import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';
import { Product, PaginatedResponse } from '../../interfaces/product.interface';
import { environment } from '../../../../environments/environment';
import { UpdateProductDto } from '../../dtos/update-product.dto';

/**
 * Servicio para gestionar operaciones CRUD de productos maestros.
 *
 * ── Caché del catálogo ──────────────────────────────────────────────────────
 * `catalog$` es un BehaviorSubject que actúa como caché en memoria.
 * La primera llamada a `loadCatalog()` hace la petición HTTP; las siguientes
 * simplemente devuelven el valor ya almacenado. Todos los componentes que
 * consuman `catalog$` comparten el mismo array sin generar tráfico adicional.
 *
 * Uso recomendado:
 *   this.productsService.loadCatalog();       // dispara la carga (1 vez)
 *   this.productsService.catalog$.subscribe() // escucha actualizaciones
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly apiUrl = `${environment.apiUrl}/product`;

  // ── Caché del catálogo público (productos activos) ─────────────────────────
  private readonly _catalog$ = new BehaviorSubject<Product[]>([]);
  /** Observable del catálogo completo de productos activos. */
  readonly catalog$ = this._catalog$.asObservable();

  /** Valor actual del catálogo sin suscripción (lectura síncrona desde caché). */
  getCatalogSnapshot(): Product[] {
    return this._catalog$.getValue();
  }

  private catalogLoaded = false;

  constructor(private readonly http: HttpClient) {}

  // ─── CATÁLOGO PÚBLICO (CON CACHÉ) ─────────────────────────────────────────

  /**
   * Carga el catálogo de productos activos la primera vez y lo almacena en
   * `catalog$`. Las llamadas posteriores son no-op para evitar peticiones HTTP.
   * Para forzar recarga (ej. después de un CRUD en backoffice), usa resetCatalog().
   */
  loadCatalog(page = 1, limit = 200): void {
    if (this.catalogLoaded) return;
    this.http
      .get<PaginatedResponse>(`${this.apiUrl}/active?page=${page}&limit=${limit}`)
      .pipe(
        catchError((err) => {
          console.error('Error cargando catálogo:', err);
          return of({ data: [], total: 0, page: 1, limit });
        })
      )
      .subscribe((res) => {
        this._catalog$.next(res.data);
        this.catalogLoaded = true;
      });
  }

  /** Invalida el caché y vuelve a cargar el catálogo en la siguiente llamada. */
  resetCatalog(): void {
    this.catalogLoaded = false;
    this._catalog$.next([]);
    this.loadCatalog();
  }

  // ─── CONSULTAS PAGINADAS (para backoffice con filtros server-side) ──────────

  /**
   * Obtiene todos los productos (incluidos inactivos) con paginación.
   * Para uso exclusivo en el área de negocio/administración.
   */
  getProducts(
    page = 1,
    limit = 12,
    filters?: { category?: string; minPrice?: number; maxPrice?: number }
  ): Observable<PaginatedResponse> {
    let url = `${this.apiUrl}/all?page=${page}&limit=${limit}`;
    if (filters?.category) url += `&category=${filters.category}`;
    if (filters?.minPrice != null) url += `&minPrice=${filters.minPrice}`;
    if (filters?.maxPrice != null) url += `&maxPrice=${filters.maxPrice}`;
    return this.http.get<PaginatedResponse>(url).pipe(
      catchError((err) => {
        console.error('Error al obtener productos:', err);
        return of({ data: [], total: 0, page: 1, limit });
      })
    );
  }

  /** Obtiene solo productos activos con paginación (para listados públicos). */
  getActiveProducts(page = 1, limit = 12): Observable<PaginatedResponse> {
    return this.http
      .get<PaginatedResponse>(`${this.apiUrl}/active?page=${page}&limit=${limit}`)
      .pipe(
        catchError((err) => {
          console.error('Error al obtener productos activos:', err);
          return of({ data: [], total: 0, page: 1, limit });
        })
      );
  }

  // ─── CONSULTAS INDIVIDUALES ────────────────────────────────────────────────

  getProductById(productId: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${productId}`);
  }

  getProductByCode(code: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/code/${code}`);
  }

  getProductsByIds(ids: string[]): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/byIds?ids=${ids.join(',')}`);
  }

  getProductsByCategory(category: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/category/${encodeURIComponent(category)}`).pipe(
      catchError((err) => {
        console.error('Error al obtener productos por categoría:', err);
        return of([]);
      })
    );
  }

  searchByTags(tags: string[]): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/search?tags=${tags.join(',')}`).pipe(
      catchError((err) => {
        console.error('Error al buscar por tags:', err);
        return of([]);
      })
    );
  }

  getProductsByPriceRange(minPrice: number, maxPrice: number): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/price-range?minPrice=${minPrice}&maxPrice=${maxPrice}`).pipe(
      catchError((err) => {
        console.error('Error al obtener por rango de precio:', err);
        return of([]);
      })
    );
  }

  // ─── CRUD (backoffice) ─────────────────────────────────────────────────────

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}`, product).pipe(
      tap(() => this.resetCatalog()) // invalidar caché al crear
    );
  }

  /** Alias para compatibilidad */
  addProduct(product: Partial<Product>): Observable<Product> {
    return this.createProduct(product);
  }

  updateProduct(productId: string, updateData: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${productId}`, updateData).pipe(
      tap(() => this.resetCatalog()) // invalidar caché al editar
    );
  }

  deleteProduct(productId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${productId}`).pipe(
      tap(() => this.resetCatalog())
    );
  }

  hardDeleteProduct(productId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${productId}/hard`).pipe(
      tap(() => this.resetCatalog())
    );
  }
}
