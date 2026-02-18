import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  rememberMe = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.authService.login(this.email, this.password);
    this.router.navigate(['/leads']); // بعد اللوجين، روح للـ Leads (الـ Guard هيحدد الشكل)
  }

  quickLogin(role: string) {
    const accounts: any = {
      admin: { email: 'admin@admin.com', pass: 'admin123' },
      marketing: { email: 'marketing@marketing.com', pass: 'marketing123' },
      sales: { email: 'sales@sales.com', pass: 'sales123' },
      support: { email: 'support@support.com', pass: 'support123' },
      developer: { email: 'developer@developer.com', pass: 'dev123' },
    };

    this.email = accounts[role].email;
    this.password = accounts[role].pass;
  }
}
