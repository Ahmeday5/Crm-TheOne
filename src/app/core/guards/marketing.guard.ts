import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const marketingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getUserRole();

  if (role !== 'marketing' && role !== 'admin') {
    router.navigate(['/leads']);
    return false;
  }
  return true;
};
