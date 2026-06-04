import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { timer } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SendMediaDialogComponent } from '../../components/send-media-dialog/send-media-dialog.component';
import {
  ChatConversation,
  DeliveryStatus,
  MessageContentType,
  MessageView,
} from '../../models/message.model';
import { MessagesStore } from '../../store/messages.store';

const POLL_INTERVAL_MS = 10_000;

type ComposeType = Exclude<MessageContentType, 'text'>;
type ChatTab = 'all' | 'unread' | 'favorites' | 'groups';

@Component({
  selector: 'app-whatsapp-session-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SendMediaDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-chat.component.html',
  styleUrl: './session-chat.component.scss',
})
export class SessionChatComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(MessagesStore);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));

  @ViewChild('scroller') private scroller?: ElementRef<HTMLDivElement>;

  readonly search = signal('');
  readonly activeTab = signal<ChatTab>('all');
  readonly draft = signal('');
  readonly composeType = signal<ComposeType | null>(null);

  // new-chat dialog
  readonly newChatOpen = signal(false);
  readonly newChatNumber = signal('');

  readonly attachOptions: ComposeType[] = [
    'image', 'video', 'audio', 'document', 'location', 'contact',
  ];
  readonly tabs: ChatTab[] = ['all', 'unread', 'favorites', 'groups'];

  readonly filteredConversations = computed<ChatConversation[]>(() => {
    const term = this.search().trim().toLowerCase();
    const tab = this.activeTab();
    return this.store.conversations().filter((c) => {
      if (tab === 'unread' && c.unread === 0) return false;
      if (tab === 'favorites' && !c.favorite) return false;
      if (tab === 'groups') return false; // groups module not wired yet
      if (term) {
        return (
          c.name.toLowerCase().includes(term) ||
          c.lastText.toLowerCase().includes(term)
        );
      }
      return true;
    });
  });

  constructor() {
    effect(() => {
      void this.store.messages().length;
      void this.store.activeId();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  ngOnInit(): void {
    if (!Number.isFinite(this.id)) {
      this.router.navigate(['/whatsapp-sessions']);
      return;
    }
    this.store.open(this.id);
    timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.loadHistory(1, true));
  }

  ngOnDestroy(): void {
    this.store.reset();
  }

  // ─────────── conversations ───────────

  setTab(tab: ChatTab): void {
    this.activeTab.set(tab);
  }

  select(id: string): void {
    this.store.selectConversation(id);
  }

  backToList(): void {
    this.store.clearActive();
  }

  toggleFavorite(id: string, event: Event): void {
    event.stopPropagation();
    this.store.toggleFavorite(id);
  }

  // ─────────── new chat ───────────

  openNewChat(): void {
    this.newChatNumber.set('');
    this.newChatOpen.set(true);
  }

  confirmNewChat(): void {
    const num = this.newChatNumber().trim();
    if (!num) return;
    this.store.startConversation(num);
    this.newChatOpen.set(false);
  }

  // ─────────── send ───────────

  send(): void {
    const text = this.draft();
    if (!text.trim()) return;
    this.store.sendText(text);
    this.draft.set('');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  openCompose(type: ComposeType): void {
    this.composeType.set(type);
  }

  closeCompose(): void {
    this.composeType.set(null);
  }

  retry(key: string): void {
    this.store.retry(key);
  }

  back(): void {
    this.router.navigate(['/whatsapp-sessions', this.id]);
  }

  // ─────────── view helpers ───────────

  clock(iso: string): string {
    return this.fmt(iso, { hour: '2-digit', minute: '2-digit' });
  }

  listTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (sameDay) return this.fmt(iso, { hour: '2-digit', minute: '2-digit' });
    return this.fmt(iso, { day: '2-digit', month: '2-digit' });
  }

  daySeparator(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const strip = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((strip(today) - strip(d)) / 86_400_000);
    if (diff === 0) return this.t('whatsapp.chat.today');
    if (diff === 1) return this.t('whatsapp.chat.yesterday');
    return this.fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** True when this message starts a new calendar day vs. the previous one. */
  isNewDay(index: number): boolean {
    const list = this.store.messages();
    if (index === 0) return true;
    const a = new Date(list[index - 1].createdAt);
    const b = new Date(list[index].createdAt);
    return a.toDateString() !== b.toDateString();
  }

  deliveryIcon(status: DeliveryStatus): string {
    switch (status) {
      case 'queued':
      case 'pending': return 'fa-regular fa-clock';
      case 'sent': return 'fa-solid fa-check';
      case 'delivered':
      case 'read': return 'fa-solid fa-check-double';
      case 'failed': return 'fa-solid fa-circle-exclamation';
      default: return 'fa-solid fa-check';
    }
  }

  deliveryClass(status: DeliveryStatus): string {
    if (status === 'read') return 'tick-read';
    if (status === 'failed') return 'tick-failed';
    return 'tick-default';
  }

  deliveryLabelKey(status: DeliveryStatus): string {
    return `whatsapp.chat.delivery.${status}`;
  }

  trackConv = (_: number, c: ChatConversation) => c.id;
  trackMsg = (_: number, m: MessageView) => m.key;

  private scrollToBottom(): void {
    const el = this.scroller?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        opts,
      );
    } catch {
      return '';
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
