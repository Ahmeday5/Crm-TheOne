import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getUserRole();

  // لو مش مسجل دخول خالص → روح للوجين
  if (!role) {
    router.navigate(['/auth/login']);
    return false;
  }

  // لو الـ URL الحالي هو /leads بالظبط (مش sub-route)
  // وجهه للشكل المناسب حسب الـ Role
  if (route.routeConfig?.path === 'leads' && !route.firstChild) {
    if (role === 'marketing' || role === 'admin') {
      router.navigate(['/leads/marketing-leadsCustomer']);  // ← غيرناه للمسار الصح اللي عندك
    } else if (role === 'sales') {
      router.navigate(['/leads/sales-leadsCustomer']);     // ← غيرناه للمسار الصح
    } else {
      router.navigate(['/']);  // لو Role غريب، روح للداش بورد الرئيسي
    }
    return true;   // ← المهم: رجع true عشان يسمح بالتنقل
  }

  // لو الـ route مش /leads، أو فيه child، خليه يمر عادي
  return true;
};
