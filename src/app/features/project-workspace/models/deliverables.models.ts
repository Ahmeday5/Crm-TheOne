/**
 * Project deliverables, staff side (`ManagerProjects|DeveloperProjects/{id}/…`):
 * access credentials (dashboard URL + username + password the client tries the
 * system with) and app releases (APK the client downloads). Replaces the old
 * GitHub builds.
 */
import type {
  CredentialEnvironment,
  CredentialKind,
  ReleasePlatform,
  ReleaseStage,
} from '../../client-portal/models/client-portal.models';

export type { CredentialEnvironment, CredentialKind, ReleasePlatform, ReleaseStage };

export const CREDENTIAL_KINDS: ReadonlyArray<CredentialKind> = ['WebDashboard', 'Website', 'AdminPanel', 'Api', 'Other'];
export const CREDENTIAL_ENVIRONMENTS: ReadonlyArray<CredentialEnvironment> = ['Production', 'Staging', 'Demo'];
export const RELEASE_PLATFORMS: ReadonlyArray<ReleasePlatform> = ['Android', 'iOS', 'Web', 'Desktop', 'Other'];
export const RELEASE_STAGES: ReadonlyArray<ReleaseStage> = ['Internal', 'Beta', 'ReleaseCandidate', 'Production'];

/** Who is calling — picks `ManagerProjects` or `DeveloperProjects`. */
export type WorkspaceScope = 'admin' | 'developer';

// ─────────── credentials ───────────

export interface AccessCredential {
  id: number;
  projectId: number;
  title: string;
  kind: CredentialKind;
  environment: CredentialEnvironment;
  url: string;
  username: string | null;
  /** The password itself is never listed — `reveal` fetches it. */
  hasPassword: boolean;
  notes: string | null;
  isVisibleToClient: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
}

/** POST / PUT body. `password`: `null` = unchanged (PUT), `""` = remove, value = replace. */
export interface CredentialInput {
  title: string;
  kind: CredentialKind;
  environment: CredentialEnvironment;
  url: string;
  username: string | null;
  password: string | null;
  notes: string | null;
  isVisibleToClient: boolean;
}

// ─────────── releases ───────────

export interface ProjectRelease {
  id: number;
  projectId: number;
  platform: ReleasePlatform;
  versionName: string;
  buildNumber: number;
  stage: ReleaseStage;
  releaseNotes: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileSha256: string | null;
  externalUrl: string | null;
  hasFile: boolean;
  apkPackageName: string | null;
  apkVersionCode: number | null;
  isVisibleToClient: boolean;
  isLatest: boolean;
  uploadedById: string | null;
  uploadedByName: string | null;
  downloadCount: number;
  createdAt: string;
}

export interface ReleaseListQuery {
  platform?: ReleasePlatform | null;
  stage?: ReleaseStage | null;
  pageIndex?: number;
  pageSize?: number;
}

/** Multipart POST — at least one of `file` / `externalUrl`. */
export interface NewReleaseInput {
  versionName: string;
  platform: ReleasePlatform;
  stage: ReleaseStage;
  releaseNotes: string | null;
  externalUrl: string | null;
  isVisibleToClient: boolean;
  file: File | null;
}

export interface ReleasePatch {
  stage?: ReleaseStage;
  releaseNotes?: string | null;
  externalUrl?: string | null;
  isVisibleToClient?: boolean;
}

// ─────────── validation (mirrors the backend) ───────────

export const CREDENTIAL_TITLE_MAX = 100;
export const RELEASE_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,50}$/;
export const RELEASE_NOTES_MAX = 4000;
/** `Releases:MaxFileBytes` default (300 MB). */
export const RELEASE_MAX_FILE_BYTES = 300 * 1024 * 1024;

/** Absolute http(s) URL only (no `javascript:` / `data:`). */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export type ReleaseFileProblem = 'type' | 'aab' | 'size' | 'empty';

/** Client-side pre-check; the server re-checks (incl. the ZIP magic bytes). */
export function checkReleaseFile(file: Pick<File, 'name' | 'size'>, platform: ReleasePlatform): ReleaseFileProblem | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.size === 0) return 'empty';
  if (file.size > RELEASE_MAX_FILE_BYTES) return 'size';
  if (platform === 'Android') {
    if (ext === 'aab') return 'aab';
    if (ext !== 'apk') return 'type';
  }
  return null;
}

export function releaseAccept(platform: ReleasePlatform): string {
  switch (platform) {
    case 'Android': return '.apk';
    case 'iOS': return '.ipa';
    case 'Desktop': return '.exe,.msi,.dmg,.zip';
    default: return '';
  }
}
