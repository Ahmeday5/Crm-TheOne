import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TodayAttendanceEntry } from '../../models/attendance.models';
import { WorkHoursPipe } from '../../pipes/work-hours.pipe';

type Lane = 'working' | 'done';

interface LaneView {
  key: Lane;
  icon: string;
  entries: TodayAttendanceEntry[];
}

/**
 * Admin's live board for today (`GET /Attendance/TodayAll`): who checked in
 * and when, split into "still working" and "checked out".
 */
@Component({
  selector: 'app-today-board',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, TipDirective, UserAvatarComponent, EmptyStateComponent, WorkHoursPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './today-board.component.html',
  styleUrl: './today-board.component.scss',
})
export class TodayBoardComponent {
  readonly entries = input.required<TodayAttendanceEntry[]>();
  readonly ready = input(true);
  readonly loading = input(false);

  readonly lanes = computed<LaneView[]>(() => {
    const byCheckIn = (a: TodayAttendanceEntry, b: TodayAttendanceEntry) =>
      (a.checkInAt ?? '').localeCompare(b.checkInAt ?? '');
    const present = this.entries().filter((e) => e.checkInAt);
    return [
      {
        key: 'working',
        icon: 'fa-solid fa-user-clock',
        entries: present.filter((e) => !e.checkOutAt).sort(byCheckIn),
      },
      {
        key: 'done',
        icon: 'fa-solid fa-user-check',
        entries: present.filter((e) => e.checkOutAt).sort(byCheckIn),
      },
    ];
  });

  readonly stats = computed(() => {
    const [working, done] = this.lanes();
    return { present: working.entries.length + done.entries.length, working: working.entries.length };
  });
}
