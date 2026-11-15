import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CustomerLocation } from '../../models/locations/location.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TipDirective } from '../../directives/tip.directive';
import { CountryFlagComponent } from '../country-flag/country-flag.component';

/**
 * A customer's country (+ flag) and Egyptian governorate. A country guessed
 * from the phone number is muted and explains itself on hover; an unknown
 * country renders `—`.
 *
 *   <app-customer-location [location]="row" />
 *   <app-customer-location [location]="customer" layout="stacked" />
 */
@Component({
  selector: 'app-customer-location',
  standalone: true,
  imports: [TranslatePipe, TipDirective, CountryFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let loc = location();
    @if (loc?.countryName) {
      <span class="cl" [class.is-stacked]="layout() === 'stacked'">
        <span class="cl__country" [class.is-inferred]="loc!.countryInferred"
              [appTip]="loc!.countryInferred ? ('customers.location.inferredTip' | translate) : ''">
          <app-country-flag [iso2]="loc!.countryIso2" />
          <span class="cl__name" dir="auto">{{ loc!.countryName }}</span>
          @if (loc!.countryInferred) {
            <i class="fa-solid fa-mobile-screen-button cl__hint" aria-hidden="true"></i>
            <span class="visually-hidden">{{ 'customers.location.inferredTip' | translate }}</span>
          }
        </span>
        @if (loc!.governorateName) {
          <span class="cl__gov" dir="auto">
            <i class="fa-solid fa-location-dot" aria-hidden="true"></i>{{ loc!.governorateName }}
          </span>
        }
      </span>
    } @else {
      <span class="text-muted">{{ emptyText() ?? '—' }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; min-width: 0; max-width: 100%; }
    .cl { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.6rem; min-width: 0; }
    .cl.is-stacked { flex-direction: column; align-items: flex-start; }
    .cl__country { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; font-weight: var(--fw-600); }
    .cl__country.is-inferred { color: var(--text-3); font-weight: var(--fw-500); }
    .cl__hint { font-size: 0.75em; opacity: 0.8; }
    .cl__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cl__gov { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--text-2); font-size: var(--fs-sm); }
    .cl__gov i { color: var(--brand-500); opacity: 0.8; }
  `,
})
export class CustomerLocationComponent {
  readonly location = input<CustomerLocation | null | undefined>(null);
  readonly layout = input<'inline' | 'stacked'>('inline');
  /** Replaces `—` for an unknown country. */
  readonly emptyText = input<string | null>(null);
}
