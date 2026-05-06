import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChannelSource } from '../../../../shared/models';
import { ChannelSourcesService } from '../../services/channel-sources.service';

@Component({
  selector: 'app-channel-source-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './channel-source-dialog.component.html',
})
export class ChannelSourceDialogComponent {
  @Output() created = new EventEmitter<ChannelSource>();
  @Output() cancel = new EventEmitter<void>();

  private readonly sources = inject(ChannelSourcesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  name = '';

  submit(form: NgForm): void {
    if (this.submitting() || form.invalid) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.sources.add({ name: this.name.trim() }).subscribe({
      next: (source) => {
        this.submitting.set(false);
        this.toast.success(this.t('campaigns.channelSource.created'));
        this.created.emit(source);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? null);
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
