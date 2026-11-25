import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, filter } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { INBOX_TOOLS_GATEWAY } from '../../data/inbox-tools.gateway';
import { WaChat, WaChatNote } from '../../models/whatsapp.models';
import { WhatsAppRealtimeService } from '../../services/whatsapp-realtime.service';
import { NOTE_MAX_LENGTH } from '../../utils/inbox-tools.util';

/**
 * Internal notes of one chat (§3) — team only, never sent to the customer.
 * Newest first; the author (or an Admin) can delete a note, system notes
 * (e.g. a transfer) only by an Admin. Live: re-reads when the chat's
 * `notesCount` changes on the hub and appends `whatsappChatNoteAdded` (de-duplicated by id).
 */
@Component({
  selector: 'app-wa-notes-panel',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-notes-panel.component.html',
  styleUrl: './wa-notes-panel.component.scss',
})
export class WaNotesPanelComponent {
  private readonly tools = inject(INBOX_TOOLS_GATEWAY);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly realtime = inject(WhatsAppRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chat = input.required<WaChat>();
  /** The real number of notes after a load / add / delete. */
  readonly countChange = output<number>();
  readonly closed = output<void>();

  protected readonly maxLength = NOTE_MAX_LENGTH;
  protected readonly notes = signal<WaChatNote[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly canAdd = computed(() => {
    const text = this.draft().trim();
    return !!text && text.length <= NOTE_MAX_LENGTH && !this.saving();
  });

  private readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  private readonly myId = computed(() => this.auth.currentUser()?.userId ?? null);
  private loadSub: Subscription | null = null;

  constructor() {
    // Load on open, on another chat, and whenever the count moves under us.
    let lastChatId: number | null = null;
    effect(
      () => {
        const chat = this.chat();
        const count = chat.notesCount ?? 0;
        untracked(() => {
          const changedChat = chat.id !== lastChatId;
          if (changedChat) {
            lastChatId = chat.id;
            this.draft.set('');
            this.load(true);
          } else if (count !== this.notes().length && !this.saving() && this.deletingId() === null) {
            this.load(false);
          }
        });
      },
      { allowSignalWrites: true },
    );

    this.realtime.noteAdded$
      .pipe(
        filter((e) => e?.chatId === this.chat().id && !!e.note),
        takeUntilDestroyed(),
      )
      .subscribe(({ note }) => this.merge(note));
  }

  protected canDelete(note: WaChatNote): boolean {
    if (this.isAdmin()) return true;
    return !note.isSystem && note.createdById === this.myId();
  }

  protected reload(): void {
    this.load(true);
  }

  protected add(): void {
    if (!this.canAdd()) return;
    const chatId = this.chat().id;
    this.saving.set(true);
    this.tools
      .addNote(chatId, this.draft().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (note) => {
          this.saving.set(false);
          this.draft.set('');
          if (chatId === this.chat().id) this.merge(note);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.toast.error(e?.message || this.t('inboxTools.failed'));
        },
      });
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Ctrl / ⌘ + Enter adds; plain Enter is a new line.
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.add();
    }
  }

  protected async remove(note: WaChatNote): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('inboxTools.notes.deleteTitle'),
      message: this.t('inboxTools.notes.deleteMessage'),
      confirmText: this.t('inboxTools.notes.deleteConfirm'),
      type: 'danger',
    });
    if (!ok) return;
    this.deletingId.set(note.id);
    this.tools
      .deleteNote(note.chatId, note.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingId.set(null);
          this.notes.update((list) => list.filter((n) => n.id !== note.id));
          this.countChange.emit(this.notes().length);
        },
        error: (e: ApiError) => {
          this.deletingId.set(null);
          this.toast.error(e?.message || this.t('inboxTools.failed'));
        },
      });
  }

  private merge(note: WaChatNote): void {
    if (this.notes().some((n) => n.id === note.id)) return;
    this.notes.update((list) => [note, ...list]);
    this.countChange.emit(this.notes().length);
  }

  private load(showSpinner: boolean): void {
    this.loadSub?.unsubscribe();
    if (showSpinner) {
      this.loading.set(true);
      this.notes.set([]);
    }
    this.error.set(false);
    const chatId = this.chat().id;
    this.loadSub = this.tools
      .notes(chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (chatId !== this.chat().id) return;
          this.loading.set(false);
          this.notes.set(rows);
          this.countChange.emit(rows.length);
        },
        error: () => {
          this.loading.set(false);
          if (showSpinner) this.error.set(true);
        },
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
