import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  ARTICLE_ACCESS_LEVELS,
  ARTICLE_MAX_ATTACHMENTS,
  ARTICLE_STATUSES,
  ARTICLE_TYPES,
  Article,
  ArticleAccessLevelName,
  ArticleCategoryOption,
  ArticleCategorySource,
  ArticleEnumOption,
  ArticleStatusName,
  ArticleTypeName,
  FormMode,
  UpdateArticleBody,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ArticlesService } from '../../services/articles.service';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-article-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    SearchableSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-form-dialog.component.html',
})
export class ArticleFormDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) mode!: FormMode;
  @Input() article: Article | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ArticlesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = ARTICLE_TYPES;
  readonly statuses = ARTICLE_STATUSES;
  readonly accessLevels = ARTICLE_ACCESS_LEVELS;
  readonly maxAttachments = ARTICLE_MAX_ATTACHMENTS;

  readonly categoryOptions = signal<ArticleCategoryOption[]>([]);
  readonly categoryOptionsAsRecords = computed(
    () => this.categoryOptions() as unknown as Record<string, unknown>[],
  );
  readonly loadingCategories = signal(false);

  /** Newly picked attachment files (create only). */
  readonly attachments = signal<File[]>([]);
  /** Object URLs for previewing picked images — revoked on removal/reset. */
  readonly previewUrls = signal<string[]>([]);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    type: ['Guide' as ArticleTypeName, Validators.required],
    accessLevel: ['Public' as ArticleAccessLevelName, Validators.required],
    status: ['Draft' as ArticleStatusName, Validators.required],
    categorySource: ['Project' as ArticleCategorySource],
    categoryId: this.fb.control<number | null>(null),
    summary: [''],
    content: [''],
    steps: [''],
    keywords: [''],
  });

  readonly titleKey = computed(() =>
    this.mode === 'edit' ? 'kb.form.editTitle' : 'kb.form.addTitle',
  );

  ngOnInit(): void {
    this.loadCategoryOptions(this.form.controls.categorySource.value);
    // Reload the picker + clear the selection whenever the source flips.
    this.form.controls.categorySource.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((source) => {
        this.form.controls.categoryId.setValue(null);
        this.loadCategoryOptions(source);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('mode' in changes || 'article' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);
      this.revokeAllPreviews();
      this.attachments.set([]);
      this.previewUrls.set([]);
      this.patchFromArticle();
    }
  }

  ngOnDestroy(): void {
    this.revokeAllPreviews();
  }

  // ─────────── category picker ───────────

  private loadCategoryOptions(source: ArticleCategorySource): void {
    this.loadingCategories.set(true);
    const req$ =
      source === 'Customer'
        ? this.service.customerOptions()
        : this.service.projectOptions();
    req$.subscribe({
      next: (rows) => {
        this.categoryOptions.set(rows ?? []);
        this.loadingCategories.set(false);
      },
      error: () => {
        this.categoryOptions.set([]);
        this.loadingCategories.set(false);
      },
    });
  }

  private patchFromArticle(): void {
    const a = this.article;
    const source = (a?.categoryType as ArticleCategorySource) || 'Project';
    this.form.reset({
      title: a?.title ?? '',
      type: a?.type ?? 'Guide',
      accessLevel: a?.accessLevel ?? 'Public',
      status: a?.status ?? 'Draft',
      categorySource: source,
      categoryId: a?.categoryId ?? null,
      summary: a?.summary ?? '',
      content: a?.content ?? '',
      steps: a?.steps ?? '',
      keywords: a?.keywords ?? '',
    });
    this.loadCategoryOptions(source);
  }

  // ─────────── attachments (create only) ───────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    if (picked.length === 0) return;

    const nextFiles = [...this.attachments()];
    const nextUrls = [...this.previewUrls()];

    for (const file of picked) {
      if (!file.type.startsWith('image/')) {
        this.toast.error(this.t('kb.form.invalidImage'));
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        this.toast.error(this.t('kb.form.imageTooLarge'));
        continue;
      }
      if (nextFiles.length >= this.maxAttachments) {
        this.toast.warning(this.t('kb.form.maxAttachments'));
        break;
      }
      nextFiles.push(file);
      nextUrls.push(URL.createObjectURL(file));
    }
    this.attachments.set(nextFiles);
    this.previewUrls.set(nextUrls);
  }

  removeAttachment(index: number): void {
    const urls = this.previewUrls();
    if (urls[index]) URL.revokeObjectURL(urls[index]);
    this.attachments.update((list) => list.filter((_, i) => i !== index));
    this.previewUrls.update((list) => list.filter((_, i) => i !== index));
  }

  private revokeAllPreviews(): void {
    for (const url of this.previewUrls()) URL.revokeObjectURL(url);
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ =
      this.mode === 'edit' && this.article
        ? this.service.update(this.article.id, this.buildUpdateBody())
        : this.service.create(this.buildCreateForm());

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(
          this.t(this.mode === 'edit' ? 'kb.messages.updated' : 'kb.messages.created'),
        );
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
      },
    });
  }

  private buildCreateForm(): FormData {
    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.append('Title', v.title.trim());
    fd.append('Type', this.apiOf(this.types, v.type));
    fd.append('AccessLevel', this.apiOf(this.accessLevels, v.accessLevel));
    fd.append('Status', this.apiOf(this.statuses, v.status));
    fd.append('Summary', (v.summary ?? '').trim());
    fd.append('Content', (v.content ?? '').trim());
    fd.append('Steps', (v.steps ?? '').trim());
    fd.append('Keywords', (v.keywords ?? '').trim());
    if (v.categoryId != null) {
      fd.append('CategoryId', String(v.categoryId));
      fd.append('CategoryType', v.categorySource);
    }
    for (const file of this.attachments()) fd.append('attachments', file);
    return fd;
  }

  private buildUpdateBody(): UpdateArticleBody {
    const v = this.form.getRawValue();
    return {
      title: v.title.trim(),
      type: this.apiOf(this.types, v.type),
      accessLevel: this.apiOf(this.accessLevels, v.accessLevel),
      categoryId: v.categoryId,
      summary: (v.summary ?? '').trim(),
      content: (v.content ?? '').trim(),
      steps: (v.steps ?? '').trim(),
      keywords: (v.keywords ?? '').trim(),
      status: this.apiOf(this.statuses, v.status),
    };
  }

  /** Map an enum name (control value) to the Arabic description the API wants. */
  private apiOf<T extends string>(
    opts: ReadonlyArray<ArticleEnumOption<T>>,
    name: T,
  ): string {
    return opts.find((o) => o.name === name)?.api ?? name;
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
