import { Injectable, inject } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';

/** One-click copy with a toast — works without the async Clipboard API too. */
@Injectable({ providedIn: 'root' })
export class PlaybookClipboardService {
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  async copy(text: string): Promise<boolean> {
    const ok = await this.write(text);
    const key = ok ? 'salesPlaybook.messages.copied' : 'salesPlaybook.messages.copyFailed';
    const message = resolveKey(TRANSLATIONS[this.language.lang()], key);
    if (ok) this.toast.success(message);
    else this.toast.error(message);
    return ok;
  }

  private async write(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* permission denied — try the legacy path */
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
