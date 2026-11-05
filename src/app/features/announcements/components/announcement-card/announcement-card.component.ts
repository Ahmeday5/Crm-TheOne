import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Announcement } from '../../models/announcement.models';
import {
  TONE_ICON,
  announcementPhase,
  daysLeft,
  windowLength,
} from '../../utils/announcement.util';

/** Presentational card — all state changes are emitted to the page. */
@Component({
  selector: 'app-announcement-card',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, ClampTextDirective, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-card.component.html',
  styleUrl: './announcement-card.component.scss',
  host: { '[class.is-focused]': 'focused()' },
})
export class AnnouncementCardComponent {
  readonly announcement = input.required<Announcement>();
  readonly today = input.required<string>();
  readonly canManage = input(false);
  readonly focused = input(false);
  readonly busy = input(false);

  readonly markRead = output<Announcement>();
  readonly edit = output<Announcement>();
  readonly remove = output<Announcement>();
  readonly togglePin = output<Announcement>();

  readonly phase = computed(() => announcementPhase(this.announcement(), this.today()));
  readonly icon = computed(() => TONE_ICON[this.announcement().tone]);
  readonly daysLeft = computed(() => daysLeft(this.announcement(), this.today()));

  /** 0–100: how much of the window has elapsed (for the timeline bar). */
  readonly elapsed = computed(() => {
    const a = this.announcement();
    const phase = this.phase();
    if (phase === 'scheduled') return 0;
    if (phase === 'expired') return 100;
    const total = windowLength(a.startsOn, a.endsOn);
    const done = windowLength(a.startsOn, this.today());
    return Math.min(100, Math.round((done / total) * 100));
  });

  readonly readRate = computed(() => {
    const a = this.announcement();
    return a.recipientsCount ? Math.round((a.readCount / a.recipientsCount) * 100) : 0;
  });
}
