import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  NAV_SECTIONS,
  canSeeNavItem,
  isNavGroup,
} from '../../../core/constants/nav-sections.const';
import { ROLE_HOME } from '../../../core/constants/role-home.const';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { UserRole } from '../../../core/models/auth.model';
import { PwaService } from '../../../core/pwa/pwa.service';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { PushNotificationsService } from '../../../core/services/push-notifications.service';
import { ThemeService } from '../../../core/services/theme.service';
import { SHORTCUTS } from '../config/shortcuts.const';
import { AppCommand, IndexedCommand } from '../models/command.models';
import { normalizeSearch } from '../utils/command-search.util';
import { CommandCenterUiService } from './command-center-ui.service';
import { TourService } from './tour.service';

const RECENT_KEY = 'crm.commands.recent';
const RECENT_MAX = 5;

/** Synonyms so both languages (and common shorthand) find each page. */
const PAGE_KEYWORDS: Record<string, string[]> = {
  '/': ['home', 'admin', 'dashboard', 'الرئيسيه', 'لوحه'],
  '/leads/sales-pipeline': ['kanban', 'pipeline', 'board', 'كانبان', 'مسار', 'مراحل'],
  '/leads/sales-leadsCustomer': ['customers', 'clients', 'عملاء', 'زباين'],
  '/leads/marketing-leadsCustomer': ['leads', 'prospects', 'محتملين'],
  '/price-offers': ['quotes', 'quotation', 'offers', 'عروض', 'اسعار'],
  '/whatsapp': ['whatsapp', 'wa', 'واتس', 'واتساب', 'chat'],
  '/team-chat': ['chat', 'messages', 'internal', 'دردشه', 'شات', 'رسائل'],
  '/announcements': ['announcements', 'news', 'board', 'اعلانات', 'اخبار'],
  '/notifications': ['notifications', 'alerts', 'اشعارات'],
  '/settings': ['settings', 'config', 'services', 'اعدادات', 'خدمات'],
  '/schedule': ['calendar', 'appointments', 'مواعيد', 'تقويم'],
  '/contracts-management': ['contracts', 'عقود'],
  '/goals': ['goals', 'targets', 'اهداف', 'تارجت'],
  '/attendance': ['attendance', 'leave', 'vacation', 'check in', 'clock', 'حضور', 'انصراف', 'اجازه', 'بصمه'],
  '/sales-playbook': ['playbook', 'script', 'objections', 'competitors', 'سكريبت', 'اعتراضات', 'منافسين', 'ردود'],
  '/smart-analytics': ['analytics', 'heatmap', 'health', 'conversion', 'تحليلات', 'تحويل', 'صحه'],
  '/daily-reports': ['reports', 'daily', 'تقارير'],
};

/**
 * Builds the command catalogue for the signed-in role: every sidebar page
 * (so new pages appear automatically) plus app actions. Also owns command
 * execution and the "recent" list, so palette and shortcuts behave the same.
 */
@Injectable({ providedIn: 'root' })
export class CommandRegistryService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly push = inject(PushNotificationsService);
  private readonly pwa = inject(PwaService);
  private readonly ui = inject(CommandCenterUiService);
  private readonly tour = inject(TourService);

  private readonly recentIds = signal<string[]>(this.loadRecent());

  /** All commands available to the current role. */
  readonly commands = computed<AppCommand[]>(() => {
    const role = this.auth.currentRole();
    if (!role) return [];
    const allowed = (c: AppCommand) => !c.roles || c.roles.includes(role);
    return [...this.pageCommands(role), ...this.actionCommands()].filter(allowed);
  });

  /** Search index — normalised AR + EN labels, context and keywords. */
  readonly index = computed<IndexedCommand[]>(() => {
    const ar = TRANSLATIONS.ar;
    const en = TRANSLATIONS.en;
    return this.commands().map((command) => ({
      command,
      haystack: [
        resolveKey(ar, command.labelKey),
        resolveKey(en, command.labelKey),
        ...(command.contextKey ? [resolveKey(ar, command.contextKey), resolveKey(en, command.contextKey)] : []),
        ...(command.keywords ?? []),
      ].map(normalizeSearch),
    }));
  });

  readonly recent = computed<AppCommand[]>(() => {
    const byId = new Map(this.commands().map((c) => [c.id, c]));
    return this.recentIds()
      .map((id) => byId.get(id))
      .filter((c): c is AppCommand => !!c);
  });

  byId(id: string): AppCommand | undefined {
    return this.commands().find((c) => c.id === id);
  }

  /** Runs a command; returns false when it isn't available to this role. */
  execute(command: AppCommand | undefined): boolean {
    if (!command) return false;
    this.remember(command.id);
    if (command.path) {
      void this.router.navigate([command.path], { queryParams: command.queryParams });
    } else {
      void command.run?.();
    }
    return true;
  }

  label(command: AppCommand): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], command.labelKey);
  }

  // ─────────── catalogue ───────────

  private pageCommands(role: UserRole): AppCommand[] {
    const shortcutFor = (commandId: string) =>
      SHORTCUTS.find((s) => s.commandId === commandId)?.keys.map((k) => k.toUpperCase());

    const pages: AppCommand[] = [];
    for (const section of NAV_SECTIONS) {
      for (const entry of section.items) {
        const items = isNavGroup(entry) ? entry.children : [entry];
        const contextKey = isNavGroup(entry) ? entry.labelKey : section.titleKey;
        for (const item of items) {
          if (!canSeeNavItem(item, role)) continue;
          const id = `page.${item.path}`;
          pages.push({
            id,
            group: 'pages',
            labelKey: item.labelKey,
            contextKey,
            icon: item.icon,
            path: item.path,
            keywords: PAGE_KEYWORDS[item.path],
            shortcut: shortcutFor(id),
          });
        }
      }
    }
    pages.push({
      id: 'page./account',
      group: 'pages',
      labelKey: 'header.myAccount',
      icon: 'fa-solid fa-circle-user',
      path: '/account',
      keywords: ['profile', 'account', 'password', 'حسابي', 'بروفايل'],
    });
    return pages;
  }

  private actionCommands(): AppCommand[] {
    const isDark = this.theme.mode() === 'dark';
    const actions: AppCommand[] = [
      {
        id: 'action.new-customer',
        group: 'actions',
        labelKey: 'commandCenter.actions.newCustomer',
        icon: 'fa-solid fa-user-plus',
        roles: ['Admin', 'Marketing', 'Sales'],
        keywords: ['add', 'new', 'lead', 'customer', 'اضافه', 'عميل', 'جديد'],
        shortcut: ['N'],
        path: '/leads/add-leadCustomer',
      },
      {
        id: 'action.new-announcement',
        group: 'actions',
        labelKey: 'commandCenter.actions.newAnnouncement',
        icon: 'fa-solid fa-bullhorn',
        roles: ['Admin'],
        keywords: ['announce', 'post', 'publish', 'اعلان', 'نشر'],
        path: '/announcements',
        queryParams: { compose: '1' },
      },
      {
        id: 'action.go-home',
        group: 'actions',
        labelKey: 'commandCenter.actions.goHome',
        icon: 'fa-solid fa-house',
        keywords: ['home', 'dashboard', 'الرئيسيه'],
        shortcut: ['G', 'H'],
        run: () => this.router.navigateByUrl(ROLE_HOME[this.auth.currentRole() ?? 'Admin']),
      },
      {
        id: 'action.toggle-theme',
        group: 'actions',
        labelKey: isDark ? 'commandCenter.actions.lightMode' : 'commandCenter.actions.darkMode',
        icon: isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon',
        keywords: ['theme', 'dark', 'light', 'mode', 'ثيم', 'ليلي', 'داكن', 'فاتح'],
        run: () => this.theme.toggleMode(),
      },
      {
        id: 'action.toggle-language',
        group: 'actions',
        labelKey: 'commandCenter.actions.switchLanguage',
        icon: 'fa-solid fa-language',
        keywords: ['language', 'english', 'arabic', 'لغه', 'انجليزي', 'عربي'],
        run: () => this.language.toggle(),
      },
      {
        id: 'action.tour',
        group: 'actions',
        labelKey: 'commandCenter.actions.startTour',
        icon: 'fa-solid fa-route',
        keywords: ['tour', 'help', 'onboarding', 'guide', 'جوله', 'شرح', 'مساعده'],
        run: () => this.tour.start(),
      },
      {
        id: 'action.shortcuts',
        group: 'actions',
        labelKey: 'commandCenter.actions.shortcuts',
        icon: 'fa-regular fa-keyboard',
        keywords: ['keyboard', 'shortcuts', 'keys', 'اختصارات', 'كيبورد'],
        shortcut: ['?'],
        run: () => this.ui.openHelp(),
      },
    ];

    if (this.pwa.canInstall()) {
      actions.push({
        id: 'action.install',
        group: 'actions',
        labelKey: 'commandCenter.actions.install',
        icon: 'fa-solid fa-download',
        keywords: ['install', 'app', 'pwa', 'تثبيت', 'تطبيق'],
        run: () => this.pwa.install(),
      });
    }

    actions.push({
      id: 'action.logout',
      group: 'actions',
      labelKey: 'header.logout',
      icon: 'fa-solid fa-right-from-bracket',
      keywords: ['logout', 'sign out', 'exit', 'خروج'],
      run: () => {
        void this.push.disable();
        this.auth.logout();
      },
    });
    return actions;
  }

  // ─────────── recent ───────────

  private remember(id: string): void {
    if (id === 'action.logout') return;
    const next = [id, ...this.recentIds().filter((x) => x !== id)].slice(0, RECENT_MAX);
    this.recentIds.set(next);
    try {
      localStorage.setItem(this.recentKey(), JSON.stringify(next));
    } catch {
      /* per-viewer convenience only */
    }
  }

  private loadRecent(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(this.recentKey()) ?? '[]');
      return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private recentKey(): string {
    return `${RECENT_KEY}.${this.auth.currentUser()?.userId ?? 'anon'}`;
  }
}
