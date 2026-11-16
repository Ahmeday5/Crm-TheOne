import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectBuildsGateway } from '../../data/project-builds-gateway';
import { BuildComposerDialogComponent } from '../build-composer-dialog/build-composer-dialog.component';
import { buildStatusClass, buildStatusKey, formatBytes, platformIcon } from '../../utils/build-ui.util';

/**
 * The project's build archive: every published version, its platform, who
 * published it, the artifact (APK) and the auto-push-to-GitHub status. Any
 * developer on the project can publish a build; the source is pushed so code is
 * never lost. Table on desktop, cards on phones.
 */
@Component({
  selector: 'app-builds-panel',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, BuildComposerDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './builds-panel.component.html',
  styleUrl: './builds-panel.component.scss',
})
export class BuildsPanelComponent {
  private readonly gateway = inject(ProjectBuildsGateway);
  private readonly auth = inject(AuthService);

  readonly projectId = input.required<number>();
  /** Developers + Admin may publish a build. */
  readonly canPublish = input(true);

  protected readonly composerOpen = signal(false);

  protected readonly rows = toSignal(
    toObservable(this.projectId).pipe(switchMap((id) => this.gateway.builds$(id))),
    { initialValue: [] },
  );

  protected readonly latestPushed = computed(() => this.rows().find((b) => b.status === 'Pushed') ?? null);

  protected readonly statusClass = buildStatusClass;
  protected readonly statusKey = buildStatusKey;
  protected readonly platformIcon = platformIcon;
  protected readonly fmtBytes = formatBytes;

  protected isMine(developerId: string): boolean {
    return this.auth.currentUser()?.userId === developerId;
  }
}
