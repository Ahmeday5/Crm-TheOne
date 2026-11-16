import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { projectStatusBadgeClass } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientPortalGateway } from '../../data/client-portal-gateway';
import { ClientProjectSummary } from '../../models/client-portal.models';

/** The client's landing page: one card per project — where it stands, at a glance. */
@Component({
  selector: 'app-client-projects',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-projects.component.html',
  styleUrl: './client-projects.component.scss',
})
export class ClientProjectsComponent {
  private readonly gateway = inject(ClientPortalGateway);
  private readonly auth = inject(AuthService);

  protected readonly projects = toSignal(
    this.gateway.myProjects$().pipe(map((list) => list as ClientProjectSummary[] | null)),
    { initialValue: null },
  );

  protected readonly firstName = computed(() => (this.auth.currentUser()?.fullName ?? '').split(' ')[0] || '');
  protected readonly statusClass = projectStatusBadgeClass;
}
