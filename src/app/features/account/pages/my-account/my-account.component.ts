import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { roleLabel } from '../../../../core/constants/roles.const';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  MAX_IMAGE_BYTES,
  formatMegabytes,
  validateImageFile,
} from '../../../../core/utils/image-file.util';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * "My account" — available to every role.
 *
 * Profile photo flow: pick → validated (type, ≤ 5 MB) → local preview →
 * "Save photo" uploads (`PUT /Auth/profile-image`) → the session's
 * `imageUrl` is updated, so the header avatar changes immediately.
 * "Remove photo" asks for confirmation, then `DELETE /Auth/profile-image`.
 */
@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-account.component.html',
  styleUrl: './my-account.component.scss',
})
export class MyAccountComponent {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly user = this.auth.currentUser;
  protected readonly roleName = computed(() =>
    roleLabel(this.auth.currentRole(), this.language.lang()),
  );
  protected readonly displayName = computed(
    () => this.user()?.fullName || this.user()?.email || '',
  );
  protected readonly maxLabel = formatMegabytes(MAX_IMAGE_BYTES);

  /** Picked but not yet uploaded. */
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingPreview = signal<string | null>(null);
  protected readonly busy = signal<'upload' | 'remove' | null>(null);

  protected readonly hasPhoto = computed(() => !!this.user()?.imageUrl);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearPending());
  }

  protected browse(): void {
    if (!this.busy()) this.fileInput().nativeElement.click();
  }

  protected onPicked(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;

    const problem = validateImageFile(file);
    if (problem) {
      const msg = this.t(`common.image.${problem}`);
      this.toast.error(problem === 'tooLarge' ? `${msg} (${this.maxLabel})` : msg);
      return;
    }

    this.clearPending();
    this.pendingFile.set(file);
    this.pendingPreview.set(URL.createObjectURL(file));
  }

  protected cancelPending(): void {
    this.clearPending();
  }

  protected upload(): void {
    const file = this.pendingFile();
    if (!file || this.busy()) return;

    this.busy.set('upload');
    this.profile
      .uploadImage(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.clearPending();
          this.toast.success(this.t('account.photo.uploaded'));
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.toast.error(err?.message?.trim() || this.t('account.photo.uploadFailed'));
        },
      });
  }

  protected async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.dialog.confirm({
      title: this.t('account.photo.confirmRemoveTitle'),
      message: this.t('account.photo.confirmRemoveMessage'),
      confirmText: this.t('account.photo.remove'),
      cancelText: this.t('common.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busy.set('remove');
    this.profile
      .removeImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.toast.success(this.t('account.photo.removed'));
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.toast.error(err?.message?.trim() || this.t('account.photo.removeFailed'));
        },
      });
  }

  private clearPending(): void {
    const url = this.pendingPreview();
    if (url) URL.revokeObjectURL(url);
    this.pendingPreview.set(null);
    this.pendingFile.set(null);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
