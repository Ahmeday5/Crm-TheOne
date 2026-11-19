import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  APP_AUDIENCES,
  APP_NAME_MAX,
  APP_PLATFORMS,
  AppAudience,
  AppPlatform,
  ProjectSurface,
  REQUEST_TARGETS,
  RequestOptions,
  RequestTarget,
} from '../../models/client-portal.models';
import {
  EMPTY_TARGET,
  TargetDraft,
  activeSurfaces,
  audienceIcon,
  platformChipIcon,
  selectionFromSurface,
  surfaceIcon,
  targetIcon,
  targetProblem,
} from '../../utils/request-target.util';

/**
 * "What is this request about?" — big, tappable cards.
 *
 *  - The project lists its parts (surfaces) → one tap on "تطبيق المندوب".
 *  - Not configured → generic: Website / Dashboard / App / Other, and for an
 *    app: which app (customers, couriers, vendors, staff, other + name).
 *  - Platform (Android / iPhone) is optional and only for apps.
 *
 * Dumb: two-way `value`, the parent decides when to show `problem` errors.
 */
@Component({
  selector: 'app-request-target-picker',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-target-picker.component.html',
  styleUrl: './request-target-picker.component.scss',
})
export class RequestTargetPickerComponent {
  readonly value = model.required<TargetDraft>();
  readonly options = input<RequestOptions | null>(null);
  readonly disabled = input(false);
  /** Show the validation hint (after the user tried to continue). */
  readonly showErrors = input(false);

  protected readonly targets = REQUEST_TARGETS;
  protected readonly audiences = APP_AUDIENCES;
  protected readonly platforms = APP_PLATFORMS;
  protected readonly appNameMax = APP_NAME_MAX;
  protected readonly targetIcon = targetIcon;
  protected readonly audienceIcon = audienceIcon;
  protected readonly platformIcon = platformChipIcon;
  protected readonly surfaceIcon = surfaceIcon;

  protected readonly surfaces = computed(() => activeSurfaces(this.options()));
  protected readonly hasSurfaces = computed(() => this.surfaces().length > 0);
  protected readonly appCount = computed(() => this.surfaces().filter((s) => s.kind === 'MobileApp').length);

  protected readonly selectedSurface = computed(() => {
    const id = this.value().surfaceId;
    return id == null ? null : this.surfaces().find((s) => s.id === id) ?? null;
  });
  /** "Something else" picked while the project lists its parts. */
  protected readonly isOtherPicked = computed(() => this.value().surfaceId == null && this.value().target === 'Other');

  protected readonly isApp = computed(() => this.value().target === 'MobileApp');
  /** Ask the platform: generic app, or a surface built for both stores. */
  protected readonly askPlatform = computed(() => {
    if (!this.isApp()) return false;
    const s = this.selectedSurface();
    return !s || !s.platforms || s.platforms === 'Both';
  });
  protected readonly askAudience = computed(() => !this.hasSurfaces() && this.isApp());

  protected readonly problem = computed(() => (this.showErrors() ? targetProblem(this.value(), this.options()) : null));

  protected pickSurface(s: ProjectSurface): void {
    this.value.set({ ...selectionFromSurface(s), appPlatform: this.keepPlatform(s.kind) });
  }

  protected pickOther(): void {
    this.value.set({ ...EMPTY_TARGET, target: 'Other' });
  }

  protected pickTarget(t: RequestTarget): void {
    const cur = this.value();
    if (cur.target === t && cur.surfaceId == null) return;
    this.value.set({ ...EMPTY_TARGET, target: t, appPlatform: this.keepPlatform(t) });
  }

  protected pickAudience(a: AppAudience): void {
    this.value.update((v) => ({ ...v, appAudience: a, appName: a === 'Other' ? v.appName : null }));
  }

  protected pickPlatform(p: AppPlatform): void {
    this.value.update((v) => ({ ...v, appPlatform: v.appPlatform === p ? null : p }));
  }

  protected setAppName(name: string): void {
    this.value.update((v) => ({ ...v, appName: name }));
  }

  private keepPlatform(next: RequestTarget): AppPlatform | null {
    return next === 'MobileApp' ? this.value().appPlatform : null;
  }
}
