import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { GoalProgressEntry } from '../../../../shared/models';
import { AssetUrlPipe } from '../../../../shared/pipes/asset-url.pipe';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * "Amounts log" for a goal — every logged amount, newest first, with who
 * logged it, when (Cairo time), the details and a proof-of-payment
 * thumbnail that opens full size in a lightbox.
 *
 * Presentational: editing and deleting are delegated to the parent via
 * `edit` / `remove`, shown only when `canEdit` (Admin). `busyEntryId` marks
 * the row whose delete is in flight.
 */
@Component({
  selector: 'app-goal-progress-history',
  standalone: true,
  imports: [
    TranslatePipe,
    MoneyPipe,
    CairoDatePipe,
    AssetUrlPipe,
    ModalComponent,
    UserAvatarComponent,
    ClampTextDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goal-progress-history.component.html',
  styleUrl: './goal-progress-history.component.scss',
})
export class GoalProgressHistoryComponent {
  readonly entries = input<readonly GoalProgressEntry[] | null | undefined>([]);
  readonly canEdit = input<boolean>(false);
  /** Entry currently being deleted — its actions are locked and spinning. */
  readonly busyEntryId = input<number | null>(null);

  readonly edit = output<GoalProgressEntry>();
  readonly remove = output<GoalProgressEntry>();

  protected readonly rows = computed(() => this.entries() ?? []);
  protected readonly total = computed(() =>
    this.rows().reduce((sum, e) => sum + (Number(e.value) || 0), 0),
  );

  /** Entry whose attachment is open in the lightbox. */
  protected readonly preview = signal<GoalProgressEntry | null>(null);
}
