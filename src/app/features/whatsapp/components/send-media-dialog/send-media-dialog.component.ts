import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MessageContentType } from '../../models/message.model';
import { MessagesStore } from '../../store/messages.store';

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB (WhatsApp media ceiling)

@Component({
  selector: 'app-send-media-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './send-media-dialog.component.html',
  styleUrl: './send-media-dialog.component.scss',
})
export class SendMediaDialogComponent {
  @Input({ required: true }) type!: Exclude<MessageContentType, 'text'>;
  @Output() closed = new EventEmitter<void>();

  private readonly store = inject(MessagesStore);
  private readonly lang = inject(LanguageService);

  // shared media state
  readonly mode = signal<'upload' | 'url'>('upload');
  readonly url = signal('');
  readonly caption = signal('');
  readonly fileData = signal<string | null>(null);
  readonly fileName = signal('');
  readonly fileMime = signal('');
  readonly fileError = signal<string | null>(null);

  // location state
  readonly latitude = signal('');
  readonly longitude = signal('');
  readonly description = signal('');

  // contact state
  readonly contactName = signal('');
  readonly contactPhone = signal('');

  readonly touched = signal(false);

  readonly isMedia = computed(() =>
    ['image', 'video', 'audio', 'document'].includes(this.type),
  );

  readonly previewUrl = computed(() => this.fileData() || this.url().trim());

  readonly canSubmit = computed(() => {
    switch (this.type) {
      case 'location':
        return this.validLat() && this.validLng();
      case 'contact':
        return !!this.contactName().trim() && this.validContactPhone();
      default:
        return !!this.previewUrl();
    }
  });

  get accept(): string {
    switch (this.type) {
      case 'image': return 'image/*';
      case 'video': return 'video/*';
      case 'audio': return 'audio/*';
      default: return '*/*';
    }
  }

  title(): string {
    const typeLabel = this.t(`whatsapp.chat.types.${this.type}`);
    return this.t('whatsapp.chat.compose.title').replace('{type}', typeLabel);
  }

  setMode(mode: 'upload' | 'url'): void {
    this.mode.set(mode);
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.fileError.set(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      this.fileError.set(this.t('whatsapp.chat.compose.fileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.fileData.set(reader.result as string);
      this.fileName.set(file.name);
      this.fileMime.set(file.type || 'application/octet-stream');
    };
    reader.readAsDataURL(file);
  }

  submit(): void {
    this.touched.set(true);
    if (!this.canSubmit()) return;

    const caption = this.caption().trim();
    const src = this.mode() === 'upload' ? this.fileData() ?? '' : this.url().trim();
    const preview = this.previewUrl();

    switch (this.type) {
      case 'image':
        this.store.sendImage(src, caption, preview);
        break;
      case 'video':
        this.store.sendVideo(src, caption, preview);
        break;
      case 'audio':
        this.store.sendAudio(src, preview);
        break;
      case 'document':
        this.store.sendDocument(
          src,
          this.fileMime() || 'application/octet-stream',
          this.fileName() || this.fileNameFromUrl(),
        );
        break;
      case 'location':
        this.store.sendLocation(this.latitude().trim(), this.longitude().trim(), this.description().trim());
        break;
      case 'contact':
        this.store.sendContact(this.contactName().trim(), this.contactPhone().trim());
        break;
    }
    this.closed.emit();
  }

  // ─────────── validation helpers ───────────

  validLat(): boolean {
    const n = Number(this.latitude());
    return this.latitude().trim() !== '' && Number.isFinite(n) && n >= -90 && n <= 90;
  }
  validLng(): boolean {
    const n = Number(this.longitude());
    return this.longitude().trim() !== '' && Number.isFinite(n) && n >= -180 && n <= 180;
  }
  validContactPhone(): boolean {
    return /^[+\d][\d\s-]{6,18}$/.test(this.contactPhone().trim());
  }

  private fileNameFromUrl(): string {
    const u = this.url().trim();
    const last = u.split('/').pop() || 'document';
    return last.split('?')[0] || 'document';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
