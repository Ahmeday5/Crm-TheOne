import { BuildPlatform, BuildStatus, ProjectBuild } from '../models/workspace.models';

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

export function buildStatusClass(status: BuildStatus): string {
  switch (status) {
    case 'Pushed': return 'bg-success-subtle text-success';
    case 'Failed': return 'bg-danger-subtle text-danger';
    case 'Uploading':
    case 'Pending': return 'bg-info-subtle text-info';
    default: return 'bg-secondary-subtle text-secondary';
  }
}

export function platformIcon(platform: BuildPlatform): string {
  switch (platform) {
    case 'Android': return 'fa-brands fa-android';
    case 'iOS': return 'fa-brands fa-apple';
    case 'Web': return 'fa-solid fa-globe';
    case 'Backend': return 'fa-solid fa-server';
    default: return 'fa-solid fa-cube';
  }
}

/** GitHub links the backend contract lets us build (they need GitHub access). */
export function buildTagUrl(b: Pick<ProjectBuild, 'gitRepoUrl' | 'gitTag'>): string | null {
  return b.gitRepoUrl && b.gitTag ? `${repoBase(b.gitRepoUrl)}/releases/tag/${encodeURIComponent(b.gitTag)}` : null;
}

export function buildCommitUrl(b: Pick<ProjectBuild, 'gitRepoUrl' | 'gitCommitSha'>): string | null {
  return b.gitRepoUrl && b.gitCommitSha ? `${repoBase(b.gitRepoUrl)}/commit/${b.gitCommitSha}` : null;
}

export function buildSourceZipUrl(b: Pick<ProjectBuild, 'gitRepoUrl' | 'gitTag'>): string | null {
  return b.gitRepoUrl && b.gitTag ? `${repoBase(b.gitRepoUrl)}/archive/refs/tags/${encodeURIComponent(b.gitTag)}.zip` : null;
}

function repoBase(url: string): string {
  return url.replace(/\.git\/?$/, '').replace(/\/+$/, '');
}

/** `1.4.0` → `1.4.1`; anything that doesn't end in a number is returned as is. */
export function nextPatchVersion(version: string | null | undefined): string {
  if (!version) return '1.0.0';
  const m = /^(.*?)(\d+)$/.exec(version.trim());
  return m ? `${m[1]}${Number(m[2]) + 1}` : version.trim();
}
