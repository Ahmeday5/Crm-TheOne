import { LeaveType } from '../models/attendance.models';

/**
 * Every business rule of the attendance module in one place.
 *
 * Times are wall-clock minutes in Africa/Cairo (the business day is Cairo's
 * regardless of the viewer's device clock). When the backend ships, these
 * values should come from company settings — the shape is already what the
 * `GET /api/Attendance/policy` endpoint in `docs/api/attendance.md` returns.
 */
export const ATTENDANCE_POLICY = {
  /** Official start of the workday, minutes after midnight (09:00). */
  workStartMinutes: 9 * 60,
  /** Official end of the workday, minutes after midnight (17:00). */
  workEndMinutes: 17 * 60,
  /** Checking in up to this many minutes after the start is still on time. */
  graceMinutes: 15,
  /** A full workday — drives the ring progress and the "check out early?" prompt. */
  workdayMinutes: 8 * 60,
  /** Weekly days off as `Date#getUTCDay()` values (5 = Friday). */
  weekendDays: [5] as ReadonlyArray<number>,
  /** First column of the calendar (6 = Saturday, as in Egyptian offices). */
  weekStartsOn: 6,
  /** Sick leave can be filed retroactively for this many days. */
  sickBackdateDays: 7,
  /** How many months back the monthly log can navigate. */
  historyMonths: 12,
} as const;

/**
 * Yearly leave entitlements — Egyptian Labour Law defaults:
 * 21 annual days, 6 casual days, and a 15-day paid sick allowance before a
 * medical committee is required.
 */
export const LEAVE_ENTITLEMENTS: Readonly<Record<LeaveType, number>> = {
  annual: 21,
  sick: 15,
  casual: 6,
};

export interface PublicHoliday {
  /** `YYYY-MM-DD` (Cairo). */
  date: string;
  name: { ar: string; en: string };
}

/**
 * Official public holidays. Religious dates follow the lunar calendar and are
 * the expected observances — the backend should own this list
 * (`GET /api/Attendance/holidays`); until then the mock serves it.
 */
export const PUBLIC_HOLIDAYS: ReadonlyArray<PublicHoliday> = [
  { date: '2026-01-07', name: { ar: 'عيد الميلاد المجيد', en: 'Coptic Christmas' } },
  { date: '2026-01-25', name: { ar: 'عيد الشرطة وثورة يناير', en: 'Police Day & January Revolution' } },
  { date: '2026-03-20', name: { ar: 'عيد الفطر', en: 'Eid al-Fitr' } },
  { date: '2026-03-21', name: { ar: 'عيد الفطر', en: 'Eid al-Fitr' } },
  { date: '2026-03-22', name: { ar: 'عيد الفطر', en: 'Eid al-Fitr' } },
  { date: '2026-04-13', name: { ar: 'شم النسيم', en: 'Sham El-Nessim' } },
  { date: '2026-04-25', name: { ar: 'عيد تحرير سيناء', en: 'Sinai Liberation Day' } },
  { date: '2026-05-01', name: { ar: 'عيد العمال', en: 'Labour Day' } },
  { date: '2026-05-26', name: { ar: 'وقفة عرفات', en: 'Arafat Day' } },
  { date: '2026-05-27', name: { ar: 'عيد الأضحى', en: 'Eid al-Adha' } },
  { date: '2026-05-28', name: { ar: 'عيد الأضحى', en: 'Eid al-Adha' } },
  { date: '2026-05-29', name: { ar: 'عيد الأضحى', en: 'Eid al-Adha' } },
  { date: '2026-06-16', name: { ar: 'رأس السنة الهجرية', en: 'Islamic New Year' } },
  { date: '2026-06-30', name: { ar: 'ذكرى ثورة 30 يونيو', en: 'June 30 Revolution' } },
  { date: '2026-07-23', name: { ar: 'عيد ثورة 23 يوليو', en: 'July 23 Revolution' } },
  { date: '2026-08-25', name: { ar: 'المولد النبوي الشريف', en: "Prophet's Birthday" } },
  { date: '2026-10-06', name: { ar: 'عيد القوات المسلحة', en: 'Armed Forces Day' } },
  { date: '2027-01-07', name: { ar: 'عيد الميلاد المجيد', en: 'Coptic Christmas' } },
  { date: '2027-01-25', name: { ar: 'عيد الشرطة وثورة يناير', en: 'Police Day & January Revolution' } },
];

/** Live refresh of the admin board and today's state (ms). */
export const ATTENDANCE_REFRESH_MS = 60_000;
