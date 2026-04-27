import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, signal } from '@angular/core';

export type Lang = 'ar' | 'en';

const LANG_KEY = 'crm.lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<Lang>('ar');

  constructor(@Inject(DOCUMENT) private doc: Document) {
    const saved = (localStorage.getItem(LANG_KEY) as Lang | null) ?? 'ar';
    this.applyLang(saved);
  }

  setLang(lang: Lang): void {
    this.applyLang(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  toggle(): void {
    this.setLang(this.lang() === 'ar' ? 'en' : 'ar');
  }

  isRtl(): boolean {
    return this.lang() === 'ar';
  }

  private applyLang(lang: Lang): void {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    this.doc.documentElement.setAttribute('lang', lang);
    this.doc.documentElement.setAttribute('dir', dir);
    this.lang.set(lang);
  }
}
