import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/ui/toast.service';

// Nota: Evitamos inyectar AuthService aquí para prevenir dependencia circular.
// Si el interceptor intentara llamar a AuthService.logout() y este usa HttpClient,
// se crea un ciclo (AuthService -> HttpClient -> interceptors -> errorInterceptor -> AuthService).
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred';

      if (error.error instanceof ErrorEvent) {
        errorMessage = `Error: ${error.error.message}`;
      } else {
        switch (error.status) {
          case 401:
            // En lugar de llamar a AuthService.logout() (que podría usar HttpClient),
            // limpiamos el token localmente y preservamos la URL actual para que regrese tras autenticarse.
            try {
              localStorage.removeItem('access_token');
              const currentUrl = router.url;
              if (currentUrl && !currentUrl.startsWith('/auth') && currentUrl !== '/login') {
                localStorage.setItem('auth_redirect_url', currentUrl);
                router.navigate(['/auth/login'], { queryParams: { returnUrl: currentUrl } });
              } else {
                router.navigate(['/auth/login']);
              }
            } catch (e) {
              router.navigate(['/auth/login']);
            }
            errorMessage = 'Su sesión ha expirado. Por favor inicia sesión de nuevo.';
            break;
          case 403:
            errorMessage = 'No tienes permiso para realizar esta acción.';
            break;
          case 404:
            errorMessage = 'El recurso solicitado no fue encontrado.';
            break;
          case 500:
            errorMessage = 'Ocurrió un error en el servidor. Por favor intenta más tarde.';
            break;
          default:
            errorMessage = error.error?.message || error.message || errorMessage;
        }
      }

      toastService.showError(errorMessage);
      return throwError(() => error);
    })
  );
};