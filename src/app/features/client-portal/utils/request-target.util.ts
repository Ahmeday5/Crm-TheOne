import {
  APP_NAME_MAX,
  AppAudience,
  AppPlatform,
  AwaitingParty,
  ProjectSurface,
  RequestOptions,
  RequestStatus,
  RequestTarget,
  RequestTargetFields,
} from '../models/client-portal.models';

/**
 * "What is this request about?" — one set of rules for the client form, the
 * Admin's correction and the mock, mirroring the backend validation (same
 * `reason` codes, see the contract §4.2).
 */

export type TargetProblem = 'target_required' | 'app_required' | 'app_name_required' | 'surface_invalid';

/** The form's in-progress selection — `target` is empty until the customer picks one. */
export type TargetDraft = Omit<RequestTargetFields, 'target'> & { target: RequestTarget | null };

export const EMPTY_TARGET: TargetDraft = {
  target: null,
  surfaceId: null,
  appAudience: null,
  appName: null,
  appPlatform: null,
};

export function activeSurfaces(options: RequestOptions | null): ProjectSurface[] {
  return (options?.surfaces ?? []).filter((s) => s.isActive).sort((a, b) => a.orderIndex - b.orderIndex);
}

/** `null` when the selection can be sent. */
export function targetProblem(sel: TargetDraft, options: RequestOptions | null): TargetProblem | null {
  const surfaces = activeSurfaces(options);
  if (sel.surfaceId != null) return surfaces.some((s) => s.id === sel.surfaceId) ? null : 'surface_invalid';
  if (!sel.target) return 'target_required';
  if (sel.target === 'MobileApp') {
    const apps = surfaces.filter((s) => s.kind === 'MobileApp');
    if (apps.length >= 2 || options?.appRequired) return 'app_required';
    if (!sel.appAudience) return 'app_required';
  }
  if (sel.appAudience === 'Other' && !sel.appName?.trim()) return 'app_name_required';
  if ((sel.appName ?? '').length > APP_NAME_MAX) return 'app_name_required';
  return null;
}

/** Picking a surface fills the derived fields (the server derives them too). */
export function selectionFromSurface(s: ProjectSurface): RequestTargetFields {
  return {
    target: s.kind,
    surfaceId: s.id,
    appAudience: s.kind === 'MobileApp' ? s.appAudience : null,
    appName: null,
    appPlatform: s.kind === 'MobileApp' ? (s.platforms === 'Both' ? null : s.platforms) : null,
  };
}

/** Drops fields that don't apply to the chosen target (never send stale app data). */
export function normalizeTarget(sel: TargetDraft): RequestTargetFields {
  const target = sel.target ?? 'Other';
  if (target !== 'MobileApp') return { target, surfaceId: sel.surfaceId, appAudience: null, appName: null, appPlatform: null };
  return { ...sel, target, appName: sel.appName?.trim() || null };
}

export function targetIcon(target: RequestTarget | null): string {
  switch (target) {
    case 'Website': return 'fa-solid fa-globe';
    case 'Dashboard': return 'fa-solid fa-gauge-high';
    case 'MobileApp': return 'fa-solid fa-mobile-screen-button';
    default: return 'fa-solid fa-shapes';
  }
}

export function audienceIcon(audience: AppAudience | null): string {
  switch (audience) {
    case 'Customer': return 'fa-solid fa-user';
    case 'Driver': return 'fa-solid fa-motorcycle';
    case 'Vendor': return 'fa-solid fa-store';
    case 'Staff': return 'fa-solid fa-id-badge';
    default: return 'fa-solid fa-mobile-screen-button';
  }
}

export function platformChipIcon(platform: AppPlatform | null): string {
  switch (platform) {
    case 'Android': return 'fa-brands fa-android';
    case 'iOS': return 'fa-brands fa-apple';
    case 'Both': return 'fa-solid fa-mobile-screen';
    default: return 'fa-solid fa-circle-question';
  }
}

export function surfaceIcon(s: Pick<ProjectSurface, 'kind' | 'appAudience'>): string {
  return s.kind === 'MobileApp' ? audienceIcon(s.appAudience) : targetIcon(s.kind);
}

/** Same rule as the server's `awaitingParty`. */
export function awaitingPartyOf(status: RequestStatus): AwaitingParty | null {
  switch (status) {
    case 'PendingReview': return 'Admin';
    case 'NeedsClarification': return 'Client';
    case 'Open':
    case 'InReview':
    case 'InProgress': return 'Team';
    default: return null;
  }
}
