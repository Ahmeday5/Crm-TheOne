import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { REVIEW_NOTE_MAX, RepReviewInput } from '../../models/smart-analytics.models';
import { RepPerformanceView, isValidRating } from '../../utils/rep-performance.util';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

/**
 * Admin's monthly review of one sales rep: 1–5 stars + a note.
 * Presentational — the page performs the save and passes `saving` back.
 */
@Component({
  selector: 'app-rep-review-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslatePipe, ModalComponent, UserAvatarComponent, RatingStarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rep-review-dialog.component.html',
  styleUrl: './rep-review-dialog.component.scss',
})
export class RepReviewDialogComponent {
  /** `null` = closed. */
  readonly rep = input<RepPerformanceView | null>(null);
  readonly monthLabel = input('');
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly save = output<RepReviewInput>();

  readonly noteMax = REVIEW_NOTE_MAX;
  readonly rating = signal(0);
  readonly note = signal('');
  readonly touched = signal(false);

  readonly open = computed(() => !!this.rep());
  readonly ratingInvalid = computed(() => !isValidRating(this.rating()));
  readonly noteLength = computed(() => this.note().trim().length);
  readonly dirty = computed(() => {
    const review = this.rep()?.review;
    return this.rating() !== (review?.rating ?? 0) || this.note().trim() !== (review?.note ?? '');
  });

  constructor() {
    // Each opening starts from the rep's saved review (or blank).
    effect(() => {
      const rep = this.rep();
      untracked(() => {
        this.rating.set(rep?.review?.rating ?? 0);
        this.note.set(rep?.review?.note ?? '');
        this.touched.set(false);
      });
    });
  }

  submit(): void {
    this.touched.set(true);
    if (this.ratingInvalid() || this.noteLength() > this.noteMax || this.saving()) return;
    this.save.emit({ rating: this.rating(), note: this.note().trim() });
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }
}
