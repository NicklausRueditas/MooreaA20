import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApprovalStatus,
  SellerProfile,
  SellerUser,
  CreateSellerProfileDto,
  UpdateSellerProfileDto,
} from '../../interfaces/seller.interface';
import { PaginatedResponse } from '../../interfaces/product.interface';

/**
 * Servicio para gestionar la entidad Seller.
 *
 * ── Seller autenticado (/sellers/profile) ───────────────────────────────────
 *   Requiere token con rol 'seller'.
 *
 * ── Admin (/admin/sellers) ───────────────────────────────────────────────────
 *   Requiere token con rol 'admin'.
 *
 * ── Catálogo privado (/product/my-catalog) ──────────────────────────────────
 *   Requiere token con rol 'seller'.
 */
@Injectable({ providedIn: 'root' })
export class SellersService {
  private readonly sellersUrl = `${environment.apiUrl}/sellers`;
  private readonly adminUrl   = `${environment.apiUrl}/admin/sellers`;
  private readonly productUrl = `${environment.apiUrl}/product`;

  /** Caché en memoria para evitar peticiones repetitivas de la lista */
  private cachedSellers$: Observable<SellerUser[]> | null = null;

  constructor(private readonly http: HttpClient) {}

  // ─── PERFIL DEL SELLER (/sellers/profile) ────────────────────────────────

  /**
   * Solicita afiliación como seller (cualquier usuario autenticado).
   * El backend asigna el rol 'seller' y crea un perfil con approvalStatus='pending'.
   * @param dto Datos de la tienda (shopName, description, logoUrl, bankInfo)
   * @returns El SellerProfile creado con approvalStatus='pending'
   */
  applyAsSeller(dto: CreateSellerProfileDto): Observable<SellerProfile> {
    return this.http.post<SellerProfile>(`${this.sellersUrl}/apply`, dto).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Crea el perfil de tienda del seller autenticado.
   * @param dto Datos del perfil (shopName, description, bankInfo)
   * @returns El SellerProfile creado
   */
  createProfile(dto: CreateSellerProfileDto): Observable<SellerProfile> {
    return this.http.post<SellerProfile>(`${this.sellersUrl}/profile`, dto).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Obtiene el perfil de tienda del seller autenticado.
   * @returns El SellerProfile del usuario autenticado
   */
  getMyProfiles(): Observable<SellerProfile[]> {
    return this.http.get<SellerProfile[]>(`${this.sellersUrl}/profile`);
  }

  /**
   * Obtiene el perfil principal de tienda del usuario autenticado o null si no tiene.
   */
  /**
   * Obtiene los datos consolidados del seller autenticado (usuario + tiendas).
   * GET /sellers/me
   */
  getMySellerDetails(): Observable<SellerUser> {
    return this.http.get<SellerUser>(`${this.sellersUrl}/me`);
  }

  getMyProfile(): Observable<SellerProfile | null> {
    return this.http.get<any>(`${this.sellersUrl}/profile`).pipe(
      map(res => {
        if (Array.isArray(res)) {
          return res.length > 0 ? res[0] : null;
        }
        return res || null;
      })
    );
  }

  /**
   * Actualiza el perfil de tienda del seller autenticado.
   * @param dto Campos a modificar (description, logoUrl, bankInfo)
   * @returns El SellerProfile actualizado
   */
  updateProfile(dto: UpdateSellerProfileDto): Observable<SellerProfile> {
    return this.http.patch<SellerProfile>(`${this.sellersUrl}/profile`, dto).pipe(
      tap(() => this.clearCache())
    );
  }

  // ─── ADMIN: GESTIÓN DE SELLERS (/admin/sellers) ──────────────────────────

  /**
   * Lista todos los sellers agrupados con sus perfiles de tienda.
   * Utiliza caché en memoria para optimizar llamadas redundantes.
   * @param status Filtrar por approvalStatus: 'pending' | 'approved' | 'rejected'
   * @param forceRefresh Forzar petición al backend ignorando caché
   * @returns Lista de SellerUser con sellerProfiles
   */
  getAllSellers(status?: ApprovalStatus, forceRefresh = false): Observable<SellerUser[]> {
    if (forceRefresh || !this.cachedSellers$ || status) {
      const url = status
        ? `${this.adminUrl}?status=${status}`
        : this.adminUrl;
      const req$ = this.http.get<SellerUser[]>(url).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
      if (!status) {
        this.cachedSellers$ = req$;
      }
      return req$;
    }
    return this.cachedSellers$;
  }

  /**
   * Limpia la caché en memoria para forzar recarga fresca en la siguiente llamada.
   */
  clearCache(): void {
    this.cachedSellers$ = null;
  }

  /**
   * Obtiene un seller específico por su userId directamente desde el backend.
   * Endpoint optimizado: GET /admin/sellers/:sellerId
   * @param userId ID del usuario seller
   * @returns Observable con el SellerUser encontrado
   */
  getSellerById(userId: string): Observable<SellerUser> {
    return this.http.get<SellerUser>(`${this.adminUrl}/${userId}`);
  }

  /**
   * Aprueba todos los perfiles activos del seller.
   * @param userId ID del usuario seller
   * @returns Array de perfiles actualizados con approvalStatus='approved'
   */
  approveSeller(userId: string): Observable<SellerProfile[]> {
    return this.http.patch<SellerProfile[]>(`${this.adminUrl}/${userId}/approve`, {}).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Rechaza/suspende todos los perfiles activos del seller.
   * @param userId ID del usuario seller
   * @returns Array de perfiles actualizados con approvalStatus='rejected'
   */
  rejectSeller(userId: string): Observable<SellerProfile[]> {
    return this.http.patch<SellerProfile[]>(`${this.adminUrl}/${userId}/reject`, {}).pipe(
      tap(() => this.clearCache())
    );
  }

  // ─── CATÁLOGO PRIVADO DEL SELLER (/product/my-catalog) ───────────────────

  /**
   * Obtiene el catálogo de productos del seller autenticado (solo sus productos).
   * @param page  Página actual (default 1)
   * @param limit Items por página (default 12)
   * @returns Respuesta paginada de productos
   */
  getMyCatalog(page = 1, limit = 12): Observable<PaginatedResponse> {
    return this.http.get<PaginatedResponse>(
      `${this.productUrl}/my-catalog?page=${page}&limit=${limit}`
    );
  }
}
