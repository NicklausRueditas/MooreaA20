import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable, catchError, of, tap, throwError } from 'rxjs';
import { User } from '../interfaces/user.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SesionService {
  private readonly apiUrl = `${environment.apiUrl}/sesion`;
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Si hay token, intentar cargar perfil al iniciar (evita race conditions)
    const token = this.authService.getToken();
    console.log('[SesionService] constructor token:', token); // <<-- LOG
    if (token) {
      this.getProfile().pipe(
        catchError(() => of(null))
      ).subscribe();
    }
  }

  getProfile(): Observable<User | null> {
    const headers = this.getAuthHeaders();
    console.log('[SesionService] getProfile called. headers exist?', !!headers); // <<-- LOG
    if (!headers) {
      // No hay token: garantizar que el estado refleje "no autenticado"
      this.userSubject.next(null);
      return of(null);
    }

    return this.http.get<User>(`${this.apiUrl}/profile`, headers).pipe(
      tap(user => {
        console.log('[SesionService] getProfile -> user:', user); // <<-- LOG
        this.userSubject.next(user);
      }),
      catchError(error => this.handleAuthError(error))
    );
  }

  // Nuevo: asegura que el perfil esté cargado (o devuelve null si no hay token)
  ensureProfileLoaded(): Observable<User | null> {
    const token = this.authService.getToken();
    const current = this.userSubject.value;
    console.log('[SesionService] ensureProfileLoaded. token:', token, 'current:', current); // <<-- LOG
    if (!token) {
      this.userSubject.next(null);
      return of(null);
    }
    if (current) {
      return of(current);
    }
    return this.getProfile().pipe(
      tap(user => console.log('[SesionService] ensureProfileLoaded -> getProfile result:', user)), // <<-- LOG
      catchError(() => of(null))
    );
  }

  deleteProfile(): Observable<void> {
    const headers = this.getAuthHeaders();
    if (!headers) {
      // Nada que borrar si no hay token
      this.userSubject.next(null);
      this.authService.logout();
      return of(void 0);
    }

    return this.http.delete<void>(
      `${this.apiUrl}/profile`,
      headers
    ).pipe(
      tap(() => {
        this.userSubject.next(null);
        this.authService.logout();
      }),
      catchError(error => this.handleAuthError(error))
    );
  }

  private getAuthHeaders(): { headers: HttpHeaders } | null {
    const token = this.authService.getToken();
    if (!token) {
      return null;
    }

    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  private handleAuthError(error: any): Observable<never> {
    console.log('[SesionService] handleAuthError:', error); // <<-- LOG
    this.userSubject.next(null);
    this.authService.logout();
    return throwError(() => error);
  }
}