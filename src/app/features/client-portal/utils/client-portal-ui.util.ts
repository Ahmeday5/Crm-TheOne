import { RequestPriority, RequestStatus, RequestType } from '../models/client-portal.models';

export function requestStatusClass(status: RequestStatus): string {
  switch (status) {
    case 'Open': return 'bg-warning-subtle text-warning';
    case 'InReview': return 'bg-info-subtle text-info';
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
