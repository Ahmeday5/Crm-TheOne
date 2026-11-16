import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { projectStatusBadgeClass } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RequestsListComponent } from '../../components/requests-list/requests-list.component';
import { ClientPortalGateway } from '../../data/client-portal-gateway';
import { ClientProjectDetail } from '../../models/client-portal.models';
import { timelineIcon } from '../../utils/client-portal-ui.util';

type Tab = 'requests' | 'updates';

/**
 * One project, as its owner sees it: how far along it is, the milestones as a
 * simple stepper, their requests (raise a problem / change / question) and the
 * latest updates. Nothing internal (team, code, credentials) is shown.
 */
@Component({
  selector: 'app-client-project',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, TranslatePipe, CairoDatePipe, RequestsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-project.component.html',
  styleUrl: './client-project.component.scss',
})
export class ClientProjectComponent {
  private readonly gateway = inject(ClientPortalGateway);
  private readonly route = inject(ActivatedRoute);

  private readonly id$ = this.route.paramMap.pipe(map((p) => Number(p.get('id')) || 0));

  protected readonly projectId = toSignal(this.id$, { initialValue: 0 });
  /** `undefined` = loading, `null` = not found / not theirs. */
  protected readonly project = toSignal<ClientProjectDetail | null | undefined>(
    this.id$.pipe(switchMap((id) => this.gateway.project$(id))),
    { initialValue: undefined },
  );
  protected readonly timeline = toSignal(this.id$.pipe(switchMap((id) => this.gateway.timeline$(id))), {
    initialValue: [],
  });

  protected readonly tab = signal<Tab>('requests');

  protected readonly doneCount = computed(
    () => this.project()?.milestones.filter((m) => m.status === 'Done').length ?? 0,
  );

  protected readonly statusClass = projectStatusBadgeClass;
  protected readonly timelineIcon = timelineIcon;
}
