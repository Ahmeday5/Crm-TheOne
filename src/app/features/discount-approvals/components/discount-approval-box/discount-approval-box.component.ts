import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, filter, map, merge, of, tap } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { NotificationsStore } from '../../../../core/services/notifications.store';
import { ToastService } from '../../../../core/services/toast.service';
import { copyToClipboard } from '../../../../shared/components/copy-button/copy-button.component';
import { notificationTypeName } from '../../../../shared/models/notifications/notification.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DISCOUNT_SAVE_REASONS, DiscountApprovalsService } from '../../data/discount-approvals.gateway';
import {
  DEFAULT_DISCOUNT_THRESHOLD_PERCENT,
  DiscountApproval,
  DiscountApprovalType,
  DiscountBinding,
} from '../../models/discount-approvals.models';
import { buildApprovalRequestText } from '../../utils/discount-messages.util';
import {
  bindingKey,
  discountPercent,
  formatPercent,
  isCompleteCode,
  normalizeCode,
  round2,
  whatsAppShareUrl,
} from '../../utils/discount.util';

/** What the host form needs: block the save until `ready`, send `code` as `approvalCode`. */
export interface DiscountGateState {
  /** The discount is above the limit for this (non-Admin) user. */
  required: boolean;
  /** Save may proceed (nothing required, or a valid code for the current values). */
  ready: boolean;
  /** The code to send as `approvalCode` — `null` when not required. */
  code: string | null;
}

/**
 * "الخصم ده محتاج موافقة المدير" — the yellow box under a discount
 * (price quotation + payment link). Renders nothing for Admins or while the
 * discount is within the limit.
 *
 *   step 1  create `POST DiscountApprovals` and send it to the manager
 *           (WhatsApp share or copy);
 *   step 2  type the 6-digit code → green "approved" state.
 *
 * The code is bound to type + customer + amount + discount: changing any of
 * them after the request makes it stale (a new request is needed). The code
 * fills itself when the decision arrives (`DiscountApprovalDecided`, or a
 * mock-store change from another tab).
 */
@Component({
  selector: 'app-discount-approval-box',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discount-approval-box.component.html',
  styleUrl: './discount-approval-box.component.scss',
})
export class DiscountApprovalBoxComponent {
  private readonly approvals = inject(DiscountApprovalsService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NotificationsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly type = input.required<DiscountApprovalType>();
  readonly customerId = input<number | null>(null);
  readonly customerName = input<string | null>(null);
  /** Total BEFORE the discount. */
  readonly amount = input<number>(0);
  readonly discount = input<number>(0);
  /** Quotation id when editing. */
  readonly referenceId = input<number | null>(null);
  /** Editing: the saved discount — not increasing it needs no approval (§9.3). */
  readonly baselineDiscount = input<number | null>(null);
  /** A customer is mandatory for this type before a request can be sent. */
  readonly customerRequired = input(true);

  readonly stateChange = output<DiscountGateState>();

  protected readonly threshold = toSignal(this.approvals.threshold$, { initialValue: DEFAULT_DISCOUNT_THRESHOLD_PERCENT });
  private readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  protected readonly percent = computed(() => discountPercent(this.amount(), this.discount()));
  protected readonly percentText = computed(() => formatPercent(this.percent()));

  readonly required = computed(() => {
    if (this.isAdmin()) return false;
    const amount = Number(this.amount()) || 0;
    const discount = Number(this.discount()) || 0;
    if (amount <= 0 || discount <= 0) return false;
    const baseline = this.baselineDiscount();
    if (baseline != null && discount <= baseline) return false;
    return this.percent() > this.threshold();
  });

  private readonly binding = computed<DiscountBinding>(() => ({
    type: this.type(),
    customerId: this.customerId(),
    amount: round2(this.amount()),
    discount: round2(this.discount()),
  }));
  private readonly key = computed(() => bindingKey(this.binding()));

  /** Last request made from this form, with the values it was made for. */
  protected readonly approval = signal<DiscountApproval | null>(null);
  private readonly approvalKey = signal<string | null>(null);
  protected readonly active = computed(() => (this.approvalKey() === this.key() ? this.approval() : null));
  protected readonly stale = computed(() => !!this.approval() && this.approvalKey() !== this.key());

  protected readonly busy = signal<'whatsapp' | 'copy' | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly code = signal('');
  protected readonly codeError = signal<string | null>(null);
  protected readonly autoFilled = signal(false);
  private readonly verified = signal<{ code: string; key: string } | null>(null);

  protected readonly approvedCode = computed(() => {
    const v = this.verified();
    return v && v.key === this.key() ? v.code : null;
  });
  readonly ready = computed(() => !this.required() || !!this.approvedCode());
  protected readonly canRequest = computed(
    () => (!this.customerRequired() || this.customerId() != null) && (Number(this.amount()) || 0) > 0,
  );

  constructor() {
    // Tell the host whenever the gate opens / closes.
    effect(() => {
      const state: DiscountGateState = { required: this.required(), ready: this.ready(), code: this.required() ? this.approvedCode() : null };
      untracked(() => this.stateChange.emit(state));
    });

    // New values → the typed code no longer applies.
    effect(() => {
      const key = this.key();
      untracked(() => {
        if (this.verified()?.key !== key) {
          this.code.set('');
          this.codeError.set(null);
          this.autoFilled.set(false);
        }
      });
    });

    // The manager decided → refetch and fill the code by itself.
    this.notifications.arrivals$
      .pipe(
        map((batch) =>
          batch.find(
            (n) => notificationTypeName(n.type) === 'DiscountApprovalDecided' && n.relatedEntityId === this.approval()?.id,
          ),
        ),
        filter((n) => !!n),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((n) => {
        // The payload carries the code — fill it at once; the refetch updates status / expiry.
        const code = typeof n?.data?.['code'] === 'string' ? (n.data['code'] as string) : null;
        if (code && !this.approvedCode() && !this.code()) {
          this.onCode(code);
          this.autoFilled.set(true);
        }
        this.refresh();
      });
  }

  /**
   * The save failed: when the server refused the code (§9.3 messages), show
   * it under the code input and close the gate again. Returns true when the
   * error was about the approval.
   */
  handleSaveError(err: ApiError | null | undefined): boolean {
    if (!err?.reason || !DISCOUNT_SAVE_REASONS.has(err.reason)) return false;
    this.verified.set(null);
    this.codeError.set(err.message || this.t('common.loadFailed'));
    return true;
  }

  /** Forget the request and the code (the host form was reset for a new item). */
  reset(): void {
    this.approval.set(null);
    this.approvalKey.set(null);
    this.verified.set(null);
    this.code.set('');
    this.codeError.set(null);
    this.error.set(null);
    this.autoFilled.set(false);
    this.busy.set(null);
  }

  // ─────────── step 1 ───────────

  protected sendWhatsApp(): void {
    if (this.busy()) return;
    const existing = this.reusable();
    if (existing) {
      window.open(whatsAppShareUrl(this.requestText(existing)), '_blank', 'noopener');
      return;
    }
    // Open the tab inside the click (popup blockers), point it at WhatsApp once the request exists.
    const tab = window.open('', '_blank');
    this.busy.set('whatsapp');
    this.ensureRequest().subscribe({
      next: (a) => {
        this.busy.set(null);
        const url = whatsAppShareUrl(this.requestText(a));
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          window.open(url, '_blank', 'noopener');
        }
      },
      error: (err: ApiError) => {
        this.busy.set(null);
        tab?.close();
        this.error.set(err?.message || this.t('common.loadFailed'));
      },
    });
  }

  protected copyRequest(): void {
    if (this.busy()) return;
    this.busy.set('copy');
    this.ensureRequest().subscribe({
      next: async (a) => {
        const ok = await copyToClipboard(this.requestText(a));
        this.busy.set(null);
        if (ok) this.toast.success(this.t('discounts.box.copied'));
        else this.toast.error(this.t('discounts.box.copyFailed'));
      },
      error: (err: ApiError) => {
        this.busy.set(null);
        this.error.set(err?.message || this.t('common.loadFailed'));
      },
    });
  }

  protected requestAgain(): void {
    this.approval.set(null);
    this.approvalKey.set(null);
    this.error.set(null);
  }

  // ─────────── step 2 ───────────

  protected onCode(raw: string): void {
    const code = normalizeCode(raw);
    this.code.set(code);
    this.codeError.set(null);
    this.autoFilled.set(false);
    if (isCompleteCode(code)) this.verify(code);
  }

  protected changeCode(): void {
    this.verified.set(null);
    this.code.set('');
    this.codeError.set(null);
    this.autoFilled.set(false);
  }

  /** The server checks the code on save (single use, same customer / amount / discount). */
  private verify(code: string): void {
    this.verified.set({ code, key: this.key() });
  }

  // ─────────── helpers ───────────

  /** The current request when it can still lead to a code (pending / approved). */
  private reusable(): DiscountApproval | null {
    const a = this.active();
    return a && (a.status === 'Pending' || a.status === 'Approved') ? a : null;
  }

  private ensureRequest(): Observable<DiscountApproval> {
    this.error.set(null);
    const existing = this.reusable();
    if (existing) return of(existing);
    const key = this.key();
    const b = this.binding();
    return this.approvals.gateway
      .create({ type: b.type, customerId: b.customerId, amount: b.amount, discount: b.discount, referenceId: this.referenceId() })
      .pipe(
        tap((a) => {
          this.approval.set(a);
          this.approvalKey.set(key);
        }),
      );
  }

  private refresh(): void {
    const current = this.approval();
    if (!current) return;
    this.approvals.gateway.get(current.id).subscribe({
      next: (a) => {
        if (this.approval()?.id !== a.id) return;
        this.approval.set(a);
        const usable = this.approvalKey() === this.key() && a.status === 'Approved' && a.code;
        if (usable && !this.approvedCode() && !this.code()) {
          this.onCode(a.code!);
          this.autoFilled.set(true);
        }
      },
      error: () => undefined,
    });
  }

  private requestText(a: DiscountApproval): string {
    const name = this.customerName()?.trim();
    const withName = name && a.customerName === '—' ? { ...a, customerName: name } : a;
    return buildApprovalRequestText(withName, this.language.lang(), this.auth.currentUser()?.fullName ?? null);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
