import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  credentialIcon,
  environmentClass,
  formatBytes,
  platformIcon,
  stageClass,
  urlHost,
} from '../../../client-portal/utils/client-portal-ui.util';
import { DeliverablesService } from '../../data/deliverables.gateway';
import {
  AccessCredential,
  ProjectRelease,
  RELEASE_STAGES,
  ReleaseStage,
  WorkspaceScope,
} from '../../models/deliverables.models';
import { CredentialDialogComponent } from '../credential-dialog/credential-dialog.component';
import { ReleaseUploadDialogComponent } from '../release-upload-dialog/release-upload-dialog.component';

const UPLOADER_DELETE_WINDOW_MS = 24 * 3_600_000;

/**
 * "التسليمات" — what the client gets to see and use: access credentials for
 * the dashboards / sites, and the app versions (APK) they download. Replaces
 * the old GitHub builds tab. Admin and assigned developers manage it.
 */
@Component({
  selector: 'app-deliverables-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    CairoDatePipe,
    TimeAgoPipe,
    CopyButtonComponent,
    MockRibbonComponent,
    CredentialDialogComponent,
    ReleaseUploadDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deliverables-panel.component.html',
  styleUrl: './deliverables-panel.component.scss',
})
export class DeliverablesPanelComponent {
  private readonly deliverables = inject(DeliverablesService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly projectId = input.required<number>();
  readonly scope = input<WorkspaceScope>('admin');

  private readonly api = computed(() => this.deliverables.for(this.scope()));
  protected readonly isAdmin = computed(() => this.scope() === 'admin');

  // credentials
  protected readonly credentials = signal<AccessCredential[] | null>(null);
  protected readonly credFailed = signal(false);
  protected readonly credDialog = signal<{ existing: AccessCredential | null } | null>(null);
  protected readonly revealed = signal<Record<number, string>>({});
  protected readonly credBusy = signal<number | null>(null);

  // releases
  protected readonly releases = signal<ProjectRelease[] | null>(null);
  protected readonly relFailed = signal(false);
  protected readonly uploadOpen = signal(false);
  protected readonly droppedFile = signal<File | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly relBusy = signal<number | null>(null);

  protected readonly error = signal<string | null>(null);
  protected readonly stages = RELEASE_STAGES;

  protected readonly credIcon = credentialIcon;
  protected readonly envClass = environmentClass;
  protected readonly host = urlHost;
  protected readonly platformIcon = platformIcon;
  protected readonly stageClass = stageClass;
  protected readonly size = formatBytes;

  ngOnInit(): void {
    this.loadCredentials();
    this.loadReleases();
  }

  // ─────────── credentials ───────────

  protected loadCredentials(): void {
    this.credFailed.set(false);
    this.api().credentials(this.projectId()).subscribe({
      next: (list) => this.credentials.set([...list].sort((a, b) => a.orderIndex - b.orderIndex)),
      error: () => this.credFailed.set(true),
    });
  }

  protected onCredentialSaved(c: AccessCredential): void {
    this.credDialog.set(null);
    this.credentials.update((list) => {
      const rows = list ?? [];
      return rows.some((x) => x.id === c.id) ? rows.map((x) => (x.id === c.id ? c : x)) : [...rows, c];
    });
    this.revealed.update((m) => {
      const next = { ...m };
      delete next[c.id];
      return next;
    });
  }

  protected toggleReveal(c: AccessCredential): void {
    if (this.revealed()[c.id]) {
      this.revealed.update((m) => {
        const next = { ...m };
        delete next[c.id];
        return next;
      });
      return;
    }
    this.credBusy.set(c.id);
    this.fetchPassword(c.id)
      .then((pw) => this.revealed.update((m) => ({ ...m, [c.id]: pw })))
      .catch((e: ApiError) => this.error.set(e?.message ?? null))
      .finally(() => this.credBusy.set(null));
  }

  protected passwordSource(c: AccessCredential): () => Promise<string | null> {
    return async () => this.revealed()[c.id] ?? (await this.fetchPassword(c.id).catch(() => null));
  }

  protected toggleCredentialVisibility(c: AccessCredential): void {
    this.credBusy.set(c.id);
    this.api()
      .updateCredential(this.projectId(), c.id, {
        title: c.title, kind: c.kind, environment: c.environment, url: c.url, username: c.username,
        password: null, notes: c.notes, isVisibleToClient: !c.isVisibleToClient,
      })
      .subscribe({
        next: (saved) => {
          this.credBusy.set(null);
          this.credentials.update((list) => list?.map((x) => (x.id === saved.id ? saved : x)) ?? list);
        },
        error: (e: ApiError) => {
          this.credBusy.set(null);
          this.error.set(e?.message ?? null);
        },
      });
  }

  protected moveCredential(index: number, delta: -1 | 1): void {
    const list = [...(this.credentials() ?? [])];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const previous = this.credentials();
    this.credentials.set(list.map((c, i) => ({ ...c, orderIndex: i })));
    this.api()
      .reorderCredentials(this.projectId(), list.map((c) => c.id))
      .subscribe({
        error: (e: ApiError) => {
          this.credentials.set(previous);
          this.error.set(e?.message ?? null);
        },
      });
  }

  protected async deleteCredential(c: AccessCredential): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('deliverables.credentials.deleteTitle'),
      message: this.t('deliverables.credentials.deleteMessage').replace('{title}', c.title),
      confirmText: this.t('common.delete'),
      type: 'danger',
    });
    if (!ok) return;
    this.credBusy.set(c.id);
    this.api().deleteCredential(this.projectId(), c.id).subscribe({
      next: () => {
        this.credBusy.set(null);
        this.credentials.update((list) => list?.filter((x) => x.id !== c.id) ?? list);
      },
      error: (e: ApiError) => {
        this.credBusy.set(null);
        this.error.set(e?.message ?? null);
      },
    });
  }

  // ─────────── releases ───────────

  protected loadReleases(): void {
    this.relFailed.set(false);
    this.api().releases(this.projectId(), { pageSize: 50 }).subscribe({
      next: (page) => this.releases.set(page.data ?? []),
      error: () => this.relFailed.set(true),
    });
  }

  protected openUpload(file: File | null = null): void {
    this.droppedFile.set(file);
    this.uploadOpen.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.openUpload(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onUploaded(): void {
    this.uploadOpen.set(false);
    this.droppedFile.set(null);
    this.loadReleases();
  }

  protected changeStage(r: ProjectRelease, stage: ReleaseStage): void {
    if (r.stage === stage) return;
    this.patchRelease(r, { stage });
  }

  protected toggleReleaseVisibility(r: ProjectRelease): void {
    this.patchRelease(r, { isVisibleToClient: !r.isVisibleToClient });
  }

  protected canDeleteRelease(r: ProjectRelease): boolean {
    if (this.isAdmin()) return true;
    const me = this.auth.currentUser()?.userId;
    return !!me && r.uploadedById === me && Date.now() - Date.parse(r.createdAt) < UPLOADER_DELETE_WINDOW_MS;
  }

  protected async deleteRelease(r: ProjectRelease): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('deliverables.releases.deleteTitle'),
      message: this.t('deliverables.releases.deleteMessage').replace('{version}', r.versionName),
      confirmText: this.t('common.delete'),
      type: 'danger',
    });
    if (!ok) return;
    this.relBusy.set(r.id);
    this.api().deleteRelease(this.projectId(), r.id).subscribe({
      next: () => {
        this.relBusy.set(null);
        this.loadReleases();
      },
      error: (e: ApiError) => {
        this.relBusy.set(null);
        this.error.set(e?.message ?? null);
      },
    });
  }

  /** Staff download: authenticated GET as a blob (the interceptors add the token), then save. */
  protected async download(r: ProjectRelease): Promise<void> {
    if (!r.hasFile) {
      if (r.externalUrl) window.open(r.externalUrl, '_blank', 'noopener');
      return;
    }
    const path = this.api().downloadUrl(this.projectId(), r.id);
    if (!path) {
      this.error.set(this.t('deliverables.releases.mockDownload'));
      return;
    }
    this.relBusy.set(r.id);
    try {
      const blob = await firstValueFrom(this.http.get(`${environment.apiUrl.replace(/\/+$/, '')}/${path}`, { responseType: 'blob' }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName ?? `${r.versionName}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      this.error.set((e as ApiError)?.message ?? this.t('portal.releases.downloadFailed'));
    } finally {
      this.relBusy.set(null);
    }
  }

  // ─────────── internals ───────────

  private patchRelease(r: ProjectRelease, patch: Partial<Pick<ProjectRelease, 'stage' | 'isVisibleToClient'>>): void {
    const previous = this.releases();
    this.releases.update((list) => list?.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) ?? list);
    this.api().updateRelease(this.projectId(), r.id, patch).subscribe({
      error: (e: ApiError) => {
        this.releases.set(previous);
        this.error.set(e?.message ?? null);
      },
    });
  }

  private fetchPassword(id: number): Promise<string> {
    return firstValueFrom(this.api().revealCredential(this.projectId(), id)).then((r) => r.password);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
