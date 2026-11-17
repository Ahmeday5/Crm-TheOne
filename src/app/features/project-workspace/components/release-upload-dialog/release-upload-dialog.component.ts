import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatBytes, platformIcon } from '../../../client-portal/utils/client-portal-ui.util';
import { DeliverablesService } from '../../data/deliverables.gateway';
import {
  NewReleaseInput,
  ProjectRelease,
  RELEASE_NOTES_MAX,
  RELEASE_PLATFORMS,
  RELEASE_STAGES,
  RELEASE_VERSION_PATTERN,
  ReleaseFileProblem,
  ReleasePlatform,
  WorkspaceScope,
  checkReleaseFile,
  isHttpUrl,
  releaseAccept,
} from '../../models/deliverables.models';

/**
 * Publish an app version: drop the APK (or give a TestFlight / preview link),
 * version + stage + "what's new", then a real upload progress bar. Files are
 * pre-checked here (type / size / .aab) before a byte is sent.
 */
@Component({
  selector: 'app-release-upload-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './release-upload-dialog.component.html',
  styleUrl: './release-upload-dialog.component.scss',
})
export class ReleaseUploadDialogComponent {
  private readonly deliverables = inject(DeliverablesService);

  readonly projectId = input.required<number>();
  readonly scope = input.required<WorkspaceScope>();
  /** A file dropped on the panel before the dialog opened. */
  readonly initialFile = input<File | null>(null);
  readonly uploaded = output<ProjectRelease>();
  readonly closed = output<void>();

  protected readonly platforms = RELEASE_PLATFORMS;
  protected readonly stages = RELEASE_STAGES;
  protected readonly notesMax = RELEASE_NOTES_MAX;
  protected readonly platformIcon = platformIcon;
  protected readonly size = formatBytes;

  protected readonly form = signal<NewReleaseInput>({
    versionName: '', platform: 'Android', stage: 'Beta', releaseNotes: '', externalUrl: '', isVisibleToClient: true, file: null,
  });
  protected readonly fileProblem = signal<ReleaseFileProblem | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly touched = signal(false);
  protected readonly progress = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly accept = computed(() => releaseAccept(this.form().platform));
  protected readonly versionOk = computed(() => RELEASE_VERSION_PATTERN.test(this.form().versionName.trim()));
  protected readonly linkOk = computed(() => !this.form().externalUrl?.trim() || isHttpUrl(this.form().externalUrl!));
  protected readonly hasSource = computed(() => !!this.form().file || !!this.form().externalUrl?.trim());
  protected readonly valid = computed(() => this.versionOk() && this.linkOk() && this.hasSource() && !this.fileProblem());
  protected readonly uploading = computed(() => this.progress() !== null);

  private sub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
  }

  ngOnInit(): void {
    const f = this.initialFile();
    if (f) this.setFile(f);
  }

  protected patch(p: Partial<NewReleaseInput>): void {
    this.form.update((f) => ({ ...f, ...p }));
    if (p.platform) this.recheck();
  }

  protected onPick(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    if (file) this.setFile(file);
    el.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected clearFile(): void {
    this.patch({ file: null });
    this.fileProblem.set(null);
  }

  protected submit(): void {
    this.touched.set(true);
    if (!this.valid() || this.uploading()) return;
    this.error.set(null);
    this.progress.set(0);
    this.sub = this.deliverables
      .for(this.scope())
      .uploadRelease(this.projectId(), this.form())
      .subscribe({
        next: (e) => {
          if (e.kind === 'progress') this.progress.set(e.percent);
          else {
            this.progress.set(100);
            this.uploaded.emit(e.data);
          }
        },
        error: (e: ApiError) => {
          this.progress.set(null);
          this.error.set(e?.message ?? null);
        },
      });
  }

  protected cancel(): void {
    this.sub?.unsubscribe();
    this.closed.emit();
  }

  private setFile(file: File): void {
    this.patch({ file });
    // Guess the platform from the file the first time.
    const ext = file.name.split('.').pop()?.toLowerCase();
    const guess: ReleasePlatform | null = ext === 'apk' || ext === 'aab' ? 'Android' : ext === 'ipa' ? 'iOS' : null;
    if (guess && guess !== this.form().platform) this.patch({ platform: guess });
    // Suggest a version from names like app-1.3.0.apk.
    const v = file.name.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1];
    if (v && !this.form().versionName) this.patch({ versionName: v });
    this.recheck();
  }

  private recheck(): void {
    const f = this.form().file;
    this.fileProblem.set(f ? checkReleaseFile(f, this.form().platform) : null);
  }
}
