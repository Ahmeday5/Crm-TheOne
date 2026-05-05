import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * Stand-in for settings tabs that don't have a real implementation yet.
 * Reads its title key + icon from the route's `data` field, so a single
 * component covers all six placeholder tabs without per-tab files.
 */
@Component({
  selector: 'app-settings-placeholder',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-5 text-center">
      <span class="icon-tile xl tone-primary mx-auto mb-3"><i [class]="icon"></i></span>
      <h4 class="fw-700 mb-2">{{ titleKey | translate }}</h4>
      <p class="text-muted mb-0">{{ 'settings.placeholder.comingSoon' | translate }}</p>
    </div>
  `,
})
export class SettingsPlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly snap = this.route.snapshot.data;

  readonly titleKey: string = this.snap['titleKey'] ?? 'settings.title';
  readonly icon: string = this.snap['icon'] ?? 'fa-solid fa-circle-info';
}
