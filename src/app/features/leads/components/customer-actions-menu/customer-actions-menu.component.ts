import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { toTelHref, toWhatsAppHref } from '../../../../core/utils/phone.util';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * Which secondary actions the host page wants surfaced in the kebab menu.
 *
 * Every flag defaults to `false` so the host can opt-in to only what its
 * variant supports — e.g. `assignSales` lives on marketing-leads, while
 * `assignSupport` lives on sales-leads, and the support page exposes
 * neither.
 */
export interface CustomerActionsConfig {
  /** "View details" — almost always on; renders as an inline button. */
  view?: boolean;
  /** Edit-my-note — renders as an inline button. */
  note?: boolean;
  /** Edit the customer profile (currently marketing-only). */
  edit?: boolean;
  /** Assign / change sales rep (marketing-only). */
  assignSales?: boolean;
  /** Assign customer to a support agent (sales-only). */
  assignSupport?: boolean;
  /** Change customer status. */
  changeStatus?: boolean;
  /** Update follow-up dates. */
  followUp?: boolean;
  /** Log a contact attempt with call result (Sales + Admin only). */
  logContact?: boolean;
  /** Open the full activity log timeline for this customer. */
  activities?: boolean;
  /** Delete (marketing-only). */
  delete?: boolean;
}

/**
 * Compact row-level action surface for the three customer tables.
 *
 * Layout:
 *   - Two inline icon buttons for the high-frequency actions (View + Note)
 *     plus tel: and wa.me anchors when the phone is parseable.
 *   - A kebab dropdown for the rest, scoped by `actions` config.
 *
 * The component knows nothing about HTTP — it just emits an output per
 * action and lets the host page decide what to do. Phone helpers are
 * resolved here so call-sites stay simple.
 */
@Component({
  selector: 'app-customer-actions-menu',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-actions-menu.component.html',
})
export class CustomerActionsMenuComponent {
  private readonly language = inject(LanguageService);

  readonly phone = input<string | null | undefined>(null);
  readonly actions = input<CustomerActionsConfig>({});
  /** Per-row spinner — when set, all buttons go disabled. */
  readonly busy = input<boolean>(false);
  /** Activity count for this row — shows a badge on the activities button. */
  readonly activitiesCount = input<number>(0);

  // ── outputs (one per action — host wires only the ones it enables) ──
  readonly view = output<void>();
  readonly note = output<void>();
  readonly edit = output<void>();
  readonly assignSales = output<void>();
  readonly assignSupport = output<void>();
  readonly changeStatus = output<void>();
  readonly followUp = output<void>();
  readonly logContact = output<void>();
  readonly activities = output<void>();
  readonly delete = output<void>();

  readonly telHref = computed(() => toTelHref(this.phone()));
  readonly waHref = computed(() => toWhatsAppHref(this.phone()));

  /** True when at least one of the dropdown-eligible actions is enabled. */
  readonly hasMenu = computed(() => {
    const a = this.actions();
    return !!(
      a.edit ||
      a.assignSales ||
      a.assignSupport ||
      a.changeStatus ||
      a.followUp ||
      a.logContact ||
      a.activities ||
      a.delete
    );
  });

  /** Accessible label for the kebab toggle. */
  readonly moreLabel = computed(() =>
    resolveKey(
      TRANSLATIONS[this.language.lang()],
      'customers.table.moreActions',
    ),
  );
}
