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
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CampaignDetails } from '../../../../shared/models';
import { CampaignsService } from '../../services/campaigns.service';

@Component({
  selector: 'app-campaign-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-details-dialog.component.html',
  styleUrl: './campaign-details-dialog.component.scss',
})
export class CampaignDetailsDialogComponent implements OnChanges {
  @Input({ required: true }) campaignId!: number;

  @Output() cancel = new EventEmitter<void>();

  private readonly campaigns = inject(CampaignsService);
  private readonly language = inject(LanguageService);

  readonly details = signal<CampaignDetails | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if ('campaignId' in changes) {
      this.fetch();
    }
  }

  refresh(): void {
    this.fetch();
  }

  reload(): void {
    this.fetch();
  }

  formatNumber(n: number | null | undefined): string {
    if (n == null) return '-';
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    if (d.getFullYear() <= 1) return '-';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }

  spentPercent(): number {
    const d = this.details();
    if (!d) return 0;
    const pct = Number(d.spentPercentage ?? 0);
    if (Number.isFinite(pct) && pct > 0) return Math.min(100, Math.round(pct));
    if (d.budget > 0)
      return Math.min(100, Math.round((d.spent ?? 0 / d.budget) * 100));
    return 0;
  }

  ageRangeLabel(): string {
    const d = this.details();
    if (!d) return '-';
    if (!d.minAge && !d.maxAge) return '-';
    return `${d.minAge ?? 0} - ${d.maxAge ?? 0}`;
  }

  private fetch(): void {
    if (this.campaignId == null) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.loadError.set(null);
    this.campaigns.getById(this.campaignId).subscribe({
      next: (row) => {
        this.details.set(row);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.details.set(null);
        this.loadError.set(this.t('campaigns.messages.loadFailed'));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
