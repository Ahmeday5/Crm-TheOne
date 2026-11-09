import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { ApiError } from '../../../core/models/api-response.model';
import { DialogService } from '../../../core/services/dialog.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { Competitor, CompetitorMention, PlaybookKind } from '../models/sales-playbook.models';
import { playbookErrorMessage } from '../utils/playbook-errors.util';
import { SalesPlaybookStore } from './sales-playbook.store';

/** Confirm → request → toast, shared by every playbook tab. */
@Injectable({ providedIn: 'root' })
export class PlaybookActionsService {
  private readonly store = inject(SalesPlaybookStore);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Id of the item currently being changed (cards show a spinner). */
  readonly busyId = signal<string | null>(null);

  async remove(kind: PlaybookKind, id: string, name: string): Promise<void> {
    const message =
      kind === 'competitors'
        ? this.t('salesPlaybook.deleteDialog.competitorMessage')
        : this.t('salesPlaybook.deleteDialog.message');
    await this.confirmAndRun(
      id,
      { title: this.t('salesPlaybook.deleteDialog.title'), message: `${message}\n«${name}»`, confirm: this.t('salesPlaybook.actions.delete') },
      () => this.store.remove(kind, id),
      this.t('salesPlaybook.messages.deleted'),
    );
  }

  async removeMention(competitor: Competitor, mention: CompetitorMention): Promise<void> {
    await this.confirmAndRun(
      mention.id,
      {
        title: this.t('salesPlaybook.mentions.removeTitle'),
        message: `${this.t('salesPlaybook.mentions.removeMessage')}\n«${mention.customerName}» — ${competitor.name}`,
        confirm: this.t('salesPlaybook.mentions.remove'),
      },
      () => this.store.removeMention(competitor.id, mention.id),
      this.t('salesPlaybook.mentions.removed'),
    );
  }

  private async confirmAndRun(
    busyKey: string,
    copy: { title: string; message: string; confirm: string },
    request: () => Observable<unknown>,
    success: string,
  ): Promise<void> {
    const ok = await this.dialog.confirm({
      title: copy.title,
      message: copy.message,
      confirmText: copy.confirm,
      cancelText: this.t('salesPlaybook.form.cancel'),
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(busyKey);
    request().subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(success);
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.toast.error(playbookErrorMessage(err, (k) => this.t(k)));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
