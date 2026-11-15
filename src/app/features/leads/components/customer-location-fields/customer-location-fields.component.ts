import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { LocationLookupsService } from '../../../../core/services/location-lookups.service';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { Country, EGYPT_COUNTRY_ID, Governorate } from '../../../../shared/models/locations/location.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { governorateApplies } from '../../utils/customer-location.util';

/**
 * Country (optional, searchable) + Egyptian governorate for the add / edit
 * customer forms. Owns the coupling between the two controls; the parent
 * owns the controls and builds the payload (`customer-location.util.ts`).
 *
 *   - Governorate shows only for Egypt or while no country is chosen.
 *   - Picking a governorate selects Egypt.
 *   - Picking another country clears the governorate.
 *   - `inferredCountryName` (edit) turns the empty country into a hint:
 *     "مصر — من رقم الموبايل".
 */
@Component({
  selector: 'app-customer-location-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label fw-600" [attr.for]="idPrefix() + '-country'">
          {{ 'customers.location.country' | translate }}
          <span class="text-muted fw-normal small">({{ 'customers.location.optional' | translate }})</span>
        </label>
        <app-searchable-select
          [attr.id]="idPrefix() + '-country'"
          [formControl]="countryControl()"
          [options]="countryOptions()"
          [externalLoading]="loading()"
          labelKey="name"
          valueKey="id"
          subLabelKey="dialCode"
          [placeholder]="countryPlaceholder()"
          [searchPlaceholder]="'customers.location.searchCountry' | translate"
          [emptyText]="'customers.location.noMatch' | translate" />
        <small class="form-text d-flex align-items-center gap-1 mt-1">
          <i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
          {{ 'customers.location.countryHint' | translate }}
        </small>
      </div>

      @if (showGovernorate()) {
        <div class="col-md-6 loc-gov">
          <label class="form-label fw-600" [attr.for]="idPrefix() + '-governorate'">
            {{ 'customers.location.governorate' | translate }}
            <span class="text-muted fw-normal small">({{ 'customers.location.optional' | translate }})</span>
          </label>
          <app-searchable-select
            [attr.id]="idPrefix() + '-governorate'"
            [formControl]="governorateControl()"
            [options]="governorateOptions()"
            [externalLoading]="loading()"
            [transformLabel]="governorateLabel"
            labelKey="name"
            valueKey="id"
            subLabelKey="nameEn"
            [placeholder]="'customers.location.governoratePh' | translate"
            [searchPlaceholder]="'customers.location.searchGovernorate' | translate"
            [emptyText]="'customers.location.noMatch' | translate" />
          <small class="form-text d-block mt-1">{{ 'customers.location.governorateHint' | translate }}</small>
        </div>
      }

      @if (loadFailed()) {
        <div class="col-12">
          <div class="alert alert-warning py-2 mb-0 d-flex align-items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span class="me-auto">{{ 'customers.location.loadFailed' | translate }}</span>
            <button type="button" class="btn btn-sm btn-light" (click)="load()">{{ 'common.retry' | translate }}</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .loc-gov { animation: loc-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes loc-in { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .loc-gov { animation: none; } }
  `,
})
export class CustomerLocationFieldsComponent implements OnInit {
  private readonly lookups = inject(LocationLookupsService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly countryControl = input.required<FormControl<number | null>>();
  readonly governorateControl = input.required<FormControl<number | null>>();
  /** Edit only: the country the backend guessed from the phone (not a stored choice). */
  readonly inferredCountryName = input<string | null>(null);
  readonly idPrefix = input('loc');

  private readonly countries = signal<Country[]>([]);
  private readonly governorates = signal<Governorate[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  private readonly countryId = signal<number | null>(null);

  protected readonly countryOptions = computed(() => this.countries() as unknown as Record<string, unknown>[]);
  protected readonly governorateOptions = computed(() => this.governorates() as unknown as Record<string, unknown>[]);
  protected readonly showGovernorate = computed(() => governorateApplies(this.countryId()));

  protected readonly countryPlaceholder = computed(() => {
    const inferred = this.inferredCountryName();
    return inferred
      ? interpolate(this.t('customers.location.inferredPlaceholder'), { country: inferred })
      : this.t('customers.location.countryPlaceholder');
  });

  /** Arabic name in Arabic, English name in English. */
  protected readonly governorateLabel = (item: Record<string, unknown>): string =>
    String((this.language.lang() === 'en' ? item['nameEn'] : item['name']) ?? item['name'] ?? '');

  ngOnInit(): void {
    this.load();
    const country = this.countryControl();
    const governorate = this.governorateControl();

    country.valueChanges
      .pipe(startWith(country.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.countryId.set(id ?? null);
        if (!governorateApplies(id ?? null) && governorate.value != null) {
          governorate.setValue(null);
          governorate.markAsDirty();
        }
      });

    governorate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      if (id != null && country.value !== EGYPT_COUNTRY_ID) {
        country.setValue(EGYPT_COUNTRY_ID);
        country.markAsDirty();
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    let pending = 2;
    const done = () => --pending === 0 && this.loading.set(false);
    const fail = () => {
      this.loadFailed.set(true);
      done();
    };
    this.lookups.countries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.countries.set(rows);
        done();
      },
      error: fail,
    });
    this.lookups.governorates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.governorates.set(rows);
        done();
      },
      error: fail,
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
