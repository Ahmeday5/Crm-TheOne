import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { INBOX_TOOLS_GATEWAY } from '../../data/inbox-tools.gateway';
import { WaChat, WaChatLabel } from '../../models/whatsapp.models';
import {
  CHAT_LABELS,
  ChatLabelMeta,
  labelMeta,
  isReminderDue,
} from '../../utils/inbox-tools.util';
import { WhatsAppInboxStore } from '../../state/whatsapp-inbox.store';
import { WaNotesPanelComponent } from '../wa-notes-panel/wa-notes-panel.component';
import { WaReminderDialogComponent } from '../wa-reminder-dialog/wa-reminder-dialog.component';
import { WaTransferDialogComponent } from '../wa-transfer-dialog/wa-transfer-dialog.component';

/**
 * The open chat's toolbar under the contact name (inbox v4): label chips +
 * «تصنيف» menu, «ذكّرني», «ملاحظات» (collapsible internal notes) and
 * «تحويل لزميل». Rendered only for users allowed to manage the chat
 * (Admin or the channel owner — the same rule as delete).
 *
 * Every change hands the updated chat to the inbox (`changed`) so the list
 * row updates at once; with the real API the hub's `whatsappChatUpdated`
 * confirms it a moment later.
 */
@Component({
  selector: 'app-wa-chat-tools',
  standalone: true,
  imports: [
    TranslatePipe,
    CairoDatePipe,
    TipDirective,
    WaNotesPanelComponent,
    WaReminderDialogComponent,
    WaTransferDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-chat-tools.component.html',
  styleUrl: './wa-chat-tools.component.scss',
})
export class WaChatToolsComponent {
  private readonly tools = inject(INBOX_TOOLS_GATEWAY);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly chat = input.required<WaChat>();
  /** Admin / Sales (transfer is not offered to Support). */
  readonly canTransfer = input(false);
  /** The chat changed (labels, notes count, reminder, transfer). */
  readonly changed = output<WaChat>();

  protected readonly allLabels = CHAT_LABELS;
  protected readonly labels = computed<ChatLabelMeta[]>(() => (this.chat().labels ?? []).map(labelMeta));
  protected readonly notesCount = computed(() => this.chat().notesCount ?? 0);
  protected readonly linked = computed(() => !!this.chat().customerId);
  private readonly store = inject(WhatsAppInboxStore, { optional: true });
  /** Live: turns on the moment the reminder time passes. */
  protected readonly due = computed(() => isReminderDue(this.chat(), this.store?.now() ?? Date.now()));

  protected readonly menuOpen = signal(false);
  protected readonly savingLabels = signal(false);
  protected readonly notesOpen = signal(false);
  protected readonly reminderOpen = signal(false);
  protected readonly transferOpen = signal(false);

  constructor() {
    // Another chat → close the menu and dialogs (the notes panel stays as the user left it).
    effect(
      () => {
        this.chat().id;
        untracked(() => {
          this.menuOpen.set(false);
          this.reminderOpen.set(false);
          this.transferOpen.set(false);
        });
      },
      { allowSignalWrites: true },
    );
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const menu = this.host.nativeElement.querySelector('.ct-labels');
    if (menu && !menu.contains(event.target as Node)) this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
  }

  protected has(code: WaChatLabel): boolean {
    return !!this.chat().labels?.includes(code);
  }

  protected toggleLabel(code: WaChatLabel): void {
    const current = this.chat().labels ?? [];
    const next = current.includes(code) ? current.filter((l) => l !== code) : [...current, code];
    this.saveLabels(next);
  }

  protected removeLabel(code: WaChatLabel): void {
    this.saveLabels((this.chat().labels ?? []).filter((l) => l !== code));
  }

  /** PUT replaces the whole set; the chip flips at once and rolls back on failure. */
  private saveLabels(labels: WaChatLabel[]): void {
    if (this.savingLabels()) return;
    const chat = this.chat();
    const before = chat.labels ?? [];
    this.savingLabels.set(true);
    this.changed.emit({ ...chat, labels });
    this.tools.setLabels(chat, labels).subscribe({
      next: (updated) => {
        this.savingLabels.set(false);
        this.changed.emit(updated);
      },
      error: (e: ApiError) => {
        this.savingLabels.set(false);
        this.changed.emit({ ...this.chat(), labels: before });
        this.toast.error(e?.message || this.t('inboxTools.failed'));
      },
    });
  }

  protected onNotesCount(count: number): void {
    if (count !== this.notesCount()) this.changed.emit({ ...this.chat(), notesCount: count });
  }

  protected onReminderChanged(next: { nextReminderAt: string | null; reminderDue: boolean }): void {
    this.changed.emit({ ...this.chat(), ...next });
  }

  protected onTransferred(chat: WaChat): void {
    this.transferOpen.set(false);
    this.changed.emit(chat);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
