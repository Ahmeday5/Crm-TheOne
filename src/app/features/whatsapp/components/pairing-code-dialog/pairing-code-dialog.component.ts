import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, timer } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SessionsStore } from '../../store/sessions.store';

const STATUS_POLL_MS = 4000;

/**
 * Pairing-code linking dialog.
 *
 * Requests a pairing code for a freshly-created (or existing) session, renders
 * it as individual character tiles, and polls session status until the device
 * connects — mirroring WhatsApp's "Link with phone number" flow.
 */
@Component({
  selector: 'app-pairing-code-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pairing-code-dialog.component.html',
  styleUrl: './pairing-code-dialog.component.scss',
})
export class PairingCodeDialogComponent implements OnInit {
  @Input({ required: true }) sessionId!: number;
  @Input({ required: true }) phone!: string;
  @Output() closed = new EventEmitter<void>();

  readonly store = inject(SessionsStore);
  private readonly destroyRef = inject(DestroyRef);
  private poll: Subscription | null = null;

  /** The pairing code split into individual character tiles. */
  readonly codeChars = computed(() => {
    const code = this.store.pairingCode();
    if (!code) return [];
    return code.replace(/[\s-]/g, '').toUpperCase().split('');
  });

  readonly connected = this.store.isConnected;

  constructor() {
    // Stop polling the moment the device links.
    effect(() => {
      if (this.connected()) this.stopPolling();
    });
  }

  ngOnInit(): void {
    this.requestCode();
    this.poll = timer(0, STATUS_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.loadStatus(this.sessionId));
  }

  requestCode(): void {
    this.store.pair(this.sessionId, this.phone);
  }

  close(): void {
    this.stopPolling();
    this.store.resetDetails();
    this.closed.emit();
  }

  private stopPolling(): void {
    this.poll?.unsubscribe();
    this.poll = null;
  }
}
