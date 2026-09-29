import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ToastService } from '../services/ui/toast.service';

/**
 * Guard para proteger rutas que requieren autenticación obligatoria (ej. Mi Cuenta).
 * Si el usuario no está autenticado, almacena la URL de retorno y redirige al login.
 *
 * @param route Estado de la ruta activada
 * @param state Snapshot del estado del enrutador con la URL solicitada
 * @returns boolean indicando si se permite la navegación
 */
export const authGuard: CanActivateFn = (route, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  if (authService.isAuthenticated()) {
    return true;
  }

  toastService.show('Debes iniciar sesión para acceder a esta sección.', 'info');
  authService.setRedirectUrl(state.url);
  router.navigate(['/auth/login']);
  return false;
};
