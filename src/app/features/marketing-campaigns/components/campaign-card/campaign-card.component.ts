import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { Campaign, CampaignStatus } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * Visual representation of a single campaign in the list view.
 *
 * Pure presentational — emits intents (`view`, `toggle`, `delete`) and lets
 * the parent component decide what to do. Only renders fields the list
 * endpoint provides; richer details (spent, remaining, daysElapsed…) live
 * in the details dialog.
 */
@Component({
  selector: 'app-campaign-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-card.component.html',
  styleUrl: './campaign-card.component.scss',
})
export class CampaignCardComponent {
  @Input({ required: true }) campaign!: Campaign;
  @Input() busy = false;

  @Output() view = new EventEmitter<Campaign>();
  @Output() edit = new EventEmitter<Campaign>();
  @Output() toggle = new EventEmitter<Campaign>();
  @Output() delete = new EventEmitter<Campaign>();

  private readonly language = inject(LanguageService);

  statusKey(status: CampaignStatus): string {
    return `campaigns.status.${status.toLowerCase()}`;
  }

  statusBadgeClass(status: CampaignStatus): string {
    switch (status) {
      case 'Active':    return 'status-active';
      case 'NotActive': return 'status-paused';
      case 'Completed': return 'status-completed';
      case 'Cancelled': return 'status-cancelled';
      default:          return 'status-paused';
    }
  }

  statusIcon(status: CampaignStatus): string {
    switch (status) {
      case 'Active':    return 'fa-solid fa-play';
      case 'NotActive': return 'fa-solid fa-pause';
      case 'Completed': return 'fa-solid fa-flag-checkered';
      case 'Cancelled': return 'fa-solid fa-ban';
      default:          return 'fa-regular fa-circle';
    }
  }

  /**
   * The toggle endpoint flips Active ↔ NotActive. For Completed / Cancelled
   * it's a no-op on the backend, but we keep the button visible (per spec)
   * — it just resumes (i.e. activates) the campaign.
   */
  toggleIcon(status: CampaignStatus): string {
    return status === 'Active' ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  }

  toggleKey(status: CampaignStatus): string {
    return status === 'Active' ? 'campaigns.card.pause' : 'campaigns.card.resume';
  }

  ageRange(c: Campaign): string {
    if (!c.minAge && !c.maxAge) return '-';
    return `${c.minAge ?? 0} - ${c.maxAge ?? 0}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1) return '-';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }

  formatNumber(n: number | null | undefined): string {
    if (n == null) return '0';
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }
}
