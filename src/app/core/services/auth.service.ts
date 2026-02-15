import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userRoleSubject = new BehaviorSubject<string | null>(null);
  userRole$ = this.userRoleSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private router: Router,
  ) {
    this.loadUserRole(); // تحميل الـ Role لو موجود في LocalStorage
  }

  login(email: string, password: string): void {
    // Mock Login (غيرها بـ API call لما الباك يجهز)
    let role: string;
    if (email.includes('admin')) {
      role = 'admin';
    } else if (email.includes('marketing')) {
      role = 'marketing';
    } else if (email.includes('sales')) {
      role = 'sales';
    } else {
      role = 'guest'; // لو مش معروف
    }
    this.userRoleSubject.next(role);
    localStorage.setItem('role', role);
    console.log('Logged in with role:', role);
    // لو API: this.apiService.post('/login', {email, password}).subscribe(res => { this.userRoleSubject.next(res.role); localStorage.setItem('role', res.role); });
  }

  loadUserRole(): void {
    const role = localStorage.getItem('role');
    if (role) {
      this.userRoleSubject.next(role);
    }
  }

  getUserRole(): string | null {
    return this.userRoleSubject.value;
  }

  logout(): void {
    this.userRoleSubject.next(null);
    localStorage.removeItem('role');
    // وغالباً هتحتاج تمسح التوكن كمان
    // localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}
