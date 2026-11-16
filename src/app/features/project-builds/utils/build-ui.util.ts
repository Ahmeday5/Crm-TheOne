import { BuildPlatform, BuildStatus } from '../models/project-build.models';

/** Human file size, e.g. 8.4 MB. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Subtle-badge class for a build's push status. */
export function buildStatusClass(status: BuildStatus): string {
  switch (status) {
    case 'Pushed': return 'bg-success-subtle text-success';
    case 'Failed': return 'bg-danger-subtle text-danger';
    case 'Uploading':
    case 'Pending': return 'bg-info-subtle text-info';
    default: return 'bg-secondary-subtle text-secondary';
  }
}

/** i18n key for a build status label. */
export function buildStatusKey(status: BuildStatus): string {
  return `projectBuilds.status.${status.toLowerCase()}`;
}

/** Font-Awesome icon for a platform. */
export function platformIcon(platform: BuildPlatform): string {
  switch (platform) {
    case 'Android': return 'fa-brands fa-android';
    case 'iOS': return 'fa-brands fa-apple';
    case 'Web': return 'fa-solid fa-globe';
    case 'Backend': return 'fa-solid fa-server';
    default: return 'fa-solid fa-cube';
  }
}
