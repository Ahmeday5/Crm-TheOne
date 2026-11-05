import {
  AttendanceEmployee,
  AttendanceRecord,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
} from '../../models/attendance.models';
import {
  AttendancePolicy,
  HolidayLookup,
  approvedLeaveOn,
  isWorkday,
} from '../../utils/attendance-calc.util';
import {
  addDays,
  addMonths,
  cairoMinutesOf,
  cairoTimeToIso,
  daysInMonth,
  eachDay,
  monthOf,
  rangesOverlap,
} from '../../utils/attendance-date.util';
import { countLeaveDays } from '../../utils/leave.util';
import { Rng, createRng } from '../../utils/prng.util';

/**
 * Deterministic demo history for the mock adapter.
 *
 * Nothing here is stored: every value derives from a seeded PRNG keyed by
 * (employee, day) — so the same history renders after every reload, in every
 * tab, and a new day "fills in" on its own. Only what users actually do
 * (check-ins, requests, decisions) is persisted by the repository.
 */

/** How many months before the current one are seeded. */
export const SEED_MONTHS_BACK = 2;

const SEED_ADMIN = { id: 'seed-admin', name: 'إدارة الموارد البشرية' };

interface Habit {
  /** Probability of arriving after the grace window. */
  lateRate: number;
  /** Probability of an unexplained absence. */
  absentRate: number;
  /** Probability of a leave in any given month. */
  leaveRate: number;
}

interface MockEmployee extends AttendanceEmployee {
  habit: Habit;
}

const MOCK_EMPLOYEES: ReadonlyArray<MockEmployee> = [
  { id: 'att-emp-01', name: 'أحمد سمير', email: 'ahmed.samir@crm.local', role: 'Sales', imageUrl: null, habit: { lateRate: 0.08, absentRate: 0.02, leaveRate: 0.5 } },
  { id: 'att-emp-02', name: 'منة الله عادل', email: 'menna.adel@crm.local', role: 'Marketing', imageUrl: null, habit: { lateRate: 0.18, absentRate: 0.03, leaveRate: 0.45 } },
  { id: 'att-emp-03', name: 'محمد عبد الرحمن', email: 'mohamed.abdelrahman@crm.local', role: 'Support', imageUrl: null, habit: { lateRate: 0.12, absentRate: 0.05, leaveRate: 0.35 } },
  { id: 'att-emp-04', name: 'سارة فؤاد', email: 'sara.fouad@crm.local', role: 'Developer', imageUrl: null, habit: { lateRate: 0.25, absentRate: 0.02, leaveRate: 0.4 } },
  { id: 'att-emp-05', name: 'يوسف حسني', email: 'youssef.hosny@crm.local', role: 'Sales', imageUrl: null, habit: { lateRate: 0.3, absentRate: 0.06, leaveRate: 0.3 } },
  { id: 'att-emp-06', name: 'نورهان طارق', email: 'nourhan.tarek@crm.local', role: 'Marketing', imageUrl: null, habit: { lateRate: 0.05, absentRate: 0.01, leaveRate: 0.55 } },
  { id: 'att-emp-07', name: 'كريم الشافعي', email: 'karim.elshafei@crm.local', role: 'Developer', imageUrl: null, habit: { lateRate: 0.15, absentRate: 0.03, leaveRate: 0.4 } },
  { id: 'att-emp-08', name: 'هبة مصطفى', email: 'heba.mostafa@crm.local', role: 'Support', imageUrl: null, habit: { lateRate: 0.1, absentRate: 0.04, leaveRate: 0.45 } },
];

const CURRENT_USER_HABIT: Habit = { lateRate: 0.14, absentRate: 0.03, leaveRate: 0.4 };

const REASONS: Record<LeaveType, ReadonlyArray<string>> = {
  annual: ['سفر عائلي خارج القاهرة', 'إجازة سنوية مخططة', 'ظروف شخصية', 'حضور فرح أحد الأقارب'],
  sick: ['دور برد شديد', 'موعد طبي ومتابعة', 'وعكة صحية مفاجئة'],
  casual: ['ظرف طارئ في البيت', 'مشوار حكومي', 'تجديد بطاقة الرقم القومي'],
};

const REJECTIONS: ReadonlyArray<string> = [
  'ضغط عمل في نهاية الشهر — برجاء اختيار موعد آخر',
  'الحد الأقصى لإجازات القسم في نفس الفترة مكتمل',
];

export interface SeedContext {
  today: string;
  now: Date;
  policy: AttendancePolicy;
  holidays: HolidayLookup;
}

/** The seeded colleagues (without their private habits). */
export function mockEmployees(): AttendanceEmployee[] {
  return MOCK_EMPLOYEES.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    imageUrl: e.imageUrl,
  }));
}

function habitOf(userId: string): Habit {
  return MOCK_EMPLOYEES.find((e) => e.id === userId)?.habit ?? CURRENT_USER_HABIT;
}

/** First seeded day. */
export function seedStart(today: string): string {
  return `${addMonths(monthOf(today), -SEED_MONTHS_BACK)}-01`;
}

function nearestWorkday(day: string, ctx: SeedContext, limit: string): string | null {
  for (let d = day; d <= limit; d = addDays(d, 1)) {
    if (isWorkday(d, ctx.policy, ctx.holidays)) return d;
  }
  return null;
}

function pickType(rng: Rng): LeaveType {
  const r = rng.next();
  return r < 0.6 ? 'annual' : r < 0.85 ? 'casual' : 'sick';
}

/** A business-hours timestamp a few days before `day`. */
function stampBefore(day: string, rng: Rng, minDays: number, maxDays: number): string {
  return cairoTimeToIso(addDays(day, -rng.int(minDays, maxDays)), rng.int(9 * 60 + 30, 16 * 60));
}

function buildLeave(
  employee: AttendanceEmployee,
  id: string,
  rng: Rng,
  from: string,
  length: number,
  status: LeaveStatus,
  createdAt: string,
  ctx: SeedContext,
): LeaveRequest | null {
  const type = pickType(rng);
  const len = type === 'casual' ? 1 : type === 'sick' ? Math.min(length, 2) : length;
  const halfDay = type === 'casual' && rng.chance(0.25);
  const to = halfDay ? from : addDays(from, len - 1);
  const days = countLeaveDays(from, to, halfDay, ctx.policy, ctx.holidays);
  if (!days) return null;
  const decided = status === 'approved' || status === 'rejected';
  return {
    id,
    userId: employee.id,
    employeeName: employee.name,
    employeeRole: employee.role,
    employeeImageUrl: employee.imageUrl,
    type,
    from,
    to,
    halfDay,
    days,
    reason: rng.pick(REASONS[type]),
    status,
    createdAt,
    decidedAt: decided ? new Date(Date.parse(createdAt) + rng.int(2, 26) * 3_600_000).toISOString() : null,
    decidedBy: decided ? SEED_ADMIN : null,
    rejectionReason: status === 'rejected' ? rng.pick(REJECTIONS) : null,
  };
}

/**
 * Seeded leave requests of one employee: at most one per seeded month, plus
 * (for colleagues) an upcoming pending request so the admin inbox has work.
 */
export function seedLeaves(
  employee: AttendanceEmployee,
  ctx: SeedContext,
  options: { withPending: boolean },
): LeaveRequest[] {
  const out: LeaveRequest[] = [];
  const habit = habitOf(employee.id);
  const current = monthOf(ctx.today);
  const accept = (l: LeaveRequest | null) => {
    if (l && !out.some((o) => rangesOverlap(o.from, o.to, l.from, l.to))) out.push(l);
  };

  for (let back = SEED_MONTHS_BACK; back >= 0; back--) {
    const month = addMonths(current, -back);
    const rng = createRng(`${employee.id}|leave|${month}`);
    if (!rng.chance(habit.leaveRate)) continue;
    const startDay = `${month}-${String(rng.int(3, Math.min(24, daysInMonth(month)))).padStart(2, '0')}`;
    const from = nearestWorkday(startDay, ctx, `${month}-${daysInMonth(month)}`);
    if (!from) continue;
    const upcoming = from >= ctx.today;
    if (upcoming && !options.withPending) continue;
    const status: LeaveStatus = upcoming ? 'pending' : rng.chance(0.88) ? 'approved' : 'rejected';
    const createdAt = upcoming
      ? cairoTimeToIso(addDays(ctx.today, -rng.int(0, 3)), rng.int(9 * 60, 11 * 60))
      : stampBefore(from, rng, 3, 12);
    accept(buildLeave(employee, `seed-${employee.id}-${month}`, rng, from, rng.int(1, 3), status, createdAt, ctx));
  }

  if (options.withPending) {
    const rng = createRng(`${employee.id}|upcoming|${current}`);
    if (rng.chance(0.5)) {
      const from = nearestWorkday(addDays(ctx.today, rng.int(2, 18)), ctx, addDays(ctx.today, 30));
      if (from) {
        const createdAt = cairoTimeToIso(addDays(ctx.today, -rng.int(0, 2)), rng.int(9 * 60, 13 * 60));
        accept(buildLeave(employee, `seed-${employee.id}-up-${current}`, rng, from, rng.int(1, 4), 'pending', createdAt, ctx));
      }
    }
  }
  return out;
}

/**
 * Seeded check-ins of one employee for `[from, to]` (clipped to the seed
 * window). Today's punches only appear once their time has passed, so the
 * admin board fills in live through the morning.
 */
export function seedRecords(
  userId: string,
  from: string,
  to: string,
  leaves: ReadonlyArray<LeaveRequest>,
  ctx: SeedContext,
  options: { includeToday: boolean },
): AttendanceRecord[] {
  const start = from < seedStart(ctx.today) ? seedStart(ctx.today) : from;
  const lastDay = options.includeToday ? ctx.today : addDays(ctx.today, -1);
  const end = to > lastDay ? lastDay : to;
  if (end < start) return [];

  const habit = habitOf(userId);
  const nowMinutes = cairoMinutesOf(ctx.now);
  const { workStartMinutes, workEndMinutes, graceMinutes } = ctx.policy;
  const out: AttendanceRecord[] = [];

  for (const day of eachDay(start, end)) {
    if (!isWorkday(day, ctx.policy, ctx.holidays)) continue;
    const leave = approvedLeaveOn(day, leaves);
    if (leave && !leave.halfDay) continue;

    const rng = createRng(`${userId}|day|${day}`);
    if (rng.chance(habit.absentRate)) continue;

    const late = rng.chance(habit.lateRate);
    const inMinutes = late
      ? workStartMinutes + graceMinutes + rng.int(1, 55)
      : workStartMinutes - rng.int(0, 28) + rng.int(0, graceMinutes - 1);
    const outMinutes = Math.min(
      workEndMinutes + rng.int(-10, 95) + (late ? rng.int(0, 30) : 0),
      23 * 60,
    );

    if (day === ctx.today) {
      if (nowMinutes < inMinutes) continue;
      out.push({
        id: `${userId}|${day}`,
        userId,
        date: day,
        checkIn: cairoTimeToIso(day, inMinutes, rng.int(0, 59)),
        checkOut: nowMinutes >= outMinutes ? cairoTimeToIso(day, outMinutes, rng.int(0, 59)) : null,
      });
      continue;
    }

    out.push({
      id: `${userId}|${day}`,
      userId,
      date: day,
      checkIn: cairoTimeToIso(day, inMinutes, rng.int(0, 59)),
      checkOut: cairoTimeToIso(day, outMinutes, rng.int(0, 59)),
    });
  }
  return out;
}
