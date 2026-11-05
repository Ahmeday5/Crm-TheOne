import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CompanySettingsService } from '../../services/company-settings.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { NotificationToastsComponent } from '../../../shared/components/notification-toasts/notification-toasts.component';
import { fadeIn } from '../../../shared/utils/animations';
import { AnnouncementBannerComponent } from '../../../features/announcements';
import { CommandCenterHostComponent } from '../../../features/command-center';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    FooterComponent,
    NotificationToastsComponent,
    AnnouncementBannerComponent,
    CommandCenterHostComponent,
    BottomNavComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [fadeIn],
})
export class MainLayoutComponent implements OnInit {
  private readonly companySettings = inject(CompanySettingsService);

  ngOnInit(): void {
    this.companySettings.ensureLoaded();
  }
}
