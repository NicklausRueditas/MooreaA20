import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { catchError, filter, take } from 'rxjs/operators';
import { ProductVariant } from '../../interfaces/store.interface';
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
  isActive?: boolean;
}

export type UpdateVariantDto = Partial<Omit<CreateVariantDto, 'productId'>>;

/** Shape del response del POST /product-variants (backend v2) */
export interface CreateVariantResponse {
  variant: ProductVariant;
  reactivated: boolean;
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

  // ─── ESCRITURA ────────────────────────────────────────────────────────────

  /**
   * Crea (o reactiva si el SKU ya existía) una variante.
   * El backend devuelve { variant, reactivated }.
   */
  createVariant(dto: CreateVariantDto): Observable<CreateVariantResponse> {
    return this.http.post<CreateVariantResponse>(this.apiUrl, dto).pipe(
      tap(() => this.invalidateProduct(dto.productId)),
    );
  }

  /** Actualiza una variante e invalida el caché. */
  updateVariant(variantId: string, productId: string, dto: UpdateVariantDto): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.apiUrl}/${variantId}`, dto).pipe(
      tap(() => this.invalidateProduct(productId)),
    );
  }

  /**
   * Soft delete de la variante (marca isActive=false).
   * Para reusar el SKU, simplemente vuelve a crear con POST — el backend la reactiva.
   */
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
