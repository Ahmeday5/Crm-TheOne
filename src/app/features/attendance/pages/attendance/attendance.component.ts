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
import { Observable, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DayLogTableComponent } from '../../components/day-log-table/day-log-table.component';
import { LeaveApprovalsComponent } from '../../components/leave-approvals/leave-approvals.component';
import { LeaveBalancesComponent } from '../../components/leave-balances/leave-balances.component';
import { LeaveRequestDialogComponent } from '../../components/leave-request-dialog/leave-request-dialog.component';
import { MonthCalendarComponent } from '../../components/month-calendar/month-calendar.component';
import { MyLeaveRequestsComponent } from '../../components/my-leave-requests/my-leave-requests.component';
import { RejectLeaveDialogComponent } from '../../components/reject-leave-dialog/reject-leave-dialog.component';
import { TeamMatrixComponent } from '../../components/team-matrix/team-matrix.component';
import { TimeClockCardComponent } from '../../components/time-clock-card/time-clock-card.component';
import { TodayBoardComponent } from '../../components/today-board/today-board.component';
import { USING_MOCK_ATTENDANCE } from '../../data/attendance-repository.provider';
import { LeaveRequest } from '../../models/attendance.models';
import { AttendanceStore } from '../../state/attendance.store';
import { leaveErrorKey } from '../../utils/attendance-errors.util';

type AttendanceTab = 'mine' | 'leave' | 'team' | 'approvals';

const EMPLOYEE_TABS: AttendanceTab[] = ['mine', 'leave'];
const ADMIN_TABS: AttendanceTab[] = ['mine', 'leave', 'team', 'approvals'];

const TAB_ICONS: Record<AttendanceTab, string> = {
  mine: 'fa-solid fa-fingerprint',
  leave: 'fa-solid fa-umbrella-beach',
  team: 'fa-solid fa-people-group',
  approvals: 'fa-solid fa-inbox',
};

/**
 * Attendance & leave — `/attendance?tab=mine|leave|team|approvals`.
 *
 * Everyone: time clock, monthly calendar + log, leave balances and requests.
 * Admin also: today's team board, the team monthly matrix and the approvals
 * inbox. The page owns the `AttendanceStore` instance (timers and polling
 * live exactly as long as the page).
 */
@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    TranslatePipe,
    LoadErrorComponent,
    TimeClockCardComponent,
    MonthCalendarComponent,
    DayLogTableComponent,
    LeaveBalancesComponent,
    MyLeaveRequestsComponent,
    LeaveRequestDialogComponent,
    TodayBoardComponent,
    TeamMatrixComponent,
    LeaveApprovalsComponent,
    RejectLeaveDialogComponent,
  ],
  providers: [AttendanceStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent {
  protected readonly store = inject(AttendanceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly isMock = USING_MOCK_ATTENDANCE;
  readonly tabIcons = TAB_ICONS;
  readonly tabs = computed(() => (this.store.isAdmin() ? ADMIN_TABS : EMPLOYEE_TABS));

  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), {
    initialValue: null,
  });

  /** Unknown / forbidden `?tab=` values fall back to the first tab. */
  readonly tab = computed<AttendanceTab>(() => {
    const t = this.tabParam() as AttendanceTab | null;
    return t && this.tabs().includes(t) ? t : 'mine';
  });

  // ─────────── UI state ───────────
  readonly selectedDay = signal<string | null>(null);
  readonly leaveDialogOpen = signal(false);
  readonly rejecting = signal<LeaveRequest | null>(null);
  readonly rejectError = signal<string | null>(null);
  readonly busyLeaveId = signal<string | null>(null);

  readonly pendingCount = computed(() => this.store.pendingApprovals().length);

  constructor() {
    // Admin data loads only once an admin tab is actually opened.
    effect(() => {
      const t = this.tab();
      untracked(() => {
        if (t === 'team' || t === 'approvals') this.store.enableTeam();
      });
    });
  }

  setTab(tab: AttendanceTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'mine' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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

  // ─────────── clock ───────────

  checkIn(): void {
    this.punch(this.store.checkIn(), 'attendance.clock.checkedIn');
  }

  checkOut(): void {
    this.punch(this.store.checkOut(), 'attendance.clock.checkedOut');
  }

  private punch(request$: Observable<unknown>, successKey: string): void {
    request$.subscribe({
      next: () => this.toast.success(this.t(successKey)),
      error: (err: ApiError) => this.fail(err),
    });
  }

  // ─────────── calendar / log ───────────

  selectDay(date: string): void {
    this.selectedDay.update((d) => (d === date ? null : date));
  }

  shiftMonth(delta: number): void {
    this.selectedDay.set(null);
    this.store.shiftMonth(delta);
  }

  // ─────────── my leave ───────────

  async cancelLeave(r: LeaveRequest): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('attendance.actions.cancelRequest'),
      message: `${this.t(`attendance.leaveTypes.${r.type}`)} · ${r.from} → ${r.to}`,
      confirmText: this.t('attendance.actions.cancelRequest'),
      type: 'warning',
    });
    if (!ok) return;
    this.busyLeaveId.set(r.id);
    this.store.cancelLeave(r.id).subscribe({
      next: () => {
        this.busyLeaveId.set(null);
        this.toast.success(this.t('attendance.messages.leaveCancelled'));
      },
      error: (err: ApiError) => {
        this.busyLeaveId.set(null);
        this.fail(err);
      },
    });
  }

  // ─────────── approvals (admin) ───────────

  approve(r: LeaveRequest): void {
    this.busyLeaveId.set(r.id);
    this.store.decideLeave(r.id, { approve: true }).subscribe({
      next: () => {
        this.busyLeaveId.set(null);
        this.toast.success(this.t('attendance.messages.leaveApproved'));
      },
      error: (err: ApiError) => {
        this.busyLeaveId.set(null);
        this.fail(err);
      },
    });
  }

  openReject(r: LeaveRequest): void {
    this.rejectError.set(null);
    this.rejecting.set(r);
  }

  confirmReject(reason: string): void {
    const r = this.rejecting();
    if (!r) return;
    this.busyLeaveId.set(r.id);
    this.rejectError.set(null);
    this.store.decideLeave(r.id, { approve: false, reason }).subscribe({
      next: () => {
        this.busyLeaveId.set(null);
        this.rejecting.set(null);
        this.toast.success(this.t('attendance.messages.leaveRejected'));
      },
      error: (err: ApiError) => {
        this.busyLeaveId.set(null);
        this.rejectError.set(this.errorText(err));
      },
    });
  }

  // ─────────── helpers ───────────

  private fail(err: ApiError): void {
    this.toast.error(this.errorText(err));
  }

  private errorText(err: ApiError): string {
    const code = err?.code;
    const key = code ? leaveErrorKey(code) : null;
    return key ? this.t(key) : err?.message?.trim() || this.t('attendance.messages.saveFailed');
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
