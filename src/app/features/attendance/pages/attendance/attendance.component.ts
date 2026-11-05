import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { EmployeeMonthDialogComponent } from '../../components/employee-month-dialog/employee-month-dialog.component';
import { LeaveRequestDialogComponent } from '../../components/leave-request-dialog/leave-request-dialog.component';
import {
  LeaveRequestsInboxComponent,
  ReviewDecision,
} from '../../components/leave-requests-inbox/leave-requests-inbox.component';
import { MonthCalendarComponent } from '../../components/month-calendar/month-calendar.component';
import { MonthRecordsTableComponent } from '../../components/month-records-table/month-records-table.component';
import { MonthSummaryComponent } from '../../components/month-summary/month-summary.component';
import { MyLeaveRequestsComponent } from '../../components/my-leave-requests/my-leave-requests.component';
import { ReviewLeaveDialogComponent } from '../../components/review-leave-dialog/review-leave-dialog.component';
import { TeamMonthlyTableComponent } from '../../components/team-monthly-table/team-monthly-table.component';
import { TimeClockCardComponent } from '../../components/time-clock-card/time-clock-card.component';
import { TodayBoardComponent } from '../../components/today-board/today-board.component';
import { EmployeeMonthlyAttendance, LeaveRequest } from '../../models/attendance.models';
import { AttendanceTodayStore } from '../../state/attendance-today.store';
import { ATTENDANCE_PATH, LeaveInboxStore } from '../../state/leave-inbox.store';
import { MyAttendanceStore } from '../../state/my-attendance.store';
import { TeamAttendanceStore } from '../../state/team-attendance.store';

/** URL segment of each tab (`''` = `/attendance`). */
type AttendanceTab = 'mine' | 'leaves' | 'team' | 'requests';

const EMPLOYEE_TABS: AttendanceTab[] = ['mine', 'leaves'];
const ADMIN_TABS: AttendanceTab[] = ['mine', 'leaves', 'team', 'requests'];

const TAB_ICONS: Record<AttendanceTab, string> = {
  mine: 'fa-solid fa-fingerprint',
  leaves: 'fa-solid fa-umbrella-beach',
  team: 'fa-solid fa-people-group',
  requests: 'fa-solid fa-inbox',
};

/** Years offered by the leave filters (current and the two before). */
const YEARS_BACK = 2;

/**
 * Attendance & leave — `/attendance[/leaves|team|requests]`.
 *
 * Everyone: time clock, month summary + calendar + table, leave requests.
 * Admin also: today's board + everyone's month, and the leave inbox.
 * Every number on the page is the server's; each tab loads on first open.
 */
@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    TranslatePipe,
    LoadErrorComponent,
    TimeClockCardComponent,
    MonthSummaryComponent,
    MonthCalendarComponent,
    MonthRecordsTableComponent,
    MyLeaveRequestsComponent,
    LeaveRequestDialogComponent,
    TodayBoardComponent,
    TeamMonthlyTableComponent,
    EmployeeMonthDialogComponent,
    LeaveRequestsInboxComponent,
    ReviewLeaveDialogComponent,
  ],
  providers: [MyAttendanceStore, TeamAttendanceStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent {
  protected readonly today = inject(AttendanceTodayStore);
  protected readonly mine = inject(MyAttendanceStore);
  protected readonly team = inject(TeamAttendanceStore);
  protected readonly inbox = inject(LeaveInboxStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly tabIcons = TAB_ICONS;
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly tabs = computed(() => (this.isAdmin() ? ADMIN_TABS : EMPLOYEE_TABS));

  private readonly tabParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('tab'))), {
    initialValue: this.route.snapshot.paramMap.get('tab'),
  });

  /** Unknown / forbidden tabs fall back to "my attendance". */
  readonly tab = computed<AttendanceTab>(() => {
    const t = this.tabParam() as AttendanceTab | null;
    return t && this.tabs().includes(t) ? t : 'mine';
  });

  readonly years = computed(() => {
    const current = Number(this.today.day().slice(0, 4));
    return Array.from({ length: YEARS_BACK + 1 }, (_, i) => current - i);
  });

  // ─────────── UI state ───────────
  readonly selectedDay = signal<string | null>(null);
  readonly leaveDialogOpen = signal(false);
  readonly busyLeaveId = signal<number | null>(null);
  readonly reviewing = signal<{ request: LeaveRequest; decision: ReviewDecision } | null>(null);
  readonly employeeOpen = signal<EmployeeMonthlyAttendance | null>(null);

  constructor() {
    // Each tab loads the first time it is shown (refreshes quietly after that).
    const opened = new Set<AttendanceTab>();
    effect(() => {
      const tab = this.tab();
      untracked(() => {
        const first = !opened.has(tab);
        opened.add(tab);
        switch (tab) {
          case 'mine':
            this.today.refresh(true);
            this.mine.loadMonth(!first);
            break;
          case 'leaves':
            this.mine.loadLeaves(!first);
            break;
          case 'team':
            this.team.loadToday(!first);
            this.team.loadMonthly(!first);
            break;
          case 'requests':
            this.team.loadLeaves(!first);
            break;
        }
      });
    });
  }

  setTab(tab: AttendanceTab): void {
    void this.router.navigate(tab === 'mine' ? [ATTENDANCE_PATH] : [ATTENDANCE_PATH, tab], { replaceUrl: true });
  }

  /** Arrow keys move between tabs (mirrored in RTL). */
  onTabKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const tabs = this.tabs();
    const rtl = this.language.lang() === 'ar';
    const forward = (e.key === 'ArrowLeft') === rtl;
    const i = tabs.indexOf(this.tab());
    const next = tabs[(i + (forward ? 1 : -1) + tabs.length) % tabs.length];
    this.setTab(next);
    queueMicrotask(() => document.getElementById(`att-tab-${next}`)?.focus());
  }

  // ─────────── my month ───────────

  selectDay(date: string): void {
    this.selectedDay.update((d) => (d === date ? null : date));
  }

  shiftMonth(delta: number): void {
    this.selectedDay.set(null);
    this.mine.shiftMonth(delta);
  }

  // ─────────── my leave ───────────

  onLeaveSaved(): void {
    this.leaveDialogOpen.set(false);
    this.setTab('leaves');
  }

  async cancelLeave(r: LeaveRequest): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('attendance.myRequests.cancelTitle'),
      message: this.t('attendance.myRequests.cancelMessage'),
      confirmText: this.t('attendance.actions.cancelRequest'),
      cancelText: this.t('attendance.actions.back'),
      type: 'warning',
    });
    if (!ok) return;
    this.busyLeaveId.set(r.id);
    this.mine.cancelLeave(r.id).subscribe({
      next: () => {
        this.busyLeaveId.set(null);
        this.toast.success(this.t('attendance.myRequests.cancelled'));
      },
      error: (err: ApiError) => {
        this.busyLeaveId.set(null);
        this.toast.error(err?.message?.trim() || this.t('attendance.myRequests.cancelFailed'));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
