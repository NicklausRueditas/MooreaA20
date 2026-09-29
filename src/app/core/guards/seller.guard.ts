import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ToastService } from '../services/ui/toast.service';

/**
 * Guard para secciones exclusivas de Vendedores y Administradores (catálogo, productos y tiendas).
 * Si un Worker operativo intenta acceder, se le redirige al módulo de órdenes correspondiente.
 *
 * @returns boolean indicando si se autoriza la navegación
 */
export const sellerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  if (!authService.isAuthenticated()) {
    toastService.show('Debes iniciar sesión para continuar.', 'warning');
    router.navigate(['/auth/login']);
    return false;
  }

  if (authService.isSeller()) {
    return true;
  }

  toastService.show('Acceso restringido: Esta sección requiere rol de Vendedor o Administrador.', 'error');
  // Si es un operario (worker), redirigir a órdenes
  if (authService.isWorker()) {
    router.navigate(['/business/orders']);
  } else {
    router.navigate(['/home']);
  }
  return false;
};
