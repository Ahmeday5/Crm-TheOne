import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChatMessage } from '../../models/chat.model';
import {
  dayKey,
  dayLabel,
  formatBytes,
  formatClock,
  formatDuration,
} from '../../models/chat-format.util';
import { ChatService } from '../../services/chat.service';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type RenderItem =
  | { kind: 'sep'; id: string; label: string }
  | { kind: 'msg'; id: string; msg: ChatMessage };

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-thread.component.html',
  styleUrl: './chat-thread.component.scss',
})
export class ChatThreadComponent {
  private readonly chat = inject(ChatService);
  private readonly lang = inject(LanguageService);
  private readonly toast = inject(ToastService);

  /** Emitted on mobile to slide back to the conversation list. */
  @Output() back = new EventEmitter<void>();

  @ViewChild('scroller') private scroller?: ElementRef<HTMLDivElement>;

  readonly conversation = this.chat.activeConversation;
  readonly draft = signal('');

  // ─── voice recording state ───
  readonly isRecording = signal(false);
  readonly recordSeconds = signal(0);
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private recordStart = 0;
  private cancelled = false;

  /** Flat list of day separators + messages for the active conversation. */
  readonly items = computed<RenderItem[]>(() => {
    const convo = this.conversation();
    if (!convo) return [];
    const out: RenderItem[] = [];
    let last = '';
    for (const m of convo.messages) {
      const dk = dayKey(m.createdAt);
      if (dk !== last) {
        out.push({ kind: 'sep', id: `sep-${dk}`, label: this.daySeparator(m.createdAt) });
        last = dk;
      }
      out.push({ kind: 'msg', id: m.id, msg: m });
    }
    return out;
  });

  readonly subtitle = computed(() => {
    const c = this.conversation();
    if (!c) return '';
    if (c.typing) return this.t('chat.typing');
    if (c.kind === 'group') {
      return `${c.participants.length} ${this.t('chat.members')}`;
    }
    return this.t(c.online ? 'chat.online' : 'chat.offline');
  });

  constructor() {
    // Auto-scroll to the newest message whenever the thread or its length changes.
    effect(() => {
      const c = this.conversation();
      void c?.messages.length;
      void this.chat.activeId();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  // ─────────── text ───────────

  send(): void {
    const text = this.draft();
    if (!text.trim()) return;
    this.chat.sendText(text);
    this.draft.set('');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  // ─────────── attachments ───────────

  onPickMedia(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    this.readFile(file, type);
  }

  onPickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.readFile(file, 'file');
  }

  private readFile(file: File, type: 'image' | 'video' | 'file'): void {
    if (file.size > MAX_BYTES) {
      this.toast.warning(this.t('chat.fileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.chat.sendMedia({
        type,
        dataUrl: reader.result as string,
        name: file.name,
        mime: file.type,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  }

  // ─────────── voice recording ───────────

  async startRecording(): Promise<void> {
    if (this.isRecording()) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.toast.error(this.t('chat.micDenied'));
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.toast.error(this.t('chat.micDenied'));
      return;
    }

    this.cancelled = false;
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => this.finishRecording();
    this.recorder.start();

    this.recordStart = Date.now();
    this.recordSeconds.set(0);
    this.isRecording.set(true);
    this.timer = window.setInterval(() => {
      this.recordSeconds.set(Math.floor((Date.now() - this.recordStart) / 1000));
    }, 250);
  }

  stopAndSend(): void {
    if (!this.isRecording()) return;
    this.cancelled = false;
    this.teardownTimer();
    this.recorder?.stop();
    this.isRecording.set(false);
  }

  cancelRecording(): void {
    if (!this.isRecording()) return;
    this.cancelled = true;
    this.teardownTimer();
    this.recorder?.stop();
    this.isRecording.set(false);
  }

  private finishRecording(): void {
    const durationSec = Math.max(1, Math.round((Date.now() - this.recordStart) / 1000));
    const blob = new Blob(this.chunks, {
      type: this.recorder?.mimeType || 'audio/webm',
    });
    this.releaseStream();

    if (this.cancelled || blob.size === 0) {
      this.chunks = [];
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.chat.sendMedia({
        type: 'audio',
        dataUrl: reader.result as string,
        mime: blob.type,
        size: blob.size,
        durationSec,
      });
    };
    reader.readAsDataURL(blob);
    this.chunks = [];
  }

  private teardownTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }

  // ─────────── view helpers ───────────

  initials(name: string): string {
    return this.chat.initials(name);
  }

  clock(ts: number): string {
    return formatClock(ts, this.locale());
  }

  duration(sec: number | undefined): string {
    return formatDuration(sec);
  }

  bytes(size: number | undefined): string {
    return formatBytes(size);
  }

  recordTimer(): string {
    return formatDuration(this.recordSeconds());
  }

  statusIcon(msg: ChatMessage): string {
    if (msg.status === 'sent') return 'fa-solid fa-check';
    return 'fa-solid fa-check-double';
  }

  private daySeparator(ts: number): string {
    const info = dayLabel(ts, this.locale());
    if (info.kind === 'today') return this.t('chat.today');
    if (info.kind === 'yesterday') return this.t('chat.yesterday');
    return info.date;
  }

  private scrollToBottom(): void {
    const el = this.scroller?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private locale(): 'ar-EG' | 'en-US' {
    return this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
