import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { formatCalendarDate } from '../../../../core/utils/calendar-date.util';
import { DailyReport } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DailyReportsService } from '../../services/daily-reports.service';

/**
 * Read-only view of a daily report. Pulls the full record from
 * `GET /Reports/{id}` (cached, no global loader — the modal owns the spinner).
 */
@Component({
  selector: 'app-daily-report-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-report-details-dialog.component.html',
  styleUrl: './daily-report-details-dialog.component.scss',
})
export class DailyReportDetailsDialogComponent implements OnChanges {
  @Input({ required: true }) reportId!: number;

  @Output() cancel = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<DailyReport>();

  private readonly reports = inject(DailyReportsService);
  private readonly language = inject(LanguageService);

  readonly details = signal<DailyReport | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if ('reportId' in changes) this.fetch();
  }

  refresh(): void {
    this.fetch();
  }

  requestEdit(): void {
    const r = this.details();
    if (r) this.editRequested.emit(r);
  }

  formatDate(value: string | null | undefined): string {
    return formatCalendarDate(
      value,
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' },
    );
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1) return '-';
    return d.toLocaleString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { dateStyle: 'medium', timeStyle: 'short' },
    );
  }

  private fetch(): void {
    if (this.reportId == null) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.reports.getById(this.reportId).subscribe({
      next: (row) => {
        this.details.set(row);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.details.set(null);
      },
    });
  }
}
