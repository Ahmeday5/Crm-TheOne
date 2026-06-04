import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PairingCodeDialogComponent } from '../../components/pairing-code-dialog/pairing-code-dialog.component';
import {
  ConnectionMethod,
  HealthStatus,
  SessionStatus,
} from '../../models/session.model';
import { SessionsStore } from '../../store/sessions.store';
import {
  healthBadgeClass,
  healthLabelKey,
  statusBadgeClass,
  statusLabelKey,
} from '../../models/session-badges.util';

@Component({
  selector: 'app-whatsapp-sessions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    LoadErrorComponent,
    ModalComponent,
    PairingCodeDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss',
})
export class SessionsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);
  readonly store = inject(SessionsStore);

  readonly createOpen = signal(false);

  /** Set after creating a `code` session — drives the pairing dialog. */
  readonly pairingFor = signal<{ id: number; phone: string } | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    connection_method: ['qr' as ConnectionMethod, [Validators.required]],
    phone_number: [''],
  });

  /** Pairing needs a phone number; QR does not. */
  get isCodeMethod(): boolean {
    return this.form.controls.connection_method.value === 'code';
  }

  /** Pairing phone must carry at least 9 digits. */
  get phoneInvalid(): boolean {
    return this.form.controls.phone_number.value.replace(/\D/g, '').length < 9;
  }

  ngOnInit(): void {
    this.store.loadSessions();
  }

  reload(): void {
    this.store.loadSessions();
  }

  openCreate(): void {
    this.form.reset({ name: '', connection_method: 'qr', phone_number: '' });
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  submitCreate(): void {
    if (this.store.actionLoading()) return;

    const code = this.isCodeMethod;
    const phone = this.form.controls.phone_number.value.replace(/\D/g, '');
    if (this.form.controls.name.invalid || (code && phone.length < 9)) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, connection_method } = this.form.getRawValue();
    this.store.createSession({ name, connection_method }).subscribe({
      next: (session) => {
        this.createOpen.set(false);
        if (code) {
          // Pairing flow: stay on the list and open the linking dialog.
          this.pairingFor.set({ id: session.id, phone });
        } else {
          // QR flow: the details page renders + polls the QR.
          this.router.navigate(['/whatsapp-sessions', session.id]);
        }
      },
    });
  }

  closePairing(): void {
    const target = this.pairingFor();
    this.pairingFor.set(null);
    this.store.loadSessions();
    if (target) this.router.navigate(['/whatsapp-sessions', target.id]);
  }

  open(id: number): void {
    this.router.navigate(['/whatsapp-sessions', id]);
  }

  // ─────────── badge helpers ───────────

  statusLabel(status: SessionStatus): string {
    return statusLabelKey(status);
  }
  statusClass(status: SessionStatus): string {
    return statusBadgeClass(status);
  }
  healthLabel(health: HealthStatus): string {
    return healthLabelKey(health);
  }
  healthClass(health: HealthStatus): string {
    return healthBadgeClass(health);
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { day: '2-digit', month: 'short', year: 'numeric' },
      );
    } catch {
      return iso;
    }
  }
}
