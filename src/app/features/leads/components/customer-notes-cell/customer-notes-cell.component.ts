import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * One row of a customer's three role-scoped notes (Marketing / Sales /
 * Support), rendered as a column of color-coded mini-chips. Lives in
 * `<td>` cells of the three customer tables.
 *
 * Pure presentation — emits no events. Action wiring (edit/save) lives in
 * `<app-customer-note-dialog>` invoked from the row's actions column.
 *
 * Styles travel in [_customers-table.scss](../../styles/_customers-table.scss)
 * — kept here as a generic visual block so the three tables share the look
 * without duplicating SCSS.
 */
@Component({
  selector: 'app-customer-notes-cell',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="crm-notes-cell">
      @if (slots().length === 0) {
        <span class="crm-notes-empty">
          <i class="fa-regular fa-comment-dots"></i>
          {{ 'customers.noteModal.emptySlot' | translate }}
        </span>
      } @else {
        @for (slot of slots(); track slot.role) {
          <div class="note-chip"
               [class]="'note-chip role-' + slot.cls"
               [title]="slot.text">
            <span class="note-chip-icon">
              <i [class]="slot.icon"></i>
            </span>
            <div class="note-chip-body">
              <div class="note-chip-head">
                <span>{{ slot.labelKey | translate }}</span>
              </div>
              <div class="note-chip-text">{{ slot.text }}</div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class CustomerNotesCellComponent {
  readonly noteMarketing = input<string | null | undefined>(null);
  readonly noteSales = input<string | null | undefined>(null);
  readonly noteSupport = input<string | null | undefined>(null);

  /**
   * Only the populated slots survive — the empty state collapses the cell
   * to a single muted line so rows stay short when there's nothing yet.
   */
  readonly slots = computed(() => {
    const list: Array<{
      role: 'Marketing' | 'Sales' | 'Support';
      cls: 'marketing' | 'sales' | 'support';
      icon: string;
      labelKey: string;
      text: string;
    }> = [];
    const m = (this.noteMarketing() ?? '').trim();
    const s = (this.noteSales() ?? '').trim();
    const su = (this.noteSupport() ?? '').trim();
    if (m) list.push({
      role: 'Marketing',
      cls: 'marketing',
      icon: 'fa-solid fa-bullhorn',
      labelKey: 'customers.noteModal.roles.marketing',
      text: m,
    });
    if (s) list.push({
      role: 'Sales',
      cls: 'sales',
      icon: 'fa-solid fa-user-tie',
      labelKey: 'customers.noteModal.roles.sales',
      text: s,
    });
    if (su) list.push({
      role: 'Support',
      cls: 'support',
      icon: 'fa-solid fa-headset',
      labelKey: 'customers.noteModal.roles.support',
      text: su,
    });
    return list;
  });
}
