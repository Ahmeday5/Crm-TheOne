import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RequestTargetPickerComponent } from '../../../client-portal/components/request-target-picker/request-target-picker.component';
import {
  ClientRequestDetails,
  REQUEST_TYPES,
  RequestOptions,
  RequestType,
} from '../../../client-portal/models/client-portal.models';
import { requestTypeIcon } from '../../../client-portal/utils/client-portal-ui.util';
import { TargetDraft, normalizeTarget, targetProblem } from '../../../client-portal/utils/request-target.util';
import { ClassificationPatch } from '../../models/client-requests.models';

/**
 * The Admin re-files what the client picked (wrong app, "not sure", issue vs.
 * change). Reuses the client's own picker so both sides speak the same words.
 */
@Component({
  selector: 'app-classification-form',
  standalone: true,
  imports: [TranslatePipe, RequestTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tf">
      <div class="tf-field">
        <span class="tf-label">{{ 'clientPortal.newRequest.kind' | translate }}</span>
        <div class="tf-seg" role="radiogroup">
          @for (t of types; track t) {
            <button type="button" role="radio" class="tf-seg__btn" [class.is-active]="type() === t" [attr.aria-checked]="type() === t"
                    [disabled]="busy()" (click)="type.set(t)">
              <i [class]="typeIcon(t)" class="me-1" aria-hidden="true"></i>{{ 'clientPortal.type.' + t | translate }}
            </button>
          }
        </div>
      </div>
      <app-request-target-picker [(value)]="target" [options]="lenientOptions()" [disabled]="busy()" [showErrors]="tried()" />
      <div class="tf-actions">
        <button type="button" class="btn btn-light btn-sm" [disabled]="busy()" (click)="cancel.emit()">{{ 'common.cancel' | translate }}</button>
        <button type="button" class="btn btn-primary btn-sm" [disabled]="busy()" (click)="save()">
          @if (busy()) { <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> }
          {{ 'clientRequests.review.save' | translate }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './triage-forms.scss',
})
export class ClassificationFormComponent {
  readonly request = input.required<ClientRequestDetails>();
  readonly options = input<RequestOptions | null>(null);
  readonly busy = input(false);

  readonly saved = output<ClassificationPatch>();
  readonly cancel = output<void>();

  protected readonly types = REQUEST_TYPES;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly tried = signal(false);
  protected readonly type = signal<RequestType>('Issue');
  protected readonly target = signal<TargetDraft>({ target: null, surfaceId: null, appAudience: null, appName: null, appPlatform: null });

  /** The Admin may file under the generic app when the project lists several. */
  protected readonly lenientOptions = computed<RequestOptions | null>(() => {
    const o = this.options();
    return o ? { ...o, appRequired: false } : null;
  });

  ngOnInit(): void {
    const r = this.request();
    this.type.set(r.type);
    this.target.set({ target: r.target, surfaceId: r.surfaceId, appAudience: r.appAudience, appName: r.appName, appPlatform: r.appPlatform });
  }

  protected save(): void {
    this.tried.set(true);
    if (targetProblem(this.target(), this.lenientOptions())) return;
    this.saved.emit({ type: this.type(), ...normalizeTarget(this.target()) });
  }
}
