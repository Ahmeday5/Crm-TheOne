import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  Subscription,
  debounceTime,
  distinctUntilChanged,
  fromEvent,
  map,
} from 'rxjs';
import {
  NAV_SECTIONS,
  NavItem,
  NavSection,
} from '../../../core/constants/nav-sections.const';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { UserRole } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

const SIDEBAR_TOGGLE_ATTR = 'data-sidebar-toggle';
const COLLAPSED_KEY = 'sidebarCollapsed';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  isSidebarOpen = false;
  isCollapsed = false;
  isMobile = false;

  /** Debounced search query — drives `visibleSections` recomputation. */
  private readonly searchQuery = signal('');
  /** Tied to the language service so changing language re-filters labels too. */
  private readonly currentLang = inject(LanguageService).lang;

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  private searchSub?: Subscription;
  private sidebarSub?: Subscription;

  private host = inject(ElementRef<HTMLElement>);
  private sidebarService = inject(SidebarService);
  private auth = inject(AuthService);
  private readonly currentRole = this.auth.currentRole;

  /** Filtered nav, recomputes on (role, lang, query) change. */
  readonly visibleSections = computed<NavSection[]>(() =>
    this.filterSections(
      NAV_SECTIONS,
      this.currentRole(),
      this.searchQuery().toLowerCase().trim(),
      this.currentLang(),
    ),
  );

  ngOnInit(): void {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved) this.isCollapsed = saved === 'true';

    this.computeViewportState();

    this.sidebarSub = this.sidebarService.sidebar$.subscribe((open) => {
      if (this.isMobile) this.isSidebarOpen = open;
      else this.isSidebarOpen = true;
    });
  }

  ngAfterViewInit(): void {
    const input = this.searchInputRef?.nativeElement;
    if (!input) return;
    this.searchSub = fromEvent(input, 'input')
      .pipe(
        map((e: Event) => (e.target as HTMLInputElement).value.trim()),
        debounceTime(200),
        distinctUntilChanged(),
      )
      .subscribe((q) => this.searchQuery.set(q));
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.sidebarSub?.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.computeViewportState();
  }

  /** Close the drawer when clicking outside on mobile. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isMobile || !this.isSidebarOpen) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (this.host.nativeElement.contains(target)) return;
    if (target.closest(`[${SIDEBAR_TOGGLE_ATTR}]`)) return;
    this.sidebarService.close();
  }

  closeSidebar(): void {
    this.sidebarService.close();
  }

  onLinkClicked(): void {
    if (this.isMobile) this.sidebarService.close();
  }

  toggleCollapse(): void {
    if (this.isMobile) return;
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem(COLLAPSED_KEY, String(this.isCollapsed));
  }

  // ─────────── filtering ───────────

  private filterSections(
    sections: ReadonlyArray<NavSection>,
    role: UserRole | null,
    query: string,
    lang: 'ar' | 'en',
  ): NavSection[] {
    if (!role) return [];

    const dict = TRANSLATIONS[lang];
    const matchesQuery = (item: NavItem) =>
      !query || resolveKey(dict, item.labelKey).toLowerCase().includes(query);

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            (!item.roles || item.roles.includes(role)) && matchesQuery(item),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  private computeViewportState(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 992;

    if (this.isMobile) {
      this.isCollapsed = false;
      if (!wasMobile) this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true;
    }
  }
}
