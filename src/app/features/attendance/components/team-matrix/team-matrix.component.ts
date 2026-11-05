import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserRole } from '../../../../core/models/auth.model';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ATTENDANCE_ROLES, DAY_STATUSES_LEGEND, TeamMatrixRow } from '../../models/attendance.models';
import { WorkDurationPipe } from '../../pipes/work-duration.pipe';
import { formatLongDay, formatMonthLabel, formatWeekday, localeFor, monthDays } from '../../utils/attendance-date.util';
import { DAY_STATUS_ICON, dayTooltip } from '../../utils/attendance-view.util';
import { ATTENDANCE_POLICY } from '../../config/attendance.config';

type RoleFilter = 'all' | UserRole;

/**
 * Employees × days heat grid for one month (Admin). Scrolls horizontally
 * inside its own container; the employee column stays pinned.
 */
@Component({
  selector: 'app-team-matrix',
  standalone: true,
  imports: [FormsModule, TranslatePipe, TipDirective, UserAvatarComponent, EmptyStateComponent, WorkDurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-matrix.component.html',
  styleUrl: './team-matrix.component.scss',
})
export class TeamMatrixComponent {
  readonly rows = input.required<TeamMatrixRow[]>();
  readonly month = input.required<string>();
  readonly ready = input(true);
  readonly loading = input(false);
  readonly canPrev = input(true);
  readonly canNext = input(true);

  readonly prev = output<void>();
  readonly next = output<void>();

  private readonly language = inject(LanguageService);
  private readonly locale = computed(() => localeFor(this.language.lang()));

  readonly roles: RoleFilter[] = ['all', ...ATTENDANCE_ROLES];
  readonly legend = DAY_STATUSES_LEGEND;
  readonly icons = DAY_STATUS_ICON;

  readonly role = signal<RoleFilter>('all');
  readonly search = signal('');
  /** Column under the pointer — highlighted across all rows. */
  readonly hoverDay = signal<string | null>(null);

  readonly monthLabel = computed(() => formatMonthLabel(this.month(), this.locale()));

  readonly columns = computed(() =>
    monthDays(this.month()).map((d) => ({
      date: d,
      num: Number(d.slice(8)),
      wd: formatWeekday(d, this.locale(), 'narrow'),
      weekend: ATTENDANCE_POLICY.weekendDays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()),
    })),
  );

  readonly view = computed(() => {
    const q = this.search().trim().toLowerCase();
    const role = this.role();
    const lang = this.language.lang();
    const locale = this.locale();
    const dict = TRANSLATIONS[lang];
    const t = (key: string, params?: Record<string, string | number>) => interpolate(resolveKey(dict, key), params);

    return this.rows()
      .filter((r) => role === 'all' || r.employee.role === role)
      .filter((r) => !q || r.employee.name.toLowerCase().includes(q) || r.employee.email.toLowerCase().includes(q))
      .map((r) => ({
        ...r,
        cells: r.days.map((d) => ({
          date: d.date,
          status: d.status,
          isToday: d.isToday,
          isOpen: d.isOpen,
          tip: `${r.employee.name} · ${formatLongDay(d.date, locale)}\n${dayTooltip(d, lang, locale, t)}`,
        })),
      }));
  });

  readonly totals = computed(() => {
    const rows = this.view();
    return {
      present: rows.reduce((s, r) => s + r.summary.present, 0),
      late: rows.reduce((s, r) => s + r.summary.late, 0),
      absent: rows.reduce((s, r) => s + r.summary.absent, 0),
      leave: rows.reduce((s, r) => s + r.summary.leaveDays, 0),
    };
  });

  readonly hasFilters = computed(() => this.role() !== 'all' || !!this.search().trim());

  clearFilters(): void {
    this.role.set('all');
    this.search.set('');
  }
}
