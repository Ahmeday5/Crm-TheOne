import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  NAV_SECTIONS,
  NavGroup,
  NavItem,
  canSeeNavItem,
  isNavGroup,
  isNavItemActive,
} from '../../../core/constants/nav-sections.const';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { AuthService } from '../../../core/services/auth.service';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { LanguageService } from '../../../core/services/language.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

const SIDEBAR_TOGGLE_ATTR = 'data-sidebar-toggle';
const COLLAPSED_KEY = 'sidebarCollapsed';
const OPEN_GROUPS_KEY = 'sidebarOpenGroups';
const MOBILE_MAX_WIDTH = 992;

/** Render-ready shapes — role/search filtering already applied. */
interface LinkVM {
  kind: 'link';
  item: NavItem;
  /** Set when a one-child group was flattened — keeps its tour anchor. */
  groupId?: string;
}
interface GroupVM {
  kind: 'group';
  group: NavGroup;
  children: NavItem[];
}
type EntryVM = LinkVM | GroupVM;
interface SectionVM {
  titleKey: string;
  entries: EntryVM[];
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — state just isn't remembered */
  }
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, NgTemplateOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sidebarService = inject(SidebarService);
  private readonly auth = inject(AuthService);
  private readonly company = inject(CompanySettingsService);
  private readonly lang = inject(LanguageService).lang;
  /** Per-item counters published by features (e.g. WhatsApp unread chats). */
  protected readonly badges = inject(NavBadgesService);

  // ─────────── layout state ───────────
  readonly isMobile = signal(false);
  readonly isOpen = signal(false);
  readonly isCollapsed = signal(readStorage(COLLAPSED_KEY) === 'true');
  /** Desktop "icons only" rail. */
  readonly isMini = computed(() => this.isCollapsed() && !this.isMobile());

  // ─────────── brand ───────────
  readonly brandLogo = this.company.logoUrl;
  readonly brandName = this.company.tradeName;
  readonly fallbackLogo = '/assets/img/logo.png';

  // ─────────── nav state ───────────
  readonly query = signal('');
  private readonly openGroups = signal<ReadonlySet<string>>(this.loadOpenGroups());

  /** Current URL — drives active link + active group highlighting. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly sections = computed<SectionVM[]>(() =>
    this.buildSections(this.query().trim().toLowerCase(), this.lang()),
  );

  /** Id of the group that contains the current page (if any). */
  readonly activeGroupId = computed(() => {
    const url = this.url();
    for (const section of NAV_SECTIONS) {
      for (const entry of section.items) {
        if (isNavGroup(entry) && entry.children.some((c) => isNavItemActive(c, url))) {
          return entry.id;
        }
      }
    }
    return null;
  });

  constructor() {
    // Navigating into a group opens it, so the active page is always visible.
    effect(() => {
      const id = this.activeGroupId();
      if (!id) return;
      untracked(() => {
        if (!this.openGroups().has(id)) this.setGroupOpen(id, true);
      });
    });
  }

  ngOnInit(): void {
    this.computeViewportState();
    this.sidebarService.sidebar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((open) => this.isOpen.set(this.isMobile() ? open : true));
  }

  // ─────────── template API ───────────

  isActive(item: NavItem): boolean {
    return isNavItemActive(item, this.url());
  }

  /** Searching force-expands every group so matches are visible. */
  isGroupOpen(id: string): boolean {
    return !!this.query() || this.openGroups().has(id);
  }

  groupBadge(group: GroupVM): number {
    return group.children.reduce((sum, c) => sum + this.badges.get(c.path), 0);
  }

  toggleGroup(id: string): void {
    // On the icon rail a group has nowhere to unfold — expand the sidebar first.
    if (this.isMini()) {
      this.setCollapsed(false);
      this.setGroupOpen(id, true);
      return;
    }
    this.setGroupOpen(id, !this.openGroups().has(id));
  }

  onSearch(value: string): void {
    this.query.set(value);
  }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.query.set('');
    input.focus();
  }

  onLinkClicked(): void {
    if (this.isMobile()) this.sidebarService.close();
  }

  closeSidebar(): void {
    this.sidebarService.close();
  }

  toggleCollapse(): void {
    if (!this.isMobile()) this.setCollapsed(!this.isCollapsed());
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(this.fallbackLogo)) img.src = this.fallbackLogo;
  }

  // ─────────── host listeners ───────────

  @HostListener('window:resize')
  onResize(): void {
    this.computeViewportState();
  }

  /** Close the drawer when clicking outside on mobile. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isMobile() || !this.isOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target || this.host.nativeElement.contains(target)) return;
    if (target.closest(`[${SIDEBAR_TOGGLE_ATTR}]`)) return;
    this.sidebarService.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobile() && this.isOpen()) this.sidebarService.close();
  }

  // ─────────── internals ───────────

  private buildSections(query: string, lang: 'ar' | 'en'): SectionVM[] {
    const role = this.auth.currentRole();
    if (!role) return [];
    const dict = TRANSLATIONS[lang];
    const label = (key: string) => resolveKey(dict, key).toLowerCase();
    const matches = (key: string) => !query || label(key).includes(query);

    return NAV_SECTIONS.map((section) => {
      const entries: EntryVM[] = [];
      for (const entry of section.items) {
        if (!isNavGroup(entry)) {
          if (canSeeNavItem(entry, role) && matches(entry.labelKey)) {
            entries.push({ kind: 'link', item: entry });
          }
          continue;
        }
        const allowed = entry.children.filter((c) => canSeeNavItem(c, role));
        // Searching for the group's own name shows the whole group.
        const children = matches(entry.labelKey)
          ? allowed
          : allowed.filter((c) => matches(c.labelKey));
        if (children.length === 1) entries.push({ kind: 'link', item: children[0], groupId: entry.id });
        else if (children.length > 1) entries.push({ kind: 'group', group: entry, children });
      }
      return { titleKey: section.titleKey, entries };
    }).filter((s) => s.entries.length > 0);
  }

  private setGroupOpen(id: string, open: boolean): void {
    this.openGroups.update((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      writeStorage(OPEN_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  private setCollapsed(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);
    writeStorage(COLLAPSED_KEY, String(collapsed));
  }

  private loadOpenGroups(): ReadonlySet<string> {
    try {
      const raw = JSON.parse(readStorage(OPEN_GROUPS_KEY) ?? '[]');
      return new Set(Array.isArray(raw) ? raw.filter((v) => typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private computeViewportState(): void {
    const wasMobile = this.isMobile();
    const mobile = window.innerWidth <= MOBILE_MAX_WIDTH;
    this.isMobile.set(mobile);
    if (mobile) {
      if (!wasMobile) this.isOpen.set(false);
    } else {
      this.isOpen.set(true);
    }
  }
}
