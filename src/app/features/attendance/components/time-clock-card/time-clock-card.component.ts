import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { interval } from 'rxjs';
import { LanguageService } from '../../../../core/services/language.service';
import {
  formatClock,
  formatElapsed,
  formatLongDay,
  localeFor,
  secondsBetween,
} from '../../../../core/utils/cairo-time.util';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AttendanceToday, ClockState } from '../../models/attendance.models';
import { WorkHoursPipe } from '../../pipes/work-hours.pipe';
import { ClockAction } from '../../state/attendance-today.store';

/** Ring geometry (SVG user units). */
const RING_R = 92;
const RING_C = 2 * Math.PI * RING_R;
/** The ring fills over a nominal 8-hour day — a visual cue, not a rule. */
const RING_FULL_SECONDS = 8 * 3600;
export const CLOCK_NOTE_MAX = 500;

/**
 * Hero "time clock" of the attendance page: live Cairo clock, the big
 * check-in / check-out button inside a ring that fills while working, an
 * optional note, and today's summary.
 *
 * Presentational — the store owns the requests. Ticks its own one-second
 * clock so nothing else re-renders every second.
 */
@Component({
  selector: 'app-time-clock-card',
  standalone: true,
  imports: [FormsModule, TranslatePipe, CairoDatePipe, WorkHoursPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-clock-card.component.html',
  styleUrl: './time-clock-card.component.scss',
})
export class TimeClockCardComponent {
  readonly today = input<AttendanceToday | null>(null);
  readonly state = input.required<ClockState>();
  /** Cairo `YYYY-MM-DD`. */
  readonly day = input.required<string>();
  readonly busy = input<ClockAction | null>(null);
  readonly loading = input(false);

  readonly checkIn = output<string | null>();
  readonly checkOut = output<string | null>();

  private readonly language = inject(LanguageService);
  readonly ringR = RING_R;
  readonly ringC = RING_C;
  readonly noteMax = CLOCK_NOTE_MAX;

  readonly noteOpen = signal(false);
  readonly note = signal('');

  private readonly nowSig = signal(new Date());

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.nowSig.set(new Date()));

    // A completed action (state changed) clears the note for the next one.
    effect(
      () => {
        this.state();
        untracked(() => {
          this.note.set('');
          this.noteOpen.set(false);
        });
      },
      { allowSignalWrites: true },
    );
  }

  private readonly locale = computed(() => localeFor(this.language.lang()));

  readonly clock = computed(() => formatClock(this.nowSig(), this.locale()));
  readonly dateLabel = computed(() => formatLongDay(this.day(), this.locale()));
  readonly record = computed(() => this.today()?.record ?? null);

  /** Live while working; the server's hours take over once checked out. */
  readonly elapsedSeconds = computed(() => {
    const r = this.record();
    if (!r?.checkInAt) return 0;
    return secondsBetween(r.checkInAt, r.checkOutAt ?? this.nowSig());
  });

  readonly elapsed = computed(() => formatElapsed(this.elapsedSeconds()));

  readonly progress = computed(() => {
    if (this.state() === 'done') return 1;
    return Math.min(1, this.elapsedSeconds() / RING_FULL_SECONDS);
  });
  readonly dashOffset = computed(() => RING_C * (1 - this.progress()));

  readonly canAct = computed(() => {
    const s = this.state();
    return (s === 'notStarted' || s === 'working') && !this.loading() && !this.busy();
  });

  press(): void {
    if (!this.canAct()) return;
    const note = this.note().trim() || null;
    if (this.state() === 'notStarted') this.checkIn.emit(note);
    else this.checkOut.emit(note);
  }
}
