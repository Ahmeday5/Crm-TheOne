import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AnalyticsSection } from '../../models/smart-analytics.models';

export interface AnalyticsTab {
  id: AnalyticsSection;
  icon: string;
  /** Small lock badge (e.g. Admin-only). */
  restricted?: boolean;
}

/**
 * Section navigation — an accessible tablist (arrow keys / Home / End move
 * focus *and* selection) rendered as large tiles with an animated active bar.
 */
@Component({
  selector: 'app-analytics-tabs',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics-tabs.component.html',
  styleUrl: './analytics-tabs.component.scss',
})
export class AnalyticsTabsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tabs = input.required<AnalyticsTab[]>();
  readonly active = input.required<AnalyticsSection>();
  readonly tabChange = output<AnalyticsSection>();

  onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const step: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
      Home: -index,
      End: count - 1 - index,
    };
    if (!(event.key in step)) return;
    event.preventDefault();
    const next = (index + step[event.key] + count) % count;
    this.tabChange.emit(this.tabs()[next].id);
    this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
}
