import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LeaveRequest } from '../../models/attendance.models';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
import { ReviewDecision } from '../leave-requests-inbox/leave-requests-inbox.component';

const NOTE_MAX = 500;

/**
 * Approve / reject a pending request with an optional note
 * (`PUT /Attendance/Leaves/{id}/Review`). The employee is notified by the
 * server; the note is shown to them next to the decision.
 */
@Component({
  selector: 'app-review-leave-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-leave-dialog.component.html',
  styles: [`
    .rv-summary {
      display: grid; gap: .35rem; margin-bottom: 1rem; padding: .85rem 1rem;
      border-radius: var(--radius-md); background: var(--surface-2); font-size: var(--fs-sm);
    }
    .rv-summary strong { color: var(--text-1); }
    .rv-reason { margin: .25rem 0 0; color: var(--text-2); white-space: pre-line; overflow-wrap: anywhere; }
    .rv-counter { display: block; margin-top: .25rem; color: var(--text-3); font-size: var(--fs-xs); text-align: end; }
  `],
})
export class ReviewLeaveDialogComponent {
  readonly request = input.required<LeaveRequest>();
  readonly decision = input.required<ReviewDecision>();
  readonly done = output<void>();
  readonly cancel = output<void>();

  private readonly store = inject(TeamAttendanceStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly noteMax = NOTE_MAX;
  readonly note = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  confirm(): void {
    if (this.busy()) return;
    const approve = this.decision() === 'approve';
    this.busy.set(true);
    this.error.set(null);
    this.store.review(this.request().id, { approve, note: this.note().trim() || null }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(this.t(approve ? 'attendance.inbox.approved' : 'attendance.inbox.rejected'));
        this.done.emit();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.error.set(err?.message?.trim() || this.t('attendance.inbox.reviewFailed'));
      },
    });
  }

  close(): void {
    if (!this.busy()) this.cancel.emit();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
