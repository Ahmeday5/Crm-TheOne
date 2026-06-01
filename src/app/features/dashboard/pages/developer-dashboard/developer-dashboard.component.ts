import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';

import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  ProjectListItem,
  TaskControlPanel,
  TaskListItem,
  projectPriorityBadgeClass,
  projectStatusBadgeClass,
  taskStatusBadgeClass,
} from '../../../../shared/models';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { TasksService } from '../../../ProjectsTasks/services/tasks.service';

/** How many of "my latest" tasks/projects to surface on the dashboard. */
const RECENT_LIMIT = 5;

@Component({
  selector: 'app-developer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NgApexchartsModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './developer-dashboard.component.html',
  styleUrl: './developer-dashboard.component.scss',
})
export class DeveloperDashboardComponent implements OnInit {
  private readonly tasks = inject(TasksService);
  private readonly projects = inject(ProjectsService);
  private readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);

  /** Admins read the org-wide control panel; everyone else reads their own. */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /** "Latest tasks" for admins vs. "My latest tasks" for developers. */
  readonly recentTasksTitleKey = computed(() =>
    this.isAdmin()
      ? 'dashboard.developer.recentTasksAll'
      : 'dashboard.developer.recentTasks',
  );

  readonly panel = signal<TaskControlPanel | null>(null);
  readonly recentTasks = signal<TaskListItem[]>([]);
  readonly activeProjects = signal<ProjectListItem[]>([]);
  readonly loading = signal(false);

  readonly statusBadge = taskStatusBadgeClass;
  readonly priorityBadge = projectPriorityBadgeClass;
  /** Projects carry their own status palette (distinct from task statuses). */
  readonly projectStatusBadge = projectStatusBadgeClass;

  /** Sprint performance — grouped bar (planned vs completed). */
  readonly sprintChart = computed<Record<string, unknown>>(() => {
    const sp = this.panel()?.sprintPerformance ?? [];
    return {
      series: [
        { name: this.t('dashboard.developer.planned'), data: sp.map((p) => p.planned) },
        { name: this.t('dashboard.developer.completed'), data: sp.map((p) => p.completed) },
      ],
      chart: { type: 'bar', height: 320, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: sp.map((p) => p.sprint) },
      colors: ['#3b82f6', '#10b981'],
      legend: { position: 'bottom' },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    };
  });

  /** Today's deadlines by priority — donut. */
  readonly deadlinesChart = computed<Record<string, unknown>>(() => {
    const td = this.panel()?.todayDeadlines ?? [];
    const high = td.filter((t) => t.priority === 1).length;
    const medium = td.filter((t) => t.priority === 2).length;
    const low = td.filter((t) => t.priority === 3).length;
    return {
      series: [high, medium, low],
      chart: { type: 'donut', height: 320, fontFamily: 'inherit' },
      labels: [
        this.t('projects.manage.priorities.1'),
        this.t('projects.manage.priorities.2'),
        this.t('projects.manage.priorities.3'),
      ],
      colors: ['#ef4444', '#f59e0b', '#0ea5e9'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true },
    };
  });

  ngOnInit(): void {
    this.loading.set(true);
    const admin = this.isAdmin();

    const panel$ = admin ? this.tasks.controlPanel() : this.tasks.myControlPanel();
    panel$.subscribe({
      next: (p) => this.panel.set(p),
      error: () => this.panel.set(null),
    });

    const query = { PageIndex: 1, PageSize: RECENT_LIMIT };
    const tasks$ = admin ? this.tasks.list(query) : this.tasks.myList(query);
    tasks$.subscribe({
      next: (page) => this.recentTasks.set(page.data ?? []),
      error: () => this.recentTasks.set([]),
    });

    const projects$ = admin
      ? this.projects.activeList(query)
      : this.projects.myActiveList(query);
    projects$.subscribe({
      next: (page) => {
        this.activeProjects.set(page.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.activeProjects.set([]);
        this.loading.set(false);
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
