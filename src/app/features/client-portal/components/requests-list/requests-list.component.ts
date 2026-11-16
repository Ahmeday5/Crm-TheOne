import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientPortalGateway } from '../../data/client-portal-gateway';
import { ClientRequest } from '../../models/client-portal.models';
import { isRequestOpen, requestPriorityClass, requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';
import { NewRequestDialogComponent } from '../new-request-dialog/new-request-dialog.component';
import { RequestThreadDialogComponent } from '../request-thread-dialog/request-thread-dialog.component';

type Scope = 'open' | 'all';

/**
 * A project's requests. Client: "New request" + their own requests. Staff:
 * every request with triage (open the thread to change status / priority).
 * Open requests first by default — that's what needs attention.
 */
@Component({
  selector: 'app-requests-list',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, NewRequestDialogComponent, RequestThreadDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests-list.component.html',
  styleUrl: './requests-list.component.scss',
})
export class RequestsListComponent {
  private readonly gateway = inject(ClientPortalGateway);

  readonly projectId = input.required<number>();
  /** Staff view (triage) vs. client view (create). */
  readonly staff = input(false);

  protected readonly scope = signal<Scope>('open');
  protected readonly composerOpen = signal(false);
  protected readonly openId = signal<string | null>(null);

  private readonly all = toSignal(
    toObservable(this.projectId).pipe(switchMap((id) => this.gateway.requests$(id))),
    { initialValue: [] as ClientRequest[] },
  );

  protected readonly openCount = computed(() => this.all().filter((r) => isRequestOpen(r.status)).length);
  protected readonly rows = computed(() =>
    this.scope() === 'open' ? this.all().filter((r) => isRequestOpen(r.status)) : this.all(),
  );
  /** Live row for the open thread (status changes reflect immediately). */
  protected readonly openRequest = computed(() => this.all().find((r) => r.id === this.openId()) ?? null);

  protected readonly statusClass = requestStatusClass;
  protected readonly priorityClass = requestPriorityClass;
  protected readonly typeIcon = requestTypeIcon;
}
