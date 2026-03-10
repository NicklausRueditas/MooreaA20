import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  of,
  switchMap,
  take,
  tap,
  catchError,
  EMPTY,
  forkJoin,
  map,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { SesionService } from '../auth/sesion.service';
import {
  Basket,
  BasketItem,
  BasketApiResponse,
  AddToBasketDto,
} from '../../interfaces/basket.interface';

export interface BasketSummary {
  itemCount: number;
  totalQuantity: number;
  estimatedTotal: number;
}

export interface VariantCheck {
  variantId: string;
  isInBasket: boolean;
}

/** Snapshot mínimo de una variante para guardar en localStorage (guest) */
interface GuestVariantSnapshot {
  _id: string;
  sku?: string;
  color?: { name: string; hex: string; code: string };
  size?: { type: string; value: string; region?: string };
  gallery?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class BasketService {
  private readonly apiUrl = `${environment.apiUrl}/basket`;

  private readonly basketSubject = new BehaviorSubject<Basket | null>(null);
  readonly basket$ = this.basketSubject.asObservable();

  private readonly basketSummarySubject = new BehaviorSubject<BasketSummary>({
    itemCount: 0,
    totalQuantity: 0,
    estimatedTotal: 0,
  });
  readonly basketSummary$ = this.basketSummarySubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly sesionService: SesionService,
  ) {
    this.initializeBasket();
  }

  // ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────

  /**
   * Bifurcación autenticado / guest.
   * Toma un snapshot del user en ese instante (take(1)) para evitar dobles suscripciones.
   */
  private executeAsUserOrGuest<T>(
    authenticatedFn: () => Observable<T>,
    guestFn: () => Observable<T>
  ): Observable<T> {
    return this.sesionService.user$.pipe(
      take(1),
      switchMap((user) => (user ? authenticatedFn() : guestFn()))
    );
  }

  /**
   * Extrae el string ID de la variante desde cualquier formato de BasketItem:
   * - Backend nuevo: item.variantId (string)
   * - Guest localStorage: item.variant._id (objeto snapshot)
   * - Legacy localStorage: item.product._id
   */
  private getVariantId(item: any): string {
    if (!item) return `corrupted-${Math.random()}`;

    if (typeof item.variantId === 'string' && item.variantId) return item.variantId;
    if (item.variant?._id) return item.variant._id;
    if (item.variant?.id)  return item.variant.id;
    if (item.product?._id) return item.product._id;
    if (item.product?.id)  return item.product.id;

    return `corrupted-${Math.random()}`;
  }

  /** Estructura vacía para carrito guest (evita repetir boilerplate) */
  private buildGuestBasket(existing?: Basket | null): Basket {
    return existing ?? {
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** Persiste el carrito guest en localStorage y emite el nuevo estado */
  private saveAndEmitGuestBasket(basket: Basket): void {
    basket.updatedAt = new Date();
    basket.items = basket.items.filter(
      (i) => !this.getVariantId(i).startsWith('corrupted-')
    );
    localStorage.setItem('basket', JSON.stringify(basket));
    this.updateBasketState(basket);
  }

  /** Emite basket y recalcula el summary */
  private updateBasketState(basket: Basket | null): void {
    this.basketSubject.next(basket);
    this.calculateSummary(basket);
  }

  /**
   * Calcula el BasketSummary.
   * Para usuarios autenticados usa los totales ya calculados por el backend (totalAmount, etc.)
   * Para guests usa reduce() local (no hay precios del backend disponibles).
   */
  private calculateSummary(basket: Basket | null): void {
    if (!basket?.items?.length) {
      this.basketSummarySubject.next({ itemCount: 0, totalQuantity: 0, estimatedTotal: 0 });
      return;
    }
    this.basketSummarySubject.next({
      itemCount:      basket.totalItems    ?? basket.items.length,
      totalQuantity:  basket.totalQuantity ?? basket.items.reduce((s, i) => s + i.quantity, 0),
      estimatedTotal: basket.totalAmount   ?? basket.items.reduce((s, i) => s + (i.subtotal ?? i.finalPrice ?? 0) * i.quantity, 0),
    });
  }

  // ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────

  /**
   * Escucha cambios en el estado de sesión y carga el carrito adecuado.
   * Cuando el usuario inicia sesión se migra el carrito guest al backend.
   */
  private initializeBasket(): void {
    this.sesionService.user$
      .pipe(
        switchMap((user) =>
          user
            ? this.loadBackendBasket().pipe(
                switchMap(() => this.migrateLocalBasketIfExists())
              )
            : this.loadLocalBasket()
        )
      )
      .subscribe();
  }

  /**
   * GET /basket — formato unificado { items, summary } con precios calculados.
   * En caso de error (carrito no existe) hace fallback a initBackendBasket para crearlo.
   */
  private loadBackendBasket(): Observable<Basket> {
    return this.http.get<BasketApiResponse>(`${this.apiUrl}`).pipe(
      map((response) => {
        const s = response.summary;
        return {
          items:         response.items ?? [],
          totalItems:    s?.itemCount           ?? 0,
          totalQuantity: s?.totalQuantity       ?? 0,
          totalAmount:   s?.totalWithDiscount   ?? 0,
          totalSavings:  s?.totalSavings        ?? 0,
        } as Basket;
      }),
      tap((basket) => this.updateBasketState(basket)),
      catchError(() => this.initBackendBasket())
    );
  }

  /**
   * GET /basket/init — crea o inicializa el carrito en el backend.
   * Solo se usa como fallback (carrito no existe aún) o al registrar un usuario nuevo.
   * NO actualiza el estado visible porque devuelve el documento crudo sin precios.
   * Tras crearlo, recarga con loadBackendBasket para obtener los precios.
   */
  private initBackendBasket(): Observable<Basket> {
    return this.http.get<Basket>(`${this.apiUrl}/init`).pipe(
      switchMap(() => {
        // Re-cargamos con el endpoint enriquecido para tener precios
        return this.http.get<BasketApiResponse>(`${this.apiUrl}`).pipe(
          map((response) => {
            const s = response.summary;
            return {
              items:         response.items ?? [],
              totalItems:    s?.itemCount         ?? 0,
              totalQuantity: s?.totalQuantity     ?? 0,
              totalAmount:   s?.totalWithDiscount ?? 0,
              totalSavings:  s?.totalSavings      ?? 0,
            } as Basket;
          }),
          tap((basket) => this.updateBasketState(basket))
        );
      }),
      catchError((error) => {
        console.error('[BasketService] No se pudo inicializar el carrito:', error);
        this.updateBasketState(null);
        return EMPTY;
      })
    );
  }

  /** Carga el carrito guest desde localStorage y emite el estado */
  private loadLocalBasket(): Observable<void> {
    return of(void 0).pipe(
      tap(() => {
        const raw = localStorage.getItem('basket');
        if (!raw) {
          this.updateBasketState(this.buildGuestBasket());
          return;
        }
        try {
          let basket: Basket = JSON.parse(raw);
          basket = this.sanitizeLocalBasket(basket);
          this.updateBasketState(basket);
        } catch {
          localStorage.removeItem('basket');
          this.updateBasketState(this.buildGuestBasket());
        }
      })
    );
  }

  /**
   * Limpia y migra el formato del carrito localStorage:
   * - Convierte items legacy { product } al nuevo { variant }
   * - Filtra items sin variantId válido (corruptos)
   */
  private sanitizeLocalBasket(basket: Basket): Basket {
    basket.items = basket.items
      .map((item: any) => {
        // Convertir formato legacy: { product } → { variant }
        if (!item.variant && item.product) {
          return { ...item, variant: item.product, product: undefined };
        }
        return item;
      })
      .filter((item) => {
        const id = this.getVariantId(item);
        return !!id && !id.startsWith('corrupted-');
      });
    return basket;
  }

  /**
   * Tras iniciar sesión, migra los items del carrito guest al backend y borra localStorage.
   * Si no hay carrito local o está vacío, no hace nada.
   */
  private migrateLocalBasketIfExists(): Observable<void> {
    const raw = localStorage.getItem('basket');
    if (!raw) return of(void 0);

    let parsed: Basket;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localStorage.removeItem('basket');
      return of(void 0);
    }

    const validItems = (parsed.items ?? []).filter((item) => {
      const id = this.getVariantId(item);
      return !!id && !id.startsWith('corrupted-');
    });

    if (validItems.length === 0) {
      localStorage.removeItem('basket');
      return of(void 0);
    }

    // Enviar cada item al backend en paralelo (fallos individuales se ignoran)
    const requests = validItems.map((item) =>
      this.http
        .post(`${this.apiUrl}/add`, {
          variantId: this.getVariantId(item),
          quantity:  item.quantity,
        } as AddToBasketDto)
        .pipe(catchError(() => of(null)))
    );

    return forkJoin(requests).pipe(
      take(1),
      switchMap(() => {
        localStorage.removeItem('basket');
        // Recargar con precios actualizados después de la migración
        return this.loadBackendBasket().pipe(
          take(1),
          map(() => void 0),
          catchError(() => of(void 0))
        );
      })
    );
  }

  // ─── AGREGAR AL CARRITO ───────────────────────────────────────────────────────

  /**
   * Agrega una variante al carrito.
   * @param variantObj Objeto variante completo (o solo string ID)
   * @param quantity Cantidad a agregar
   * @param product Producto maestro (necesario para calcular finalPrice en guest)
   */
  addToBasket(
    variantObj: any,
    quantity: number = 1,
    product?: any
  ): Observable<Basket> {
    const variantId =
      typeof variantObj === 'string'
        ? variantObj
        : (variantObj?._id ?? variantObj?.id ?? '');

    return this.executeAsUserOrGuest(
      () => this.addToBackend(variantId, quantity),
      () => this.handleGuestAdd(variantObj, variantId, quantity, product)
    ).pipe(
      catchError((error) => {
        console.error('[BasketService] Error al agregar al carrito:', error);
        throw error;
      })
    );
  }

  private addToBackend(variantId: string, quantity: number): Observable<Basket> {
    return this.http
      .post(`${this.apiUrl}/add`, { variantId, quantity } as AddToBasketDto)
      .pipe(switchMap(() => this.loadBackendBasket()));
  }

  private handleGuestAdd(
    variantObj: any,
    variantId: string,
    quantity: number,
    product?: any
  ): Observable<Basket> {
    const basket = this.buildGuestBasket(this.basketSubject.value);

    const existingIdx = basket.items.findIndex(
      (item) => this.getVariantId(item) === variantId
    );

    if (existingIdx !== -1) {
      basket.items[existingIdx].quantity += quantity;
    } else {
      const snapshot = this.buildVariantSnapshot(variantObj, product);
      basket.items.push({
        variant:    snapshot.variant,
        product:    snapshot.product,
        quantity,
        finalPrice: snapshot.finalPrice,
      });
    }

    this.saveAndEmitGuestBasket(basket);
    return of(basket);
  }

  /** Construye un snapshot mínimo de variante + producto para localStorage */
  private buildVariantSnapshot(
    variantObj: any,
    product?: any
  ): { variant: GuestVariantSnapshot; product?: any; finalPrice?: number } {
    if (typeof variantObj !== 'object' || !variantObj) {
      return { variant: variantObj };
    }

    const variant: GuestVariantSnapshot = {
      _id:     variantObj._id,
      sku:     variantObj.sku,
      color:   variantObj.color,
      size:    variantObj.size,
      gallery: variantObj.gallery ?? product?.gallery,
    };

    const productSnapshot = product
      ? { _id: product._id, name: product.name, brand: product.brand, basePrice: product.basePrice, discount: product.discount }
      : undefined;

    const finalPrice = product
      ? product.basePrice + (variantObj.priceAdjustment ?? 0)
      : undefined;

    return { variant, product: productSnapshot, finalPrice };
  }

  // ─── ACTUALIZAR CANTIDAD ──────────────────────────────────────────────────────

  updateQuantity(variantId: string, quantity: number): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.updateQuantityBackend(variantId, quantity),
      () => this.handleGuestUpdate(variantId, quantity)
    );
  }

  private updateQuantityBackend(variantId: string, quantity: number): Observable<Basket> {
    return this.http
      .patch(`${this.apiUrl}/update/${variantId}`, { quantity })
      .pipe(switchMap(() => this.loadBackendBasket()));
  }

  adjustQuantity(variantId: string, change: number): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.adjustQuantityBackend(variantId, change),
      () => this.adjustQuantityGuest(variantId, change)
    );
  }

  private adjustQuantityBackend(variantId: string, change: number): Observable<Basket> {
    return this.http
      .patch(`${this.apiUrl}/adjust/${variantId}`, { change })
      .pipe(switchMap(() => this.loadBackendBasket()));
  }

  private adjustQuantityGuest(variantId: string, change: number): Observable<Basket> {
    const basket = this.basketSubject.value;
    if (!basket) throw new Error('No hay carrito activo');
    const item = basket.items.find((i) => this.getVariantId(i) === variantId);
    if (!item) throw new Error('Variante no encontrada en carrito');
    const newQty = item.quantity + change;
    return newQty <= 0
      ? this.removeFromBasket(variantId)
      : this.handleGuestUpdate(variantId, newQty);
  }

  private handleGuestUpdate(variantId: string, quantity: number): Observable<Basket> {
    const basket = this.basketSubject.value;
    if (!basket) throw new Error('No hay carrito activo');
    if (quantity <= 0) return this.handleGuestRemove(variantId);

    const idx = basket.items.findIndex((i) => this.getVariantId(i) === variantId);
    if (idx === -1) throw new Error('Variante no encontrada en carrito');

    basket.items[idx].quantity = quantity;
    this.saveAndEmitGuestBasket(basket);
    return of(basket);
  }

  // ─── ELIMINAR DEL CARRITO ─────────────────────────────────────────────────────

  removeFromBasket(variantId: string): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.removeFromBackend(variantId),
      () => this.handleGuestRemove(variantId)
    );
  }

  private removeFromBackend(variantId: string): Observable<Basket> {
    return this.http
      .delete(`${this.apiUrl}/remove/${variantId}`)
      .pipe(switchMap(() => this.loadBackendBasket()));
  }

  private handleGuestRemove(variantId: string): Observable<Basket> {
    const basket = this.basketSubject.value;
    if (!basket) throw new Error('No hay carrito activo');
    basket.items = basket.items.filter((i) => this.getVariantId(i) !== variantId);
    this.saveAndEmitGuestBasket(basket);
    return of(basket);
  }

  // ─── VACIAR CARRITO ───────────────────────────────────────────────────────────

  clearBasket(): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.clearBackendBasket(),
      () => this.clearGuestBasket()
    );
  }

  private clearBackendBasket(): Observable<Basket> {
    return this.http
      .delete(`${this.apiUrl}/clear`)
      .pipe(switchMap(() => this.loadBackendBasket()));
  }

  private clearGuestBasket(): Observable<Basket> {
    localStorage.removeItem('basket');
    const empty = this.buildGuestBasket();
    this.updateBasketState(empty);
    return of(empty);
  }

  // ─── VERIFICAR EN CARRITO ────────────────────────────────────────────────────

  checkVariantInBasket(variantId: string): Observable<VariantCheck> {
    return this.executeAsUserOrGuest(
      () => this.http.get<VariantCheck>(`${this.apiUrl}/check/${variantId}`),
      () => {
        const basket = this.basketSubject.value;
        const isInBasket =
          basket?.items.some((i) => this.getVariantId(i) === variantId) ?? false;
        return of({ variantId, isInBasket });
      }
    );
  }

  // ─── REFRESH / ACCESO PÚBLICO ─────────────────────────────────────────────────

  /** Recarga el carrito completo desde la fuente correcta (backend o localStorage) */
  refreshBasket(): Observable<Basket | null> {
    return this.sesionService.user$.pipe(
      take(1),
      switchMap((user) => {
        if (user) return this.loadBackendBasket();
        this.loadLocalBasket().subscribe();
        return this.basket$.pipe(take(1));
      })
    );
  }

  /** Devuelve el carrito completo actual como observable (una sola emisión) */
  getFullBasket(): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.loadBackendBasket(),
      () => of(this.basketSubject.value ?? this.buildGuestBasket())
    );
  }

  /** Elimina del estado local los ítems con IDs corruptos (solo modo guest) */
  cleanupCorruptedItems(): void {
    const basket = this.basketSubject.value;
    if (!basket) return;

    const clean = basket.items.filter(
      (i) => !this.getVariantId(i).startsWith('corrupted-')
    );
    if (clean.length === basket.items.length) return;

    basket.items = clean;
    // Solo persiste en localStorage si es carrito guest
    if (!basket._id || basket._id === 'guest-basket') {
      localStorage.setItem('basket', JSON.stringify(basket));
    }
    this.updateBasketState(basket);
  }
}
