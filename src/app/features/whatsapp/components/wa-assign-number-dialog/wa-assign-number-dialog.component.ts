import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { roleLabel } from '../../../../core/constants/roles.const';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WhatsAppEmployee, WhatsAppInstance } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { formatWhatsAppPhone, isNumberWorking, whatsappErrorText } from '../../utils/whatsapp.util';

export type AssignOutcome = 'linked' | 'changed';

/**
 * Admin: link a number to an employee, or hand it to someone else.
 *
 * The picker lists every Sales / Support / Admin user with the number they
 * hold today, and the dialog spells out side effects before saving:
 *   - the picked employee already has a number → they move to this one
 *     (the server releases their old number itself);
 *   - this number belongs to someone else → they're unlinked first and fall
 *     back to the company number (the server rejects a taken number).
 * If linking fails after that unlink, the previous owner is restored.
 */
@Component({
  selector: 'app-wa-assign-number-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-assign-number-dialog.component.html',
})
export class WaAssignNumberDialogComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** The number being (re)assigned. */
  readonly instance = input.required<WhatsAppInstance>();
  /** Every number — to show who already holds which. */
  readonly instances = input<readonly WhatsAppInstance[]>([]);

  readonly saved = output<AssignOutcome>();
  readonly cancelled = output<void>();

  protected readonly employees = signal<WhatsAppEmployee[]>([]);
  protected readonly loadingEmployees = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly isChange = computed(() => !!this.instance().assignedUserId);
  protected readonly phone = computed(() => formatWhatsAppPhone(this.instance().phoneNumber));
  protected readonly offline = computed(() => !isNumberWorking(this.instance().status));

  /** userId → the *other* number that user holds now. */
  private readonly numberOfUser = computed(() => {
    const map = new Map<string, WhatsAppInstance>();
    for (const i of this.instances()) {
      if (i.assignedUserId && i.id !== this.instance().id) map.set(i.assignedUserId, i);
    }
    return map;
  });

  protected readonly options = computed(() => {
    const lang = this.language.lang();
    const current = this.instance().assignedUserId;
    return this.employees().map((e) => {
      const held = this.numberOfUser().get(e.userId);
      const status =
        e.userId === current
          ? this.t('whatsapp.numbers.assignDialog.currentlyLinked')
          : held
            ? interpolate(this.t('whatsapp.numbers.assignDialog.hasNumber'), {
                phone: formatWhatsAppPhone(held.phoneNumber) || this.t('whatsapp.numbers.noPhone'),
              })
            : this.t('whatsapp.numbers.assignDialog.noNumber');
      return { userId: e.userId, fullName: e.fullName, sub: `${roleLabel(e.role, lang)} · ${status}` };
    });
  });

  private readonly selected = computed(
    () => this.employees().find((e) => e.userId === this.selectedUserId()) ?? null,
  );

  /** "{name} is linked to {phone} and will be moved here." */
  protected readonly moveNotice = computed(() => {
    const picked = this.selected();
    const held = picked ? this.numberOfUser().get(picked.userId) : undefined;
    if (!picked || !held) return null;
    return interpolate(this.t('whatsapp.numbers.assignDialog.willMove'), {
      name: picked.fullName,
      phone: formatWhatsAppPhone(held.phoneNumber) || this.t('whatsapp.numbers.noPhone'),
    });
  });

  /** "{current owner} will be unlinked and fall back to the company number." */
  protected readonly replaceNotice = computed(() => {
    const { assignedUserId, assignedUserName } = this.instance();
    const picked = this.selectedUserId();
    if (!assignedUserId || !picked || picked === assignedUserId) return null;
    return interpolate(this.t('whatsapp.numbers.assignDialog.willReplace'), {
      name: assignedUserName || '—',
    });
  });

  protected readonly canSave = computed(() => {
    const picked = this.selectedUserId();
    return !!picked && picked !== this.instance().assignedUserId && !this.saving();
  });

  ngOnInit(): void {
    this.selectedUserId.set(this.instance().assignedUserId);
    this.loadEmployees();
  }

  protected loadEmployees(): void {
    this.loadingEmployees.set(true);
    this.loadFailed.set(false);
    this.api
      .employees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.employees.set(list);
          this.loadingEmployees.set(false);
          this.loadFailed.set(list.length === 0);
        },
        error: () => {
          this.loadingEmployees.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  protected onPick(userId: string | null): void {
    this.selectedUserId.set(userId);
    this.saveError.set(null);
  }

  protected save(): void {
    const userId = this.selectedUserId();
    if (!userId || !this.canSave()) return;

    this.saving.set(true);
    this.saveError.set(null);
    const changing = this.isChange();

    this.assign(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit(changing ? 'changed' : 'linked');
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(whatsappErrorText(err, (k) => this.t(k)));
        },
      });
  }

  /** Link `userId`; when the number is taken, release it first and roll back on failure. */
  private assign(userId: string): Observable<unknown> {
    const { id: instanceId, assignedUserId: previous } = this.instance();
    const link$ = this.api.assignNumber(userId, { instanceId });
    if (!previous || previous === userId) return link$;

    return this.api.assignNumber(previous, { instanceId: null }).pipe(
      switchMap(() =>
        link$.pipe(
          catchError((err) =>
            this.api.assignNumber(previous, { instanceId }).pipe(
              catchError(() => of(null)),
              switchMap(() => throwError(() => err)),
            ),
          ),
        ),
      ),
    );
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
