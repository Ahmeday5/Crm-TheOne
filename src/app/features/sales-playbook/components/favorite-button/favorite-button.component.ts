import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlaybookKind } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';

/** Personal star — per user, stored locally. */
@Component({
  selector: 'app-pb-favorite-button',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="pb-fav" [class.is-on]="on()"
            [attr.aria-pressed]="on()"
            [attr.aria-label]="(on() ? 'salesPlaybook.actions.unfavorite' : 'salesPlaybook.actions.favorite') | translate"
            [title]="(on() ? 'salesPlaybook.actions.unfavorite' : 'salesPlaybook.actions.favorite') | translate"
            (click)="toggle($event)">
      <i class="fa-star" [class.fa-solid]="on()" [class.fa-regular]="!on()" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .pb-fav {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-3);
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease, transform 0.15s ease;

      &:hover { background: var(--warning-soft); color: var(--warning); transform: rotate(-12deg) scale(1.08); }
      &:focus-visible { outline: 2px solid var(--brand-500); outline-offset: 2px; }
      &.is-on { color: var(--warning); }
      &.is-on i { animation: pb-star 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
    }
    @keyframes pb-star {
      0% { transform: scale(0.4) rotate(-72deg); }
      100% { transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pb-fav, .pb-fav i { transition: none; animation: none !important; }
    }
  `,
})
export class FavoriteButtonComponent {
  readonly kind = input.required<PlaybookKind>();
  readonly itemId = input.required<string>();

  private readonly store = inject(SalesPlaybookStore);
  protected readonly on = computed(() => this.store.isFavorite(this.kind(), this.itemId()));

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.store.toggleFavorite(this.kind(), this.itemId());
  }
}
