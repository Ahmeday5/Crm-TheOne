import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/models/api-response.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GITHUB_REPO_PATTERN, GitSettings } from '../../models/workspace.models';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';

/**
 * The project's GitHub repo + branch (where builds are pushed) and whether the
 * client sees new builds on their timeline. The token itself lives only on the
 * server; we just warn when it's missing.
 */
@Component({
  selector: 'app-git-settings-card',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './git-settings-card.component.html',
})
export class GitSettingsCardComponent {
  private readonly api = inject(ProjectWorkspaceService);

  readonly projectId = input.required<number>();
  readonly changed = output<void>();

  protected readonly settings = signal<GitSettings | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly repoUrl = signal('');
  protected readonly branch = signal('main');
  protected readonly showToClient = signal(false);
  protected readonly saving = signal(false);
  protected readonly savedFlash = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly urlValid = computed(() => {
    const v = this.repoUrl().trim();
    return v === '' || GITHUB_REPO_PATTERN.test(v);
  });
  protected readonly dirty = computed(() => {
    const s = this.settings();
    if (!s) return false;
    return (
      this.repoUrl().trim() !== (s.gitHubRepoUrl ?? '') ||
      (this.branch().trim() || 'main') !== s.gitBranch ||
      this.showToClient() !== s.showBuildsToClient
    );
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.gitSettings(this.projectId()).subscribe({
      next: (s) => {
        this.apply(s);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected save(): void {
    if (!this.urlValid() || !this.dirty() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .saveGitSettings(this.projectId(), {
        gitHubRepoUrl: this.repoUrl().trim(),
        gitBranch: this.branch().trim() || null,
        showBuildsToClient: this.showToClient(),
      })
      .subscribe({
        next: (s) => {
          this.saving.set(false);
          this.apply(s);
          this.changed.emit();
          this.savedFlash.set(true);
          setTimeout(() => this.savedFlash.set(false), 2000);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.error.set(e?.message ?? null);
        },
      });
  }

  private apply(s: GitSettings): void {
    this.settings.set(s);
    this.repoUrl.set(s.gitHubRepoUrl ?? '');
    this.branch.set(s.gitBranch || 'main');
    this.showToClient.set(s.showBuildsToClient);
  }
}
