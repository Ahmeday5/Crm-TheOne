import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RequestStatusBannerComponent } from '../../components/request-status-banner/request-status-banner.component';
import { RequestTargetChipComponent } from '../../components/request-target-chip/request-target-chip.component';
import { RequestThreadComponent, ThreadReply } from '../../components/request-thread/request-thread.component';
import { PORTAL_REQUESTS_GATEWAY } from '../../data/portal-requests.gateway';
import { ClientRequestDetails } from '../../models/client-portal.models';
import { ANY_PROJECT, PortalLiveService } from '../../services/portal-live.service';
import { requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';
import { errorText } from '../../utils/request-errors.util';
import { LanguageService } from '../../../../core/services/language.service';

/**
 * `/portal/requests/:id` — one request: where it is (journey + what happens
 * next), what it is about, and the conversation. Answering the Admin's
 * question sends it straight back to review; live updates patch it in place.
 */
@Component({
  selector: 'app-portal-request',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CairoDatePipe, RequestThreadComponent, RequestStatusBannerComponent, RequestTargetChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (request(); as r) {
      <a class="pr-back" [routerLink]="['/portal', 'projects', r.projectId]">
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>{{ r.projectName || ('clientPortal.project.back' | translate) }}
      </a>
      <div class="card pr-card">
        <div class="card-header pr-head">
          <span class="pr-icon" [attr.data-type]="r.type"><i [class]="typeIcon(r.type)" aria-hidden="true"></i></span>
          <div class="pr-headtext">
            <h1 class="pr-title">{{ r.title }}</h1>
            <span class="pr-sub">
              <app-request-target-chip [source]="r" size="sm" />
              <span>{{ 'clientPortal.type.' + r.type | translate }} · #{{ r.id }} · {{ r.createdAt | cairoDate: 'date' }}</span>
            </span>
          </div>
          <span class="badge" [class]="statusClass(r.status)">{{ 'clientPortal.status.' + r.status | translate }}</span>
        </div>
        <div class="card-body d-flex flex-column gap-4">
          <app-request-status-banner [request]="r" (answer)="thread()?.focusComposer()" />
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
    .pr-card { animation: pr-in 240ms ease both; }
    .pr-head { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .pr-icon {
      display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0;
      border-radius: var(--radius-md); background: var(--brand-soft); color: var(--brand-500);
    }
    .pr-icon[data-type='Issue'] { background: var(--danger-soft); color: var(--danger); }
    .pr-headtext { flex: 1; min-width: 0; }
    .pr-title { margin: 0 0 0.25rem; font-size: var(--fs-lg); font-weight: var(--fw-700); overflow-wrap: anywhere; }
    .pr-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: var(--fs-xs); color: var(--text-3); }
    .pr-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem; min-height: 220px; padding: 2rem; }
    @keyframes pr-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .pr-card { animation: none; } }
  `,
})
export class PortalRequestComponent {
  private readonly api = inject(PORTAL_REQUESTS_GATEWAY);
  private readonly live = inject(PortalLiveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LanguageService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || 0;

  protected readonly thread = viewChild(RequestThreadComponent);
  protected readonly request = signal<ClientRequestDetails | null>(null);
  protected readonly failed = signal(false);
  protected readonly sending = signal(false);
  protected readonly sentCount = signal(0);
  protected readonly error = signal<string | null>(null);

  protected readonly statusClass = requestStatusClass;
  protected readonly typeIcon = requestTypeIcon;

  constructor() {
    this.api.get(this.id).subscribe({
      next: (r) => this.request.set(r),
      error: () => this.failed.set(true),
    });

    // The Admin approved / asked / replied — refresh quietly.
    this.live.projectChanged$
      .pipe(
        filter((e) => e.kind === 'request' && (e.projectId === ANY_PROJECT || e.projectId === this.request()?.projectId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.refresh());
  }

  protected onReply(reply: ThreadReply): void {
    const r = this.request();
    if (!r) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.comment(r.id, reply.body, reply.attachments).subscribe({
      // Re-read: an answer moves it back to review, a reply to a resolved one reopens it.
      next: () => this.refresh(() => this.sentCount.update((n) => n + 1)),
      error: (e: ApiError) => {
        this.sending.set(false);
        this.error.set(errorText(e, this.lang.lang()));
        if (e?.reason === 'request_rejected') this.refresh();
      },
    });
  }

  private refresh(done?: () => void): void {
    this.api.get(this.id).subscribe({
      next: (fresh) => {
        this.request.set(fresh);
        this.sending.set(false);
        done?.();
      },
      error: () => {
        this.sending.set(false);
        done?.();
      },
    });
  }
}
