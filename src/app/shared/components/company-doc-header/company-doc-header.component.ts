import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Branded letterhead for printable documents (contracts, quotations,
 * invoices). Renders the tenant's logo, legal name, address, contact lines and
 * — when present — the legal numbers that belong on official documents
 * (commercial registration + tax number).
 *
 * Reads `CompanySettingsService` (SSOT) and shows only populated fields, so it
 * degrades cleanly for partially-configured tenants. Print-friendly: no
 * interactivity, neutral ink-safe styling.
 */
@Component({
  selector: 'app-company-doc-header',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-doc-header.component.html',
  styleUrl: './company-doc-header.component.scss',
})
export class CompanyDocHeaderComponent {
  /** Show the commercial-registration / tax-number line (default on). */
  @Input() showLegal = true;

  protected readonly company = inject(CompanySettingsService);
  protected readonly fallbackLogo = '/assets/img/logo.png';

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== this.fallbackLogo) img.src = this.fallbackLogo;
  }
}
