import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Announcement } from '../../models/announcement.models';
import { AnnouncementsStore } from '../../state/announcements.store';
import {
  announcementPhase,
  announcementTone,
  daysLeft,
  targetLabelKey,
} from '../../utils/announcement.util';
import { AnnouncementReadersDialogComponent } from '../announcement-readers-dialog/announcement-readers-dialog.component';

/** One announcement in full — opened from the banner, a card or a notification. */
@Component({
  selector: 'app-announcement-detail-dialog',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, CairoDatePipe, AnnouncementReadersDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-detail-dialog.component.html',
  styleUrl: './announcement-detail-dialog.component.scss',
})
export class AnnouncementDetailDialogComponent {
  readonly announcement = input.required<Announcement>();
  readonly closed = output<void>();

  private readonly store = inject(AnnouncementsStore);
  readonly isAdmin = this.store.isAdmin;
  readonly readersOpen = signal(false);

  readonly phase = computed(() => announcementPhase(this.announcement(), this.store.today()));
  readonly tone = computed(() => announcementTone(this.announcement()));
  readonly daysLeft = computed(() => daysLeft(this.announcement(), this.store.today()));
  readonly targetKey = computed(() => targetLabelKey(this.announcement().target));
}
