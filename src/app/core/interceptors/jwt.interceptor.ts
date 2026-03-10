import { HttpInterceptorFn } from '@angular/common/http';

// Interceptor funcional que añade el header Authorization con el token JWT.
// Evitamos inyectar AuthService aquí para romper la dependencia circular (NG0200).
// En su lugar leemos el token directamente desde localStorage (clave: 'access_token').
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Obtener token de localStorage de forma directa evita resolver AuthService
  const token = localStorage.getItem('access_token');

  // Si es una petición de autenticación o no hay token, no modificar
  if (req.url.includes('/auth/') || !token) {
    return next(req);
  }

  // Clonar la petición y agregar el header Authorization
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};