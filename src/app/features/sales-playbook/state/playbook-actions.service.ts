import { Injectable, inject, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { ApiError } from '../../../core/models/api-response.model';
import { DialogService } from '../../../core/services/dialog.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { PlaybookKind } from '../models/sales-playbook.models';
import { SalesPlaybookStore } from './sales-playbook.store';

/** Confirm → delete → toast, shared by every playbook tab. */
@Injectable({ providedIn: 'root' })
export class PlaybookActionsService {
  private readonly store = inject(SalesPlaybookStore);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Id of the item currently being deleted (cards show a spinner). */
  readonly busyId = signal<string | null>(null);

  async remove(kind: PlaybookKind, id: string, name: string): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('salesPlaybook.deleteDialog.title'),
      message: `${this.t('salesPlaybook.deleteDialog.message')}\n«${name}»`,
      confirmText: this.t('salesPlaybook.actions.delete'),
      cancelText: this.t('salesPlaybook.form.cancel'),
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(id);
    this.store.remove(kind, id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('salesPlaybook.messages.deleted'));
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.toast.error(err?.message?.trim() || this.t('salesPlaybook.messages.saveFailed'));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
