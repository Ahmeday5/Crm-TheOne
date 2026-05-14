import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ALL_ROLES, roleLabel } from '../../../../core/constants/roles.const';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { UserRole } from '../../../../core/models/auth.model';
import { AppUser } from '../../../../core/models/user.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UsersService } from '../../../../core/services/users.service';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';

type RoleFilter = 'all' | UserRole;

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    LoadErrorComponent,
    UserFormDialogComponent,
    ClickOutsideDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
})
export class UserManagementComponent {
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly roles: ReadonlyArray<UserRole> = ALL_ROLES;

  /** Loaded user list (full result from the API). */
  readonly all = signal<AppUser[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Filter / search state. */
  searchTerm = '';
  readonly searchSignal = signal('');
  readonly roleFilter = signal<RoleFilter>('all');

  /** Per-row dropdown menu — only one open at a time. */
  readonly openMenuId = signal<string | null>(null);

  /** Add / edit modal state. */
  readonly dialogMode = signal<'add' | 'edit' | null>(null);
  readonly editingUser = signal<AppUser | null>(null);

  /** Filtered list — recomputes on (all, searchSignal, roleFilter) change. */
  readonly visible = computed<AppUser[]>(() => {
    const list = this.all();
    const q = this.searchSignal().trim().toLowerCase();
    const role = this.roleFilter();
    return list.filter((u) => {
      if (q) {
        const hay =
          (u.fullName ?? '').toLowerCase() +
          ' ' +
          u.email.toLowerCase() +
          ' ' +
          (u.phone ?? '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (role !== 'all') {
        // The list endpoint doesn't return role; we'd need to filter via getById
        // calls, which is too expensive. Until the backend includes role in the
        // list, we keep the dropdown for UI parity but skip the filter logic.
        return true;
      }
      return true;
    });
  });

  /** KPI numbers derived from `all`. */
  readonly kpis = computed(() => {
    const total = this.all().length;
    return {
      total,
      // No `isActive` field on the API yet — assume all loaded users are active.
      active: total,
      inactive: 0,
      rolesCount: this.roles.length,
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  // ─────────── data loading ───────────

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.users.list().subscribe({
      next: (rows) => {
        this.all.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('settings.users.messages.loadFailed'));
      },
    });
  }

  // ─────────── search / filter ───────────

  onSearchInput(value: string): void {
    this.searchSignal.set(value);
  }

  onRoleFilterChange(value: RoleFilter): void {
    this.roleFilter.set(value);
  }

  // ─────────── row dropdown ───────────

  toggleMenu(userId: string): void {
    this.openMenuId.update((id) => (id === userId ? null : userId));
  }

  closeMenus(): void {
    this.openMenuId.set(null);
  }

  // ─────────── add / edit ───────────

  openAdd(): void {
    this.editingUser.set(null);
    this.dialogMode.set('add');
    this.closeMenus();
  }

  openEdit(user: AppUser): void {
    this.editingUser.set(user);
    this.dialogMode.set('edit');
    this.closeMenus();
  }

  closeDialog(): void {
    this.dialogMode.set(null);
    this.editingUser.set(null);
  }

  onDialogSuccess(): void {
    this.closeDialog();
    this.reload();
  }

  // ─────────── delete ───────────

  async confirmDelete(user: AppUser): Promise<void> {
    this.closeMenus();
    const ok = await this.dialog.confirm({
      title: this.t('settings.users.deleteDialog.title'),
      message: this.t('settings.users.deleteDialog.message'),
      confirmText: this.t('settings.users.deleteDialog.confirm'),
      cancelText: this.t('settings.users.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.users.delete(user.userId).subscribe({
      next: () => {
        this.toast.success(this.t('settings.users.messages.deleted'));
        this.reload();
      },
      error: (err: ApiError) => {
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── view helpers ───────────

  initialOf(user: AppUser): string {
    const source = user.fullName ?? user.email;
    return source.trim().charAt(0).toUpperCase();
  }

  displayName(user: AppUser): string {
    return user.fullName ?? user.email;
  }

  displayPhone(user: AppUser): string {
    return user.phone || this.t('settings.users.placeholders.notProvided');
  }

  roleLabelFor(role: UserRole): string {
    return roleLabel(role, this.language.lang());
  }

  trackById = (_: number, u: AppUser) => u.userId;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
