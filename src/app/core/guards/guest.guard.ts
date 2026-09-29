import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Guard para páginas públicas de autenticación (/auth/login, /auth/register).
 * Evita que usuarios ya autenticados vuelvan a ver formularios de inicio de sesión o registro.
 *
 * @returns boolean indicando si se permite el acceso (true solo para usuarios no autenticados)
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Redirigir a panel de negocio si es usuario corporativo, o a inicio si es cliente
  if (authService.isBusinessUser()) {
    router.navigate(['/business/orders']);
  } else {
    router.navigate(['/home']);
  }
  return false;
};
