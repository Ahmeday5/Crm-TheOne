import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import {
  GoalLeaderboardEntry,
  GoalLeaderboardQuery,
  GoalType,
  SalesPerson,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GoalsService } from '../../services/goals.service';

type FilterType = 'all' | GoalType;

@Component({
  selector: 'app-goals-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, EmptyStateComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private readonly goalsService = inject(GoalsService);
  private readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly destroy$ = new Subject<void>();

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  readonly entries = signal<GoalLeaderboardEntry[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly salesPersons = signal<SalesPerson[]>([]);

  // ── filters ──
  readonly filterType = signal<FilterType>('all');
  readonly filterUserId = signal<string>('');
  readonly filterFrom = signal<string>('');
  readonly filterTo = signal<string>('');

  readonly top3 = computed(() => this.entries().slice(0, 3));
  readonly rest = computed(() => this.entries().slice(3));

  ngOnInit(): void {
    this.load();
    if (this.isAdmin()) this.loadSalesPersons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const query: GoalLeaderboardQuery = {};
    const t = this.filterType();
    if (t !== 'all') query.GoalType = t;
    if (this.isAdmin() && this.filterUserId()) query.UserId = this.filterUserId();
    if (this.filterFrom()) query.From = new Date(this.filterFrom()).toISOString();
    if (this.filterTo()) query.To = new Date(this.filterTo()).toISOString();

    this.goalsService.leaderboard(query).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.entries.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('goals.leaderboard.loadFailed'));
      },
    });
  }

  private loadSalesPersons(): void {
    this.goalsService.getSalesPersons().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => this.salesPersons.set(list ?? []),
      error: () => this.salesPersons.set([]),
    });
  }

  setFilterType(t: string): void {
    this.filterType.set(t as FilterType);
    this.load();
  }

  setFilterUserId(id: string): void {
    this.filterUserId.set(id);
    this.load();
  }

  setFilterFrom(v: string): void {
    this.filterFrom.set(v);
    this.load();
  }

  setFilterTo(v: string): void {
    this.filterTo.set(v);
    this.load();
  }

  reset(): void {
    this.filterType.set('all');
    this.filterUserId.set('');
    this.filterFrom.set('');
    this.filterTo.set('');
    this.load();
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
  }

  rankMeta(rank: number): { icon: string; color: string } {
    if (rank === 1) return { icon: 'fa-solid fa-crown', color: '#f59e0b' };
    if (rank === 2) return { icon: 'fa-solid fa-medal', color: '#94a3b8' };
    if (rank === 3) return { icon: 'fa-solid fa-award', color: '#cd7c3b' };
    return { icon: 'fa-solid fa-hashtag', color: '#6b7280' };
  }

  formatNumber(n: number | null | undefined): string {
    if (n == null) return '0';
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
