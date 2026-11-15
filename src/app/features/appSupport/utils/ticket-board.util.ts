import {
  SUPPORT_TICKET_STATUSES,
  SupportTicket,
  SupportTicketStatus,
  SupportTicketStatusMeta,
  UpdateSupportTicketRequest,
} from '../../../shared/models';

/**
 * Pure rules of the tickets Kanban board (one column per ticket status).
 * The board runs on the existing endpoints only: `GetTickets?Status=` per
 * column, `TicketStatistics`, and `UpdateTicket` for moves.
 */

export type BoardTone = 'brand' | 'info' | 'warning' | 'success' | 'muted';

export interface BoardColumnDef {
  meta: SupportTicketStatusMeta;
  tone: BoardTone;
}

const TONES: Record<SupportTicketStatus, BoardTone> = {
  [SupportTicketStatus.Open]: 'brand',
  [SupportTicketStatus.InProgress]: 'info',
  [SupportTicketStatus.WaitingCustomer]: 'warning',
  [SupportTicketStatus.Resolved]: 'success',
  [SupportTicketStatus.Closed]: 'muted',
};

/** Columns in workflow order: Open → In progress → Waiting customer → Resolved → Closed. */
export const BOARD_COLUMNS: readonly BoardColumnDef[] = SUPPORT_TICKET_STATUSES.map((meta) => ({
  meta,
  tone: TONES[meta.value],
}));

/** The backend requires a next follow-up date while a ticket is `Open` (and only then). */
export function needsFollowUp(status: SupportTicketStatus): boolean {
  return status === SupportTicketStatus.Open;
}

/**
 * `UpdateTicket` body for moving a card. The endpoint replaces the record,
 * so every field is carried over from the card; only the status (and the
 * follow-up date it implies) changes.
 */
export function moveRequest(
  ticket: Pick<SupportTicket, 'title' | 'description' | 'serviceId' | 'priority' | 'nextFollowUpDate'>,
  target: SupportTicketStatus,
  followUpIso: string | null = null,
): UpdateSupportTicketRequest {
  return {
    title: ticket.title,
    description: ticket.description ?? '',
    serviceId: ticket.serviceId,
    priority: ticket.priority,
    status: target,
    nextFollowUpDate: needsFollowUp(target) ? followUpIso ?? ticket.nextFollowUpDate ?? null : null,
  };
}

const DAY_MS = 86_400_000;

/** Whole days since the ticket was opened (0 = today). */
export function ticketAgeDays(createdAt: string, now = Date.now()): number {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY_MS)) : 0;
}

/** An open ticket whose follow-up time has passed. */
export function isFollowUpOverdue(ticket: Pick<SupportTicket, 'status' | 'nextFollowUpDate'>, now = Date.now()): boolean {
  if (ticket.status !== SupportTicketStatus.Open || !ticket.nextFollowUpDate) return false;
  const due = Date.parse(ticket.nextFollowUpDate);
  return Number.isFinite(due) && due < now;
}

/** Default follow-up for a ticket moved back to Open: tomorrow 10:00 local, as `datetime-local` text. */
export function defaultFollowUpLocal(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
