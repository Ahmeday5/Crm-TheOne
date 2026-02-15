import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SidebarService } from '../../../core/services/sidebar.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {

 constructor(
    private sidebarService: SidebarService,
    private authService: AuthService,
    private router: Router
  ) {}

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['auth/login']);
  }
}
