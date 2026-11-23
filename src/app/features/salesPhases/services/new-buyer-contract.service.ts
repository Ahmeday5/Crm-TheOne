import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter } from 'rxjs';
import { UserRole } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { CustomersService } from '../../leads/services/customers.service';

/** Contracts list — hosts the create-contract dialog. */
export const CONTRACTS_PAGE_PATH = '/contracts-management';

/**
 * `?newContractFor=<customerId>` on the contracts page opens the create
 * dialog with that customer pre-selected. Consumed once, then stripped from
 * the URL so a refresh / back navigation doesn't reopen it.
 */
export const NEW_CONTRACT_FOR_PARAM = 'newContractFor';

/** Roles that may open the contracts page and create a contract (see `salesPhases.routes`). */
const CONTRACT_EDITOR_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['Admin', 'Sales']);

/**
 * "New buyer → add the contract now".
 *
 * Whenever a customer is moved to **Buyer** — from the status dialog on any
 * list, a Kanban drag, or any future surface that goes through
 * `CustomersService.changeStatus` — the user is taken straight to the
 * contracts page with the create-contract dialog open for that customer.
 *
 * It listens to `CustomersService.statusChanged$` (emitted only after the
 * server confirmed the change) instead of being wired into each screen, so
 * no caller can forget it and none has to know about contracts.
 */
@Injectable({ providedIn: 'root' })
export class NewBuyerContractService {
  private readonly customers = inject(CustomersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    this.customers.statusChanged$
      .pipe(
        filter((change) => change.status === 'Buyer'),
        filter(() => this.canCreateContracts()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ customerId }) => this.openNewContract(customerId));
  }

  /** Navigates to the contracts page with the create dialog open for `customerId`. */
  openNewContract(customerId: number): Promise<boolean> {
    return this.router.navigate([CONTRACTS_PAGE_PATH], {
      queryParams: { [NEW_CONTRACT_FOR_PARAM]: customerId },
    });
  }

  private canCreateContracts(): boolean {
    const role = this.auth.currentRole();
    return !!role && CONTRACT_EDITOR_ROLES.has(role);
  }
}
