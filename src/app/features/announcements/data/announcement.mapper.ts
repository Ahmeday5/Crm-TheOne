import { UserRole } from '../../../core/models/auth.model';
import { serverDay, serverInstantToIso } from '../../../core/utils/cairo-time.util';
import {
  ANNOUNCEMENT_TARGETS,
  Announcement,
  AnnouncementDto,
  AnnouncementReader,
  AnnouncementTarget,
} from '../models/announcement.models';

/**
 * DTO → domain. Runs once at the HTTP / hub boundary so the UI never sees
 * zone-less Cairo timestamps or unexpected shapes.
 */
export function toAnnouncement(dto: AnnouncementDto): Announcement {
  const startsOn = serverDay(dto.startDate) ?? '';
  return {
    id: Number(dto.id),
    title: dto.title ?? '',
    body: dto.body ?? '',
    target: toTarget(dto.targetRole),
    isPinned: !!dto.isPinned,
    startsOn,
    endsOn: serverDay(dto.endDate) ?? startsOn,
    isActive: !!dto.isActive,
    isRead: !!dto.isRead,
    authorName: dto.createdByName?.trim() || null,
    createdAt: serverInstantToIso(dto.createdAt) ?? dto.createdAt,
    readCount: numberOrNull(dto.readCount),
    targetCount: numberOrNull(dto.targetCount),
  };
}

export function toReader(raw: AnnouncementReader): AnnouncementReader {
  return {
    userId: String(raw.userId ?? ''),
    fullName: raw.fullName ?? '',
    hasRead: !!raw.hasRead,
    readAt: serverInstantToIso(raw.readAt),
  };
}

/** Case-insensitive role match; anything unknown means "everyone". */
function toTarget(raw: string | null | undefined): AnnouncementTarget {
  if (!raw) return null;
  const match = ANNOUNCEMENT_TARGETS.find((t) => t?.toLowerCase() === raw.trim().toLowerCase());
  return (match ?? null) as UserRole | null;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
