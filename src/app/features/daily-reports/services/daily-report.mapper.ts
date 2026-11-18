import { DailyReport, DailyReportListItem, DailyReportProjectRef } from '../../../shared/models';

/**
 * Response → model boundary for `Reports/*`.
 *
 * Project links arrived with the 2026-11-18 backend: `projects: [{ id, title }]`
 * on the detail / write responses and `projectNames: string[]` on list rows.
 * Reports created before that (and pages cached by an older build) have
 * neither — normalise to empty arrays so templates never branch on `null`.
 */

function toProjectRefs(raw: unknown): DailyReportProjectRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      const id = Number((p as { id?: unknown })?.id);
      const title = String((p as { title?: unknown })?.title ?? '').trim();
      return Number.isFinite(id) && id > 0 ? { id, title: title || `#${id}` } : null;
    })
    .filter((p): p is DailyReportProjectRef => p !== null);
}

function toNames(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((n) => String(n ?? '').trim()).filter(Boolean) : [];
}

export function normalizeDailyReport(dto: DailyReport): DailyReport {
  return { ...dto, projects: toProjectRefs((dto as { projects?: unknown })?.projects) };
}

export function normalizeDailyReportListItem(dto: DailyReportListItem): DailyReportListItem {
  return { ...dto, projectNames: toNames((dto as { projectNames?: unknown })?.projectNames) };
}
