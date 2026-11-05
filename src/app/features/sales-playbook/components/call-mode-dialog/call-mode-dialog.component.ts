import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CallScript } from '../../models/sales-playbook.models';
import { CopyButtonComponent } from '../copy-button/copy-button.component';

type StageKind = 'opening' | 'step' | 'questions' | 'closing';

interface Stage {
  key: string;
  kind: StageKind;
  /** Body text (empty for the questions checklist). */
  text: string;
  /** 1-based step number for `step` stages. */
  step?: number;
}

const STAGE_ICON: Record<StageKind, string> = {
  opening: 'fa-solid fa-door-open',
  step: 'fa-solid fa-shoe-prints',
  questions: 'fa-solid fa-list-check',
  closing: 'fa-solid fa-flag-checkered',
};

/**
 * Guided "call mode": walks the rep through opening → steps → discovery
 * questions (tick as you ask) → closing, one stage at a time, in large
 * readable type. ← / → move between stages (mirrored in RTL), Esc closes.
 */
@Component({
  selector: 'app-pb-call-mode-dialog',
  standalone: true,
  imports: [TranslatePipe, ModalComponent, CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './call-mode-dialog.component.html',
  styleUrl: './call-mode-dialog.component.scss',
})
export class CallModeDialogComponent {
  readonly script = input.required<CallScript>();
  readonly closed = output<void>();

  private readonly language = inject(LanguageService);

  protected readonly index = signal(0);
  /** Direction of the last move — drives the slide-in side. */
  protected readonly direction = signal<1 | -1>(1);
  protected readonly asked = signal<ReadonlySet<number>>(new Set());

  protected readonly stages = computed<Stage[]>(() => {
    const s = this.script();
    const stages: Stage[] = [{ key: 'opening', kind: 'opening', text: s.opening }];
    s.steps.forEach((text, i) => stages.push({ key: `step-${i}`, kind: 'step', text, step: i + 1 }));
    if (s.questions.length) stages.push({ key: 'questions', kind: 'questions', text: '' });
    stages.push({ key: 'closing', kind: 'closing', text: s.closing });
    return stages;
  });

  protected readonly total = computed(() => this.stages().length);
  /** `index === total` is the "call finished" summary. */
  protected readonly finished = computed(() => this.index() >= this.total());
  protected readonly current = computed<Stage[]>(() => {
    const stage = this.stages()[this.index()];
    return stage ? [stage] : [];
  });
  protected readonly progress = computed(() =>
    Math.round((Math.min(this.index() + 1, this.total()) / this.total()) * 100),
  );
  protected readonly isRtl = computed(() => this.language.lang() === 'ar');

  private readonly dots = viewChildren<ElementRef<HTMLElement>>('dot');

  constructor() {
    // Keep the active dot visible when a long script scrolls the rail.
    effect(() => {
      const dot = this.dots()[this.index()]?.nativeElement;
      dot?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }

  protected icon(kind: StageKind): string {
    return STAGE_ICON[kind];
  }

  protected stageLabel(st: Stage): string {
    const dict = TRANSLATIONS[this.language.lang()];
    return st.kind === 'step'
      ? interpolate(resolveKey(dict, 'salesPlaybook.call.stepN'), { n: st.step })
      : resolveKey(dict, `salesPlaybook.call.stage.${st.kind}`);
  }

  protected go(target: number): void {
    const next = Math.max(0, Math.min(target, this.total()));
    if (next === this.index()) return;
    this.direction.set(next > this.index() ? 1 : -1);
    this.index.set(next);
  }

  protected next(): void {
    this.go(this.index() + 1);
  }

  protected prev(): void {
    this.go(this.index() - 1);
  }

  protected restart(): void {
    this.asked.set(new Set());
    this.go(0);
  }

  protected toggleAsked(i: number): void {
    const next = new Set(this.asked());
    if (!next.delete(i)) next.add(i);
    this.asked.set(next);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input[type="text"], input[type="search"], textarea, select, [contenteditable="true"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const forward = this.isRtl() ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
    if (forward) this.next();
    else this.prev();
  }
}
