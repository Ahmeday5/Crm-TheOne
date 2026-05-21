import { Injectable } from '@angular/core';

/**
 * One exportable/printable column.
 *
 * `value` pulls the display value out of a row. Returning a raw `number`
 * keeps the cell numeric in Excel; return a pre-formatted `string` for dates,
 * currency, status labels, etc. `null`/`undefined`/`''` render as a dash in
 * print and an empty cell in Excel.
 */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Text alignment in the printed table. Defaults to start. */
  align?: 'start' | 'center' | 'end';
}

export interface ExcelOptions<T> {
  /** File name without extension. */
  fileName: string;
  /** Worksheet tab name. Defaults to "Sheet1". */
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

export interface PrintOptions<T> {
  /** Report heading + browser tab title. */
  title: string;
  /** Optional sub-line under the title (e.g. active filters, scope). */
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** Document direction. Defaults to ltr. */
  dir?: 'rtl' | 'ltr';
  /** Locale used for the generated-at timestamp. */
  locale?: string;
  /** Localized labels so the print frame matches the app language. */
  labels?: {
    generatedAt?: string;
    total?: string;
  };
}

const BRAND_NAME = 'The One System';
const BRAND_LOGO = '/assets/img/logo.png';

/**
 * Excel export + branded print for any data table.
 *
 * Both paths are entity-agnostic: callers describe their columns once
 * (header + value accessor) and hand over the rows — the current page or,
 * via a fetch-all callback at the call-site, every page. Excel uses SheetJS
 * (lazy-imported so it stays out of the initial bundle); print renders a
 * standalone, app-chrome-free report document in a fresh window.
 */
@Injectable({ providedIn: 'root' })
export class TableExportService {
  /** Builds and downloads a real `.xlsx` workbook. */
  async toExcel<T>(opts: ExcelOptions<T>): Promise<void> {
    const XLSX = await import('xlsx');

    const header = opts.columns.map((c) => c.header);
    const body = opts.rows.map((row) =>
      opts.columns.map((c) => this.cellForExcel(c.value(row))),
    );
    const aoa: (string | number)[][] = [header, ...body];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = opts.columns.map((c, i) => ({
      wch: this.columnWidth(c.header, body, i),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, this.safeSheetName(opts.sheetName));
    XLSX.writeFile(wb, `${this.safeFileName(opts.fileName)}.xlsx`);
  }

  /** Opens a clean report document and triggers the browser print dialog. */
  printTable<T>(opts: PrintOptions<T>): boolean {
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) return false; // popup blocked — caller surfaces a toast

    win.document.open();
    win.document.write(this.buildPrintHtml(opts));
    win.document.close();
    return true;
  }

  // ─────────── excel helpers ───────────

  private cellForExcel(v: string | number | null | undefined): string | number {
    if (v === null || v === undefined) return '';
    return v;
  }

  private columnWidth(
    header: string,
    body: (string | number)[][],
    col: number,
  ): number {
    let max = header.length;
    for (const row of body) {
      const len = String(row[col] ?? '').length;
      if (len > max) max = len;
    }
    return Math.min(60, Math.max(8, max + 2));
  }

  private safeSheetName(name: string | undefined): string {
    // Excel sheet names are ≤ 31 chars and can't contain : \ / ? * [ ]
    const cleaned = (name ?? 'Sheet1').replace(/[:\\/?*[\]]/g, ' ').trim();
    return cleaned.slice(0, 31) || 'Sheet1';
  }

  private safeFileName(name: string): string {
    return (name || 'export').replace(/[\\/:*?"<>|]/g, '-').trim() || 'export';
  }

  // ─────────── print helpers ───────────

  private buildPrintHtml<T>(opts: PrintOptions<T>): string {
    const dir = opts.dir ?? 'ltr';
    const locale = opts.locale ?? (dir === 'rtl' ? 'ar-EG' : 'en-US');
    const generatedLabel = opts.labels?.generatedAt ?? 'Generated';
    const totalLabel = opts.labels?.total ?? 'Total';
    const stamp = new Date().toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const headCells = opts.columns
      .map(
        (c) =>
          `<th style="text-align:${this.alignFor(c.align, dir)}">${this.esc(
            c.header,
          )}</th>`,
      )
      .join('');

    const bodyRows = opts.rows
      .map((row) => {
        const cells = opts.columns
          .map((c) => {
            const raw = c.value(row);
            const text =
              raw === null || raw === undefined || raw === ''
                ? '—'
                : String(raw);
            return `<td style="text-align:${this.alignFor(
              c.align,
              dir,
            )}">${this.esc(text)}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const origin = window.location.origin;

    return `<!doctype html>
<html lang="${dir === 'rtl' ? 'ar' : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${this.esc(opts.title)}</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --brand:#003d7a; --head:#f1f5f9; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 28px 32px;
  }
  .report-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding-bottom: 14px; margin-bottom: 18px;
    border-bottom: 3px solid var(--brand);
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 46px; width: auto; object-fit: contain; }
  .brand .brand-name { font-size: 18px; font-weight: 700; color: var(--brand); }
  .report-meta { text-align: ${dir === 'rtl' ? 'left' : 'right'}; }
  .report-meta .report-title { font-size: 17px; font-weight: 700; margin: 0 0 4px; }
  .report-meta .report-sub { font-size: 12px; color: var(--muted); margin: 0; }
  .report-meta .report-stamp { font-size: 11px; color: var(--muted); margin: 2px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: var(--head); color: var(--ink); font-weight: 700;
    text-align: ${dir === 'rtl' ? 'right' : 'left'};
    padding: 9px 10px; border: 1px solid var(--line);
    white-space: nowrap;
  }
  tbody td {
    padding: 8px 10px; border: 1px solid var(--line); vertical-align: top;
  }
  tbody tr:nth-child(even) { background: #fafbfc; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .report-foot {
    margin-top: 14px; font-size: 11px; color: var(--muted);
    display: flex; justify-content: space-between;
  }
  @page { size: A4 landscape; margin: 12mm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="report-head">
    <div class="brand">
      <img id="brand-logo" src="${origin}${BRAND_LOGO}" alt="${BRAND_NAME}"
           onerror="this.style.display='none'">
      <span class="brand-name">${BRAND_NAME}</span>
    </div>
    <div class="report-meta">
      <p class="report-title">${this.esc(opts.title)}</p>
      ${opts.subtitle ? `<p class="report-sub">${this.esc(opts.subtitle)}</p>` : ''}
      <p class="report-stamp">${this.esc(generatedLabel)}: ${this.esc(stamp)}</p>
    </div>
  </div>

  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="report-foot">
    <span>${this.esc(totalLabel)}: ${opts.rows.length}</span>
    <span>${this.esc(BRAND_NAME)}</span>
  </div>

  <script>
    (function () {
      function go() { try { window.focus(); window.print(); } catch (e) {} }
      window.onafterprint = function () { window.close(); };
      var img = document.getElementById('brand-logo');
      if (img && !img.complete) {
        img.onload = go; img.onerror = go; setTimeout(go, 1500);
      } else {
        setTimeout(go, 250);
      }
    })();
  </script>
</body>
</html>`;
  }

  private alignFor(
    align: 'start' | 'center' | 'end' | undefined,
    dir: 'rtl' | 'ltr',
  ): string {
    if (align === 'center') return 'center';
    if (align === 'end') return dir === 'rtl' ? 'left' : 'right';
    if (align === 'start') return dir === 'rtl' ? 'right' : 'left';
    return dir === 'rtl' ? 'right' : 'left';
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
