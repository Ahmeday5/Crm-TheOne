import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CallScript } from '../../models/sales-playbook.models';
import { FavoriteButtonComponent } from '../favorite-button/favorite-button.component';

@Component({
  selector: 'app-pb-script-card',
  standalone: true,
  imports: [TranslatePipe, ClampTextDirective, TipDirective, FavoriteButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './script-card.component.html',
  styleUrl: './script-card.component.scss',
})
export class ScriptCardComponent {
  readonly script = input.required<CallScript>();
  readonly canManage = input(false);
  readonly busy = input(false);

  readonly start = output<CallScript>();
  readonly edit = output<CallScript>();
  readonly remove = output<CallScript>();

  private readonly language = inject(LanguageService);

  protected readonly serviceName = computed(() => {
    const s = this.script().service;
    if (!s) return null;
    return (this.language.lang() === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || null;
  });
}
