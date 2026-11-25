import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { localInputToIso, toLocalInputValue } from '../../../../core/utils/datetime-local.util';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe, formatCairoDate, parseUtc } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { INBOX_TOOLS_GATEWAY } from '../../data/inbox-tools.gateway';
import { WaChat, WaChatReminder } from '../../models/whatsapp.models';
import {
  REMINDER_NOTE_MAX_LENGTH,
  REMINDER_PRESETS,
  ReminderPreset,
  compareByIso,
  presetDate,
} from '../../utils/inbox-tools.util';

/** What the chat row should show after a change (until the server's chat event lands). */
export interface ReminderSummary {
  nextReminderAt: string | null;
  reminderDue: boolean;
}

/**
 * «ذكّرني» (§4): quick presets (in 1 h, in 3 h, tomorrow 10 AM, in a week)
 * or any future date-time, plus an optional note. Above the form: the
 * caller's own open reminders on this chat, with «تم» / delete.
 *
 * With the real API the reminder fires as a `ChatReminderDue` notification
 * (FCM too, even with the CRM closed).
 */
@Component({
  selector: 'app-wa-reminder-dialog',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-reminder-dialog.component.html',
  styleUrl: './wa-reminder-dialog.component.scss',
})
export class WaReminderDialogComponent implements OnInit {
  private readonly tools = inject(INBOX_TOOLS_GATEWAY);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chat = input.required<WaChat>();
  readonly changed = output<ReminderSummary>();
  readonly closed = output<void>();

  protected readonly presets = REMINDER_PRESETS;
  protected readonly noteMax = REMINDER_NOTE_MAX_LENGTH;

  protected readonly when = signal('');
  protected readonly note = signal('');
  protected readonly preset = signal<ReminderPreset | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly mine = signal<WaChatReminder[]>([]);
  protected readonly loadingMine = signal(true);
  protected readonly busyId = signal<number | null>(null);

  /** Earliest pickable value of the datetime input. */
  protected readonly minWhen = toLocalInputValue(new Date());

  /** Someone else's reminder (the chat's earliest isn't one of mine). */
  protected readonly othersAt = computed(() => {
    const at = this.chat().nextReminderAt;
    if (!at || this.loadingMine()) return null;
    return this.mine().some((r) => r.dueAt === at || parseUtc(r.dueAt)?.getTime() === parseUtc(at)?.getTime()) ? null : at;
  });

  protected readonly canSave = computed(() => {
    const iso = localInputToIso(this.when());
    return !!iso && !this.saving() && this.note().length <= REMINDER_NOTE_MAX_LENGTH;
  });

  ngOnInit(): void {
    this.pick('tomorrow10');
    this.loadMine();
  }

  protected pick(preset: ReminderPreset): void {
    this.preset.set(preset);
    this.when.set(toLocalInputValue(presetDate(preset)));
    this.error.set(null);
  }

  protected onWhen(value: string): void {
    this.preset.set(null);
    this.when.set(value);
    this.error.set(null);
  }

  protected isDue(r: WaChatReminder): boolean {
    return r.status === 'Due' || (parseUtc(r.dueAt)?.getTime() ?? Infinity) <= Date.now();
  }

  protected save(): void {
    const iso = localInputToIso(this.when());
    if (!iso) return;
    if (new Date(iso).getTime() <= Date.now()) {
      this.error.set(this.t('inboxTools.reminder.mustBeFuture'));
      return;
    }
    const chat = this.chat();
    this.saving.set(true);
    this.error.set(null);
    this.tools
      .addReminder(chat, { dueAt: iso, note: this.note().trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reminder) => {
          this.saving.set(false);
          const next = [chat.nextReminderAt, reminder.dueAt].filter((x): x is string => !!x).sort(compareByIso)[0];
          this.changed.emit({ nextReminderAt: next ?? reminder.dueAt, reminderDue: !!chat.reminderDue });
          const when = formatCairoDate(reminder.dueAt, this.language.lang(), 'datetime');
          this.toast.success(interpolate(this.t('inboxTools.reminder.saved'), { when }));
          this.closed.emit();
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.error.set(e?.message || this.t('inboxTools.failed'));
        },
      });
  }

  protected markDone(r: WaChatReminder): void {
    this.busyId.set(r.id);
    this.tools
      .reminderDone(r.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dropped(r, 'inboxTools.reminder.doneToast'),
        error: (e: ApiError) => this.failed(e),
      });
  }

  protected remove(r: WaChatReminder): void {
    this.busyId.set(r.id);
    this.tools
      .deleteReminder(r.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dropped(r, 'inboxTools.reminder.deletedToast'),
        error: (e: ApiError) => this.failed(e),
      });
  }

  /** The caller's pending + due reminders, narrowed to this chat (the list has no `chatId` filter). */
  private loadMine(): void {
    const chatId = this.chat().id;
    const page = { pageIndex: 1, pageSize: 100 };
    forkJoin([
      this.tools.reminders({ ...page, status: 'pending' }),
      this.tools.reminders({ ...page, status: 'due' }),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([pending, due]) => {
          this.loadingMine.set(false);
          this.mine.set(
            [...due.data, ...pending.data]
              .filter((r) => r.chatId === chatId && r.status !== 'Done')
              .sort((a, b) => compareByIso(a.dueAt, b.dueAt)),
          );
        },
        error: () => this.loadingMine.set(false),
      });
  }

  private dropped(r: WaChatReminder, toastKey: string): void {
    this.busyId.set(null);
    this.mine.update((list) => list.filter((x) => x.id !== r.id));
    this.toast.success(this.t(toastKey));
    const others = this.othersAt();
    const next = [others, ...this.mine().map((x) => x.dueAt)].filter((x): x is string => !!x).sort(compareByIso)[0] ?? null;
    this.changed.emit({ nextReminderAt: next, reminderDue: this.mine().some((x) => this.isDue(x)) });
  }

  private failed(e: ApiError): void {
    this.busyId.set(null);
    this.toast.error(e?.message || this.t('inboxTools.failed'));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
