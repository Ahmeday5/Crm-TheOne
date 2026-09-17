import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ProjectDailyReportResponseDto } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../services/project-progress.service';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-detail.component.html',
})
export class ReportDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ProjectProgressService);
  private readonly auth = inject(AuthService);
  private readonly company = inject(CompanySettingsService);
  protected readonly language = inject(LanguageService);

  readonly reportId = Number(this.route.snapshot.paramMap.get('reportId'));

  readonly report = signal<ProjectDailyReportResponseDto | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly isOwner = computed(
    () => this.report()?.developerId === this.auth.currentUser()?.userId,
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getReportById(this.reportId).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(null);
      },
    });
  }

  attachmentUrl(path: string): string {
    return this.company.assetUrl(path) ?? path;
  }

  goBack(): void {
    this.router.navigate(['/ProjectManage']);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
