import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';

type ChipTone = 'success' | 'danger' | 'gray';

/**
 * Header widget for employees (Sales / Support): their WhatsApp number at a
 * glance — green "connected", red "disconnected", grey "no number". Driven
 * by `GET /status` and kept live by `whatsappInstanceStatus` hub events
 * (both through `WhatsAppSessionStore`). Links to the inbox.
 */
@Component({
  selector: 'app-wa-number-status-chip',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      @let label = labelKey() | translate;
      <a class="wa-chip" [attr.data-tone]="tone()" routerLink="/whatsapp"
         [title]="('whatsapp.chip.title' | translate) + ': ' + label"
         [attr.aria-label]="('whatsapp.chip.title' | translate) + ': ' + label">
        <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
        <span class="wa-chip__dot" aria-hidden="true"></span>
        <span class="wa-chip__text">{{ label }}</span>
      </a>
    }
  `,
  styles: `
    @use 'breakpoints' as bp;
    :host { display: contents; }
    .wa-chip {
      --wa-chip-color: var(--text-3);
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      height: 2.25rem;
      padding: 0 0.7rem;
      margin-inline-end: 0.35rem;
      border: 1px solid color-mix(in srgb, var(--wa-chip-color) 35%, transparent);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--wa-chip-color) 10%, var(--surface-0));
      color: var(--wa-chip-color);
      font-size: var(--fs-xs);
      font-weight: var(--fw-700);
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s;

      &:hover { background: color-mix(in srgb, var(--wa-chip-color) 18%, var(--surface-0)); }
      &:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    }
    .wa-chip[data-tone='success'] { --wa-chip-color: var(--success); }
    .wa-chip[data-tone='danger'] { --wa-chip-color: var(--danger); }
    .wa-chip__dot { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: currentColor; }
    .wa-chip[data-tone='success'] .wa-chip__dot { animation: wa-chip-pulse 2s ease-in-out infinite; }
    @keyframes wa-chip-pulse {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 45%, transparent); }
      50% { box-shadow: 0 0 0 4px transparent; }
    }
    /* Phones: the dot + icon say enough. */
    @include bp.down(sm) { .wa-chip__text { display: none; } }
    @media (prefers-reduced-motion: reduce) { .wa-chip__dot { animation: none !important; } }
  `,
})
export class WaNumberStatusChipComponent {
  private readonly session = inject(WhatsAppSessionStore);

  /** Employees only — admins work from every channel and see status on the settings page. */
  protected readonly visible = computed(
    () => this.session.enabled() && !this.session.isAdmin() && !!this.session.status(),
  );

  protected readonly tone = computed<ChipTone>(() => {
    const status = this.session.status();
    if (!status || status.status === 'NOT_ASSIGNED') return 'gray';
    if (status.canSend || status.status === 'CONNECTED') return 'success';
    return status.status === 'UNKNOWN' ? 'gray' : 'danger';
  });

  protected readonly labelKey = computed(() => {
    const status = this.session.status();
    if (!status || status.status === 'NOT_ASSIGNED') return 'whatsapp.chip.none';
    if (status.canSend || status.status === 'CONNECTED') return 'whatsapp.chip.connected';
    return status.status === 'UNKNOWN' ? 'whatsapp.chip.unknown' : 'whatsapp.chip.disconnected';
  });
}
