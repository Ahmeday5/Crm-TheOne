import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ContractArea, isMocked } from '../../../core/constants/contract-mocks.const';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * A small "بيانات تجريبية" tag on screens whose backend is not live yet
 * (`CONTRACT_MOCKS`). Disappears by itself when the area is flipped to live.
 */
@Component({
  selector: 'app-mock-ribbon',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active()) {
      <span class="mr" [title]="'common.mockHint' | translate">
        <i class="fa-solid fa-flask" aria-hidden="true"></i>{{ 'common.mockData' | translate }}
      </span>
    }
  `,
  styles: `
    :host { display: contents; }
    .mr {
      display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem;
      border-radius: var(--radius-pill); border: 1px dashed var(--warning);
      background: var(--warning-soft); color: var(--warning);
      font-size: var(--fs-xs); font-weight: var(--fw-700); white-space: nowrap;
    }
  `,
})
export class MockRibbonComponent {
  readonly area = input.required<ContractArea>();
  protected readonly active = computed(() => isMocked(this.area()));
}
