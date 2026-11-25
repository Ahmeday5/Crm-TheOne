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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { LanguageService } from '../../../../core/services/language.service';
import { CreatedAtComponent } from '../../../../shared/components/created-at/created-at.component';
import { CustomerDetails, SupportTicket, SupportTicketListQuery } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupportTicketsService } from '../../../appSupport/services/support-tickets.service';
import { ChangeStatusDialogComponent } from '../../../leads/components/change-status-dialog/change-status-dialog.component';
import { CustomersService } from '../../../leads/services/customers.service';
import { customerStatusBadgeClass, resolveCustomerStatus } from '../../../leads/utils/customer-status.util';
import { WaChat } from '../../models/whatsapp.models';
import { compareByIso, labelMeta } from '../../utils/inbox-tools.util';
import { formatWhatsAppPhone } from '../../utils/whatsapp.util';

/** How many support tickets the card lists (§7). */
const TICKETS_SHOWN = 3;

/**
 * The customer card beside the open chat (inbox v4 §7): who they are
 * (`GET Customers/{id}/getCustomerById`), their last support tickets, and
 * this chat's labels / reminder / notes. «تغيير الحالة» opens the shared
 * status dialog; «الملف الكامل» asks the inbox to open the details dialog.
 * An unlinked chat shows the add-customer call to action instead.
 *
 * Layout (third column vs. drawer) is the inbox's job.
 */
@Component({
  selector: 'app-wa-customer-panel',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, CreatedAtComponent, ChangeStatusDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-customer-panel.component.html',
  styleUrl: './wa-customer-panel.component.scss',
})
export class WaCustomerPanelComponent {
  private readonly customers = inject(CustomersService);
  private readonly tickets = inject(SupportTicketsService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chat = input.required<WaChat>();
  /** Admin / Sales with permission on this chat: add customer, change status. */
  readonly canEdit = input(false);
  readonly closed = output<void>();
  readonly addCustomer = output<void>();
  readonly openProfile = output<number>();

  protected readonly customer = signal<CustomerDetails | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly recentTickets = signal<SupportTicket[]>([]);
  protected readonly ticketsLoading = signal(false);
  protected readonly ticketsError = signal(false);
  protected readonly statusOpen = signal(false);

  protected readonly labels = computed(() => (this.chat().labels ?? []).map(labelMeta));
  protected readonly statusText = computed(() =>
    resolveCustomerStatus(this.customer()?.statusName ?? null, this.language.lang(), '—'),
  );
  protected readonly statusClass = computed(() => customerStatusBadgeClass(this.customer()?.statusName ?? null));
  protected readonly hasTeamNotes = computed(() => {
    const c = this.customer();
    return !!(c?.noteMarketing?.trim() || c?.noteSales?.trim() || c?.noteSupport?.trim());
  });

  private customerSub: Subscription | null = null;
  private ticketsSub: Subscription | null = null;

  constructor() {
    effect(
      () => {
        const id = this.chat().customerId;
        untracked(() => this.load(id));
      },
      { allowSignalWrites: true },
    );
  }

  protected phone(value: string | null | undefined): string {
    return formatWhatsAppPhone(value) || value || '';
  }

  protected reload(): void {
    this.load(this.chat().customerId);
  }

  protected onStatusChanged(): void {
    this.statusOpen.set(false);
    this.reload();
  }

  private load(customerId: number | null): void {
    this.customerSub?.unsubscribe();
    this.ticketsSub?.unsubscribe();
    this.customer.set(null);
    this.recentTickets.set([]);
    this.error.set(false);
    this.ticketsError.set(false);
    this.statusOpen.set(false);
    if (!customerId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.customerSub = this.customers
      .getById(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.loading.set(false);
          this.customer.set(c);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });

    // §7 asks the backend to support `customerId` on GetTickets — sent as-is,
    // and the rows are narrowed here too in case an older build ignores it.
    const query = { PageIndex: 1, PageSize: TICKETS_SHOWN, customerId } as SupportTicketListQuery;
    this.ticketsLoading.set(true);
    this.ticketsSub = this.tickets
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.ticketsLoading.set(false);
          const rows = Array.isArray(page?.data) ? page.data : [];
          this.recentTickets.set(
            rows
              .filter((t) => t.customerId === customerId)
              .sort((a, b) => compareByIso(b.createdAt, a.createdAt))
              .slice(0, TICKETS_SHOWN),
          );
        },
        error: () => {
          this.ticketsLoading.set(false);
          this.ticketsError.set(true);
        },
      });
  }
}
