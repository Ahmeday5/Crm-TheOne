import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PortalBrandingService } from '../../services/portal-branding.service';
import { PortalLiveService } from '../../services/portal-live.service';
import { PortalSessionService } from '../../services/portal-session.service';

/**
 * The client's whole app: a branded top bar (TheOne logo, "مشاريعي", who is
 * viewing, contact, theme / language) over a centred column, and a footer with
 * the company's contact details. No staff chrome, no staff routes.
 */
@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    TranslatePipe,
    UserAvatarComponent,
    ThemeToggleComponent,
    LanguageToggleComponent,
    ModalComponent,
    MockRibbonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-layout.component.html',
  styleUrl: './client-layout.component.scss',
})
export class ClientLayoutComponent {
  protected readonly session = inject(PortalSessionService);
  protected readonly brand = inject(PortalBrandingService);
  private readonly live = inject(PortalLiveService);

  protected readonly year = new Date().getFullYear();
  protected readonly customer = this.session.customer;
  protected readonly company = computed(() => this.customer()?.companyName || this.customer()?.name || '');
  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);

  protected readonly renameOpen = signal(false);
  protected readonly nameDraft = signal('');
  protected readonly renaming = signal(false);

  constructor() {
    this.brand.load();
    void this.live.start();

    const onScroll = () => this.scrolled.set(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    const onDocClick = () => this.menuOpen.set(false);
    document.addEventListener('click', onDocClick);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onDocClick);
      void this.live.stop();
    });
  }

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected openRename(): void {
    this.menuOpen.set(false);
    this.nameDraft.set(this.session.visitorName() ?? '');
    this.renameOpen.set(true);
  }

  protected saveName(): void {
    if (this.renaming()) return;
    this.renaming.set(true);
    this.session.rename(this.nameDraft().trim() || null).subscribe({
      next: () => {
        this.renaming.set(false);
        this.renameOpen.set(false);
      },
      error: () => this.renaming.set(false),
    });
  }

  protected signOut(): void {
    this.session.signOut();
  }
}
