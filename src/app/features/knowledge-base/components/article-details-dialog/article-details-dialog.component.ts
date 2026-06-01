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
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  Article,
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
})
export class ArticleDetailsDialogComponent implements OnInit {
  @Input({ required: true }) articleId!: number;

  @Output() cancel = new EventEmitter<void>();

  private readonly service = inject(ArticlesService);
  private readonly company = inject(CompanySettingsService);
  protected readonly language = inject(LanguageService);

  readonly details = signal<Article | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

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
}
