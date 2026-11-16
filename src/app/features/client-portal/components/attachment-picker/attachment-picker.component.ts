import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatBytes } from '../../../project-workspace/utils/build-ui.util';
import { REQUEST_ACCEPT, REQUEST_MAX_FILES, checkRequestFile } from '../../models/client-portal.models';

interface Picked {
  file: File;
  /** Object URL for image previews (revoked on remove / destroy). */
  preview: string | null;
}

/**
 * Drag & drop (or click) attachments with image thumbnails. Two-way `files`.
 * Enforces the backend rules (≤ 10 files, ≤ 20 MB, known types) and says why a
 * file was skipped. `compact` = a single paperclip button (reply boxes).
 */
@Component({
  selector: 'app-attachment-picker',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attachment-picker.component.html',
  styleUrl: './attachment-picker.component.scss',
})
export class AttachmentPickerComponent {
  readonly files = model<File[]>([]);
  readonly compact = input(false);
  readonly disabled = input(false);

  protected readonly accept = REQUEST_ACCEPT;
  protected readonly fmtBytes = formatBytes;
  protected readonly picked = signal<Picked[]>([]);
  protected readonly over = signal(false);
  protected readonly skipped = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.picked().forEach((p) => p.preview && URL.revokeObjectURL(p.preview)));
  }

  /** Parent cleared `files` (e.g. after sending) — drop our previews too. */
  ngDoCheck(): void {
    if (this.files().length === 0 && this.picked().length) {
      this.picked().forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      this.picked.set([]);
    }
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.add(Array.from(el.files ?? []));
    el.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    if (this.disabled()) return;
    this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.over.set(true);
  }

  protected remove(index: number): void {
    const p = this.picked()[index];
    if (p?.preview) URL.revokeObjectURL(p.preview);
    this.picked.update((list) => list.filter((_, i) => i !== index));
    this.files.set(this.picked().map((x) => x.file));
  }

  private add(incoming: File[]): void {
    this.skipped.set(null);
    const next = [...this.picked()];
    for (const file of incoming) {
      if (next.length >= REQUEST_MAX_FILES) {
        this.skipped.set('tooMany');
        break;
      }
      const problem = checkRequestFile(file);
      if (problem) {
        this.skipped.set(problem);
        continue;
      }
      next.push({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
    }
    this.picked.set(next);
    this.files.set(next.map((p) => p.file));
  }
}
