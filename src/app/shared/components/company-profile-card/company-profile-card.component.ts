import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Presentational company-identity card — logo, legal + trade name, default
 * currency, contact links (email / phone / mobile / WhatsApp), website and
 * legal numbers. Reads the `CompanySettingsService` SSOT and renders only the
 * fields that are actually populated, so it stays clean for partially-filled
 * tenants. Reusable on dashboards, the settings page, or a company profile.
 */
@Component({
  selector: 'app-company-profile-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-profile-card.component.html',
  styleUrl: './company-profile-card.component.scss',
})
export class CompanyProfileCardComponent {
  protected readonly company = inject(CompanySettingsService);
  protected readonly fallbackLogo = '/assets/img/logo.png';

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== this.fallbackLogo) img.src = this.fallbackLogo;
  }
}
