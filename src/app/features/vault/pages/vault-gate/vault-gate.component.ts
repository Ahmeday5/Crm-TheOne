import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { VaultChangePasswordDialogComponent } from '../../components/vault-change-password-dialog/vault-change-password-dialog.component';
import { VaultLockScreenComponent } from '../../components/vault-lock-screen/vault-lock-screen.component';
import { provideVaultLockGateway } from '../../data/vault-lock-gateway.provider';
import { VaultSessionService } from '../../state/vault-session.service';
import { VaultListComponent } from '../vault-list/vault-list.component';

/**
 * `/vault` — the lock first, the vault only after the vault password.
 *
 * The vault list is created only while unlocked (so nothing is fetched before
 * that) and destroyed the moment the session locks — manually, on expiry, on
 * logout, or after a password change.
 */
@Component({
  selector: 'app-vault-gate',
  standalone: true,
  imports: [TranslatePipe, VaultLockScreenComponent, VaultListComponent, VaultChangePasswordDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideVaultLockGateway()],
  templateUrl: './vault-gate.component.html',
  styleUrl: './vault-gate.component.scss',
})
export class VaultGateComponent implements OnDestroy {
  protected readonly session = inject(VaultSessionService);
  protected readonly changeOpen = signal(false);

  /** mm:ss until auto-lock. */
  protected readonly countdown = computed(() => {
    const s = this.session.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  /** Last minute: the chip turns amber. */
  protected readonly expiring = computed(() => this.session.secondsLeft() <= 60);

  /** Leaving the vault page locks it — coming back needs the password again. */
  ngOnDestroy(): void {
    this.session.lock();
  }
}
