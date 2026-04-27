import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ColorScheme, ThemeMode, ThemeService } from '../../../core/services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="dropdown">
      <button
        class="btn-icon"
        type="button"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        [attr.aria-label]="'header.theme' | translate"
      >
        <i class="fa-solid fa-palette fs-5"></i>
      </button>

      <div class="dropdown-menu dropdown-menu-end p-3" style="min-width: 280px">
        <h6 class="text-muted mb-2">{{ 'header.theme' | translate }}</h6>

        <div class="row g-2 mb-3">
          <div class="col-6">
            <button
              type="button"
              class="btn w-100 d-flex align-items-center justify-content-center gap-2"
              [class.btn-primary]="theme.mode() === 'light'"
              [class.btn-light]="theme.mode() !== 'light'"
              (click)="theme.setMode('light')"
            >
              <i class="fa-solid fa-sun"></i>
              <span>{{ 'header.mode.light' | translate }}</span>
            </button>
          </div>
          <div class="col-6">
            <button
              type="button"
              class="btn w-100 d-flex align-items-center justify-content-center gap-2"
              [class.btn-primary]="theme.mode() === 'dark'"
              [class.btn-light]="theme.mode() !== 'dark'"
              (click)="theme.setMode('dark')"
            >
              <i class="fa-solid fa-moon"></i>
              <span>{{ 'header.mode.dark' | translate }}</span>
            </button>
          </div>
        </div>

        <h6 class="text-muted mb-2">{{ 'header.color.label' | translate }}</h6>

        <div class="row g-2">
          @for (c of colors; track c.key) {
            <div class="col-4">
              <button
                type="button"
                class="btn btn-light w-100 d-flex flex-column align-items-center gap-2 py-2"
                [class.border-brand]="theme.color() === c.key"
                (click)="theme.setColor(c.key)"
              >
                <span class="dot" [class]="c.key"></span>
                <small>{{ c.label | translate }}</small>
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);

  readonly colors: { key: ColorScheme; label: string }[] = [
    { key: 'blue',   label: 'header.color.blue' },
    { key: 'purple', label: 'header.color.purple' },
    { key: 'green',  label: 'header.color.green' },
  ];

  // expose for template type-narrowing
  protected readonly _ = null as unknown as ThemeMode;
}
