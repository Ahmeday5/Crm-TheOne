import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { HourLabelPipe } from '../../pipes/hour-label.pipe';
import { RankedSlot } from '../../utils/contact-time.util';

/** The three recommended calling windows, as ranked medal cards. */
@Component({
  selector: 'app-top-contact-times',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, HourLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-contact-times.component.html',
  styleUrl: './top-contact-times.component.scss',
})
export class TopContactTimesComponent {
  readonly slots = input.required<RankedSlot[]>();
}
