import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectBuildsGateway } from '../../data/project-builds-gateway';
import { BUILD_PLATFORMS, BuildPlatform, NewBuildDraft } from '../../models/project-build.models';
import { formatBytes } from '../../utils/build-ui.util';

/**
 * Publishes a new build: pick the artifact (APK/package), version, platform and
 * notes. On submit the gateway "uploads" and the source auto-pushes to GitHub;
 * the parent's builds list reflects the new row and its status.
 */
@Component({
  selector: 'app-build-composer-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './build-composer-dialog.component.html',
})
export class BuildComposerDialogComponent {
  private readonly gateway = inject(ProjectBuildsGateway);

  readonly projectId = input.required<number>();
  readonly published = output<void>();
  readonly closed = output<void>();

  protected readonly platforms = BUILD_PLATFORMS;
  protected readonly versionName = signal('');
  protected readonly platform = signal<BuildPlatform>('Android');
  protected readonly notes = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly fmtBytes = formatBytes;

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  protected get canSubmit(): boolean {
    return !!this.versionName().trim() && !this.submitting();
  }

  protected submit(): void {
    if (!this.canSubmit) return;
    this.submitting.set(true);
    this.error.set(null);
    const draft: NewBuildDraft = {
      projectId: this.projectId(),
      versionName: this.versionName(),
      platform: this.platform(),
      notes: this.notes(),
      artifact: this.file(),
    };
    this.gateway.publishBuild(draft).subscribe({
      next: () => {
        this.submitting.set(false);
        this.published.emit();
        this.closed.emit();
      },
      error: (e: Error) => {
        this.submitting.set(false);
        this.error.set(e?.message ?? 'تعذّر نشر النسخة');
      },
    });
  }
}
