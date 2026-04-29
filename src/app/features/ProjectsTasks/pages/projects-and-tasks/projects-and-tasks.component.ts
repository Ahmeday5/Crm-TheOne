import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  TabbedNavCardComponent,
  TabbedNavItem,
} from '../../../../shared/components/tabbed-nav-card/tabbed-nav-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-projects-and-tasks',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, PageHeaderComponent, TabbedNavCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-and-tasks.component.html',
  styleUrl: './projects-and-tasks.component.scss',
})
export class ProjectsAndTasksComponent {
  readonly tabs: TabbedNavItem[] = [
    {
      routerLink: 'ProjectManage',
      labelKey: 'projects.tabs.projects',
      icon: 'fa-solid fa-table-columns',
      color: 'primary',
    },
    {
      routerLink: 'TasksManage',
      labelKey: 'projects.tabs.tasks',
      icon: 'fa-solid fa-list-check',
      color: 'purple',
    },
  ];
}
