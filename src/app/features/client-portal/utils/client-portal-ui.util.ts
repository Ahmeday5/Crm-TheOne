import {
  CredentialEnvironment,
  CredentialKind,
  ReleasePlatform,
  ReleaseStage,
  RequestPriority,
  RequestStatus,
  RequestType,
  ScheduleHealth,
} from '../models/client-portal.models';

export function requestStatusClass(status: RequestStatus): string {
  switch (status) {
    case 'PendingReview': return 'bg-warning-subtle text-warning';
    case 'NeedsClarification': return 'bg-danger-subtle text-danger';
    case 'Open': return 'bg-primary-subtle text-primary';
    case 'InReview': return 'bg-info-subtle text-info';
    case 'InProgress': return 'bg-primary-subtle text-primary';
    case 'Resolved': return 'bg-success-subtle text-success';
    case 'Closed': return 'bg-secondary-subtle text-secondary';
    case 'Rejected': return 'bg-secondary-subtle text-secondary';
  }
}

export function requestStatusIcon(status: RequestStatus): string {
  switch (status) {
    case 'PendingReview': return 'fa-solid fa-hourglass-half';
    case 'NeedsClarification': return 'fa-solid fa-circle-question';
    case 'Open': return 'fa-solid fa-circle-check';
    case 'InReview': return 'fa-solid fa-magnifying-glass';
    case 'InProgress': return 'fa-solid fa-screwdriver-wrench';
    case 'Resolved': return 'fa-solid fa-check-double';
    case 'Closed': return 'fa-solid fa-lock';
    case 'Rejected': return 'fa-solid fa-ban';
  }
}

/** Tone token for status-coloured surfaces (banners, timeline chips). */
export function requestStatusTone(status: RequestStatus): 'warning' | 'danger' | 'brand' | 'info' | 'success' | 'muted' {
  switch (status) {
    case 'PendingReview': return 'warning';
    case 'NeedsClarification': return 'danger';
    case 'Open':
    case 'InProgress': return 'brand';
    case 'InReview': return 'info';
    case 'Resolved': return 'success';
    case 'Closed':
    case 'Rejected': return 'muted';
  }
}

export function requestPriorityClass(priority: RequestPriority | null): string {
  switch (priority) {
    case 'High': return 'bg-danger-subtle text-danger';
    case 'Medium': return 'bg-warning-subtle text-warning';
    case 'Low': return 'bg-info-subtle text-info';
    default: return 'bg-secondary-subtle text-secondary';
  }
}

export function requestTypeIcon(type: RequestType): string {
  switch (type) {
    case 'Issue': return 'fa-solid fa-bug';
    case 'ChangeRequest': return 'fa-solid fa-pen-ruler';
    case 'Question': return 'fa-solid fa-circle-question';
  }
}

// ─────────── schedule health ───────────

export function healthTone(h: ScheduleHealth): 'success' | 'warning' | 'danger' | 'brand' {
  switch (h) {
    case 'OnTrack': return 'brand';
    case 'AtRisk': return 'warning';
    case 'Delayed': return 'danger';
    case 'Completed': return 'success';
  }
}

export function healthIcon(h: ScheduleHealth): string {
  switch (h) {
    case 'OnTrack': return 'fa-solid fa-circle-check';
    case 'AtRisk': return 'fa-solid fa-triangle-exclamation';
    case 'Delayed': return 'fa-solid fa-clock';
    case 'Completed': return 'fa-solid fa-trophy';
  }
}

// ─────────── deliverables ───────────

export function platformIcon(p: ReleasePlatform): string {
  switch (p) {
    case 'Android': return 'fa-brands fa-android';
    case 'iOS': return 'fa-brands fa-apple';
    case 'Web': return 'fa-solid fa-globe';
    case 'Desktop': return 'fa-solid fa-desktop';
    default: return 'fa-solid fa-cube';
  }
}

export function stageClass(s: ReleaseStage): string {
  switch (s) {
    case 'Production': return 'bg-success-subtle text-success';
    case 'ReleaseCandidate': return 'bg-primary-subtle text-primary';
    case 'Beta': return 'bg-info-subtle text-info';
    case 'Internal': return 'bg-secondary-subtle text-secondary';
  }
}

export function credentialIcon(k: CredentialKind): string {
  switch (k) {
    case 'WebDashboard': return 'fa-solid fa-gauge-high';
    case 'Website': return 'fa-solid fa-globe';
    case 'AdminPanel': return 'fa-solid fa-user-shield';
    case 'Api': return 'fa-solid fa-plug';
    default: return 'fa-solid fa-key';
  }
}

export function environmentClass(e: CredentialEnvironment): string {
  switch (e) {
    case 'Production': return 'bg-success-subtle text-success';
    case 'Staging': return 'bg-warning-subtle text-warning';
    case 'Demo': return 'bg-info-subtle text-info';
  }
}

/** `38412288` → `36.6 MB`. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Host part of a URL for compact display (`demo.theone.com`). */
export function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
