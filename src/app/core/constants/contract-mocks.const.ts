/**
 * Contract-first switches for the "Client Portal v2" backend work.
 *
 * Every area below already has its real HTTP adapter written against the
 * agreed contract (`backend-prompt-client-portal-v2.md`). While the backend
 * is being built, an area marked `true` runs on an in-memory mock adapter
 * with the exact same interface, so the screens can be used and reviewed now.
 *
 * When the backend ships an area: flip it to `false`. Nothing else changes.
 * A small "بيانات تجريبية" ribbon is shown on screens running on a mock.
 */
export const CONTRACT_MOCKS = {
  /** `ClientPortal/*` — magic-link session + the whole client portal. */
  clientPortal: false,
  /** `ClientPortalLinks/*` + `ManagerProjects/{id}/client-link` — the admin link card. */
  clientLinks: false,
  /** `…/{id}/credentials` + `…/{id}/releases` — the deliverables tab. */
  deliverables: false,
  /** `DeveloperProjects/{id}/milestones` — developers editing milestones (admin side is live). */
  developerMilestones: false,
} as const;

export type ContractArea = keyof typeof CONTRACT_MOCKS;

export function isMocked(area: ContractArea): boolean {
  return CONTRACT_MOCKS[area];
}
