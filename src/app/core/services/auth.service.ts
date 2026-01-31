import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

import {
  User,
  LoginResponse,
  CurrentUserResponse,
  CreateUserDto,
  LoginUserDto,
  AppRole,
} from '../dtos/auth.interfaces';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.initializeUserFromToken();
  }

  //#region Inicialización
  /**
   * Inicializa el usuario si existe un token en localStorage
   */
  private initializeUserFromToken(): void {
    const token = this.getToken();
    if (token) {
      this.fetchCurrentUser().subscribe();
    }
  }
  //#endregion

  //#region Autenticación con Google
  /**
   * Inicia el flujo de autenticación con Google
   */
initiateGoogleLogin(): void {
  
  window.location.href = `${this.apiUrl}/auth/google`;
}

  /**
   * Maneja la autenticación con Google después del callback
   * @param token Token JWT recibido
   */
/**
 * Maneja la autenticación con Google después del callback
 * @param fragment Fragmento de URL que contiene el token (#token=...)
 * @returns Observable que emite cuando se completa la autenticación
 */
handleGoogleAuth(fragment: string): Observable<void> {
  return new Observable(subscriber => {
    try {
      // Extraer token del fragmento
      const tokenParam = fragment.split('&').find(param => param.startsWith('token='));
      console.log('[AuthService] Fragment recibido:', fragment);
      console.log('[AuthService] tokenParam extraído:', tokenParam);
      
      if (!tokenParam) {
        console.error('[AuthService] No se encontró parámetro token');
        throw new Error('Formato de token inválido. No se encontró parámetro token');
      }

      const token = tokenParam.split('=')[1];
      console.log('[AuthService] Token extraído:', token);
      
      if (!token) {
        console.error('[AuthService] Token vacío o mal formado');
        throw new Error('Token vacío o mal formado');
      }

      // Almacenar token
      this.storeToken(token);
      console.log('[AuthService] Token almacenado en localStorage:', localStorage.getItem('access_token'));

      // Obtener usuario actual
      this.fetchCurrentUser().subscribe({
        next: () => {
          this.redirectAfterLogin();
          subscriber.next();
          subscriber.complete();
        },
        error: (err) => {
          // Limpiar token inválido
          this.removeToken();
          subscriber.error(err);
        }
      });
    } catch (error) {
      subscriber.error(error);
    }
  });
}
  //#endregion

  //#region Autenticación tradicional (email/contraseña)
  /**
   * Registra un nuevo usuario
   * @param createUserDto Datos del usuario a registrar
   * @returns Observable con el usuario creado
   */
  register(createUserDto: CreateUserDto): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/auth/register`, createUserDto);
  }

  /**
   * Inicia sesión con email y contraseña
   * @param loginUserDto Credenciales del usuario
   * @returns Observable con la respuesta de login
   */
  login(loginUserDto: LoginUserDto): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, loginUserDto)
      .pipe(
        tap((response) => {
          this.storeToken(response.access_token);
          this.fetchCurrentUser().subscribe(() => {
            this.redirectAfterLogin();
          });
        })
      );
  }
  //#endregion

  //#region Gestión de Token
  /**
   * Almacena el token JWT en localStorage
   * @param token Token JWT a almacenar
   */
  storeToken(token: string): void {
    localStorage.setItem('access_token', token);
  }

  /**
   * Obtiene el token JWT almacenado
   * @returns Token JWT o null si no existe
   */
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Elimina el token JWT almacenado
   */
  removeToken(): void {
    localStorage.removeItem('access_token');
  }
  //#endregion

  //#region Gestión de Usuario
  /**
   * Obtiene la información del usuario actual desde el backend
   * @returns Observable con la respuesta del usuario
   */
  private fetchCurrentUser(): Observable<CurrentUserResponse> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`,
    });

    return this.http
      .get<CurrentUserResponse>(`${this.apiUrl}/auth/me`, { headers })
      .pipe(
        tap((response) => {
          this.currentUserSubject.next(
            response.authenticated
              ? {
                  id: response.user.id,
                  roles: response.user.roles,
                }
              : null
          );
        }),
        catchError((error) => {
          this.currentUserSubject.next(null);
          throw error;
        })
      );
  }

  /**
   * Obtiene el usuario actual
   * @returns Usuario actual o null si no está autenticado
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Verifica si el usuario está autenticado
   * @returns true si el usuario tiene un token válido
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Verifica si el usuario tiene un rol específico
   * @param role Rol a verificar
   * @returns true si el usuario tiene el rol
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.roles?.includes(role) || false;
  }
  //#endregion

  //#region Logout
  /**
   * Cierra la sesión del usuario
   * @returns Observable con el resultado del logout
   */
  logout(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/logout`, {})
      .pipe(
        tap(() => {
          this.removeToken();
          this.currentUserSubject.next(null);
          this.router.navigate(['/login']);
        })
      );
  }
  //#endregion

  //#region Helpers
  /**
   * Guarda la URL de redirección en localStorage
   * @param url URL a guardar (solo se guarda el path)
   */
  private setRedirectUrl(url: string): void {
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    localStorage.setItem('auth_redirect_url', cleanUrl);
  }

  /**
   * Redirige al usuario después de un login exitoso
   */
  private redirectAfterLogin(): void {
    const redirectPath =
      localStorage.getItem('auth_redirect_url') || '/home';
    localStorage.removeItem('auth_redirect_url');
    this.router.navigateByUrl(redirectPath);
  }
  //#endregion
}
