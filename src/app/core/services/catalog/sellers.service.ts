import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
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
  private readonly sellersUrl  = `${environment.apiUrl}/sellers`;
  private readonly adminUrl    = `${environment.apiUrl}/admin/sellers`;
  private readonly productUrl  = `${environment.apiUrl}/product`;

  constructor(private readonly http: HttpClient) {}

  // ─── PERFIL DEL SELLER (/sellers/profile) ────────────────────────────────

  /**
   * Crea el perfil de tienda del seller autenticado.
   * @param dto Datos del perfil (storeName, description, bankInfo)
   * @returns El SellerProfile creado
   */
  createProfile(dto: CreateSellerProfileDto): Observable<SellerProfile> {
    return this.http.post<SellerProfile>(`${this.sellersUrl}/profile`, dto);
  }

  /**
   * Obtiene el perfil de tienda del seller autenticado.
   * @returns El SellerProfile del usuario autenticado
   */
  getMyProfile(): Observable<SellerProfile> {
    return this.http.get<SellerProfile>(`${this.sellersUrl}/profile`);
  }

  /**
   * Actualiza el perfil de tienda del seller autenticado.
   * @param dto Campos a modificar (description, logoUrl, bankInfo)
   * @returns El SellerProfile actualizado
   */
  updateProfile(dto: UpdateSellerProfileDto): Observable<SellerProfile> {
    return this.http.patch<SellerProfile>(`${this.sellersUrl}/profile`, dto);
  }

  // ─── ADMIN: GESTIÓN DE SELLERS (/admin/sellers) ──────────────────────────

  /**
   * Lista todos los sellers (o solo los pendientes si pending=true).
   * @param pending Si true, devuelve solo sellers con status 'pending'
   * @returns Lista de SellerUser
   */
  getAllSellers(pending = false): Observable<SellerUser[]> {
    const url = pending
      ? `${this.adminUrl}?pending=true`
      : this.adminUrl;
    return this.http.get<SellerUser[]>(url);
  }

  /**
   * Aprueba un seller → cambia su status a 'approved'.
   * @param sellerId ID del usuario seller
   * @returns El SellerUser actualizado
   */
  approveSeller(sellerId: string): Observable<SellerUser> {
    return this.http.patch<SellerUser>(`${this.adminUrl}/${sellerId}/approve`, {});
  }

  /**
   * Rechaza/suspende un seller → cambia su status a 'rejected'.
   * @param sellerId ID del usuario seller
   * @returns El SellerUser actualizado
   */
  rejectSeller(sellerId: string): Observable<SellerUser> {
    return this.http.patch<SellerUser>(`${this.adminUrl}/${sellerId}/reject`, {});
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
