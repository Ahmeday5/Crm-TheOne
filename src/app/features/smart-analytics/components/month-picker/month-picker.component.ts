import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MonthKey } from '../../models/smart-analytics.models';
import { monthLabel, shiftMonth } from '../../utils/month.util';

interface MonthOption {
  key: MonthKey;
  label: string;
}

/**
 * Prev / next month stepper with a drop-down of the allowed months.
 * The label slides in the direction of travel.
 */
@Component({
  selector: 'app-month-picker',
  standalone: true,
  imports: [TranslatePipe, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-picker.component.html',
  styleUrl: './month-picker.component.scss',
})
export class MonthPickerComponent {
  private readonly language = inject(LanguageService);

  readonly month = input.required<MonthKey>();
  readonly min = input.required<MonthKey>();
  readonly max = input.required<MonthKey>();
  readonly monthChange = output<MonthKey>();

  readonly open = signal(false);
  /** +1 = moved forward, -1 = back — drives the slide direction. */
  readonly direction = signal<1 | -1>(1);

  private readonly locale = computed(() => (this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB'));

  readonly label = computed(() => monthLabel(this.month(), this.locale()));
  readonly canPrev = computed(() => this.month() > this.min());
  readonly canNext = computed(() => this.month() < this.max());

  readonly options = computed<MonthOption[]>(() => {
    const out: MonthOption[] = [];
    for (let m = this.max(); m >= this.min(); m = shiftMonth(m, -1)) {
      out.push({ key: m, label: monthLabel(m, this.locale()) });
    }
    return out;
  });

  step(delta: 1 | -1): void {
    const next = shiftMonth(this.month(), delta);
    if (next < this.min() || next > this.max()) return;
    this.direction.set(delta);
    this.monthChange.emit(next);
  }

  pick(key: MonthKey): void {
    this.open.set(false);
    if (key === this.month()) return;
    this.direction.set(key > this.month() ? 1 : -1);
    this.monthChange.emit(key);
  }
}
