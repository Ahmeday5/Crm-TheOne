import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  AssignProjectTeamDto,
  DeveloperOption,
  ProjectTeamMemberResponseDto,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { ProjectProgressService } from '../../services/project-progress.service';

@Component({
  selector: 'app-assign-team-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    SearchableSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-team-dialog.component.html',
})
export class AssignTeamDialogComponent implements OnInit, OnChanges {
  @Input({ required: true }) projectId!: number;
  /** Existing team (if any) — used to pre-fill the form for re-assignment. */
  @Input() currentTeam: ProjectTeamMemberResponseDto[] = [];

  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly projectsService = inject(ProjectsService);
  private readonly service = inject(ProjectProgressService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly developerOptions = signal<DeveloperOption[]>([]);
  readonly developerOptionsAsRecords = computed(
    () => this.developerOptions() as unknown as Record<string, unknown>[],
  );
  readonly loadingDevelopers = signal(false);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    members: this.fb.array<ReturnType<typeof this.buildMemberGroup>>([]),
  });

  get members() {
    return this.form.controls.members;
  }

  /** Live running total of every row's responsibility %. */
  readonly total = computed(() => this.totalTick());
  private readonly totalTick = signal(0);

  readonly isValidTotal = computed(() => this.total() === 100);

  ngOnInit(): void {
    this.loadDevelopers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('currentTeam' in changes || 'projectId' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);
      this.patchFromCurrentTeam();
    }
  }

  private loadDevelopers(): void {
    this.loadingDevelopers.set(true);
    this.projectsService.developers().subscribe({
      next: (rows) => {
        this.developerOptions.set(rows ?? []);
        this.loadingDevelopers.set(false);
      },
      error: () => {
        this.developerOptions.set([]);
        this.loadingDevelopers.set(false);
      },
    });
  }

  private buildMemberGroup(member?: ProjectTeamMemberResponseDto) {
    const group = this.fb.nonNullable.group({
      developerId: this.fb.control<string | null>(member?.developerId ?? null, Validators.required),
      projectRole: [member?.projectRole ?? ''],
      responsibilityPercentage: this.fb.control<number>(
        member?.responsibilityPercentage ?? 0,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ),
    });
    group.controls.responsibilityPercentage.valueChanges.subscribe(() => this.bumpTotal());
    return group;
  }

  private patchFromCurrentTeam(): void {
    this.members.clear();
    for (const m of this.currentTeam) {
      this.members.push(this.buildMemberGroup(m));
    }
    if (this.members.length === 0) this.addMember();
    this.bumpTotal();
  }

  private bumpTotal(): void {
    const sum = this.members.controls.reduce(
      (acc, c) => acc + (Number(c.controls.responsibilityPercentage.value) || 0),
      0,
    );
    this.totalTick.set(Math.round(sum * 100) / 100);
  }

  // ─────────── rows ───────────

  addMember(): void {
    this.members.push(this.buildMemberGroup());
    this.bumpTotal();
  }

  removeMember(index: number): void {
    this.members.removeAt(index);
    this.bumpTotal();
  }

  /** True when a developer is already picked in another row. */
  isDuplicate(index: number): boolean {
    const id = this.members.at(index)?.controls.developerId.value;
    if (!id) return false;
    return this.members.controls.filter((c) => c.controls.developerId.value === id).length > 1;
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid || !this.isValidTotal() || this.hasDuplicates()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: AssignProjectTeamDto = {
      members: this.members.controls.map((c) => ({
        developerId: c.controls.developerId.value as string,
        projectRole: (c.controls.projectRole.value ?? '').trim() || undefined,
        responsibilityPercentage: Number(c.controls.responsibilityPercentage.value),
      })),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.service.assignTeam(this.projectId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('projectProgress.messages.teamAssigned'));
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('projectProgress.messages.teamAssignFailed'));
      },
    });
  }

  private hasDuplicates(): boolean {
    return this.members.controls.some((_, i) => this.isDuplicate(i));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
