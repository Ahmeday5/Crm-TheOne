import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CompanyProfileCardComponent } from '../../../../shared/components/company-profile-card/company-profile-card.component';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { CompanySettings } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/** Max upload size for logo / favicon (2 MB). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    FormErrorComponent,
    LoadErrorComponent,
    CompanyProfileCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-settings.component.html',
  styleUrl: './company-settings.component.scss',
})
export class CompanySettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settings = inject(CompanySettingsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly submitting = signal(false);

  // ── image upload state ──
  private logoFile: File | null = null;
  private faviconFile: File | null = null;
  readonly logoPreview = signal<string | null>(null);
  readonly faviconPreview = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.minLength(2)]],
    tradeName: [''],
    email: ['', [Validators.email]],
    phone: [''],
    mobile: [''],
    website: [''],
    address: [''],
    commercialRegistration: [''],
    taxNumber: [''],
    defaultCurrency: [''],
  });

  ngOnInit(): void {
    const current = this.settings.settings();
    if (current) {
      this.patch(current);
    } else {
      this.reload();
    }
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.settings.load().subscribe({
      next: (s) => {
        this.patch(s);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('settings.company.loadFailed'));
      },
    });
  }

  private patch(s: CompanySettings): void {
    this.form.reset({
      companyName: s.companyName ?? '',
      tradeName: s.tradeName ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      mobile: s.mobile ?? '',
      website: s.website ?? '',
      address: s.address ?? '',
      commercialRegistration: s.commercialRegistration ?? '',
      taxNumber: s.taxNumber ?? '',
      defaultCurrency: s.defaultCurrency ?? '',
    });
    this.logoFile = null;
    this.faviconFile = null;
    this.logoPreview.set(this.settings.assetUrl(s.logoUrl));
    this.faviconPreview.set(this.settings.assetUrl(s.faviconUrl));
  }

  // ─────────── image pickers ───────────

  onLogoSelected(event: Event): void {
    const file = this.pickImage(event);
    if (file === undefined) return;
    this.logoFile = file;
    this.logoPreview.set(file ? URL.createObjectURL(file) : null);
  }

  onFaviconSelected(event: Event): void {
    const file = this.pickImage(event);
    if (file === undefined) return;
    this.faviconFile = file;
    this.faviconPreview.set(file ? URL.createObjectURL(file) : null);
  }

  /** Returns the validated File, or `undefined` when the pick was rejected. */
  private pickImage(event: Event): File | null | undefined {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      this.toast.error(this.t('settings.company.invalidImage'));
      input.value = '';
      return undefined;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.error(this.t('settings.company.imageTooLarge'));
      input.value = '';
      return undefined;
    }
    return file;
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.append('CompanyName', v.companyName.trim());
    fd.append('TradeName', (v.tradeName ?? '').trim());
    fd.append('Email', (v.email ?? '').trim());
    fd.append('Phone', (v.phone ?? '').trim());
    fd.append('Mobile', (v.mobile ?? '').trim());
    fd.append('Website', (v.website ?? '').trim());
    fd.append('Address', (v.address ?? '').trim());
    fd.append('CommercialRegistration', (v.commercialRegistration ?? '').trim());
    fd.append('TaxNumber', (v.taxNumber ?? '').trim());
    fd.append('DefaultCurrency', (v.defaultCurrency ?? '').trim());
    if (this.logoFile) fd.append('logo', this.logoFile);
    if (this.faviconFile) fd.append('favicon', this.faviconFile);

    this.submitting.set(true);
    this.settings.update(fd).subscribe({
      next: (s) => {
        this.submitting.set(false);
        this.patch(s);
        this.toast.success(this.t('settings.company.saved'));
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.toast.error(err?.message ?? this.t('settings.company.saveFailed'));
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
