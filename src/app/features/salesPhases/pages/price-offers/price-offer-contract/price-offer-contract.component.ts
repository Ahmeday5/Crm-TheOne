import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../../core/i18n';
import { LanguageService } from '../../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../../shared/components/load-error/load-error.component';
import { PriceQuotationDetail } from '../../../../../shared/models';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { PriceQuotationsService } from '../../../services/price-quotations.service';

/**
 * Printable "عرض سعر" document for a single price quotation.
 *
 * Reproduces the official The One System quotation template (the PDF the
 * client supplied): branded bilingual header, addressee block, the line-item
 * table, fixed terms / operating-requirements section, and the signature
 * block — across two A4 pages. Everything outside `.contract-sheet` is
 * hidden by the print stylesheet so `window.print()` yields the document
 * alone.
 *
 * Only the dynamic fields come from the API (`GET /PriceQuotations/{id}`):
 * date, company, addressee, and the items table. The rest is the company's
 * standing boilerplate and is intentionally hard-coded Arabic — it is a
 * formal Arabic business document, not localized UI.
 */
@Component({
  selector: 'app-price-offer-contract',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-offer-contract.component.html',
  styleUrl: './price-offer-contract.component.scss',
})
export class PriceOfferContractComponent implements OnInit {
  private readonly service = inject(PriceQuotationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  private quoteId: number | null = null;

  readonly quote = signal<PriceQuotationDetail | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /**
   * Document date — the quotation's `createdAt` once the backend returns it;
   * today's date as a graceful fallback until then.
   */
  readonly issueDate = computed(() => {
    const created = this.quote()?.createdAt;
    const d = created ? new Date(created) : new Date();
    if (Number.isNaN(d.getTime())) return this.formatDateParts(new Date());
    return this.formatDateParts(d);
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.quoteId = idParam ? Number(idParam) : null;
    this.load();
  }

  load(): void {
    if (this.quoteId === null) {
      this.loadError.set(this.t('sales.priceOffers.contract.loadFailed'));
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(this.quoteId).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('sales.priceOffers.contract.loadFailed'));
      },
    });
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/price-offers']);
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) return '0';
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  private formatDateParts(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd} / ${mm} / ${yyyy}`;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
