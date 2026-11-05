import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { LanguageService } from '../../../../core/services/language.service';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ATTENDANCE_POLICY } from '../../config/attendance.config';
import { AttendanceDay, AttendanceRecord, ClockState } from '../../models/attendance.models';
import { WorkDurationPipe } from '../../pipes/work-duration.pipe';
import { workdayProgress } from '../../utils/attendance-calc.util';
import {
  formatClock,
  formatElapsed,
  formatLongDay,
  formatMinutesOfDay,
  localeFor,
  secondsBetween,
} from '../../utils/attendance-date.util';

/** Ring geometry (SVG user units). */
const RING_R = 92;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Hero "time clock": live Cairo clock, the big check-in / check-out button
 * wrapped in a ring that fills over the workday, and today's summary.
 *
 * Presentational — the page owns the requests; this ticks its own
 * one-second clock so nothing else re-renders every second.
 */
@Component({
  selector: 'app-time-clock-card',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, WorkDurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-clock-card.component.html',
  styleUrl: './time-clock-card.component.scss',
})
export class TimeClockCardComponent {
  readonly record = input<AttendanceRecord | null>(null);
  readonly day = input.required<AttendanceDay>();
  readonly state = input.required<ClockState>();
  readonly busy = input(false);
  readonly loading = input(false);

  readonly checkIn = output<void>();
  readonly checkOut = output<void>();

  private readonly language = inject(LanguageService);
  readonly policy = ATTENDANCE_POLICY;
  readonly ringR = RING_R;
  readonly ringC = RING_C;

  private readonly nowSig = signal(new Date());

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.nowSig.set(new Date()));
  }

  private readonly locale = computed(() => localeFor(this.language.lang()));

  readonly clock = computed(() => formatClock(this.nowSig(), this.locale()));
  readonly dateLabel = computed(() => formatLongDay(this.day().date, this.locale()));

  readonly shift = computed(() => ({
    start: formatMinutesOfDay(this.policy.workStartMinutes, this.locale()),
    end: formatMinutesOfDay(this.policy.workEndMinutes, this.locale()),
  }));

  readonly elapsedSeconds = computed(() => {
    const r = this.record();
    return r ? secondsBetween(r.checkIn, r.checkOut ?? this.nowSig()) : 0;
  });

  readonly elapsed = computed(() => formatElapsed(this.elapsedSeconds()));
  readonly workedMinutes = computed(() => Math.floor(this.elapsedSeconds() / 60));
  readonly progress = computed(() => workdayProgress(this.workedMinutes(), this.policy));
  readonly progressPct = computed(() => Math.round(this.progress() * 100));
  readonly dashOffset = computed(() => RING_C * (1 - this.progress()));
  readonly remainingMinutes = computed(() => Math.max(0, this.policy.workdayMinutes - this.workedMinutes()));
  readonly overtimeMinutes = computed(() => Math.max(0, this.workedMinutes() - this.policy.workdayMinutes));

  readonly holidayName = computed(() => this.day().holidayName?.[this.language.lang()] ?? '');

  /** Banner shown above the button for days that aren't regular workdays. */
  readonly dayNote = computed<'weekend' | 'holiday' | 'leave' | null>(() => {
    const d = this.day();
    if (d.leave) return 'leave';
    if (d.holidayName) return 'holiday';
    if (d.status === 'weekend' || (d.isExtra && !d.holidayName)) return 'weekend';
    return null;
  });

  press(): void {
    if (this.busy() || this.loading()) return;
    const state = this.state();
    if (state === 'notStarted') this.checkIn.emit();
    else if (state === 'working') this.checkOut.emit();
  }
}
