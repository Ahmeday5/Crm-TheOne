import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';
import { TRANSLATIONS, TranslationParams, interpolate, resolveKey } from '../../core/i18n';

/**
 *   {{ 'common.save' | translate }}
 *   {{ 'whatsapp.chats.unread' | translate: { n: chat.unreadCount } }}   → fills `{n}`
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false, // language toggles re-render
})
export class TranslatePipe implements PipeTransform {
  private lang = inject(LanguageService);

  transform(key: string | null | undefined, params?: TranslationParams | null): string {
    if (!key) return '';
    return interpolate(resolveKey(TRANSLATIONS[this.lang.lang()], key), params);
  }
}
