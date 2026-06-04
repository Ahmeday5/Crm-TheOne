import { HealthStatus, SessionStatus } from './session.model';

/**
 * Shared mapping of session status / health values to i18n keys and Bootstrap
 * subtle-badge classes — kept in one place so the list and detail views render
 * indicators identically.
 */

export function statusLabelKey(status: SessionStatus): string {
  switch (status) {
    case 'connected': return 'whatsapp.status.connected';
    case 'connecting': return 'whatsapp.status.connecting';
    case 'disconnected': return 'whatsapp.status.disconnected';
    default: return 'whatsapp.status.unknown';
  }
}

export function statusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case 'connected': return 'bg-success-subtle text-success';
    case 'connecting': return 'bg-warning-subtle text-warning';
    case 'disconnected': return 'bg-danger-subtle text-danger';
    default: return 'bg-secondary-subtle text-secondary';
  }
}

export function healthLabelKey(health: HealthStatus): string {
  switch (health) {
    case 'healthy': return 'whatsapp.health.healthy';
    case 'warning': return 'whatsapp.health.warning';
    case 'offline': return 'whatsapp.health.offline';
    default: return 'whatsapp.health.unknown';
  }
}

export function healthBadgeClass(health: HealthStatus): string {
  switch (health) {
    case 'healthy': return 'bg-success-subtle text-success';
    case 'warning': return 'bg-warning-subtle text-warning';
    case 'offline': return 'bg-danger-subtle text-danger';
    default: return 'bg-secondary-subtle text-secondary';
  }
}
