import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ToastService } from '../services/ui/toast.service';

/**
 * Guard de acceso general al panel de negocios (/business).
 * Permite el acceso únicamente a usuarios con roles operativos: admin, seller o worker.
 * Redirige al login si no está autenticado, o al home si es un cliente estándar.
 *
 * @param route Estado de la ruta activada
 * @param state Snapshot con la URL solicitada
 * @returns boolean indicando si se permite el acceso al panel corporativo
 */
export const businessGuard: CanActivateFn = (route, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  if (!authService.isAuthenticated()) {
    toastService.show('Inicia sesión con tu cuenta corporativa para ingresar.', 'warning');
    authService.setRedirectUrl(state.url);
    router.navigate(['/auth/login']);
    return false;
  }

  if (authService.isBusinessUser()) {
    return true;
  }

  toastService.show('Acceso restringido: Se requieren permisos comerciales o de vendedor.', 'error');
  router.navigate(['/home']);
  return false;
};
