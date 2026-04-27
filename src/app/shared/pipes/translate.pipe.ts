import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';
import { TRANSLATIONS, resolveKey } from '../../core/i18n';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false, // language toggles re-render
})
export class TranslatePipe implements PipeTransform {
  private lang = inject(LanguageService);

  transform(key: string | null | undefined): string {
    if (!key) return '';
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
