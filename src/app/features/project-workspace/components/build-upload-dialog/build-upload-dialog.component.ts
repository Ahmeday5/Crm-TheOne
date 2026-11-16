import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  BUILD_PLATFORMS,
  BUILD_VERSION_PATTERN,
  BuildPlatform,
  BuildSourceMode,
  COMMIT_SHA_PATTERN,
  ProjectBuild,
} from '../../models/workspace.models';
import { ProjectBuildsService } from '../../services/project-builds.service';
import { formatBytes, nextPatchVersion, platformIcon } from '../../utils/build-ui.util';

const MAX_ARTIFACT_BYTES = 500 * 1024 * 1024;
const MAX_SOURCE_BYTES = 300 * 1024 * 1024;

/**
 * Upload a build: platform chips → version (prefilled: last + 1 patch) →
 * artifact (drag & drop) → source: a zip the server pushes, or the commit the
 * developer already pushed. Shows upload progress; on 202 hands the new
 * `Pending` build to the parent, which polls it.
 */
@Component({
  selector: 'app-build-upload-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './build-upload-dialog.component.html',
  styleUrl: './build-upload-dialog.component.scss',
})
export class BuildUploadDialogComponent {
  private readonly api = inject(ProjectBuildsService);

  readonly projectId = input.required<number>();
  /** Last build, to prefill the version and platform. */
  readonly lastBuild = input<ProjectBuild | null>(null);

  readonly uploaded = output<ProjectBuild>();
  readonly closed = output<void>();

  protected readonly platforms = BUILD_PLATFORMS;
  protected readonly platformIcon = platformIcon;
  protected readonly fmtBytes = formatBytes;

  protected readonly platform = signal<BuildPlatform>('Android');
  protected readonly versionName = signal('');
  protected readonly notes = signal('');
  protected readonly artifact = signal<File | null>(null);
  protected readonly sourceMode = signal<BuildSourceMode>('archive');
  protected readonly sourceFile = signal<File | null>(null);
  protected readonly commitSha = signal('');
  protected readonly dragOver = signal<'artifact' | 'source' | null>(null);

  protected readonly progress = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  private upload?: Subscription;

  protected readonly versionValid = computed(() => BUILD_VERSION_PATTERN.test(this.versionName().trim()));
  protected readonly shaValid = computed(() => COMMIT_SHA_PATTERN.test(this.commitSha().trim()));
  protected readonly sourceReady = computed(() =>
    this.sourceMode() === 'archive' ? !!this.sourceFile() : this.shaValid(),
  );
  protected readonly uploading = computed(() => this.progress() !== null);
  protected readonly canSubmit = computed(() => this.versionValid() && this.sourceReady() && !this.uploading());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.upload?.unsubscribe());
  }

  ngOnInit(): void {
    const last = this.lastBuild();
    this.versionName.set(nextPatchVersion(last?.versionName));
    if (last) this.platform.set(last.platform);
  }

  protected pick(kind: 'artifact' | 'source', event: Event): void {
    const el = event.target as HTMLInputElement;
    this.accept(kind, el.files?.[0] ?? null);
    el.value = '';
  }

  protected onDrop(kind: 'artifact' | 'source', event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(null);
    this.accept(kind, event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(kind: 'artifact' | 'source', event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(kind);
  }

  protected clear(kind: 'artifact' | 'source'): void {
    (kind === 'artifact' ? this.artifact : this.sourceFile).set(null);
  }

  private accept(kind: 'artifact' | 'source', file: File | null): void {
    this.error.set(null);
    if (!file) return;
    if (kind === 'source') {
      if (!file.name.toLowerCase().endsWith('.zip')) return this.error.set('zipOnly');
      if (file.size > MAX_SOURCE_BYTES) return this.error.set('sourceTooBig');
      this.sourceFile.set(file);
    } else {
      if (file.size > MAX_ARTIFACT_BYTES) return this.error.set('artifactTooBig');
      this.artifact.set(file);
    }
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const source =
      this.sourceMode() === 'archive'
        ? { mode: 'archive' as const, file: this.sourceFile()! }
        : { mode: 'commit' as const, sha: this.commitSha() };
    this.error.set(null);
    this.progress.set(0);
    this.upload = this.api
      .upload(this.projectId(), {
        versionName: this.versionName(),
        platform: this.platform(),
        notes: this.notes(),
        artifact: this.artifact(),
        source,
      })
      .subscribe({
        next: (e) => {
          if (e.kind === 'progress') this.progress.set(e.percent);
          else {
            this.progress.set(null);
            this.uploaded.emit(e.data);
          }
        },
        error: (e: ApiError) => {
          this.progress.set(null);
          this.error.set(e?.message || 'generic');
        },
      });
  }

  protected cancel(): void {
    this.upload?.unsubscribe();
    this.closed.emit();
  }
}
