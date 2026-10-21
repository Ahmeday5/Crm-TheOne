import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  OnChanges,
  inject,
  input,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../core/i18n';

/** Header classes that mark a column as the row's action toolbar. */
const ACTION_CLASSES = ['rt-actions', 'actions-col', 'crm-actions-col'];

/** Header text that also means "actions" (covers both locales). */
const ACTION_LABELS = new Set(
  Object.values(TRANSLATIONS).map((dict) =>
    normalize(resolveKey(dict, 'common.actions')),
  ),
);

/**
 * Collapses a regular `<table>` into a stack of labelled cards on phones.
 *
 *   <table class="table" appResponsiveTable>…</table>
 *   <table class="table" appResponsiveTable [rtPrimaryCol]="1">…</table>
 *
 * Desktop rendering is untouched. Below the `md` breakpoint the global
 * `_responsive-table.scss` rules hide `<thead>` and render every `<tr>` as a
 * card in which each cell shows its column header as an inline label — so a
 * 100-column table becomes 100 labelled lines per card and keeps working
 * with the page's existing pagination.
 *
 * The directive only *annotates* the DOM; all visuals live in CSS:
 *   - `data-label` on every body cell, copied from its column header
 *     (an explicit `data-label` on the `<td>` or `<th>` wins);
 *   - `.rt-primary` on the title cell (column `rtPrimaryCol`, `-1` = none);
 *   - `.rt-actions` on the action-toolbar cell (detected from the header's
 *     class or text, or set it yourself with `<th class="rt-actions">`);
 *   - `.rt-full`    on cells that span the whole row (loading / empty rows);
 *   - `.rt-hide-mobile` propagates from a header to its whole column.
 *
 * A MutationObserver re-labels rows as they are paged, filtered or
 * re-translated, coalesced to one pass per animation frame.
 */
@Directive({
  selector: 'table[appResponsiveTable]',
  standalone: true,
  host: { class: 'rt-table' },
})
export class ResponsiveTableDirective implements AfterViewInit, OnChanges {
  /** Zero-based column rendered as the card title; `-1` disables it. */
  readonly rtPrimaryCol = input<number>(0);

  private readonly host = inject<ElementRef<HTMLTableElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private frame = 0;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.annotate();

    // Outside Angular: re-labelling never needs change detection.
    this.zone.runOutsideAngular(() => {
      const observer = new MutationObserver(() => this.schedule());
      observer.observe(this.host.nativeElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(this.frame);
      });
    });
  }

  ngOnChanges(): void {
    if (this.viewReady) this.annotate();
  }

  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.annotate());
  }

  private annotate(): void {
    const table = this.host.nativeElement;
    const columns = this.readColumns(table);
    if (!columns.length) return;

    const primary = this.rtPrimaryCol();
    const bodyRows = table.querySelectorAll<HTMLTableRowElement>(
      ':scope > tbody > tr, :scope > tfoot > tr',
    );

    bodyRows.forEach((row) => {
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const span = Math.max(1, cell.colSpan);
        const meta = columns[col];

        if (span >= columns.length && columns.length > 1) {
          setClass(cell, 'rt-full', true);
        } else if (meta) {
          if (!cell.hasAttribute('data-label') || cell.dataset['rtAuto'] === '1') {
            cell.setAttribute('data-label', meta.label);
            cell.dataset['rtAuto'] = '1';
          }
          setClass(cell, 'rt-primary', col === primary && !meta.isActions);
          setClass(cell, 'rt-actions', meta.isActions);
          setClass(cell, 'rt-hide-mobile', meta.hideMobile);
        }
        col += span;
      }
    });
  }

  /** One entry per logical column, expanding header `colspan`s. */
  private readColumns(table: HTMLTableElement): ColumnMeta[] {
    const headerRows = table.tHead?.rows;
    const headerRow = headerRows?.[headerRows.length - 1];
    if (!headerRow) return [];

    const columns: ColumnMeta[] = [];
    for (const th of Array.from(headerRow.cells)) {
      const label = th.getAttribute('data-label') ?? normalize(th.textContent);
      const meta: ColumnMeta = {
        label,
        isActions:
          ACTION_CLASSES.some((c) => th.classList.contains(c)) ||
          ACTION_LABELS.has(label),
        hideMobile: th.classList.contains('rt-hide-mobile'),
      };
      for (let i = 0; i < Math.max(1, th.colSpan); i++) columns.push(meta);
    }
    return columns;
  }
}

interface ColumnMeta {
  label: string;
  isActions: boolean;
  hideMobile: boolean;
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function setClass(el: Element, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}
