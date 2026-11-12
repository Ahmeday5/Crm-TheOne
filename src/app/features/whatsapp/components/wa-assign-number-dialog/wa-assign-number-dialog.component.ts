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
import { roleLabel } from '../../../../core/constants/roles.const';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaEmployee, WaInstance } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { WhatsAppAssignmentService } from '../../services/whatsapp-assignment.service';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import { channelLabel, whatsappErrorText } from '../../utils/whatsapp.util';
import { WaChannelBadgeComponent } from '../wa-channel-badge/wa-channel-badge.component';

export type AssignOutcome = 'linked' | 'changed';

/**
 * Admin: give a channel (WhatsApp number or Messenger page) to an employee,
 * or hand it to someone else. Each employee holds at most one channel of
 * each type.
 *
 * The picker lists active Sales / Support users with the channel of the
 * same type they hold today, and spells out side effects before saving:
 *   - the picked employee already has a channel of this type → it is
 *     replaced (the server does that itself; their other type stays);
 *   - this channel belongs to someone else → they lose it (and keep their
 *     other channel). If assigning then fails, they get it back.
 * Server messages are shown as they are.
 */
@Component({
  selector: 'app-wa-assign-number-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent, SearchableSelectComponent, WaChannelBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-assign-number-dialog.component.html',
})
export class WaAssignNumberDialogComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly assignment = inject(WhatsAppAssignmentService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(WhatsAppSessionStore);

  /** The channel being (re)assigned. */
  readonly instance = input.required<WaInstance>();
  /** Every channel — to show who already holds which. */
  readonly instances = input<readonly WaInstance[]>([]);

  readonly saved = output<AssignOutcome>();
  readonly cancelled = output<void>();

  protected readonly employees = signal<WaEmployee[]>([]);
  protected readonly loadingEmployees = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly isChange = computed(() => !!this.instance().assignedUserId);
  protected readonly label = computed(() => channelLabel(this.instance()));
  protected readonly offline = computed(() => !this.instance().canSend);

  /** userId → the *other* channel of the same type that user holds now. */
  private readonly sameTypeOfUser = computed(() => {
    const target = this.instance();
    const map = new Map<string, WaInstance>();
    for (const i of this.instances()) {
      if (i.assignedUserId && i.id !== target.id && i.type === target.type) map.set(i.assignedUserId, i);
    }
    return map;
  });

  protected readonly options = computed(() => {
    const lang = this.language.lang();
    const current = this.instance().assignedUserId;
    return this.employees().map((e) => {
      const held = this.sameTypeOfUser().get(e.userId);
      const status =
        e.userId === current
          ? this.t('whatsapp.numbers.assignDialog.currentlyLinked')
          : held
            ? interpolate(this.t('whatsapp.numbers.assignDialog.hasNumber'), { channel: channelLabel(held) })
            : this.t('whatsapp.numbers.assignDialog.noNumber');
      return { userId: e.userId, fullName: e.fullName, sub: `${roleLabel(e.role, lang)} · ${status}` };
    });
  });

  private readonly selected = computed(
    () => this.employees().find((e) => e.userId === this.selectedUserId()) ?? null,
  );

  /** "{name} has {channel}; it will be replaced by this one." */
  protected readonly moveNotice = computed(() => {
    const picked = this.selected();
    const held = picked ? this.sameTypeOfUser().get(picked.userId) : undefined;
    if (!picked || !held) return null;
    return interpolate(this.t('whatsapp.numbers.assignDialog.willMove'), {
      name: picked.fullName,
      channel: channelLabel(held),
    });
  });

  /** "{current owner} will lose this channel." */
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

    this.assignment
      .assign(this.instance(), userId, this.instances())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          if (updated) this.session.applyInstance(updated);
          this.saved.emit(changing ? 'changed' : 'linked');
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.saveError.set(whatsappErrorText(err, (k) => this.t(k)));
        },
      });
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
