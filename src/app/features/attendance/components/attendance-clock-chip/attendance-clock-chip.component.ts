import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { secondsBetween } from '../../../../core/utils/cairo-time.util';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WorkHoursPipe } from '../../pipes/work-hours.pipe';
import { AttendanceTodayStore } from '../../state/attendance-today.store';

/**
 * Header time clock — on every page, for every employee:
 *
 *  - not checked in → "Check in" (one tap)
 *  - working        → live H:MM since check-in + "Check out" (confirmed)
 *  - done           → today's hours, links to the attendance page
 *  - on leave       → "On leave today", no actions
 *
 * Shares `AttendanceTodayStore` with the attendance page, so both always
 * show the same state. Errors (e.g. already checked in) are toasted by the
 * store with the server's message.
 */
@Component({
  selector: 'app-attendance-clock-chip',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CairoDatePipe, WorkHoursPipe, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-clock-chip.component.html',
  styleUrl: './attendance-clock-chip.component.scss',
})
export class AttendanceClockChipComponent {
  protected readonly store = inject(AttendanceTodayStore);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  /** Minute resolution is enough in the header (and cheaper than 1 s). */
  private readonly nowSig = signal(Date.now());

  constructor() {
    interval(30_000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.nowSig.set(Date.now()));
  }

  readonly ready = computed(() => this.store.loaded());
  readonly state = this.store.state;
  readonly busy = this.store.busy;
  readonly record = this.store.record;

  /** "3:25" since check-in (Latin digits, LTR — reads like a timer). */
  readonly elapsed = computed(() => {
    const checkIn = this.record()?.checkInAt;
    if (!checkIn) return '';
    const total = Math.floor(secondsBetween(checkIn, new Date(this.nowSig())) / 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  checkIn(): void {
    this.store.checkIn();
  }

  async checkOut(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('attendance.chip.confirmOutTitle'),
      message: this.t('attendance.chip.confirmOutMessage'),
      confirmText: this.t('attendance.clock.checkOut'),
      cancelText: this.t('attendance.chip.cancel'),
      type: 'info',
    });
    if (ok) this.store.checkOut();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
