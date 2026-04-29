import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type TabbedNavColor =
  | 'primary'
  | 'indigo'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'cyan'
  | 'pink'
  | 'gray';

export interface TabbedNavItem {
  /** Relative router link target (e.g. 'panel', 'sales-report'). */
  routerLink: string | unknown[];
  /** i18n key resolved through TranslatePipe. */
  labelKey: string;
  /** Font Awesome class string (e.g. 'fa-solid fa-chart-column'). */
  icon: string;
  /** Color tint — keep paired with the same item across themes. Defaults to 'primary'. */
  color?: TabbedNavColor;
}

@Component({
  selector: 'app-tabbed-nav-card',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tabbed-nav-card.component.html',
  styleUrl: './tabbed-nav-card.component.scss',
})
export class TabbedNavCardComponent {
  @Input({ required: true }) items: TabbedNavItem[] = [];
}
