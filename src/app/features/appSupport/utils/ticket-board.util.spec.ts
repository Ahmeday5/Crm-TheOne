import { SupportTicketPriority, SupportTicketStatus } from '../../../shared/models';
import {
  BOARD_COLUMNS,
  defaultFollowUpLocal,
  isFollowUpOverdue,
  moveRequest,
  needsFollowUp,
  ticketAgeDays,
} from './ticket-board.util';

const ticket = {
  title: 'Printer down',
  description: 'details',
  serviceId: 7,
  priority: SupportTicketPriority.High,
  nextFollowUpDate: '2026-11-16T08:00:00Z' as string | null,
};

describe('ticket board rules', () => {
  it('has one column per status, in workflow order', () => {
    expect(BOARD_COLUMNS.map((c) => c.meta.enumName)).toEqual(['Open', 'InProgress', 'WaitingCustomer', 'Resolved', 'Closed']);
    expect(BOARD_COLUMNS.find((c) => c.meta.value === SupportTicketStatus.Resolved)?.tone).toBe('success');
  });

  it('only Open needs a follow-up date', () => {
    expect(needsFollowUp(SupportTicketStatus.Open)).toBeTrue();
    expect(needsFollowUp(SupportTicketStatus.Resolved)).toBeFalse();
  });

  it('carries every field over and changes only the status', () => {
    expect(moveRequest(ticket, SupportTicketStatus.InProgress)).toEqual({
      title: 'Printer down',
      description: 'details',
      serviceId: 7,
      priority: SupportTicketPriority.High,
      status: SupportTicketStatus.InProgress,
      nextFollowUpDate: null,
    });
  });

  it('moving to Open uses the picked follow-up (or keeps the existing one)', () => {
    expect(moveRequest(ticket, SupportTicketStatus.Open, '2026-11-20T08:00:00.000Z').nextFollowUpDate).toBe('2026-11-20T08:00:00.000Z');
    expect(moveRequest(ticket, SupportTicketStatus.Open).nextFollowUpDate).toBe('2026-11-16T08:00:00Z');
    expect(moveRequest({ ...ticket, nextFollowUpDate: null }, SupportTicketStatus.Open).nextFollowUpDate).toBeNull();
  });

  it('computes age and overdue follow-ups', () => {
    const now = Date.parse('2026-11-15T12:00:00Z');
    expect(ticketAgeDays('2026-11-15T09:00:00Z', now)).toBe(0);
    expect(ticketAgeDays('2026-11-10T12:00:00Z', now)).toBe(5);
    expect(isFollowUpOverdue({ status: SupportTicketStatus.Open, nextFollowUpDate: '2026-11-15T08:00:00Z' }, now)).toBeTrue();
    expect(isFollowUpOverdue({ status: SupportTicketStatus.Open, nextFollowUpDate: '2026-11-16T08:00:00Z' }, now)).toBeFalse();
    expect(isFollowUpOverdue({ status: SupportTicketStatus.Resolved, nextFollowUpDate: '2026-11-01T08:00:00Z' }, now)).toBeFalse();
  });

  it('defaults a re-opened ticket to tomorrow 10:00', () => {
    expect(defaultFollowUpLocal(new Date(2026, 10, 15, 18, 30))).toBe('2026-11-16T10:00');
  });
});
