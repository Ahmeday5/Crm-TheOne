import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RefreshButtonComponent } from '../../../../shared/components/refresh-button/refresh-button.component';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { AssetUrlPipe } from '../../../../shared/pipes/asset-url.pipe';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentMethodLogoComponent } from '../../components/payment-method-logo/payment-method-logo.component';
import { PaymentsService } from '../../data/payments.gateway';
import { PAYMENT_REQUEST_STATUSES, PaymentRequest, PaymentRequestStatus } from '../../models/payments.models';
import { PaymentsInboxStore } from '../../state/payments-inbox.store';
import { publicPayUrl } from '../../utils/pay-links.util';
import { formatAmount } from '../../utils/payment-message.util';

const STATUS_TONE: Record<PaymentRequestStatus, string> = {
  Pending: 'warning',
  CustomerConfirmed: 'info',
  Paid: 'success',
  Cancelled: 'secondary',
  Expired: 'danger',
};

/**
 * `/payments` — every payment link sent from the chat. Staff confirm a
 * payment by hand once the money shows up ("Customer confirmed" first).
 *
 * Deep links (from notification type 27):
 *   `?request=<id>`                 opens that request's details;
 *   `?status=CustomerConfirmed`     pre-filters the list.
 * No realtime event exists for requests — the list refetches quietly on
 * `PaymentsInboxStore.changed$` (type-27 notification or a visible-tab poll).
 */
@Component({
  selector: 'app-payment-requests',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    CairoDatePipe,
    AssetUrlPipe,
    PageHeaderComponent,
    PaginationComponent,
    RefreshButtonComponent,
    ModalComponent,
    MockRibbonComponent,
    ResponsiveTableDirective,
    PaymentMethodLogoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-requests.component.html',
  styleUrl: './payment-requests.component.scss',
})
export class PaymentRequestsComponent implements OnInit {
  private readonly payments = inject(PaymentsService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inbox = inject(PaymentsInboxStore);

  protected readonly statuses = PAYMENT_REQUEST_STATUSES;
  protected readonly formatAmount = formatAmount;

  protected readonly rows = signal<PaymentRequest[]>([]);
  protected readonly count = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly status = signal<PaymentRequestStatus | null>(null);
  protected search = '';
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected readonly details = signal<PaymentRequest | null>(null);
  protected readonly paying = signal<PaymentRequest | null>(null);
  protected paidNote = '';
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly isEmpty = computed(() => !this.loading() && !this.error() && this.rows().length === 0);

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageIndex.set(1);
        this.load();
      });

    // Query params drive the filter / details on first load AND on later
    // notification clicks while the page is already open.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const raw = q.get('status') as PaymentRequestStatus | null;
      const nextStatus = raw && PAYMENT_REQUEST_STATUSES.includes(raw) ? raw : null;
      const requestId = Number(q.get('request'));
      if (nextStatus !== this.status()) this.pageIndex.set(1);
      this.status.set(nextStatus);
      this.load();
      if (requestId > 0) this.openById(requestId);
    });

    this.inbox.changed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(true));
  }

  /** `quiet` = background refresh: no dimming, failures keep the current rows. */
  protected load(quiet = false): void {
    if (quiet && (this.loading() || this.busy())) return;
    if (!quiet) {
      this.loading.set(true);
      this.error.set(false);
    }
    this.payments.gateway
      .requests({ pageIndex: this.pageIndex(), pageSize: this.pageSize(), status: this.status(), search: this.search })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
          this.error.set(false);
          this.syncOpenDetails();
        },
        error: () => {
          this.loading.set(false);
          if (!quiet) this.error.set(true);
        },
      });
  }

  protected onSearch(value: string): void {
    this.search$.next(value.trim());
  }

  /** Filter chips write the URL (shareable, back-button safe) — the query-param subscription loads. */
  protected setStatus(status: PaymentRequestStatus | null): void {
    if (status === this.status()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status, request: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Header refresh: the list and the sidebar badge. */
  protected refreshAll(): void {
    this.load();
    this.inbox.refresh();
  }

  /** Details always show the latest server copy (view count, payer data, receipt). */
  protected openDetails(r: PaymentRequest): void {
    this.details.set(r);
    this.openById(r.id);
  }

  protected closeDetails(): void {
    this.details.set(null);
    if (this.route.snapshot.queryParamMap.has('request')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { request: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected onPage(page: number): void {
    this.pageIndex.set(page);
    this.load();
  }

  protected onPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.load();
  }

  protected tone(status: PaymentRequestStatus): string {
    return STATUS_TONE[status];
  }

  protected link(r: PaymentRequest): string {
    return publicPayUrl(r.token);
  }

  protected canMarkPaid(r: PaymentRequest): boolean {
    return r.status === 'Pending' || r.status === 'CustomerConfirmed' || r.status === 'Expired';
  }

  protected canCancel(r: PaymentRequest): boolean {
    return r.status === 'Pending' || r.status === 'CustomerConfirmed';
  }

  protected copyLink(r: PaymentRequest): void {
    navigator.clipboard
      ?.writeText(this.link(r))
      .then(() => this.toast.success(this.t('payments.requests.linkCopied')))
      .catch(() => undefined);
  }

  protected openMarkPaid(r: PaymentRequest): void {
    this.paidNote = '';
    this.actionError.set(null);
    this.paying.set(r);
  }

  protected confirmPaid(): void {
    const r = this.paying();
    if (!r || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.payments.gateway.markPaid(r.id, this.paidNote.trim() || null).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.paying.set(null);
        this.replace(updated);
        this.toast.success(this.t('payments.requests.markedPaid'));
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.actionError.set(err?.message || this.t('common.loadFailed'));
      },
    });
  }

  protected async cancel(r: PaymentRequest): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('payments.requests.cancelTitle'),
      message: this.t('payments.requests.cancelMessage'),
      confirmText: this.t('payments.requests.cancel'),
      cancelText: this.t('common.close'),
      type: 'warning',
    });
    if (!ok) return;
    this.payments.gateway.cancel(r.id).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.toast.success(this.t('payments.requests.cancelled'));
      },
      error: (err: ApiError) => this.toast.error(err?.message || this.t('common.loadFailed')),
    });
  }

  private openById(id: number): void {
    this.payments.gateway.request(id).subscribe({
      next: (fresh) => {
        this.details.set(fresh);
        this.rows.update((list) => list.map((r) => (r.id === fresh.id ? fresh : r)));
      },
      error: (err: ApiError) => {
        if (this.details()?.id === id) return; // keep the row copy already shown
        this.toast.error(err?.message || this.t('common.loadFailed'));
        this.closeDetails();
      },
    });
  }

  /** A quiet reload may carry a newer copy of the request whose details are open. */
  private syncOpenDetails(): void {
    const open = this.details();
    const fresh = open && this.rows().find((r) => r.id === open.id);
    if (fresh) this.details.set(fresh);
  }

  private replace(updated: PaymentRequest): void {
    this.inbox.refresh();
    this.rows.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    if (this.details()?.id === updated.id) this.details.set(updated);
    // The row may no longer match the status filter.
    if (this.status() && this.status() !== updated.status) this.load();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
