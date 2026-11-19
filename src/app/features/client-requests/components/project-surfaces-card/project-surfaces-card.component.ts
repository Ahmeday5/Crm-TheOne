import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  APP_AUDIENCES,
  APP_PLATFORMS,
  AppAudience,
  AppPlatform,
  ProjectSurface,
  RequestTarget,
  SURFACE_NAME_MAX,
} from '../../../client-portal/models/client-portal.models';
import { UiError, toUiError } from '../../../client-portal/utils/request-errors.util';
import { audienceIcon, platformChipIcon, surfaceIcon, targetIcon } from '../../../client-portal/utils/request-target.util';
import { PROJECT_SURFACES_GATEWAY } from '../../data/project-surfaces.gateway';
import { SurfaceInput } from '../../models/client-requests.models';

const KINDS: ReadonlyArray<RequestTarget> = ['MobileApp', 'Dashboard', 'Website'];

interface Draft extends SurfaceInput {
  id: number | null;
}

/**
 * "مكونات المشروع" — the website, dashboard and each app of this project.
 * The client picks one of them when sending a request, so a project with a
 * customer app AND a courier app never gets an ambiguous "the app crashes".
 */
@Component({
  selector: 'app-project-surfaces-card',
  standalone: true,
  imports: [FormsModule, TranslatePipe, MockRibbonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-surfaces-card.component.html',
  styleUrl: './project-surfaces-card.component.scss',
})
export class ProjectSurfacesCardComponent {
  private readonly api = inject(PROJECT_SURFACES_GATEWAY);
  private readonly dialog = inject(DialogService);
  private readonly lang = inject(LanguageService);

  readonly projectId = input.required<number>();
  readonly canEdit = input(false);

  protected readonly kinds = KINDS;
  protected readonly audiences = APP_AUDIENCES;
  protected readonly platforms = APP_PLATFORMS.filter((p) => p !== 'Unknown');
  protected readonly nameMax = SURFACE_NAME_MAX;
  protected readonly surfaceIcon = surfaceIcon;
  protected readonly targetIcon = targetIcon;
  protected readonly audienceIcon = audienceIcon;
  protected readonly platformIcon = platformChipIcon;

  protected readonly items = signal<ProjectSurface[] | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly error = signal<UiError | null>(null);

  protected readonly sorted = computed(() => [...(this.items() ?? [])].sort((a, b) => a.orderIndex - b.orderIndex));
  protected readonly draftValid = computed(() => {
    const d = this.draft();
    return !!d && !!d.name.trim() && (d.kind !== 'MobileApp' || !!d.appAudience);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loadFailed.set(false);
    this.api.list(this.projectId()).subscribe({
      next: (list) => this.items.set(list),
      error: () => this.loadFailed.set(true),
    });
  }

  protected startNew(): void {
    this.error.set(null);
    this.draft.set({ id: null, kind: 'MobileApp', appAudience: null, name: '', platforms: 'Both', url: null, isActive: true });
  }

  protected startEdit(s: ProjectSurface): void {
    this.error.set(null);
    this.draft.set({ id: s.id, kind: s.kind, appAudience: s.appAudience, name: s.name, platforms: s.platforms, url: s.url, isActive: s.isActive });
  }

  protected patchDraft(patch: Partial<Draft>): void {
    this.draft.update((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      // Suggest a name from the audience while the field is still empty / auto-filled.
      if (patch.appAudience && (!d.name.trim() || d.name === this.audienceName(d.appAudience))) next.name = this.audienceName(patch.appAudience);
      if (patch.kind && patch.kind !== 'MobileApp') {
        next.appAudience = null;
        next.platforms = null;
        if (!d.name.trim()) next.name = this.t(`clientRequests.target.${patch.kind}`);
      }
      if (patch.kind === 'MobileApp' && !next.platforms) next.platforms = 'Both';
      return next;
    });
  }

  protected save(): void {
    const d = this.draft();
    if (!d || !this.draftValid() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const { id, ...input } = d;
    const body: SurfaceInput = { ...input, name: input.name.trim(), url: input.url?.trim() || null };
    const req$ = id == null ? this.api.create(this.projectId(), body) : this.api.update(this.projectId(), id, body);
    req$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.draft.set(null);
        this.items.update((list) => {
          const rest = (list ?? []).filter((x) => x.id !== saved.id);
          return [...rest, saved];
        });
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.error.set(toUiError(e));
      },
    });
  }

  protected toggleActive(s: ProjectSurface): void {
    const { id, orderIndex: _o, ...rest } = s;
    this.busyId.set(id);
    this.api.update(this.projectId(), id, { ...rest, isActive: !s.isActive }).subscribe({
      next: (saved) => {
        this.busyId.set(null);
        this.items.update((list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
      },
      error: (e: ApiError) => {
        this.busyId.set(null);
        this.error.set(toUiError(e));
      },
    });
  }

  protected move(s: ProjectSurface, delta: -1 | 1): void {
    const list = this.sorted();
    const from = list.findIndex((x) => x.id === s.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    const reordered = next.map((x, i) => ({ ...x, orderIndex: i }));
    const previous = this.items();
    this.items.set(reordered); // optimistic
    this.api.reorder(this.projectId(), reordered.map((x) => x.id)).subscribe({
      error: (e: ApiError) => {
        this.items.set(previous);
        this.error.set(toUiError(e));
      },
    });
  }

  protected async remove(s: ProjectSurface): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('clientRequests.surfaces.remove'),
      message: interpolate(this.t('clientRequests.surfaces.removeConfirm'), { name: s.name }),
      confirmText: this.t('common.delete'),
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(s.id);
    this.api.remove(this.projectId(), s.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load(); // the server may have only hidden it (old requests point at it)
      },
      error: (e: ApiError) => {
        this.busyId.set(null);
        this.error.set(toUiError(e));
      },
    });
  }

  private audienceName(a: AppAudience | null): string {
    return a ? this.t(`clientRequests.audience.${a}`) : '';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }

  protected platformLabel(p: AppPlatform | null): string {
    return p ? `clientRequests.platform.${p}` : '';
  }
}
