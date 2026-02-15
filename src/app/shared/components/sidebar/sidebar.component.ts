import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  debounceTime,
  distinctUntilChanged,
  fromEvent,
  map,
  Subscription,
} from 'rxjs';
import { SidebarService } from '../../../core/services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  isSidebarOpen: boolean = false;
  isCollapsed: boolean = false;
  isMobile = false;

  menuItems: any[] = [];
  filteredMenuItems: any[] = [];
  private searchSub: Subscription | null = null;
  @ViewChild('searchInput', { static: true })
  searchInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    private router: Router,
    private sidebarService: SidebarService,
  ) {}

  ngOnInit(): void {
    this.updateMenuItems();
    this.updateSidebarState();
    this.filteredMenuItems = JSON.parse(JSON.stringify(this.menuItems));

    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      this.isCollapsed = saved === 'true';
    }

    this.sidebarService.sidebar$.subscribe((open) => {
      if (window.innerWidth <= 992) {
        this.isSidebarOpen = open;
      }
    });
  }

  closeSidebar() {
    this.sidebarService.close();
  }

  toggleCollapse(): void {
    if (window.innerWidth >= 993) {
      this.isCollapsed = !this.isCollapsed;
      localStorage.setItem('sidebarCollapsed', this.isCollapsed.toString());
      window.dispatchEvent(new Event('resize'));
    }
  }

  ngAfterViewInit(): void {
    window.addEventListener('resize', () => this.updateSidebarState());

    this.searchSub = fromEvent(this.searchInputRef.nativeElement, 'input')
      .pipe(
        map((e: any) => e.target.value as string),
        map((v) => v.trim()),
        debounceTime(200),
        distinctUntilChanged(),
      )
      .subscribe((query) => {
        this.applyFilter(query);
      });
  }

  ngOnDestroy(): void {
    if (this.searchSub) this.searchSub.unsubscribe();
  }

  private updateSidebarState(): void {
    this.isMobile = window.innerWidth <= 992;

    if (this.isMobile) {
      this.isSidebarOpen = false;
      this.isCollapsed = false;
    } else {
      this.isSidebarOpen = true;
    }
  }

  toggleSubmenu(sectionIndex: number, itemIndex: number): void {
    const section = this.filteredMenuItems[sectionIndex];
    if (!section || !section.items) return;

    const item = section.items[itemIndex];
    if (!item) return;

    item.isOpen = !item.isOpen;
  }

  private applyFilter(query: string): void {
    if (!query) {
      this.filteredMenuItems = JSON.parse(JSON.stringify(this.menuItems));
      this.closeAllSubmenus(this.filteredMenuItems);
      return;
    }

    const q = query.toLowerCase();

    const result: any[] = [];

    for (const section of this.menuItems) {
      const clonedSection: any = { ...section };
      clonedSection.items = [];

      const titleMatches =
        section.title && section.title.toLowerCase().includes(q);

      if (titleMatches) {
        clonedSection.items = JSON.parse(JSON.stringify(section.items || []));
        if (clonedSection.items)
          clonedSection.items.forEach((it: any) => {
            if (it.submenu) it.isOpen = true;
          });
        result.push(clonedSection);
        continue;
      }

      if (section.items && section.items.length) {
        for (const item of section.items) {
          const itemLabel = (item.label || '').toLowerCase();
          let matchedItem: any = null;

          if (itemLabel.includes(q)) {
            matchedItem = JSON.parse(JSON.stringify(item));
            if (matchedItem.submenu) matchedItem.isOpen = true;
          } else if (item.submenu && item.submenu.length) {
            const matchingSub: any[] = [];
            for (const sub of item.submenu) {
              const subKey = (sub.key || '').toLowerCase();
              if (subKey.includes(q)) {
                matchingSub.push(JSON.parse(JSON.stringify(sub)));
              }
            }
            if (matchingSub.length) {
              matchedItem = {
                ...JSON.parse(JSON.stringify(item)),
                submenu: matchingSub,
                isOpen: true,
              };
            }
          }

          if (matchedItem) {
            clonedSection.items.push(matchedItem);
          }
        }

        if (clonedSection.items.length) {
          result.push(clonedSection);
        }
      }
    }

    this.filteredMenuItems = result;
  }

  private closeAllSubmenus(list: any[]): void {
    for (const section of list) {
      if (section.items && section.items.length) {
        for (const it of section.items) {
          if (it.submenu) it.isOpen = false;
        }
      }
    }
  }

  private updateMenuItems(): void {
    this.menuItems = [
      {
        title: 'اختر الدور',
        items: [
          {
            label: 'المدير / المالك',
            path: '/',
            icons: 'bi bi-grid-fill',
            isOpen: false,
          },
          {
            label: 'التسويق',
            path: 'marketing-dashboard',
            icons: 'bi bi-people',
            isOpen: false,
          },
          {
            label: 'المبيعات',
            path: 'sales-dashboard',
            icons: 'bi bi-graph-up',
            isOpen: false,
          },
          {
            label: 'الدعم الفني',
            path: 'appsupport-dashboard',
            icons: 'bi bi-headset',
            isOpen: false,
          },
          {
            label: 'المطورين',
            path: 'developer-dashboard',
            icons: 'bi bi-code-slash',
            isOpen: false,
          },
        ],
      },
      {
        title: 'الوحدات المتاحة',
        items: [
          {
            label: 'إدارة العملاء المحتملين',
            path: '/leads/marketing-leadsCustomer',
            icons: 'bi bi-person-lines-fill',
            isOpen: false,
          },
          {
            label: 'خط المبيعات',
            path: 'line',
            icons: 'bi bi-graph-up-arrow',
            isOpen: false,
          },
          {
            label: 'الدعم الفني',
            path: '/support',
            icons: 'bi bi-headset',
            isOpen: false,
          },
          {
            label: 'المشاريع والمهام',
            path: '/projects',
            icons: 'bi bi-kanban',
            isOpen: false,
          },
          {
            label: 'التقارير والتحليلات',
            path: '/reports',
            icons: 'bi bi-bar-chart',
            isOpen: false,
          },
          {
            label: 'الدردشة الداخلية',
            path: '/internal-chat',
            icons: 'bi bi-chat-dots',
            isOpen: false,
          },
        ],
      },
      {
        title: 'إدارة النظام',
        items: [
          {
            label: 'إدارة المستخدمين',
            path: '/users',
            icons: 'bi bi-person-gear',
            isOpen: false,
          },
          {
            label: 'إعدادات النظام',
            path: '/settings',
            icons: 'bi bi-gear',
            isOpen: false,
          },
          {
            label: 'قاعدة المعرفة',
            path: '/knowledge-base',
            icons: 'bi bi-book',
            isOpen: false,
          },
          {
            label: 'تحسينات النظام',
            path: '/system-improvements',
            icons: 'bi bi-lightning',
            isOpen: false,
          },
          {
            label: 'الميزات المتقدمة',
            path: '/advanced-features',
            icons: 'bi bi-cpu',
            isOpen: false,
          },
          {
            label: 'مركز الإشعارات',
            path: '/notifications',
            icons: 'bi bi-bell',
            isOpen: false,
          },
        ],
      },
    ];
  }
}
