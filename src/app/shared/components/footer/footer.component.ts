import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * App shell footer — dynamic copyright (legal company name), website, contact
 * links and legal numbers, all sourced from `CompanySettingsService`. Renders
 * only the fields that are populated.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  protected readonly company = inject(CompanySettingsService);
  /** Static (set once at construction) — the calendar year doesn't change mid-session. */
  protected readonly year = new Date().getFullYear();
}
