import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { catchError, filter, map, take } from 'rxjs/operators';
import { ProductVariant, ProductVariantGeo } from '../../interfaces/store.interface';

/** Shape exacta que devuelve el backend al crear/reactivar una variante */
interface UpsertVariantResponse {
  variant:     ProductVariant;
  reactivated: boolean;
}
import {
  VariantSizeType,
  WeightUnit,
  LengthUnit,
} from '../../constants/product-options.constants';
import { environment } from '../../../../environments/environment';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateVariantDto {
  productId: string;
  sku: string;
  color?: { name: string; hex: string; code: string };
  size?: {
    type: VariantSizeType;  // valores exactos del enum del backend
    value: string;
    region?: string;        // EU | US | UK | CM (para footwear)
  };
  dimensions?: {
    length?: number;
    width?:  number;
    height?: number;
    unit?:   LengthUnit;   // 'cm' por defecto
    weight?: { value: number; unit: WeightUnit };
  };
  gallery?: string[];
  priceAdjustment?: number;
}

/**
 * Campos que acepta PATCH /product-variants/:id.
 * NO incluye: productId, sku ni isActive (tienen endpoints propios).
 */
export type UpdateVariantDto = Partial<Pick<CreateVariantDto, 'color' | 'size' | 'dimensions' | 'gallery' | 'priceAdjustment'>>;

// ─── Respuesta del endpoint /by-catalog y /my-catalog (grupo por producto) ───────
// Shape actualizado: el backend retorna arreglo de { product, variants[] } en lugar
// de un array plano con productId populado.
// api-requests.http L300-306

/**
 * Datos del producto maestro tal como viene en cada grupo de /by-catalog.
 * Incluye basePrice para poder calcular el costo en el modal de inventario.
 */
export interface CatalogProduct {
  _id:       string;
  code:      string;
  name:      string;
  brand:     string;
  model?:    string;
  basePrice: number;    // precio base — fuente de verdad para el costo
  gallery?:  string[];
}

/** Un grupo en la respuesta de /by-catalog: un producto y sus variantes */
export interface CatalogVariantGroup {
  product:  CatalogProduct;
  variants: ProductVariant[];
}

/**
 * Variante aplanada con el producto adjunto — construida en el componente.
 * Permite acceder a product.basePrice directamente desde la variante.
 */
export interface FlatCatalogVariant extends ProductVariant {
  /** Referencia al producto maestro, con basePrice incluido */
  product: CatalogProduct;
}

/** @deprecated Usar FlatCatalogVariant + CatalogVariantGroup */
export interface CatalogVariant extends ProductVariant {
  productId: CatalogProduct;
}

/** Respuesta de PATCH /bulk-status */
export interface BulkStatusResponse {
  updated: number;
  ids: string[];
}

// ──────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ProductVariantsService {
  private readonly apiUrl = `${environment.apiUrl}/product-variants`;

  /**
   * Caché en memoria: productId → BehaviorSubject<ProductVariant[]>
   * La primera llamada dispara el HTTP; las siguientes usan el valor ya almacenado.
   */
  private readonly _cache = new Map<string, BehaviorSubject<ProductVariant[] | null>>();

  constructor(private readonly http: HttpClient) {}

  // ─── LECTURA ──────────────────────────────────────────────────────────────

  /** Obtiene las variantes de un producto (con caché en memoria). */
  getVariantsByProduct(productId: string): Observable<ProductVariant[]> {
    if (!this._cache.has(productId)) {
      const subject = new BehaviorSubject<ProductVariant[] | null>(null);
      this._cache.set(productId, subject);
      this.http
        .get<ProductVariant[]>(`${this.apiUrl}/product/${productId}`)
        .pipe(catchError(() => of([])))
        .subscribe(variants => subject.next(variants));
    }
    return this._cache.get(productId)!.pipe(
      filter((v): v is ProductVariant[] => v !== null),
      take(1),
    );
  }

  /** Obtiene una variante por ID. */
  getVariantById(variantId: string): Observable<ProductVariant> {
    return this.http.get<ProductVariant>(`${this.apiUrl}/${variantId}`);
  }

  /** Obtiene el precio final de una variante (basePrice + priceAdjustment). */
  getVariantPrice(variantId: string): Observable<{ finalPrice: number }> {
    return this.http.get<{ finalPrice: number }>(`${this.apiUrl}/${variantId}/price`);
  }

  /**
   * [Público] Solo variantes ACTIVAS de un producto.
   * GET /product-variants/product/:id/active
   * Usado en la tienda pública y el modal de compra rápida.
   */
  getActiveVariantsByProduct(productId: string): Observable<ProductVariant[]> {
    return this.http
      .get<ProductVariant[]>(`${this.apiUrl}/product/${productId}/active`)
      .pipe(catchError(() => of([])));
  }

  /**
   * [Público] Variantes activas con disponibilidad GEO por tienda.
   * GET /product-variants/product/:id/geo[?lat=X&lng=Y]
   *
   * Cada variante en la respuesta incluye `storeAvailability[]`:
   *  - storeName, storeType, city, address
   *  - availableQty    → stock disponible en esa tienda
   *  - distanceKm      → distancia Haversine al cliente
   *  - deliveryCost    → S/ 0 si distanceKm ≤ 2, S/ X.XX si aplica (S/ 2.20/km extra)
   *  - isFreeDelivery  → true si distanceKm ≤ 2 y la tienda hace delivery
   *  - isWithinDeliveryRange → true si distanceKm ≤ capabilities.deliveryRadius
   *
   * Prioridad de resolución de coordenadas (manejada por el backend):
   *  1. lat/lng como query params (pasados aquí si el GeoService ya los tiene)
   *  2. Fallback: Huancayo (-12.0651, -75.2049)
   *
   * @param productId ID del producto maestro
   * @param lat Latitud del cliente (obtenida del GeoService)
   * @param lng Longitud del cliente (obtenida del GeoService)
   * @returns Observable<ProductVariantGeo[]> con storeAvailability[] por variante
   */
  getGeoVariantsByProduct(productId: string, lat?: number, lng?: number): Observable<ProductVariantGeo[]> {
    let url = `${this.apiUrl}/product/${productId}/geo`;
    if (lat !== undefined && lng !== undefined) {
      url += `?lat=${lat}&lng=${lng}`;
    }
    return this.http
      .get<ProductVariantGeo[]>(url)
      .pipe(catchError(() => of([])));
  }

  /**
   * [Seller] Variantes activas del catálogo propio (con product embebido).
   * GET /product-variants/my-catalog
   * Útil para el selector de variantes al crear inventario desde el panel del seller.
   */
  getMyCatalogVariants(): Observable<ProductVariant[]> {
    return this.http
      .get<ProductVariant[]>(`${this.apiUrl}/my-catalog`)
      .pipe(catchError(() => of([])));
  }

  /**
   * [Admin] Variantes activas de un catálogo específico, agrupadas por producto.
   * GET /product-variants/by-catalog?ownerId=moorea  → catálogo Moorea
   * GET /product-variants/by-catalog?ownerId=<id>    → catálogo del seller
   *
   * Response shape (actualizado): Array de { product, variants[] }
   *   product  → { _id, code, name, brand, model, basePrice }
   *   variants → ProductVariant[] (sin productId populado — usar product._id)
   * Ref: api-requests.http L300-306
   *
   * @param ownerId 'moorea' para el catálogo oficial, o un sellerId
   * @returns Observable<CatalogVariantGroup[]> agrupado por producto
   */
  getVariantsByCatalog(ownerId: 'moorea' | string): Observable<CatalogVariantGroup[]> {
    return this.http
      .get<CatalogVariantGroup[]>(`${this.apiUrl}/by-catalog?ownerId=${ownerId}`)
      .pipe(catchError(() => of([])));
  }

  // ─── ESCRITURA ────────────────────────────────────────────────────────────

  /** Crea una variante e invalida el caché del producto.
   *  El backend devuelve { variant, reactivated } → extraemos solo variant.
   */
  createVariant(dto: CreateVariantDto): Observable<ProductVariant> {
    return this.http.post<UpsertVariantResponse>(this.apiUrl, dto).pipe(
      tap(() => this.invalidateProduct(dto.productId)),
      map(res => res.variant),
    );
  }

  /** Actualiza datos de una variante (color, talla, dimensiones, gallery, priceAdjustment).
   *  ⚠️ NO enviar isActive aquí — usar activateVariant() / deactivateVariant().
   */
  updateVariant(variantId: string, productId: string, dto: UpdateVariantDto): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.apiUrl}/${variantId}`, dto).pipe(
      tap(() => this.invalidateProduct(productId)),
    );
  }

  /** Activa una variante → PATCH /:id/activate */
  activateVariant(variantId: string, productId: string): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.apiUrl}/${variantId}/activate`, {}).pipe(
      tap(() => this.invalidateProduct(productId)),
    );
  }

  /** Desactiva una variante → PATCH /:id/deactivate */
  deactivateVariant(variantId: string, productId: string): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.apiUrl}/${variantId}/deactivate`, {}).pipe(
      tap(() => this.invalidateProduct(productId)),
    );
  }

  /** Activa o desactiva varias variantes de golpe → PATCH /bulk-status */
  bulkStatus(ids: string[], isActive: boolean, productId: string): Observable<BulkStatusResponse> {
    return this.http.patch<BulkStatusResponse>(`${this.apiUrl}/bulk-status`, { ids, isActive }).pipe(
      tap(() => this.invalidateProduct(productId)),
    );
  }

  /** Elimina una variante permanentemente (hard delete) → DELETE /:id */
  deleteVariant(variantId: string, productId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${variantId}`).pipe(
      tap(() => this.invalidateProduct(productId)),
    );
  }

  // ─── CACHÉ ────────────────────────────────────────────────────────────────

  /** Invalida el caché de un producto específico. */
  invalidateProduct(productId: string): void {
    this._cache.delete(productId);
  }

  /** Invalida todo el caché. */
  clearCache(): void {
    this._cache.clear();
  }
}
