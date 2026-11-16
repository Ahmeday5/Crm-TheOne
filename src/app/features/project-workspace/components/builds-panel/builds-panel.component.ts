import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { resolveAssetUrl } from '../../../../core/utils/asset-url.util';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectBuild, isBuildInFlight } from '../../models/workspace.models';
import { BuildsScope, ProjectBuildsService } from '../../services/project-builds.service';
import {
  buildCommitUrl,
  buildSourceZipUrl,
  buildStatusClass,
  buildTagUrl,
  formatBytes,
  platformIcon,
} from '../../utils/build-ui.util';
import { BuildUploadDialogComponent } from '../build-upload-dialog/build-upload-dialog.component';

const PAGE_SIZE = 20;

/**
 * The project's builds, newest first. Builds still being pushed to GitHub are
 * polled live (every 3 s, ≤ 10 min, stops when the page is left); a failed one
 * offers Retry (its owner, or any admin).
 */
@Component({
  selector: 'app-builds-panel',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, BuildUploadDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './builds-panel.component.html',
  styleUrl: './builds-panel.component.scss',
})
export class BuildsPanelComponent {
  private readonly api = inject(ProjectBuildsService);
  private readonly auth = inject(AuthService);

  readonly projectId = input.required<number>();
  readonly scope = input.required<BuildsScope>();
  /** Only developers on the project upload (the backend enforces it). */
  readonly canUpload = input(false);
  /** The project has a GitHub repo — uploads fail without one. */
  readonly repoConfigured = input(true);

  protected readonly rows = signal<ProjectBuild[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly uploadOpen = signal(false);
  protected readonly retryingId = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly hasMore = computed(() => this.rows().length < this.total());
  protected readonly latestPushed = computed(() => this.rows().find((b) => b.status === 'Pushed') ?? null);
  /** Newest build — prefills the next version in the upload dialog. */
  protected readonly newest = computed<ProjectBuild | null>(() => this.rows().at(0) ?? null);

  protected readonly statusClass = buildStatusClass;
  protected readonly platformIcon = platformIcon;
  protected readonly fmtBytes = formatBytes;
  protected readonly tagUrl = buildTagUrl;
  protected readonly commitUrl = buildCommitUrl;
  protected readonly sourceZipUrl = buildSourceZipUrl;
  protected readonly inFlight = isBuildInFlight;

  /** One poller per in-flight build id. */
  private readonly pollers = new Map<number, Subscription>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pollers.forEach((s) => s.unsubscribe()));
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.list(this.scope(), this.projectId(), { pageIndex: 1, pageSize: PAGE_SIZE }).subscribe({
      next: (page) => {
        this.rows.set(page.data ?? []);
        this.total.set(page.count ?? 0);
        this.page.set(1);
        this.loading.set(false);
        this.pollInFlight();
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected loadMore(): void {
    if (this.loadingMore()) return;
    const next = this.page() + 1;
    this.loadingMore.set(true);
    this.api.list(this.scope(), this.projectId(), { pageIndex: next, pageSize: PAGE_SIZE }).subscribe({
      next: (page) => {
        const have = new Set(this.rows().map((b) => b.id));
        this.rows.update((rows) => [...rows, ...(page.data ?? []).filter((b) => !have.has(b.id))]);
        this.total.set(page.count ?? this.total());
        this.page.set(next);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  protected onUploaded(build: ProjectBuild): void {
    this.uploadOpen.set(false);
    this.rows.update((rows) => [build, ...rows.filter((b) => b.id !== build.id)]);
    this.total.update((n) => n + 1);
    this.watch(build.id);
  }

  protected canRetry(b: ProjectBuild): boolean {
    if (b.status !== 'Failed') return false;
    return this.scope() === 'admin' || b.developerId === this.auth.currentUser()?.userId;
  }

  protected retry(b: ProjectBuild): void {
    this.retryingId.set(b.id);
    this.error.set(null);
    this.api.retry(this.scope(), this.projectId(), b.id).subscribe({
      next: (fresh) => {
        this.retryingId.set(null);
        this.replace(fresh);
        this.watch(fresh.id);
      },
      error: (e: ApiError) => {
        this.retryingId.set(null);
        this.error.set(e?.message ?? null);
      },
    });
  }

  protected download(b: ProjectBuild): string | null {
    return resolveAssetUrl(b.artifactUrl);
  }

  protected isMine(b: ProjectBuild): boolean {
    return !!b.developerId && b.developerId === this.auth.currentUser()?.userId;
  }

  // ─────────── polling ───────────

  private pollInFlight(): void {
    for (const b of this.rows()) if (isBuildInFlight(b.status)) this.watch(b.id);
  }

  private watch(id: number): void {
    if (this.pollers.has(id)) return;
    const sub = this.api.watch(this.scope(), this.projectId(), id).subscribe({
      next: (b) => this.replace(b),
      complete: () => this.pollers.delete(id),
      error: () => this.pollers.delete(id),
    });
    this.pollers.set(id, sub);
  }

  private replace(b: ProjectBuild): void {
    this.rows.update((rows) => rows.map((r) => (r.id === b.id ? b : r)));
  }
}
