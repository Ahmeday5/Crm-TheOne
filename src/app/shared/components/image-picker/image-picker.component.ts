import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { resolveAssetUrl } from '../../../core/utils/asset-url.util';
import {
  ImageFileError,
  MAX_IMAGE_BYTES,
  formatMegabytes,
  validateImageFile,
} from '../../../core/utils/image-file.util';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** What the parent should send: a new file, a removal, or nothing. */
export interface ImagePickerChange {
  /** Newly picked image, or `null` when none is pending. */
  file: File | null;
  /** The existing image (`currentUrl`) should be deleted. */
  removed: boolean;
}

/**
 * Optional single-image field with preview.
 *
 *   <app-image-picker (changed)="onImage($event)" />
 *   <app-image-picker [currentUrl]="entry.attachmentUrl" (changed)="onImage($event)" />
 *
 * States: empty → picked (preview, change / discard) and, when an image
 * already exists: current (change / remove) → removed (undo).
 * Files are validated (image type, size) before they are accepted; the
 * preview object URL is revoked on change and on destroy.
 */
@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-picker.component.html',
  styleUrl: './image-picker.component.scss',
})
export class ImagePickerComponent {
  /** Existing image (server-relative or absolute), if any. */
  readonly currentUrl = input<string | null | undefined>(null);
  readonly maxBytes = input<number>(MAX_IMAGE_BYTES);
  readonly disabled = input<boolean>(false);

  readonly changed = output<ImagePickerChange>();

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly file = signal<File | null>(null);
  protected readonly removed = signal(false);
  protected readonly error = signal<ImageFileError | null>(null);
  private readonly objectUrl = signal<string | null>(null);

  protected readonly existingUrl = computed(() => resolveAssetUrl(this.currentUrl()));
  protected readonly maxLabel = computed(() => formatMegabytes(this.maxBytes()));

  /** What the preview frame shows: the new pick, else the existing image. */
  protected readonly previewUrl = computed(() =>
    this.objectUrl() ?? (this.removed() ? null : this.existingUrl()),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected browse(): void {
    if (!this.disabled()) this.fileInput().nativeElement.click();
  }

  protected onPicked(event: Event): void {
    const el = event.target as HTMLInputElement;
    const picked = el.files?.[0];
    el.value = ''; // allow re-picking the same file after a discard
    if (!picked) return;

    const problem = validateImageFile(picked, this.maxBytes());
    this.error.set(problem);
    if (problem) return;

    this.revoke();
    this.objectUrl.set(URL.createObjectURL(picked));
    this.file.set(picked);
    this.removed.set(false);
    this.emit();
  }

  /** Drop the pending pick (falls back to the existing image, if any). */
  protected discard(): void {
    this.revoke();
    this.file.set(null);
    this.error.set(null);
    this.emit();
  }

  /** Mark the existing image for deletion. */
  protected remove(): void {
    this.removed.set(true);
    this.error.set(null);
    this.emit();
  }

  protected undoRemove(): void {
    this.removed.set(false);
    this.emit();
  }

  private emit(): void {
    this.changed.emit({ file: this.file(), removed: this.removed() && !this.file() });
  }

  private revoke(): void {
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
  }
}
