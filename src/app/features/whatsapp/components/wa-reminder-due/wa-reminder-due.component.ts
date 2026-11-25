import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CairoDatePipe, formatCairoDate, parseUtc } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { INBOX_TOOLS_GATEWAY } from '../../data/inbox-tools.gateway';
import { WaChat, WaChatReminder } from '../../models/whatsapp.models';
import { ReminderPreset, compareByIso, presetDate } from '../../utils/inbox-tools.util';

/** What the banner reports back so the chat row / toolbar update at once. */
export interface ReminderDueChange {
  nextReminderAt: string | null;
  reminderDue: boolean;
}

/**
 * «حان وقت المتابعة» — the banner at the top of a chat whose reminder time has
 * come. Shows the reminder's note and lets the owner close it ("تمّت المتابعة")
 * or snooze it (marks it done and books a new one). Someone else's reminder is
 * shown read-only.
 */
@Component({
  selector: 'app-wa-reminder-due',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-reminder-due.component.html',
  styleUrl: './wa-reminder-due.component.scss',
})
export class WaReminderDueComponent {
  private readonly tools = inject(INBOX_TOOLS_GATEWAY);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chat = input.required<WaChat>();
  readonly changed = output<ReminderDueChange>();

  /** The caller's due reminders on this chat (oldest first). */
  protected readonly mine = signal<WaChatReminder[]>([]);
  protected readonly busy = signal(false);

  protected readonly current = computed(() => this.mine()[0] ?? null);
  protected readonly name = computed(() => this.chat().customerName || this.chat().contactName || '');

  constructor() {
    effect(
      () => {
        const id = this.chat().id;
        // Re-read when the chat's reminder state changes (a reminder became due, was snoozed…).
        this.chat().nextReminderAt;
        untracked(() => this.load(id));
      },
      { allowSignalWrites: true },
    );
  }

  protected done(): void {
    const r = this.current();
    if (!r || this.busy()) return;
    this.busy.set(true);
    this.tools
      .reminderDone(r.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success(this.t('inboxTools.due.doneToast'));
          this.drop(r, null);
        },
        error: (e: ApiError) => this.fail(e),
      });
  }

  protected snooze(preset: ReminderPreset): void {
    const r = this.current();
    if (!r || this.busy()) return;
    const dueAt = presetDate(preset).toISOString();
    this.busy.set(true);
    this.tools
      .reminderDone(r.id)
      .pipe(
        switchMap(() => this.tools.addReminder(this.chat(), { dueAt, note: r.note })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fresh) => {
          this.busy.set(false);
          const when = formatCairoDate(fresh.dueAt, this.language.lang(), 'datetime');
          this.toast.success(interpolate(this.t('inboxTools.due.snoozedToast'), { when }));
          this.drop(r, fresh.dueAt);
        },
        error: (e: ApiError) => this.fail(e),
      });
  }

  private drop(r: WaChatReminder, added: string | null): void {
    const rest = this.mine().filter((x) => x.id !== r.id);
    this.mine.set(rest);
    const next = [added, ...rest.map((x) => x.dueAt)].filter((x): x is string => !!x).sort(compareByIso)[0] ?? null;
    this.changed.emit({ nextReminderAt: next, reminderDue: rest.length > 0 });
  }

  private load(chatId: number): void {
    const page = { pageIndex: 1, pageSize: 100 };
    forkJoin([this.tools.reminders({ ...page, status: 'due' }), this.tools.reminders({ ...page, status: 'pending' })])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([due, pending]) => {
          const now = Date.now();
          this.mine.set(
            [...due.data, ...pending.data]
              .filter(
                (r) =>
                  r.chatId === chatId &&
                  r.status !== 'Done' &&
                  (r.status === 'Due' || (parseUtc(r.dueAt)?.getTime() ?? Infinity) <= now),
              )
              .sort((a, b) => compareByIso(a.dueAt, b.dueAt)),
          );
        },
        error: () => this.mine.set([]),
      });
  }

  private fail(e: ApiError): void {
    this.busy.set(false);
    this.toast.error(e?.message || this.t('inboxTools.failed'));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
