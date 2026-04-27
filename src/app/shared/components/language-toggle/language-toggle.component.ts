import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Lang, LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="dropdown">
      <button
        class="btn-icon d-flex align-items-center gap-2"
        type="button"
        data-bs-toggle="dropdown"
        [attr.aria-label]="'header.language' | translate"
      >
        <i class="fa-solid fa-language fs-5"></i>
        <span class="d-none d-lg-inline fw-600">{{ language.lang() === 'ar' ? 'AR' : 'EN' }}</span>
      </button>

      <ul class="dropdown-menu dropdown-menu-end">
        @for (l of langs; track l.key) {
          <li>
            <button
              type="button"
              class="dropdown-item d-flex align-items-center justify-content-between"
              [class.active]="language.lang() === l.key"
              (click)="language.setLang(l.key)"
            >
              <span>{{ l.label }}</span>
              @if (language.lang() === l.key) {
                <i class="fa-solid fa-check text-primary"></i>
              }
            </button>
          </li>
        }
      </ul>
    </div>
  `,
})
export class LanguageToggleComponent {
  language = inject(LanguageService);

  readonly langs: { key: Lang; label: string }[] = [
    { key: 'ar', label: 'العربية' },
    { key: 'en', label: 'English' },
  ];
}
