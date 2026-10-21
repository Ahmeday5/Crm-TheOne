import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { TextPreviewService } from '../../../core/services/text-preview.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ModalComponent } from '../modal/modal.component';

/**
 * Compact dialog that shows the full version of a truncated text.
 * Mounted once at the app root; driven by `TextPreviewService`.
 */
@Component({
  selector: 'app-text-preview-dialog',
  standalone: true,
  imports: [ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let preview = service.current();
    <app-modal
      [open]="!!preview"
      size="sm"
      icon="fa-solid fa-align-left"
      iconTone="info"
      [title]="preview?.title || ('common.details' | translate)"
      (closed)="service.close()">
      <p class="text-preview-body">{{ preview?.text }}</p>

      <ng-container modal-footer>
        <button type="button" class="btn btn-light btn-sm" (click)="copy(preview?.text)">
          <i class="fa-regular fa-copy"></i>{{ 'common.copy' | translate }}
        </button>
        <button type="button" class="btn btn-primary btn-sm" (click)="service.close()">
          {{ 'common.close' | translate }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .text-preview-body {
      margin: 0;
      white-space: pre-line;
      overflow-wrap: anywhere;
      line-height: 1.7;
      color: var(--text-1);
      font-size: var(--fs-md);
    }
  `,
})
export class TextPreviewDialogComponent {
  protected readonly service = inject(TextPreviewService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  protected async copy(text: string | undefined): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(resolveKey(TRANSLATIONS[this.language.lang()], 'common.copied'));
    } catch {
      /* Clipboard blocked (insecure origin / permissions) — nothing to do. */
    }
  }
}
