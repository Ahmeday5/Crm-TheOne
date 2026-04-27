import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  Subscription,
  debounceTime,
  distinctUntilChanged,
  fromEvent,
  map,
} from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface MenuItem {
  label: string;     // translation key
  path: string;
  icon: string;
  isOpen?: boolean;
  submenu?: MenuItem[];
}
interface MenuSection {
  title: string;     // translation key
  items: MenuItem[];
}

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

  menuItems: MenuSection[] = [];
  filteredMenuItems: MenuSection[] = [];

  /** Search input is always rendered, so the ref is reliable. */
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  private searchSub?: Subscription;
  private sidebarSub?: Subscription;

  private host = inject(ElementRef<HTMLElement>);
  private sidebarService = inject(SidebarService);
  private language = inject(LanguageService);

  ngOnInit(): void {
    this.menuItems = this.buildMenu();
    this.filteredMenuItems = this.cloneMenu(this.menuItems);

    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved) this.isCollapsed = saved === 'true';

    this.computeViewportState();

    // Drive isSidebarOpen from the service. On mobile we follow the service's
    // state; on desktop the drawer is always "open" (laid out as a column).
    this.sidebarSub = this.sidebarService.sidebar$.subscribe((open) => {
      if (this.isMobile) this.isSidebarOpen = open;
      else this.isSidebarOpen = true;
    });
  }

  ngAfterViewInit(): void {
    // Search input is now ALWAYS rendered, so this is safe; guard anyway.
    const input = this.searchInputRef?.nativeElement;
    if (!input) return;
    this.searchSub = fromEvent(input, 'input')
      .pipe(
        map((e: Event) => (e.target as HTMLInputElement).value.trim()),
        debounceTime(200),
        distinctUntilChanged(),
      )
      .subscribe((q) => this.applyFilter(q));
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.sidebarSub?.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.computeViewportState();
  }

  /** Close the drawer when the user clicks anywhere outside it on mobile. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isMobile || !this.isSidebarOpen) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    // Click inside the sidebar itself? leave it open.
    if (this.host.nativeElement.contains(target)) return;
    // Click on the hamburger toggle? let its own handler decide.
    if (target.closest(`[${SIDEBAR_TOGGLE_ATTR}]`)) return;
    this.sidebarService.close();
  }

  closeSidebar(): void {
    this.sidebarService.close();
  }

  /** Auto-close mobile drawer when a link is tapped. */
  onLinkClicked(): void {
    if (this.isMobile) this.sidebarService.close();
  }

  toggleCollapse(): void {
    if (this.isMobile) return;
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem(COLLAPSED_KEY, String(this.isCollapsed));
  }

  toggleSubmenu(sectionIndex: number, itemIndex: number): void {
    const item = this.filteredMenuItems[sectionIndex]?.items[itemIndex];
    if (item) item.isOpen = !item.isOpen;
  }

  private computeViewportState(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 992;

    if (this.isMobile) {
      this.isCollapsed = false;
      // crossing into mobile: drawer starts CLOSED
      if (!wasMobile) this.isSidebarOpen = false;
    } else {
      // desktop: laid out as a column, always "open"
      this.isSidebarOpen = true;
    }
  }

  private applyFilter(query: string): void {
    if (!query) {
      this.filteredMenuItems = this.cloneMenu(this.menuItems);
      return;
    }
    const q = query.toLowerCase();
    const dict = TRANSLATIONS[this.language.lang()];
    const translated = (key: string) => resolveKey(dict, key).toLowerCase();
    this.filteredMenuItems = this.menuItems
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => translated(it.label).includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }

  private cloneMenu(menu: MenuSection[]): MenuSection[] {
    return JSON.parse(JSON.stringify(menu));
  }

  private buildMenu(): MenuSection[] {
    return [
      {
        title: 'sidebar.sections.role',
        items: [
          { label: 'sidebar.items.admin',      path: '/',                       icon: 'fa-solid fa-table-cells-large' },
          { label: 'sidebar.items.marketing',  path: '/marketing-dashboard',    icon: 'fa-solid fa-users' },
          { label: 'sidebar.items.sales',      path: '/sales-dashboard',        icon: 'fa-solid fa-chart-line' },
          { label: 'sidebar.items.support',    path: '/appsupport-dashboard',   icon: 'fa-solid fa-headset' },
          { label: 'sidebar.items.developers', path: '/developer-dashboard',    icon: 'fa-solid fa-code' },
        ],
      },
      {
        title: 'sidebar.sections.modules',
        items: [
          { label: 'sidebar.items.leads',     path: '/leads/marketing-leadsCustomer', icon: 'fa-solid fa-address-card' },
          { label: 'sidebar.items.salesLine', path: '/line',                          icon: 'fa-solid fa-chart-line' },
          { label: 'sidebar.items.support',   path: '/dashboardSupport',              icon: 'fa-solid fa-headset' },
          { label: 'sidebar.items.projects',  path: '/ProjectManage',                 icon: 'fa-solid fa-table-columns' },
          { label: 'sidebar.items.reports',   path: '/reports',                       icon: 'fa-solid fa-chart-bar' },
          { label: 'sidebar.items.chat',      path: '/internal-chat',                 icon: 'fa-regular fa-comment-dots' },
        ],
      },
      {
        title: 'sidebar.sections.system',
        items: [
          { label: 'sidebar.items.users',         path: '/users',                icon: 'fa-solid fa-user-gear' },
          { label: 'sidebar.items.settings',      path: '/settings',             icon: 'fa-solid fa-gear' },
          { label: 'sidebar.items.kb',            path: '/knowledge-base',       icon: 'fa-solid fa-book' },
          { label: 'sidebar.items.improvements',  path: '/system-improvements',  icon: 'fa-solid fa-bolt' },
          { label: 'sidebar.items.advanced',      path: '/advanced-features',    icon: 'fa-solid fa-microchip' },
          { label: 'sidebar.items.notifications', path: '/notifications',        icon: 'fa-solid fa-bell' },
        ],
      },
    ];
  }
}
