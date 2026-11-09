import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CompetitorsPanelComponent } from '../../components/competitors-panel/competitors-panel.component';
import { ObjectionsPanelComponent } from '../../components/objections-panel/objections-panel.component';
import { RepliesPanelComponent } from '../../components/replies-panel/replies-panel.component';
import { ScriptsPanelComponent } from '../../components/scripts-panel/scripts-panel.component';
import { PLAYBOOK_KINDS, PlaybookImportResult, PlaybookKind } from '../../models/sales-playbook.models';
import { MigrationReport, PlaybookMigrationService } from '../../state/playbook-migration.service';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { playbookErrorMessage } from '../../utils/playbook-errors.util';
import { KIND_ICON } from '../../utils/playbook.util';

function isKind(value: string | null): value is PlaybookKind {
  return !!value && (PLAYBOOK_KINDS as readonly string[]).includes(value);
}

/**
 * دليل المبيعات — call scripts, objection handling, competitor intel and
 * WhatsApp quick replies. Every role reads; Admin curates; Sales / Support
 * also link customers to competitors (see `sales-playbook.permissions.ts`).
 * The active tab lives in `?tab=` so links (e.g. from the WhatsApp picker)
 * open the right section.
 */
@Component({
  selector: 'app-sales-playbook',
  standalone: true,
  imports: [
    TranslatePipe,
    TipDirective,
    StatCardComponent,
    LoadErrorComponent,
    ModalComponent,
    ScriptsPanelComponent,
    ObjectionsPanelComponent,
    CompetitorsPanelComponent,
    RepliesPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-playbook.component.html',
  styleUrl: './sales-playbook.component.scss',
})
export class SalesPlaybookComponent implements OnInit {
  private readonly store = inject(SalesPlaybookStore);
  private readonly migration = inject(PlaybookMigrationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly kinds = PLAYBOOK_KINDS;
  readonly kindIcon = KIND_ICON;

  readonly isAdmin = this.store.canManage;
  readonly loading = this.store.loading;
  readonly loaded = this.store.loaded;
  readonly error = this.store.error;
  readonly counts = this.store.counts;
  readonly isEmpty = this.store.isEmpty;

  readonly tab = toSignal(
    this.route.queryParamMap.pipe(map((q) => (isKind(q.get('tab')) ? (q.get('tab') as PlaybookKind) : 'scripts'))),
    { initialValue: 'scripts' as PlaybookKind },
  );
  readonly tabIndex = computed(() => this.kinds.indexOf(this.tab()));

  readonly importing = signal(false);
  readonly importResult = signal<PlaybookImportResult | null>(null);
  readonly importAdded = computed(() => {
    const r = this.importResult();
    return r ? r.added.scripts + r.added.objections + r.added.replies : 0;
  });

  /** Content saved in this browser before the backend existed, not on the server yet. */
  readonly localPending = computed(() => (this.isAdmin() ? this.migration.pendingCount() : 0));
  readonly migrating = signal(false);
  readonly migrationReport = signal<MigrationReport | null>(null);
  readonly migrationMoved = computed(() => {
    const m = this.migrationReport()?.moved;
    return m ? m.scripts + m.objections + m.competitors + m.replies : 0;
  });

  ngOnInit(): void {
    this.store.start();
  }

  reload(): void {
    this.store.refresh();
  }

  selectTab(kind: PlaybookKind): void {
    if (kind === this.tab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: kind === 'scripts' ? null : kind },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** ←/→ across tabs (WAI-ARIA tabs pattern), mirrored for RTL. */
  onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const rtl = this.language.lang() === 'ar';
    const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
    const n = this.kinds.length;
    const next = this.kinds[(this.tabIndex() + (forward ? 1 : -1) + n) % n];
    this.selectTab(next);
    queueMicrotask(() => document.getElementById(`pb-tab-${next}`)?.focus());
  }

  async loadReadyContent(): Promise<void> {
    if (this.importing()) return;
    const ok = await this.dialog.confirm({
      title: this.t('salesPlaybook.readyContent.confirmTitle'),
      message: this.t('salesPlaybook.readyContent.confirmMessage'),
      confirmText: this.t('salesPlaybook.readyContent.confirm'),
      cancelText: this.t('salesPlaybook.form.cancel'),
      type: 'info',
    });
    if (!ok) return;

    this.importing.set(true);
    this.store.importReadyContent().subscribe({
      next: (result) => {
        this.importing.set(false);
        this.importResult.set(result);
        const added = result.added.scripts + result.added.objections + result.added.replies;
        if (added) {
          this.toast.success(
            interpolate(this.t('salesPlaybook.readyContent.toast'), {
              scripts: result.added.scripts,
              objections: result.added.objections,
              replies: result.added.replies,
              skipped: result.skipped,
            }),
          );
        } else {
          this.toast.info(this.t('salesPlaybook.readyContent.nothingNew'));
        }
      },
      error: (err: ApiError) => {
        this.importing.set(false);
        this.toast.error(err?.status ? playbookErrorMessage(err, (k) => this.t(k)) : this.t('salesPlaybook.readyContent.failed'));
      },
    });
  }

  async moveLocalContent(): Promise<void> {
    if (this.migrating()) return;
    const ok = await this.dialog.confirm({
      title: this.t('salesPlaybook.migration.confirmTitle'),
      message: this.t('salesPlaybook.migration.confirmMessage'),
      confirmText: this.t('salesPlaybook.migration.confirm'),
      cancelText: this.t('salesPlaybook.form.cancel'),
      type: 'info',
    });
    if (!ok) return;

    this.migrating.set(true);
    this.migration.migrate().subscribe({
      next: (report) => {
        this.migrating.set(false);
        this.migrationReport.set(report);
      },
      error: (err: ApiError) => {
        this.migrating.set(false);
        this.toast.error(err?.status ? playbookErrorMessage(err, (k) => this.t(k)) : this.t('salesPlaybook.migration.failed'));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
