import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ToastService } from '../services/ui/toast.service';

/**
 * Guard para proteger rutas exclusivas de Administrador (ej. gestión de usuarios y vendedores).
 *
 * @returns boolean indicando si se permite el acceso
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  if (!authService.isAuthenticated()) {
    toastService.show('Debes iniciar sesión con una cuenta de Administrador.', 'warning');
    router.navigate(['/auth/login']);
    return false;
  }

  if (authService.isAdmin()) {
    return true;
  }

  toastService.show('Acceso restringido: Se requieren permisos de Administrador.', 'error');
  router.navigate(['/business/orders']);
  return false;
};
