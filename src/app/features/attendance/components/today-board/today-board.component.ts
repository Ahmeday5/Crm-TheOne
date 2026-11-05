import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PresenceEntry } from '../../models/attendance.models';
import { PRESENCE_ICON } from '../../utils/attendance-view.util';

type Lane = 'present' | 'late' | 'missing' | 'away';

interface LaneView {
  key: Lane;
  icon: string;
  entries: PresenceEntry[];
}

const LANE_ICON: Record<Lane, string> = {
  present: 'fa-solid fa-user-check',
  late: 'fa-solid fa-user-clock',
  missing: 'fa-solid fa-user-xmark',
  away: 'fa-solid fa-umbrella-beach',
};

/** Admin's live board — who is in, late, missing or away today. */
@Component({
  selector: 'app-today-board',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, TipDirective, UserAvatarComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './today-board.component.html',
  styleUrl: './today-board.component.scss',
})
export class TodayBoardComponent {
  readonly presence = input.required<PresenceEntry[]>();
  readonly ready = input(true);
  readonly loading = input(false);

  readonly stateIcon = PRESENCE_ICON;

  readonly lanes = computed<LaneView[]>(() => {
    const all = this.presence();
    const byCheckIn = (a: PresenceEntry, b: PresenceEntry) => ((a.checkIn ?? '') < (b.checkIn ?? '') ? -1 : 1);
    const inside = all.filter((p) => p.state === 'working' || p.state === 'done');
    const lanes: Record<Lane, PresenceEntry[]> = {
      present: inside.filter((p) => !p.isLate).sort(byCheckIn),
      late: inside.filter((p) => p.isLate).sort((a, b) => b.lateMinutes - a.lateMinutes),
      missing: all.filter((p) => p.state === 'absent' || p.state === 'notYet'),
      away: all.filter((p) => p.state === 'leave' || p.state === 'off'),
    };
    return (Object.keys(lanes) as Lane[]).map((key) => ({ key, icon: LANE_ICON[key], entries: lanes[key] }));
  });

  readonly stats = computed(() => {
    const all = this.presence();
    const expected = all.filter((p) => p.state !== 'leave' && p.state !== 'off').length;
    const inside = all.filter((p) => p.state === 'working' || p.state === 'done').length;
    const working = all.filter((p) => p.state === 'working').length;
    return {
      expected,
      inside,
      working,
      rate: expected ? Math.round((inside / expected) * 100) : 0,
      allOff: all.length > 0 && all.every((p) => p.state === 'off'),
    };
  });
}
