import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  APPOINTMENT_PRIORITIES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  Appointment,
  AppointmentCustomerOption,
  AppointmentStats,
  AppointmentStatus,
  AppointmentType,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppointmentFormDialogComponent } from '../../components/appointment-form-dialog/appointment-form-dialog.component';
import { AppointmentsService } from '../../services/appointments.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    EmptyStateComponent,
    StatCardComponent,
    PaginationComponent,
    LoadErrorComponent,
    TableToolsComponent,
    AppointmentFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.scss',
})
export class AppointmentsComponent implements OnInit {
  private readonly service = inject(AppointmentsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);

  readonly types = APPOINTMENT_TYPES;
  readonly statuses = APPOINTMENT_STATUSES;

  readonly rows = signal<Appointment[]>([]);
  readonly customers = signal<AppointmentCustomerOption[]>([]);
  readonly stats = signal<AppointmentStats | null>(null);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  // ─── filters ───
  /**
   * Off by default: the list shows every appointment the caller is allowed
   * to see — the backend already scopes by role (Admin → all, employee →
   * own). Ticking the box adds an explicit `AssignedToUserId = me` filter.
   */
  readonly mineOnly = signal(false);
  readonly search = signal('');
  readonly customerId = signal<number | null>(null);
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly typeFilter = signal<AppointmentType | 'all'>('all');
  readonly statusFilter = signal<AppointmentStatus | 'all'>('all');

  readonly currentUserName = computed(
    () => this.auth.currentUser()?.fullName || this.auth.currentUser()?.email || '',
  );

  /** Client-side type/status narrowing on the loaded page. */
  readonly visibleRows = computed(() => {
    const t = this.typeFilter();
    const s = this.statusFilter();
    return this.rows().filter(
      (r) =>
        (t === 'all' || r.type === t) && (s === 'all' || r.status === s),
    );
  });

  ngOnInit(): void {
    this.loadCustomers();
    this.loadStats();
    this.reload();
  }

  // ─────────── data ───────────

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const uid = this.auth.currentUser()?.userId;
    this.service
      .list({
        PageIndex: this.pageIndex(),
        PageSize: this.pageSize(),
        Search: this.search().trim() || undefined,
        AssignedToUserId: this.mineOnly() && uid ? uid : undefined,
        CustomerId: this.customerId() ?? undefined,
        FromDate: this.toIso(this.fromDate()),
        ToDate: this.toIso(this.toDate()),
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.totalCount.set(page.totalCount ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('sales.appointments.loadFailed'));
        },
      });
  }

  private loadStats(): void {
    this.service.stats().subscribe({ next: (s) => this.stats.set(s) });
  }

  private loadCustomers(): void {
    this.service.customersDropdown().subscribe({
      next: (rows) => this.customers.set(rows ?? []),
    });
  }

  // ─────────── filters ───────────

  applyFilters(): void {
    this.pageIndex.set(1);
    this.reload();
  }

  toggleMine(value: boolean): void {
    this.mineOnly.set(value);
    this.applyFilters();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.applyFilters();
  }

  onCustomerChange(value: string): void {
    this.customerId.set(value ? Number(value) : null);
    this.applyFilters();
  }

  onFromDate(value: string): void {
    this.fromDate.set(value);
    this.applyFilters();
  }

  onToDate(value: string): void {
    this.toDate.set(value);
    this.applyFilters();
  }

  onTypeFilter(value: string): void {
    this.typeFilter.set(value === 'all' ? 'all' : (Number(value) as AppointmentType));
  }

  onStatusFilter(value: string): void {
    this.statusFilter.set(
      value === 'all' ? 'all' : (Number(value) as AppointmentStatus),
    );
  }

  onPageChange(page: number): void {
    this.pageIndex.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.reload();
  }

  // ─────────── create / edit / delete ───────────

  readonly formOpen = signal(false);
  readonly editId = signal<number | null>(null);

  openCreate(): void {
    this.editId.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: Appointment): void {
    if (this.busyId() === row.id) return;
    this.editId.set(row.id);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editId.set(null);
  }

  onSaved(): void {
    this.closeForm();
    this.reload();
    this.loadStats();
  }

  async confirmDelete(row: Appointment): Promise<void> {
    if (this.busyId() === row.id) return;
    const ok = await this.dialog.confirm({
      title: this.t('sales.appointments.deleteDialog.title'),
      message: this.t('sales.appointments.deleteDialog.message'),
      confirmText: this.t('sales.appointments.deleteDialog.confirm'),
      cancelText: this.t('sales.appointments.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.service.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('sales.appointments.messages.deleted'));
        if (this.rows().length === 1 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.reload();
        this.loadStats();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── helpers ───────────

  optionLabel(opt: { ar: string; en: string }): string {
    return this.language.lang() === 'ar' ? opt.ar : opt.en;
  }

  typeBadgeClass(t: AppointmentType): string {
    switch (t) {
      case AppointmentType.Meeting:
      case AppointmentType.Presentation:
        return 'bg-primary-subtle text-primary';
      case AppointmentType.Demo:
        return 'bg-info-subtle text-info';
      case AppointmentType.Call:
        return 'bg-success-subtle text-success';
      case AppointmentType.Negotiation:
      case AppointmentType.ContractSigning:
        return 'bg-warning-subtle text-warning';
      case AppointmentType.Support:
        return 'bg-danger-subtle text-danger';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  statusBadgeClass(s: AppointmentStatus): string {
    switch (s) {
      case AppointmentStatus.Scheduled:
        return 'bg-info-subtle text-info';
      case AppointmentStatus.Completed:
        return 'bg-success-subtle text-success';
      case AppointmentStatus.Cancelled:
      case AppointmentStatus.NoShow:
        return 'bg-danger-subtle text-danger';
      case AppointmentStatus.Postponed:
        return 'bg-warning-subtle text-warning';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  priorityBadgeClass(p: number): string {
    switch (p) {
      case 4:
        return 'bg-danger-subtle text-danger';
      case 3:
        return 'bg-warning-subtle text-warning';
      case 2:
        return 'bg-info-subtle text-info';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** `yyyy-MM-dd` (date input) → ISO at midnight, or undefined when empty. */
  private toIso(date: string): string | undefined {
    if (!date) return undefined;
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  // ─────────── export / print ───────────

  appointmentTypeLabel(r: Appointment): string {
    const opt = APPOINTMENT_TYPES.find((o) => o.code === r.type);
    return opt ? this.optionLabel(opt) : r.typeNameAr;
  }

  appointmentStatusLabel(r: Appointment): string {
    const opt = APPOINTMENT_STATUSES.find((o) => o.code === r.status);
    return opt ? this.optionLabel(opt) : r.statusNameAr;
  }

  appointmentPriorityLabel(r: Appointment): string {
    const opt = APPOINTMENT_PRIORITIES.find((o) => o.code === r.priority);
    return opt ? this.optionLabel(opt) : r.priorityNameAr;
  }

  get exportColumns(): ExportColumn<Appointment>[] {
    return [
      { header: '#', value: (r) => r.id },
      {
        header: this.t('sales.appointments.table.title'),
        value: (r) => r.title,
      },
      {
        header: this.t('sales.appointments.table.customer'),
        value: (r) => r.customerFullName,
      },
      {
        header: this.t('sales.appointments.table.assignedTo'),
        value: (r) => r.assignedToUserName,
      },
      {
        header: this.t('sales.appointments.table.type'),
        value: (r) => this.appointmentTypeLabel(r),
      },
      {
        header: this.t('sales.appointments.table.priority'),
        value: (r) => this.appointmentPriorityLabel(r),
      },
      {
        header: this.t('sales.appointments.table.status'),
        value: (r) => this.appointmentStatusLabel(r),
      },
      {
        header: this.t('sales.appointments.table.start'),
        value: (r) => this.formatDateTime(r.startDate),
      },
      {
        header: this.t('sales.appointments.table.end'),
        value: (r) => this.formatDateTime(r.endDate),
      },
      {
        header: this.t('sales.appointments.table.location'),
        value: (r) => r.location,
      },
    ];
  }

  /** Current page = the rows visible after the client type/status filter. */
  get visibleExportRows(): Appointment[] {
    return this.visibleRows();
  }

  readonly fetchAllRows = async (): Promise<Appointment[]> => {
    const uid = this.auth.currentUser()?.userId;
    const page = await firstValueFrom(
      this.service.list({
        PageIndex: 1,
        PageSize: this.totalCount() || this.pageSize(),
        Search: this.search().trim() || undefined,
        AssignedToUserId: this.mineOnly() && uid ? uid : undefined,
        CustomerId: this.customerId() ?? undefined,
        FromDate: this.toIso(this.fromDate()),
        ToDate: this.toIso(this.toDate()),
      }),
    );
    const t = this.typeFilter();
    const s = this.statusFilter();
    return (page.data ?? []).filter(
      (r) => (t === 'all' || r.type === t) && (s === 'all' || r.status === s),
    );
  };

  trackById = (_: number, r: Appointment) => r.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
