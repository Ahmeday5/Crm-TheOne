import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  Article,
  ArticleAttachment,
  articleStatusBadgeClass,
  articleTypeBadgeClass,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ArticlesService } from '../../services/articles.service';

@Component({
  selector: 'app-article-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-details-dialog.component.html',
  styleUrl: './article-details-dialog.component.scss',
})
export class ArticleDetailsDialogComponent implements OnInit {
  @Input({ required: true }) articleId!: number;

  @Output() cancel = new EventEmitter<void>();
  /** Emitted after any mutation (e.g. attachment deleted) so the parent can refresh. */
  @Output() changed = new EventEmitter<void>();

  private readonly service = inject(ArticlesService);
  private readonly company = inject(CompanySettingsService);
  private readonly toast = inject(ToastService);
  protected readonly language = inject(LanguageService);

  readonly details = signal<Article | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ── attachment delete state ──
  readonly confirmDeleteAttachmentId = signal<number | null>(null);
  readonly deletingAttachmentId = signal<number | null>(null);

  readonly typeBadge = articleTypeBadgeClass;
  readonly statusBadge = articleStatusBadgeClass;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(this.articleId).subscribe({
      next: (d) => {
        this.details.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(null);
      },
    });
  }

  // ─────────── attachment delete ───────────

  requestDeleteAttachment(attachment: ArticleAttachment): void {
    this.confirmDeleteAttachmentId.set(attachment.id);
  }

  cancelDeleteAttachment(): void {
    this.confirmDeleteAttachmentId.set(null);
  }

  confirmDeleteAttachment(attachment: ArticleAttachment): void {
    if (this.deletingAttachmentId()) return;
    this.deletingAttachmentId.set(attachment.id);
    this.service.deleteAttachment(attachment.id).subscribe({
      next: () => {
        this.deletingAttachmentId.set(null);
        this.confirmDeleteAttachmentId.set(null);
        // Remove the attachment from the local details signal (immediate feedback).
        this.details.update((a) =>
          a
            ? { ...a, attachments: a.attachments.filter((x) => x.id !== attachment.id) }
            : a,
        );
        this.toast.success(this.t('kb.messages.attachmentDeleted'));
        this.changed.emit();
      },
      error: () => {
        this.deletingAttachmentId.set(null);
        this.confirmDeleteAttachmentId.set(null);
        this.toast.error(this.t('kb.messages.attachmentDeleteFailed'));
      },
    });
  }

  // ─────────── helpers ───────────

  /** Resolve a server-relative attachment path to an absolute URL. */
  attachmentUrl(path: string): string {
    return this.company.assetUrl(path) ?? path;
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
