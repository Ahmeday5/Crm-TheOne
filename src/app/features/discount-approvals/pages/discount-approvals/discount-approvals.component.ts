import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { NotificationsStore } from '../../../../core/services/notifications.store';
import { ToastService } from '../../../../core/services/toast.service';
import { copyToClipboard } from '../../../../shared/components/copy-button/copy-button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RefreshButtonComponent } from '../../../../shared/components/refresh-button/refresh-button.component';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { notificationTypeName } from '../../../../shared/models/notifications/notification.model';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DiscountApprovalsService } from '../../data/discount-approvals.gateway';
import { DiscountDraftsService } from '../../data/discount-drafts.service';
import {
  DEFAULT_DISCOUNT_THRESHOLD_PERCENT,
  DISCOUNT_APPROVAL_STATUSES,
  DiscountApproval,
  DiscountApprovalStatus,
} from '../../models/discount-approvals.models';
import { buildApprovalCodeText } from '../../utils/discount-messages.util';
import { formatMoney, formatPercent, whatsAppShareUrl } from '../../utils/discount.util';

const STATUS_TONE: Record<DiscountApprovalStatus, string> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Used: 'info',
  Expired: 'secondary',
};

/**
 * `/discount-approvals[/:id]` — Admin decides discount requests above the
 * limit (docs/backend-prompt-inbox-v4.md §9.2). With `:id` the request card
 * sits on top (approve → big code to send back; reject → reason); the table
 * below lists every request (server data in live mode).
 */
@Component({
  selector: 'app-discount-approvals',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    CairoDatePipe,
    PageHeaderComponent,
    PaginationComponent,
    RefreshButtonComponent,
    ModalComponent,
    ResponsiveTableDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discount-approvals.component.html',
  styleUrl: './discount-approvals.component.scss',
})
export class DiscountApprovalsComponent {
  private readonly service = inject(DiscountApprovalsService);
  private readonly gateway = this.service.gateway;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly notifications = inject(NotificationsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly drafts = inject(DiscountDraftsService);

  /** Admins decide; everyone else sees their own requests (and their codes). */
  protected readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  // ── sales rules (Admin) ──
  protected readonly rules = this.service.rules;
  protected readonly rulesOpen = signal(false);
  protected readonly rulesSaving = signal(false);
  protected readonly rulesError = signal<string | null>(null);
  protected rulesThreshold = 10;
  protected rulesMinutes = 60;

  protected readonly statuses = DISCOUNT_APPROVAL_STATUSES;
  protected readonly formatMoney = formatMoney;
  protected readonly formatPercent = formatPercent;
  protected readonly threshold = toSignal(this.service.threshold$, { initialValue: DEFAULT_DISCOUNT_THRESHOLD_PERCENT });

  // ── list ──
  protected readonly status = signal<DiscountApprovalStatus | null>(null);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly rows = signal<DiscountApproval[]>([]);
  protected readonly count = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly isEmpty = computed(() => !this.loading() && !this.error() && this.rows().length === 0);

  // ── selected request (`:id`) ──
  private readonly idParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: null });
  protected readonly selectedId = computed(() => {
    const n = Number(this.idParam());
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  protected readonly selected = signal<DiscountApproval | null>(null);
  protected readonly selectedLoading = signal(false);
  protected readonly selectedError = signal<string | null>(null);
  protected readonly deciding = signal<'approve' | 'reject' | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly rejectOpen = signal(false);
  protected rejectReason = '';

  constructor() {
    effect(() => {
      const id = this.selectedId();
      untracked(() => {
        this.actionError.set(null);
        if (id == null) {
          this.selected.set(null);
          this.selectedError.set(null);
        } else {
          this.loadSelected(id, true);
        }
      });
    });

    this.load();

    // A request arrived / was decided → refresh the list and the open card.
    this.notifications.arrivals$
      .pipe(
        filter((batch) => batch.some((n) => String(notificationTypeName(n.type)).startsWith('DiscountApproval'))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.refreshAll(false));
  }

  // ─────────── continue where the rep left off ───────────

  /** The rep's own approved request, with the form still saved in this browser. */
  protected canContinue(a: DiscountApproval): boolean {
    return (
      a.status === 'Approved' &&
      !!a.code &&
      a.requestedById === this.auth.currentUser()?.userId &&
      this.drafts.has(a.id)
    );
  }

  protected continueRequest(a: DiscountApproval): void {
    if (a.type === 'PriceQuotation') {
      void this.router.navigate(['/price-offers'], { queryParams: { resumeApproval: a.id } });
      return;
    }
    const chatId = this.drafts.get(a.id, 'PaymentRequest')?.payload.chatId;
    if (chatId) void this.router.navigate(['/whatsapp', 'chats', chatId], { queryParams: { resumeApproval: a.id } });
  }

  /** Bring the opened request into view (it sits above the table). */
  protected scrollToCard(): void {
    setTimeout(() => document.querySelector('.dap-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  // ─────────── sales rules (Admin) ───────────

  protected openRules(): void {
    const r = this.rules();
    this.rulesThreshold = r.discountApprovalThresholdPercent;
    this.rulesMinutes = r.awaitingReplyThresholdMinutes;
    this.rulesError.set(null);
    this.rulesOpen.set(true);
  }

  protected saveRules(): void {
    if (this.rulesSaving()) return;
    this.rulesSaving.set(true);
    this.rulesError.set(null);
    this.service
      .saveRules({
        discountApprovalThresholdPercent: Number(this.rulesThreshold),
        awaitingReplyThresholdMinutes: Number(this.rulesMinutes),
      })
      .subscribe({
        next: () => {
          this.rulesSaving.set(false);
          this.rulesOpen.set(false);
          this.toast.success(this.t('discounts.rules.saved'));
        },
        error: (err: ApiError) => {
          this.rulesSaving.set(false);
          this.rulesError.set(err?.message || this.t('common.loadFailed'));
        },
      });
  }

  // ─────────── data ───────────

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.gateway
      .list({ status: this.status(), pageIndex: this.pageIndex(), pageSize: this.pageSize() })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  private loadSelected(id: number, showSpinner: boolean): void {
    if (showSpinner) this.selectedLoading.set(true);
    this.selectedError.set(null);
    this.gateway.get(id).subscribe({
      next: (a) => {
        if (this.selectedId() !== id) return;
        this.selected.set(a);
        this.selectedLoading.set(false);
      },
      error: (err: ApiError) => {
        if (this.selectedId() !== id) return;
        this.selected.set(null);
        this.selectedLoading.set(false);
        this.selectedError.set(err?.message || this.t('discounts.page.notFound'));
      },
    });
  }

  protected refreshAll(spinner = true): void {
    this.load();
    const id = this.selectedId();
    if (id != null) this.loadSelected(id, spinner);
  }

  protected setStatus(status: DiscountApprovalStatus | null): void {
    this.status.set(status);
    this.pageIndex.set(1);
    this.load();
  }

  protected onPage(index: number): void {
    this.pageIndex.set(index);
    this.load();
  }

  protected onPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.load();
  }

  // ─────────── decisions ───────────

  protected approve(a: DiscountApproval): void {
    if (this.deciding()) return;
    this.deciding.set('approve');
    this.actionError.set(null);
    this.gateway.approve(a.id).subscribe({
      next: (updated) => {
        this.deciding.set(null);
        this.selected.set(updated);
        this.toast.success(this.t('discounts.page.approvedToast'));
        this.load();
      },
      error: (err: ApiError) => {
        this.deciding.set(null);
        this.actionError.set(err?.message || this.t('common.loadFailed'));
      },
    });
  }

  protected openReject(): void {
    this.rejectReason = '';
    this.rejectOpen.set(true);
  }

  protected confirmReject(a: DiscountApproval): void {
    const reason = this.rejectReason.trim();
    if (!reason || this.deciding()) return;
    this.deciding.set('reject');
    this.actionError.set(null);
    this.gateway.reject(a.id, reason).subscribe({
      next: (updated) => {
        this.deciding.set(null);
        this.rejectOpen.set(false);
        this.selected.set(updated);
        this.toast.success(this.t('discounts.page.rejectedToast'));
        this.load();
      },
      error: (err: ApiError) => {
        this.deciding.set(null);
        this.rejectOpen.set(false);
        this.actionError.set(err?.message || this.t('common.loadFailed'));
      },
    });
  }

  // ─────────── code hand-off ───────────

  protected sendCode(a: DiscountApproval): void {
    window.open(whatsAppShareUrl(buildApprovalCodeText(a, this.language.lang())), '_blank', 'noopener');
  }

  protected async copyCode(a: DiscountApproval): Promise<void> {
    if (!a.code) return;
    const ok = await copyToClipboard(a.code);
    if (ok) this.toast.success(this.t('discounts.page.codeCopied'));
    else this.toast.error(this.t('discounts.box.copyFailed'));
  }

  protected closeSelected(): void {
    this.router.navigate(['/discount-approvals']);
  }

  // ─────────── view helpers ───────────

  protected tone(status: DiscountApprovalStatus): string {
    return STATUS_TONE[status] ?? 'secondary';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
