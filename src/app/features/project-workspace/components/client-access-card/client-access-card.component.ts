import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../../leads/services/customers.service';
import { ClientAccessResult, ClientAccessStatus } from '../../models/workspace.models';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "بوابة العميل": give the project's customer a portal login, re-invite them
 * (new temporary password) or revoke it. The temporary password is shown once
 * in a dialog — copied, never stored.
 */
@Component({
  selector: 'app-client-access-card',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent, CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-access-card.component.html',
  styleUrl: './client-access-card.component.scss',
})
export class ClientAccessCardComponent {
  private readonly api = inject(ProjectWorkspaceService);
  private readonly customers = inject(CustomersService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly projectId = input.required<number>();
  readonly customerId = input<number | null>(null);
  /** Access changed — the page refreshes its project header. */
  readonly changed = output<void>();

  protected readonly status = signal<ClientAccessStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The one-time credentials dialog; cleared on close. */
  protected readonly issued = signal<ClientAccessResult | null>(null);

  protected readonly emailValid = computed(() => EMAIL_PATTERN.test(this.email().trim()));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.clientAccess(this.projectId()).subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
        if (s.hasAccess && s.email) this.email.set(s.email);
        else this.prefillFromCustomer(s.customerId ?? this.customerId());
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  /** Create the account — or, with the same email, re-invite (fresh temporary password). */
  protected grant(): void {
    const email = this.email().trim();
    if (!EMAIL_PATTERN.test(email) || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.grantClientAccess(this.projectId(), { email, sendInvite: false }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.issued.set(res);
        this.changed.emit();
        this.load();
      },
      error: (e: ApiError) => {
        this.busy.set(false);
        this.error.set(e?.message ?? null);
      },
    });
  }

  protected async revoke(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('clientAccess.revokeTitle'),
      message: this.t('clientAccess.revokeMessage'),
      confirmText: this.t('clientAccess.revoke'),
      type: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.revokeClientAccess(this.projectId()).subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
        this.load();
      },
      error: (e: ApiError) => {
        this.busy.set(false);
        this.error.set(e?.message ?? null);
      },
    });
  }

  protected closeIssued(): void {
    this.issued.set(null);
  }

  private prefillFromCustomer(customerId: number | null): void {
    if (!customerId || this.email()) return;
    this.customers
      .getById(customerId)
      .pipe(catchError(() => of(null)))
      .subscribe((c) => {
        if (c?.email && !this.email()) this.email.set(c.email);
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
