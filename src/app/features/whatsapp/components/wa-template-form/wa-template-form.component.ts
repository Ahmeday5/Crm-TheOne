import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaTemplate } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { renderTemplateSegments, sendableTemplates, templateVariables } from '../../utils/template.util';
import { whatsappErrorText } from '../../utils/whatsapp.util';

/** WhatsApp caps one template parameter at 1024 characters. */
const MAX_PARAMETER_LENGTH = 1024;

/** A complete, valid template choice. */
export interface TemplateChoice {
  template: WaTemplate;
  /** Values keyed by variable name. */
  parameters: Record<string, string>;
}

type ParamsGroup = FormGroup<Record<string, FormControl<string>>>;

/**
 * Pick an approved template and fill its variables (reactive form: one
 * required control per variable), with a live preview of the body.
 *
 * Templates come from `GET /templates` (`instanceId` = the admin's chosen
 * WhatsApp number; employees get their own). Only `sendable` ones are
 * listed. Emits the valid choice, or `null` while incomplete.
 */
@Component({
  selector: 'app-wa-template-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-template-form.component.html',
  styleUrl: './wa-template-form.component.scss',
})
export class WaTemplateFormComponent {
  private readonly api = inject(WhatsAppApiService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Admin: the WhatsApp number whose templates to list; `null` = the caller's own. */
  readonly instanceId = input<string | null>(null);
  readonly disabled = input(false);
  /** Shows required-field errors without waiting for blur (after a submit attempt). */
  readonly showErrors = input(false);

  /** The valid choice, or `null` while nothing / not everything is filled. */
  readonly choiceChange = output<TemplateChoice | null>();

  protected readonly templates = signal<WaTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);

  protected readonly form = new FormGroup({
    templateId: new FormControl<number | null>(null, { validators: Validators.required }),
    params: new FormGroup({}) as ParamsGroup,
  });

  private readonly formValue = signal<Record<string, string>>({});
  protected readonly selected = signal<WaTemplate | null>(null);
  protected readonly variables = computed(() => {
    const t = this.selected();
    return t ? templateVariables(t) : [];
  });
  protected readonly preview = computed(() => {
    const t = this.selected();
    return t ? renderTemplateSegments(t.body ?? '', this.formValue()) : [];
  });
  protected readonly maxLength = MAX_PARAMETER_LENGTH;

  constructor() {
    // (Re)load the list whenever the number changes or a retry is asked for.
    toObservable(computed(() => ({ instanceId: this.instanceId(), attempt: this.reload() })))
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ instanceId }) =>
          this.api.templates(instanceId).pipe(
            map((list) => ({ list: sendableTemplates(list), error: null as string | null })),
            catchError((err: unknown) =>
              of({ list: [] as WaTemplate[], error: whatsappErrorText(err, (k) => this.t(k), 'whatsapp.templates.loadFailed') }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ list, error }) => {
        this.loading.set(false);
        this.error.set(error);
        this.templates.set(list);
        // Keep the current pick when it still exists on the new list; auto-pick a lone template.
        const current = this.form.controls.templateId.value;
        const keep = list.find((t) => t.id === current) ?? (list.length === 1 ? list[0] : null);
        this.form.controls.templateId.setValue(keep?.id ?? null);
      });

    this.form.controls.templateId.valueChanges
      .pipe(startWith(this.form.controls.templateId.value), takeUntilDestroyed())
      .subscribe((id) => this.select(this.templates().find((t) => t.id === id) ?? null));

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emit());

    effect(() => {
      const disabled = this.disabled();
      untracked(() => (disabled ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
    });
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected control(name: string): FormControl<string> | null {
    return this.form.controls.params.controls[name] ?? null;
  }

  protected invalid(name: string): boolean {
    const c = this.control(name);
    return !!c && c.invalid && (c.touched || this.showErrors());
  }

  /** The raw slot, e.g. `{{1}}` — built here because templates can't contain `{{` in bindings. */
  protected placeholderFor(name: string): string {
    return `{{${name}}}`;
  }

  /** `1` → "Variable 1"; named variables are shown as they are. */
  protected variableLabel(name: string): string {
    return /^\d+$/.test(name) ? `${this.t('whatsapp.templates.variable')} ${name}` : name;
  }

  /** Swap the variable controls for the picked template's. */
  private select(template: WaTemplate | null): void {
    this.selected.set(template);
    const previous = this.form.controls.params.getRawValue();
    const group: ParamsGroup = new FormGroup<Record<string, FormControl<string>>>({});
    for (const name of template ? templateVariables(template) : []) {
      group.addControl(
        name,
        new FormControl(previous[name] ?? '', {
          nonNullable: true,
          validators: [Validators.required, Validators.maxLength(MAX_PARAMETER_LENGTH), notBlank],
        }),
        { emitEvent: false },
      );
    }
    if (this.disabled()) group.disable({ emitEvent: false });
    this.form.setControl('params', group);
    this.emit();
  }

  private emit(): void {
    const values = this.form.controls.params.getRawValue();
    this.formValue.set(values);
    const template = this.selected();
    const valid = !!template && this.form.controls.params.valid;
    if (!template || !valid) {
      this.choiceChange.emit(null);
      return;
    }
    const parameters: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) parameters[key] = value.trim();
    this.choiceChange.emit({ template, parameters });
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

/** `required` accepts spaces; a template parameter must have real content. */
function notBlank(control: AbstractControl<string | null>): ValidationErrors | null {
  const value = control.value ?? '';
  return value && !value.trim() ? { blank: true } : null;
}
