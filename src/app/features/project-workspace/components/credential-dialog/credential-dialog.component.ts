import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DeliverablesService } from '../../data/deliverables.gateway';
import {
  AccessCredential,
  CREDENTIAL_ENVIRONMENTS,
  CREDENTIAL_KINDS,
  CREDENTIAL_TITLE_MAX,
  CredentialInput,
  WorkspaceScope,
  isHttpUrl,
} from '../../models/deliverables.models';

/**
 * Add / edit one access credential. On edit the password field starts empty:
 * empty = keep the current one, "remove password" clears it.
 */
@Component({
  selector: 'app-credential-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" [title]="(existing() ? 'deliverables.credentials.edit' : 'deliverables.credentials.add') | translate"
               icon="fa-solid fa-key" size="md" (closed)="closed.emit()">
      <form id="cred-form" class="row g-3" (ngSubmit)="save()">
        <div class="col-12 col-md-7">
          <label class="form-label" for="cr-title">{{ 'deliverables.credentials.titleLabel' | translate }} *</label>
          <input id="cr-title" class="form-control" name="title" [maxlength]="titleMax" required
                 [placeholder]="'deliverables.credentials.titlePlaceholder' | translate"
                 [ngModel]="form().title" (ngModelChange)="patch({ title: $event })" />
        </div>
        <div class="col-6 col-md-5">
          <label class="form-label" for="cr-env">{{ 'deliverables.credentials.environment' | translate }}</label>
          <select id="cr-env" class="form-select" name="environment" [ngModel]="form().environment" (ngModelChange)="patch({ environment: $event })">
            @for (e of envs; track e) { <option [value]="e">{{ 'portal.credentials.env.' + e | translate }}</option> }
          </select>
        </div>
        <div class="col-6 col-md-5">
          <label class="form-label" for="cr-kind">{{ 'deliverables.credentials.kind' | translate }}</label>
          <select id="cr-kind" class="form-select" name="kind" [ngModel]="form().kind" (ngModelChange)="patch({ kind: $event })">
            @for (k of kinds; track k) { <option [value]="k">{{ 'deliverables.credentials.kinds.' + k | translate }}</option> }
          </select>
        </div>
        <div class="col-12 col-md-7">
          <label class="form-label" for="cr-url">{{ 'deliverables.credentials.url' | translate }} *</label>
          <input id="cr-url" class="form-control" name="url" dir="ltr" type="url" required placeholder="https://"
                 [class.is-invalid]="touched() && !urlOk()" [ngModel]="form().url" (ngModelChange)="patch({ url: $event })" />
          @if (touched() && !urlOk()) { <div class="invalid-feedback">{{ 'deliverables.credentials.urlInvalid' | translate }}</div> }
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="cr-user">{{ 'portal.credentials.username' | translate }}</label>
          <input id="cr-user" class="form-control" name="username" dir="ltr" autocomplete="off"
                 [ngModel]="form().username" (ngModelChange)="patch({ username: $event })" />
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="cr-pass">{{ 'portal.credentials.password' | translate }}</label>
          <div class="input-group">
            <input id="cr-pass" class="form-control" name="password" dir="ltr" autocomplete="new-password"
                   [type]="showPassword() ? 'text' : 'password'" [disabled]="removePassword()"
                   [placeholder]="existing()?.hasPassword ? ('deliverables.credentials.keepPassword' | translate) : ''"
                   [ngModel]="form().password" (ngModelChange)="patch({ password: $event })" />
            <button type="button" class="btn btn-light" (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="'portal.credentials.show' | translate">
              <i [class]="showPassword() ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
            </button>
          </div>
          @if (existing()?.hasPassword) {
            <div class="form-check mt-1">
              <input class="form-check-input" type="checkbox" id="cr-rm" name="removePassword"
                     [ngModel]="removePassword()" (ngModelChange)="removePassword.set($event)" />
              <label class="form-check-label small" for="cr-rm">{{ 'deliverables.credentials.removePassword' | translate }}</label>
            </div>
          }
        </div>
        <div class="col-12">
          <label class="form-label" for="cr-notes">{{ 'deliverables.credentials.notes' | translate }}</label>
          <textarea id="cr-notes" class="form-control" name="notes" rows="2" maxlength="1000"
                    [placeholder]="'deliverables.credentials.notesPlaceholder' | translate"
                    [ngModel]="form().notes" (ngModelChange)="patch({ notes: $event })"></textarea>
        </div>
        <div class="col-12">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="cr-vis" name="isVisibleToClient"
                   [ngModel]="form().isVisibleToClient" (ngModelChange)="patch({ isVisibleToClient: $event })" />
            <label class="form-check-label" for="cr-vis">{{ 'deliverables.visibleToClient' | translate }}</label>
          </div>
        </div>
        @if (error(); as e) { <div class="col-12"><div class="alert alert-danger py-2 mb-0 small">{{ e }}</div></div> }
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn-light" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
        <button type="submit" form="cred-form" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) { <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> }
          {{ 'common.save' | translate }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class CredentialDialogComponent {
  private readonly deliverables = inject(DeliverablesService);

  readonly projectId = input.required<number>();
  readonly scope = input.required<WorkspaceScope>();
  readonly existing = input<AccessCredential | null>(null);
  readonly saved = output<AccessCredential>();
  readonly closed = output<void>();

  protected readonly kinds = CREDENTIAL_KINDS;
  protected readonly envs = CREDENTIAL_ENVIRONMENTS;
  protected readonly titleMax = CREDENTIAL_TITLE_MAX;

  protected readonly form = signal<CredentialInput>({
    title: '', kind: 'WebDashboard', environment: 'Staging', url: '', username: null, password: null, notes: null, isVisibleToClient: true,
  });
  protected readonly showPassword = signal(false);
  protected readonly removePassword = signal(false);
  protected readonly touched = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly urlOk = computed(() => isHttpUrl(this.form().url));

  ngOnInit(): void {
    const c = this.existing();
    if (c) {
      this.form.set({
        title: c.title, kind: c.kind, environment: c.environment, url: c.url, username: c.username,
        password: null, notes: c.notes, isVisibleToClient: c.isVisibleToClient,
      });
    }
  }

  protected patch(p: Partial<CredentialInput>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected save(): void {
    this.touched.set(true);
    const f = this.form();
    if (!f.title.trim() || !this.urlOk() || this.saving()) return;
    const body: CredentialInput = {
      ...f,
      title: f.title.trim(),
      url: f.url.trim(),
      username: f.username?.trim() || null,
      notes: f.notes?.trim() || null,
      password: this.removePassword() ? '' : f.password || null,
    };
    const api = this.deliverables.for(this.scope());
    const c = this.existing();
    this.saving.set(true);
    this.error.set(null);
    (c ? api.updateCredential(this.projectId(), c.id, body) : api.createCredential(this.projectId(), body)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.error.set(e?.message ?? null);
      },
    });
  }
}
