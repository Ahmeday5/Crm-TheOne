import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RepPerformanceView } from '../../utils/rep-performance.util';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

/** Per-rep monthly figures with the admin's star rating and note. */
@Component({
  selector: 'app-rep-performance-table',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    CairoDatePipe,
    TipDirective,
    ClampTextDirective,
    ResponsiveTableDirective,
    UserAvatarComponent,
    RatingStarsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rep-performance-table.component.html',
  styleUrl: './rep-performance-table.component.scss',
})
export class RepPerformanceTableComponent {
  readonly reps = input.required<RepPerformanceView[]>();
  readonly refreshing = input(false);
  readonly review = output<RepPerformanceView>();
}
