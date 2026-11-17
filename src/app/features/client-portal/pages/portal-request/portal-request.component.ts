import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError } from '../../../../core/models/api-response.model';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RequestThreadComponent, ThreadReply } from '../../components/request-thread/request-thread.component';
import { ClientRequestDetails } from '../../models/client-portal.models';
import { CLIENT_PORTAL_GATEWAY } from '../../data/client-portal.gateway';
import { requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';

/**
 * `/portal/requests/:id` — one request as a chat with the team. Replying to a
 * resolved request reopens it (server-side, back to "قيد المراجعة").
 */
@Component({
  selector: 'app-portal-request',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CairoDatePipe, RequestThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (request(); as r) {
      <a class="pr-back" [routerLink]="['/portal', 'projects', r.projectId]">
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>{{ r.projectName || ('clientPortal.project.back' | translate) }}
      </a>
      <div class="card">
        <div class="card-header pr-head">
          <span class="pr-icon" [attr.data-type]="r.type"><i [class]="typeIcon(r.type)" aria-hidden="true"></i></span>
          <div class="pr-headtext">
            <h1 class="pr-title">{{ r.title }}</h1>
            <span class="pr-sub">{{ 'clientPortal.type.' + r.type | translate }} · {{ r.createdAt | cairoDate: 'date' }}</span>
          </div>
          <span class="badge" [class]="statusClass(r.status)">{{ 'clientPortal.status.' + r.status | translate }}</span>
        </div>
        <div class="card-body">
          <app-request-thread [request]="r" viewer="client" [sending]="sending()" [error]="error()"
                              [sentCount]="sentCount()" (reply)="onReply($event)" />
        </div>
      </div>
    } @else if (failed()) {
      <div class="card"><div class="pr-center">
        <h6 class="fw-700 mb-0">{{ 'clientPortal.errors.requestNotFound' | translate }}</h6>
        <a class="btn btn-sm btn-light" routerLink="/portal">{{ 'clientPortal.project.back' | translate }}</a>
      </div></div>
    } @else {
      <div class="pr-center"><span class="spinner-border text-primary" aria-hidden="true"></span></div>
    }
  `,
  styles: `
    .pr-back {
      display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 1rem;
      color: var(--text-2); font-size: var(--fs-sm); font-weight: var(--fw-600); text-decoration: none;
    }
    .pr-back:hover { color: var(--brand-500); }
    :host-context([dir='ltr']) .pr-back i { transform: scaleX(-1); }
    .pr-head { display: flex; align-items: center; gap: 0.75rem; }
    .pr-icon {
      display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0;
      border-radius: var(--radius-md); background: var(--brand-soft); color: var(--brand-500);
    }
    .pr-icon[data-type='Issue'] { background: var(--danger-subtle, #fde8e8); color: var(--danger); }
    .pr-headtext { flex: 1; min-width: 0; }
    .pr-title { margin: 0; font-size: var(--fs-lg); font-weight: var(--fw-700); }
    .pr-sub { font-size: var(--fs-xs); color: var(--text-3); }
    .pr-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem; min-height: 220px; padding: 2rem; }
  `,
})
export class PortalRequestComponent {
  private readonly api = inject(CLIENT_PORTAL_GATEWAY);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || 0;

  protected readonly request = signal<ClientRequestDetails | null>(null);
  protected readonly failed = signal(false);
  protected readonly sending = signal(false);
  protected readonly sentCount = signal(0);
  protected readonly error = signal<string | null>(null);

  protected readonly statusClass = requestStatusClass;
  protected readonly typeIcon = requestTypeIcon;

  constructor() {
    this.api.request(this.id).subscribe({
      next: (r) => this.request.set(r),
      error: () => this.failed.set(true),
    });
  }

  protected onReply(reply: ThreadReply): void {
    const r = this.request();
    if (!r) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.comment(r.id, reply.body, reply.attachments).subscribe({
      next: () => {
        // Re-read: replying to a resolved request moves it back to "InReview".
        this.api.request(r.id).subscribe({
          next: (fresh) => {
            this.request.set(fresh);
            this.sending.set(false);
            this.sentCount.update((n) => n + 1);
          },
          error: () => {
            this.sending.set(false);
            this.sentCount.update((n) => n + 1);
          },
        });
      },
      error: (e: ApiError) => {
        this.sending.set(false);
        this.error.set(e?.message ?? null);
      },
    });
  }
}
