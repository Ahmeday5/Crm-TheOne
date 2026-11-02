import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WhatsAppNumberStatus } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { formatWhatsAppPhone, isNoNumberAssignedError, isNumberWorking } from '../../utils/whatsapp.util';

type NumberState = 'checking' | 'working' | 'down' | 'unassigned' | 'unavailable';

/**
 * The signed-in employee's sending number, as a status pill:
 *
 *   ● +201127599438 · متصل              (own number, WORKING)
 *   ● +20… · تُرسل من رقم الشركة          (no own number → company default)
 *   ● رقم الواتساب غير متصل — تواصل مع الأدمن
 *   ● لم يتم ربط رقم واتساب بحسابك — تواصل مع الأدمن
 */
@Component({
  selector: 'app-wa-number-status',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('checking') {
        <span class="wa-ns wa-ns--muted" role="status">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          {{ 'whatsapp.number.checking' | translate }}
        </span>
      }
      @case ('working') {
        <span class="wa-ns wa-ns--ok" role="status">
          <span class="wa-ns__dot" aria-hidden="true"></span>
          <span class="wa-ns__phone" dir="ltr">{{ phone() }}</span>
          <span class="wa-ns__sep" aria-hidden="true">·</span>
          @if (status()?.isDefault) {
            <span>{{ 'whatsapp.number.companyNumber' | translate }}</span>
          } @else {
            <span>{{ 'whatsapp.number.connected' | translate }}</span>
          }
        </span>
      }
      @case ('down') {
        <span class="wa-ns wa-ns--bad" role="alert">
          <span class="wa-ns__dot" aria-hidden="true"></span>
          {{ 'whatsapp.number.disconnected' | translate }}
        </span>
      }
      @case ('unassigned') {
        <span class="wa-ns wa-ns--bad" role="alert">
          <span class="wa-ns__dot" aria-hidden="true"></span>
          {{ 'whatsapp.number.unassigned' | translate }}
        </span>
      }
      @default {
        <button type="button" class="wa-ns wa-ns--muted wa-ns--action" (click)="load()">
          <i class="fa-solid fa-rotate" aria-hidden="true"></i>
          {{ 'whatsapp.number.unavailable' | translate }}
        </button>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; min-width: 0; max-width: 100%; }

    .wa-ns {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
      max-width: 100%;
      padding: 0.4rem 0.85rem;
      border-radius: var(--radius-pill);
      border: 1px solid transparent;
      font-size: var(--fs-sm);
      font-weight: var(--fw-600);
      line-height: 1.35;
    }
    .wa-ns__dot {
      flex-shrink: 0;
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 22%, transparent);
    }
    .wa-ns__phone { font-variant-numeric: tabular-nums; }
    .wa-ns__sep { opacity: 0.5; }

    .wa-ns--ok { background: var(--success-soft); color: var(--success); border-color: color-mix(in srgb, var(--success) 25%, transparent); }
    .wa-ns--bad { background: var(--danger-soft); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 25%, transparent); }
    .wa-ns--muted { background: var(--surface-1); color: var(--text-2); border-color: var(--border); }
    .wa-ns--action { cursor: pointer; }
    .wa-ns--action:hover { color: var(--brand); border-color: var(--brand); }
  `,
})
export class WaNumberStatusComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<WhatsAppNumberStatus | null>(null);
  protected readonly state = signal<NumberState>('checking');
  protected readonly phone = computed(() => formatWhatsAppPhone(this.status()?.phoneNumber));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('checking');
    this.api
      .myStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.status.set(s);
          this.state.set(isNumberWorking(s?.status) ? 'working' : 'down');
        },
        error: (err) => this.state.set(isNoNumberAssignedError(err) ? 'unassigned' : 'unavailable'),
      });
  }
}
