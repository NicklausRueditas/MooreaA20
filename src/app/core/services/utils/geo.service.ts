import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── Interfaces de respuesta del backend ────────────────────────────────────

/**
 * Respuesta de GET /geo/location.
 * El backend resuelve las coordenadas del cliente con la siguiente prioridad:
 *   1. Usuario autenticado con dirección default (Bearer token)
 *   2. Query params ?lat=X&lng=Y
 *   3. Fallback: Huancayo (-12.0651, -75.2049)
 */
export interface GeoLocation {
  /** Latitud del cliente resuelta */
  lat: number;
  /** Longitud del cliente resuelta */
  lng: number;
  /** Fuente usada para resolver la ubicación */
  source: 'default_address' | 'query_params' | 'fallback';
  /** Ciudad aproximada (si el backend la incluye) */
  city?: string;
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Servicio de Geolocalización.
 *
 * Responsabilidades:
 *  - Llama a GET /geo/location para resolver la ubicación del cliente.
 *  - Acepta coordenadas manuales opcionales (?lat=&lng=) que serán enviadas al backend.
 *  - Cachea el resultado en `location$` (BehaviorSubject) para evitar peticiones repetidas.
 *  - Expone `coords` como getter síncrono para consultas rápidas sin suscripción.
 *
 * Uso en StoreComponent (al iniciar /store):
 *   this.geoService.resolve().subscribe();
 *   → Luego pasar coords a ProductsService.loadGeoGatalog(lat, lng)
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly apiUrl = `${environment.apiUrl}/geo`;

  // ── Estado interno ──────────────────────────────────────────────────────────

  /** Ubicación resuelta del cliente. null = aún no cargada. */
  private readonly _location$ = new BehaviorSubject<GeoLocation | null>(null);

  /** Observable público de la ubicación resuelta. */
  readonly location$ = this._location$.asObservable();

  /** Flag para evitar peticiones duplicadas. */
  private resolved = false;

  constructor(private readonly http: HttpClient) {}

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Resuelve la ubicación del cliente llamando a GET /geo/location.
   * Si ya fue resuelta previamente (caché), devuelve el valor almacenado sin HTTP.
   *
   * @param lat Latitud manual opcional (se envía como query param al backend)
   * @param lng Longitud manual opcional (se envía como query param al backend)
   * @param forceRefresh Si true, ignora el caché y hace una nueva petición
   * @returns Observable<GeoLocation> con las coordenadas resueltas
   */
  resolve(lat?: number, lng?: number, forceRefresh = false): Observable<GeoLocation> {
    if (this.resolved && !forceRefresh) {
      return of(this._location$.getValue()!);
    }

    let url = `${this.apiUrl}/location`;
    if (lat !== undefined && lng !== undefined) {
      url += `?lat=${lat}&lng=${lng}`;
    }

    return this.http.get<GeoLocation>(url).pipe(
      tap((location) => {
        this._location$.next(location);
        this.resolved = true;
      }),
      catchError((err) => {
        console.error('[GeoService] Error al resolver ubicación:', err);
        // Fallback local: Huancayo
        const fallback: GeoLocation = { lat: -12.0651, lng: -75.2049, source: 'fallback' };
        this._location$.next(fallback);
        this.resolved = true;
        return of(fallback);
      })
    );
  }

  /**
   * Devuelve las coordenadas resueltas de forma síncrona (sin suscripción).
   * Retorna null si aún no se llamó a resolve().
   */
  get coords(): { lat: number; lng: number } | null {
    const loc = this._location$.getValue();
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  }

  /**
   * Invalida el caché para forzar una nueva resolución en la próxima llamada a resolve().
   * Útil cuando el usuario actualiza su dirección default.
   */
  reset(): void {
    this.resolved = false;
    this._location$.next(null);
  }
}
