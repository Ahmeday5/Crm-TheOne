import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, fromEvent, map, startWith } from 'rxjs';
import { ROLE_CHAT, ROLE_HOME, ROLE_WORKSPACE } from '../../../core/constants/role-home.const';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { NotificationsPanelService } from '../../../core/services/notifications-panel.service';
import { NotificationsStore } from '../../../core/services/notifications.store';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface BottomItem {
  id: string;
  labelKey: string;
  icon: string;
  /** Route items; action items use `run`. */
  path?: string;
  /** Active on nested routes too (e.g. `/whatsapp/chats/3`). */
  prefix?: boolean;
  badge?: number;
  run?: () => void;
  /** Extra attribute so the opener's own outside-click logic ignores it. */
  toggleAttr?: 'data-sidebar-toggle' | 'data-notifications-toggle';
  active?: boolean;
}

/** Below this share of the layout viewport the on-screen keyboard is open. */
const KEYBOARD_RATIO = 0.75;

/**
 * Mobile / tablet bottom bar (hidden ≥ lg): Home · role workspace (customers
 * or tasks) · WhatsApp or team chat · notifications (unread badge) · menu.
 * Hides itself while the on-screen keyboard is open so it never covers a
 * composer or form field.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly badges = inject(NavBadgesService);
  private readonly notifications = inject(NotificationsStore);
  private readonly panel = inject(NotificationsPanelService);
  private readonly sidebar = inject(SidebarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly keyboardOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
      startWith(this.router.url.split(/[?#]/)[0]),
    ),
    { initialValue: '/' },
  );

  private readonly sidebarOpen = toSignal(this.sidebar.sidebar$, { initialValue: false });

  readonly items = computed<BottomItem[]>(() => {
    const role = this.auth.currentRole();
    if (!role) return [];
    const url = this.url();
    const isOn = (path: string, prefix = false) =>
      path === '/' ? url === '/' : url === path || (prefix && url.startsWith(`${path}/`));

    const home = ROLE_HOME[role];
    const work = ROLE_WORKSPACE[role];
    const chat = ROLE_CHAT[role];
    const panelOpen = this.panel.open();
    const menuOpen = this.sidebarOpen();

    return [
      { id: 'home', labelKey: 'bottomNav.home', icon: 'fa-solid fa-house', path: home, active: !panelOpen && !menuOpen && isOn(home) },
      { id: 'work', ...work, active: !panelOpen && !menuOpen && isOn(work.path, true) },
      {
        id: 'chat',
        ...chat,
        prefix: true,
        badge: this.badges.get(chat.path),
        active: !panelOpen && !menuOpen && isOn(chat.path, true),
      },
      {
        id: 'notifications',
        labelKey: 'bottomNav.notifications',
        icon: 'fa-solid fa-bell',
        badge: this.notifications.unreadCount(),
        toggleAttr: 'data-notifications-toggle',
        active: panelOpen,
        run: () => {
          this.sidebar.close();
          this.panel.toggle();
        },
      },
      {
        id: 'menu',
        labelKey: 'bottomNav.menu',
        icon: 'fa-solid fa-bars',
        toggleAttr: 'data-sidebar-toggle',
        active: menuOpen,
        run: () => {
          this.panel.close();
          this.sidebar.toggle();
        },
      },
    ];
  });

  ngOnInit(): void {
    const vv = window.visualViewport;
    if (!vv) return;
    fromEvent(vv, 'resize')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.keyboardOpen.set(vv.height < window.innerHeight * KEYBOARD_RATIO));
  }

  /** Route taps also close any overlay that was open. */
  onNavigate(): void {
    this.panel.close();
    this.sidebar.close();
  }

  badgeText(n: number | undefined): string {
    return !n ? '' : n > 99 ? '99+' : String(n);
  }
}
