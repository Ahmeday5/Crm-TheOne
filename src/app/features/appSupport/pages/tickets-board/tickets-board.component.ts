import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import {
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_MAP,
  SupportTicket,
  SupportTicketListQuery,
  SupportTicketPriorityName,
  SupportTicketStatistics,
  SupportTicketStatus,
} from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupportTicketDetailsDialogComponent } from '../../components/support-ticket-details-dialog/support-ticket-details-dialog.component';
import { SupportTicketFormDialogComponent } from '../../components/support-ticket-form-dialog/support-ticket-form-dialog.component';
import { SupportTicketsService } from '../../services/support-tickets.service';
import {
  BOARD_COLUMNS,
  BoardColumnDef,
  defaultFollowUpLocal,
  isFollowUpOverdue,
  moveRequest,
  needsFollowUp,
  ticketAgeDays,
} from '../../utils/ticket-board.util';

/** Cards each column loads per request (first load and every "load more"). */
const PER_COLUMN = 20;

interface BoardColumn extends BoardColumnDef {
  items: SupportTicket[];
  /** Server total for this status (+ current filters). */
  count: number;
  page: number;
}

/**
 * Support tickets as a Kanban board — same look and behaviour as the sales
 * pipeline: one column per status, drag a card (or use its "move to" menu)
 * to change the status. Runs on the existing endpoints only:
 * `GetTickets?Status=&Priority=&Search=` per column, `TicketStatistics`,
 * and `UpdateTicket` for moves (moving to "Open" asks for a follow-up date,
 * which the backend requires for open tickets).
 */
@Component({
  selector: 'app-tickets-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    CairoDatePipe,
    StatCardComponent,
    LoadErrorComponent,
    ModalComponent,
    TipDirective,
    ClampTextDirective,
    SupportTicketDetailsDialogComponent,
    SupportTicketFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-board.component.html',
  styleUrl: './tickets-board.component.scss',
})
export class TicketsBoardComponent implements OnInit {
  private readonly service = inject(SupportTicketsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly priorities = SUPPORT_TICKET_PRIORITIES;
  protected readonly priorityMeta = SUPPORT_TICKET_PRIORITY_MAP;
  protected readonly statusEnum = SupportTicketStatus;

  // ── filters ──
  protected searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  protected readonly search = signal('');
  protected readonly priority = signal<SupportTicketPriorityName | null>(null);
  protected readonly hasFilters = computed(() => !!this.search() || this.priority() !== null);

  // ── board ──
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly stats = signal<SupportTicketStatistics | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loadingMore = signal<SupportTicketStatus | null>(null);
  private loadSub?: Subscription;

  protected readonly overdueCount = computed(
    () => this.columns().find((c) => c.meta.value === SupportTicketStatus.Open)?.items.filter((t) => isFollowUpOverdue(t)).length ?? 0,
  );

  // ── drag & drop ──
  protected readonly dragging = signal<SupportTicket | null>(null);
  protected readonly dropTarget = signal<SupportTicketStatus | null>(null);
  protected readonly savingIds = signal<ReadonlySet<number>>(new Set());

  // ── dialogs ──
  protected readonly detailsId = signal<number | null>(null);
  protected readonly editId = signal<number | null>(null);
  /** A move to "Open" waiting for its follow-up date. */
  protected readonly reopen = signal<{ ticket: SupportTicket; when: string } | null>(null);

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.search.set(term.trim());
        this.reload();
      });
    this.reload();
  }

  // ─────────── data ───────────

  private query(status: SupportTicketStatus, page: number): SupportTicketListQuery {
    const meta = BOARD_COLUMNS.find((c) => c.meta.value === status)!.meta;
    return {
      PageIndex: page,
      PageSize: PER_COLUMN,
      Status: meta.enumName,
      Priority: this.priority() ?? undefined,
      Search: this.search() || undefined,
    };
  }

  /** Every column (one request each, in parallel) + statistics. `quiet` keeps the cards on screen. */
  protected reload(force = false, quiet = false): void {
    this.loadSub?.unsubscribe();
    if (!quiet) this.loading.set(true);
    this.loadError.set(null);

    const columns$ = forkJoin(
      BOARD_COLUMNS.map((def) =>
        this.service.list(this.query(def.meta.value, 1), force).pipe(
          map((page): BoardColumn => ({ ...def, items: page.data ?? [], count: page.count ?? 0, page: 1 })),
        ),
      ),
    );
    const stats$ = this.service.statistics(force).pipe(catchError(() => of(null)));

    this.loadSub = forkJoin({ columns: columns$, stats: stats$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ columns, stats }) => {
          this.columns.set(columns);
          if (stats) this.stats.set(stats);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          if (!quiet || !this.columns().length) this.loadError.set(this.t('support.board.loadFailed'));
        },
      });
  }

  protected loadMore(col: BoardColumn): void {
    if (this.loadingMore() !== null) return;
    this.loadingMore.set(col.meta.value);
    this.service
      .list(this.query(col.meta.value, col.page + 1))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.patchColumn(col.meta.value, (c) => {
            const known = new Set(c.items.map((i) => i.id));
            return { ...c, page: c.page + 1, count: page.count ?? c.count, items: [...c.items, ...(page.data ?? []).filter((i) => !known.has(i.id))] };
          });
          this.loadingMore.set(null);
        },
        error: () => {
          this.loadingMore.set(null);
          this.toast.error(this.t('support.board.loadFailed'));
        },
      });
  }

  private patchColumn(status: SupportTicketStatus, fn: (c: BoardColumn) => BoardColumn): void {
    this.columns.update((cols) => cols.map((c) => (c.meta.value === status ? fn(c) : c)));
  }

  // ─────────── filters ───────────

  protected onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  protected onPriorityChange(value: string): void {
    this.priority.set((value || null) as SupportTicketPriorityName | null);
    this.reload();
  }

  protected clearFilters(): void {
    this.searchTerm = '';
    this.search.set('');
    this.priority.set(null);
    this.reload();
  }

  // ─────────── drag & drop (native HTML5) ───────────

  protected onDragStart(event: DragEvent, ticket: SupportTicket): void {
    if (this.savingIds().has(ticket.id)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('text/plain', String(ticket.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.dragging.set(ticket);
  }

  protected onDragEnd(): void {
    this.dragging.set(null);
    this.dropTarget.set(null);
  }

  protected onDragOver(event: DragEvent, col: BoardColumn): void {
    const t = this.dragging();
    if (!t || t.status === col.meta.value) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTarget.set(col.meta.value);
  }

  protected onDragLeave(event: DragEvent, col: BoardColumn): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    if (this.dropTarget() === col.meta.value) this.dropTarget.set(null);
  }

  protected onDrop(event: DragEvent, col: BoardColumn): void {
    event.preventDefault();
    const t = this.dragging();
    this.onDragEnd();
    if (t) this.requestMove(t, col.meta.value);
  }

  /** Keyboard / touch path: the card's "move to" menu. */
  protected onMoveSelect(ticket: SupportTicket, value: string, select: HTMLSelectElement): void {
    select.value = '';
    if (value !== '') this.requestMove(ticket, Number(value) as SupportTicketStatus);
  }

  private requestMove(ticket: SupportTicket, target: SupportTicketStatus): void {
    if (ticket.status === target) return;
    if (needsFollowUp(target)) {
      this.reopen.set({ ticket, when: defaultFollowUpLocal() });
      return;
    }
    this.move(ticket, target, null);
  }

  protected confirmReopen(): void {
    const r = this.reopen();
    if (!r?.when) return;
    const iso = new Date(r.when).toISOString();
    this.reopen.set(null);
    this.move(r.ticket, SupportTicketStatus.Open, iso);
  }

  /** Optimistic move, then `UpdateTicket`; the board quietly re-syncs either way. */
  private move(ticket: SupportTicket, target: SupportTicketStatus, followUpIso: string | null): void {
    const targetMeta = BOARD_COLUMNS.find((c) => c.meta.value === target)!.meta;
    const moved: SupportTicket = {
      ...ticket,
      status: target,
      statusName: targetMeta.enumName,
      nextFollowUpDate: needsFollowUp(target) ? followUpIso : null,
    };
    this.columns.update((cols) =>
      cols.map((c) => {
        if (c.meta.value === ticket.status) return { ...c, count: Math.max(0, c.count - 1), items: c.items.filter((i) => i.id !== ticket.id) };
        if (c.meta.value === target) return { ...c, count: c.count + 1, items: [moved, ...c.items] };
        return c;
      }),
    );
    this.setSaving(ticket.id, true);

    this.service
      .update(ticket.id, moveRequest(ticket, target, followUpIso))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.setSaving(ticket.id, false);
          this.toast.success(
            interpolate(this.t('support.board.moved'), { no: ticket.ticketNumber, stage: this.t(targetMeta.i18nKey) }),
          );
          this.reload(true, true);
        },
        error: (err: ApiError) => {
          this.setSaving(ticket.id, false);
          this.toast.error(err?.message?.trim() || this.t('support.board.moveFailed'));
          this.reload(true, true);
        },
      });
  }

  private setSaving(id: number, on: boolean): void {
    this.savingIds.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // ─────────── dialogs ───────────

  protected openEdit(id: number): void {
    this.detailsId.set(null);
    this.editId.set(id);
  }

  protected onEdited(): void {
    this.editId.set(null);
    this.reload(true, true);
  }

  // ─────────── view helpers ───────────

  protected ageLabel(t: SupportTicket): string {
    const days = ticketAgeDays(t.createdAt);
    return days === 0 ? this.t('support.board.card.openedToday') : interpolate(this.t('support.board.card.age'), { days });
  }

  protected overdue(t: SupportTicket): boolean {
    return isFollowUpOverdue(t);
  }

  protected otherColumns(t: SupportTicket): BoardColumnDef[] {
    return BOARD_COLUMNS.filter((c) => c.meta.value !== t.status);
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
