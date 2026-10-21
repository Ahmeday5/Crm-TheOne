import { Injectable, signal } from '@angular/core';

export interface TextPreview {
  /** Dialog heading — falls back to a generic "Details" label. */
  title?: string;
  text: string;
}

/**
 * Opens the app-wide "full text" dialog used by truncated content.
 *
 * `<app-text-preview-dialog>` is mounted once at the root and renders
 * whatever is in `current`; `ClampTextDirective` is the usual caller.
 */
@Injectable({ providedIn: 'root' })
export class TextPreviewService {
  private readonly state = signal<TextPreview | null>(null);
  readonly current = this.state.asReadonly();

  open(preview: TextPreview): void {
    if (!preview.text?.trim()) return;
    this.state.set(preview);
  }

  close(): void {
    this.state.set(null);
  }
}
