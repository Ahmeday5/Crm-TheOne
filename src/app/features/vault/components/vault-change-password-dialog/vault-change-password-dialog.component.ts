import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { VaultLockGateway } from '../../data/vault-lock-gateway';
import { VaultLockError, checkVaultPassword, isStrongEnough } from '../../models/vault-lock.models';
import { VaultSessionService } from '../../state/vault-session.service';

/**
 * Change the vault password (current + new twice). On success every open vault
 * session is revoked server-side, so this one locks too and the new password
 * is needed straight away.
 */
@Component({
  selector: 'app-vault-change-password-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vault-change-password-dialog.component.html',
})
export class VaultChangePasswordDialogComponent {
  private readonly gateway = inject(VaultLockGateway);
  private readonly session = inject(VaultSessionService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly closed = output<void>();

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly rules = computed(() => checkVaultPassword(this.next()));
  protected readonly matches = computed(() => !!this.confirm() && this.confirm() === this.next());
  protected readonly canSave = computed(
    () => !!this.current() && isStrongEnough(this.next()) && this.matches() && this.next() !== this.current() && !this.busy(),
  );

  protected save(): void {
    if (!this.canSave()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    this.gateway.changePassword(this.current(), this.next()).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(resolveKey(TRANSLATIONS[this.language.lang()], 'vaultLock.change.done'));
        this.closed.emit();
        this.session.lock();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const code = err instanceof VaultLockError ? err.code : 'unknown';
        this.errorKey.set(
          code === 'wrong' ? 'vaultLock.change.wrongCurrent' : code === 'weak' ? 'vaultLock.errors.weak' : 'vaultLock.errors.generic',
        );
      },
    });
  }
}
