import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PORTAL_REQUESTS_GATEWAY } from '../../data/portal-requests.gateway';
import {
  ClientRequestDetails,
  REQUEST_TEXT_MAX,
  REQUEST_TITLE_MAX,
  REQUEST_TYPES,
  RequestOptions,
  RequestType,
} from '../../models/client-portal.models';
import { requestTypeIcon } from '../../utils/client-portal-ui.util';
import { UiError, toUiError } from '../../utils/request-errors.util';
import { EMPTY_TARGET, TargetDraft, normalizeTarget, targetProblem } from '../../utils/request-target.util';
import { AttachmentPickerComponent } from '../attachment-picker/attachment-picker.component';
import { RequestTargetChipComponent } from '../request-target-chip/request-target-chip.component';
import { RequestTargetPickerComponent } from '../request-target-picker/request-target-picker.component';

type Step = 'target' | 'details';

/** Server `reason` codes that send the customer back to step 1. */
const TARGET_REASONS = new Set(['target_required', 'app_required', 'app_name_required', 'surface_invalid']);

/**
 * "عندي مشكلة / طلب تعديل" — two short steps:
 *   1. what it's about (website / dashboard / which app),
 *   2. kind → title → details (+ screenshots).
 * The request then waits for the Admin's review (said up front, no surprises).
 */
@Component({
  selector: 'app-new-request-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ModalComponent,
    TranslatePipe,
    AttachmentPickerComponent,
    RequestTargetPickerComponent,
    RequestTargetChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-request-dialog.component.html',
  styleUrl: './new-request-dialog.component.scss',
})
export class NewRequestDialogComponent {
  private readonly api = inject(PORTAL_REQUESTS_GATEWAY);

  readonly projectId = input.required<number>();
  readonly created = output<ClientRequestDetails>();
  readonly closed = output<void>();

  protected readonly types = REQUEST_TYPES;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly titleMax = REQUEST_TITLE_MAX;
  protected readonly textMax = REQUEST_TEXT_MAX;

  protected readonly step = signal<Step>('target');
  protected readonly options = signal<RequestOptions | null>(null);
  protected readonly optionsLoading = signal(true);
  protected readonly target = signal<TargetDraft>(EMPTY_TARGET);
  protected readonly triedNext = signal(false);

  protected readonly type = signal<RequestType>('Issue');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly sending = signal(false);
  protected readonly error = signal<UiError | null>(null);

  protected readonly targetValid = computed(() => !targetProblem(this.target(), this.options()));
  /** Chip preview on step 2 — the surface's name when one was picked. */
  protected readonly targetPreview = computed(() => {
    const t = normalizeTarget(this.target());
    const s = this.options()?.surfaces.find((x) => x.id === t.surfaceId);
    return { ...t, targetLabel: s?.name ?? t.appName };
  });
  protected readonly canSend = computed(
    () => this.targetValid() && !!this.title().trim() && !!this.description().trim() && !this.sending(),
  );

  ngOnInit(): void {
    this.api
      .options(this.projectId())
      .pipe(catchError(() => of<RequestOptions>({ surfaces: [], appRequired: false })))
      .subscribe((o) => {
        this.options.set(o);
        this.optionsLoading.set(false);
      });
  }

  protected next(): void {
    this.triedNext.set(true);
    if (!this.targetValid()) return;
    this.error.set(null);
    this.step.set('details');
  }

  protected back(): void {
    if (!this.sending()) this.step.set('target');
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api
      .create(this.projectId(), {
        ...normalizeTarget(this.target()),
        type: this.type(),
        title: this.title(),
        description: this.description(),
        attachments: this.files(),
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.created.emit(r);
        },
        error: (e: ApiError) => {
          this.sending.set(false);
          if (e?.reason && TARGET_REASONS.has(e.reason)) {
            this.step.set('target');
            this.triedNext.set(true);
          }
          this.error.set(toUiError(e));
        },
      });
  }
}
