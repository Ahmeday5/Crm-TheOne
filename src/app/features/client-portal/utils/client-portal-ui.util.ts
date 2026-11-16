import { RequestPriority, RequestStatus, RequestType, TimelineKind } from '../models/client-portal.models';

export function requestStatusClass(status: RequestStatus): string {
  switch (status) {
    case 'Open': return 'bg-info-subtle text-info';
    case 'InReview': return 'bg-secondary-subtle text-secondary';
    case 'InProgress': return 'bg-primary-subtle text-primary';
    case 'Resolved': return 'bg-success-subtle text-success';
    case 'Closed': return 'bg-secondary-subtle text-secondary';
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

export function timelineIcon(kind: TimelineKind): string {
  switch (kind) {
    case 'milestone': return 'fa-solid fa-flag-checkered';
    case 'release': return 'fa-solid fa-rocket';
    case 'request': return 'fa-solid fa-message';
    case 'update': return 'fa-solid fa-chart-line';
  }
}

/** Open = still needs the team. */
export function isRequestOpen(status: RequestStatus): boolean {
  return status !== 'Resolved' && status !== 'Closed';
}
