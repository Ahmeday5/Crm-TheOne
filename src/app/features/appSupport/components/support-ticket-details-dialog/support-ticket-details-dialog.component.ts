import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  SUPPORT_TICKET_PRIORITY_MAP,
  SUPPORT_TICKET_STATUS_MAP,
  SupportTicket,
  SupportTicketPriorityMeta,
  SupportTicketStatusMeta,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupportTicketsService } from '../../services/support-tickets.service';

/**
 * Read-only ticket detail — modal dialog (no route).
 *
 * Loads the full record via `GetTicketById` so it always reflects the latest
 * server state (the list row may be a few seconds stale). Emits `edit` so the
 * host can hand off to the form dialog.
 */
@Component({
  selector: 'app-support-ticket-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-ticket-details-dialog.component.html',
  styleUrl: './support-ticket-details-dialog.component.scss',
})
export class SupportTicketDetailsDialogComponent implements OnInit {
  @Input({ required: true }) ticketId!: number;

  @Output() edit = new EventEmitter<number>();
  @Output() cancel = new EventEmitter<void>();

  private readonly service = inject(SupportTicketsService);
  private readonly language = inject(LanguageService);

  readonly ticket = signal<SupportTicket | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(this.ticketId).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('support.tickets.form.loadFailed'));
      },
    });
  }

  priorityMeta(t: SupportTicket): SupportTicketPriorityMeta | undefined {
    return SUPPORT_TICKET_PRIORITY_MAP[t.priority];
  }

  statusMeta(t: SupportTicket): SupportTicketStatusMeta | undefined {
    return SUPPORT_TICKET_STATUS_MAP[t.status];
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
