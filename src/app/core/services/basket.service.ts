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
  finalize,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import { SesionService } from './sesion.service';
import { ProductsService } from './products.service';
import { Basket, BasketItem } from '../interfaces/basket.interface';
import { Product } from '../interfaces/product.interface';

export interface BasketSummary {
  itemCount: number;
  totalQuantity: number;
  estimatedTotal: number;
}

export interface ProductCheck {
  productId: string;
  isInBasket: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class BasketService {
  private readonly apiUrl = `${environment.apiUrl}/basket`;

  // Subject para el carrito completo
  private basketSubject = new BehaviorSubject<Basket | null>(null);
  basket$ = this.basketSubject.asObservable();

  // Subject para el resumen del carrito
  private basketSummarySubject = new BehaviorSubject<BasketSummary>({
    itemCount: 0,
    totalQuantity: 0,
    estimatedTotal: 0,
  });
  basketSummary$ = this.basketSummarySubject.asObservable();

  // Subject para los productos del carrito (con detalles)
  private basketProductsSubject = new BehaviorSubject<Product[]>([]);
  basketProducts$ = this.basketProductsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private sesionService: SesionService,
    private productsService: ProductsService
  ) {
    this.initializeBasket();
  }

  // --- HELPERS ---

  /**
   * 🔧 HELPER: EJECUTAR ACCIÓN SEGÚN AUTENTICACIÓN
   * Centraliza la lógica de bifurcación entre usuario autenticado y guest.
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
   * 🔧 HELPER: OBTENER ID DEL PRODUCTO NORMALIZADO
   * Maneja si item.product es string o objeto con _id.
   */
  private getProductId(item: BasketItem): string {
    return typeof item.product === 'string' ? item.product : item.product._id;
  }

  /**
   * 🔧 HELPER: ACTUALIZAR ESTADO DEL CARRITO
   * Centraliza la actualización de subjects después de cambios.
   */
  private updateBasketState(
    basket: Basket | null,
    isLocal: boolean = false
  ): void {
    this.basketSubject.next(basket);
    this.extractAndLoadProducts(basket);
    if (isLocal) {
      this.calculateLocalSummary();
    } else {
      this.loadBasketSummary();
    }
  }

  /**
   * 🔄 INICIALIZAR CARRITO
   * Se ejecuta al iniciar el servicio y cuando cambia el estado de autenticación
   */
  private initializeBasket(): void {
    this.sesionService.user$
      .pipe(
        switchMap((user) => {
          if (user) {
            // Usuario autenticado: Cargar carrito del backend
            return this.loadBackendBasket().pipe(
              switchMap(() => this.migrateLocalBasketIfExists())
            );
          } else {
            // Usuario no autenticado: Cargar carrito local
            return this.loadLocalBasket();
          }
        })
      )
      .subscribe();
  }

  /**
   * 📦 CARGAR CARRITO DESDE BACKEND
   * Usa JWT para autenticación (token se envía automáticamente)
   */
  private loadBackendBasket(): Observable<Basket> {
    return this.http.get<Basket>(`${this.apiUrl}/init`).pipe(
      tap((basket) => {
        this.applyBasket(basket, false);
      }),
      catchError((error) => {
        console.error('Error al cargar carrito del backend:', error);
        // Reiniciar estado si falla
        this.applyBasket(null, true);
        return EMPTY;
      })
    );
  }

  /**
   * 💾 CARGAR CARRITO LOCAL (GUEST)
   */
  private loadLocalBasket(): Observable<void> {
    return of(void 0).pipe(
      tap(() => {
        const localBasket = localStorage.getItem('basket');
        if (localBasket) {
          const basket = JSON.parse(localBasket);
          this.applyBasket(basket, true);
        } else {
          this.applyBasket(null, true);
        }
      })
    );
  }

  /**
   * 🔄 MIGRAR CARRITO LOCAL A BACKEND
   * Migra productos del localStorage al backend cuando el usuario inicia sesión
   */
  private migrateLocalBasketIfExists(): Observable<void> {
    const localBasket = localStorage.getItem('basket');
    if (!localBasket) return of(void 0);

    const parsedBasket = JSON.parse(localBasket);
    if (!parsedBasket.items || parsedBasket.items.length === 0) {
      localStorage.removeItem('basket');
      return of(void 0);
    }

    // Crear un array de observables para migrar cada producto
    const migrationRequests = parsedBasket.items.map(
      (item: any) =>
        this.http
          .post(`${this.apiUrl}/add`, {
            productId: item.product,
            quantity: item.quantity,
          })
          .pipe(catchError(() => of(null))) // Ignorar errores individuales pero continuar
    );

    // Ejecutar todas las migraciones y luego refrescar el carrito desde el backend
    return forkJoin(migrationRequests).pipe(
      take(1),
      switchMap(() => {
        localStorage.removeItem('basket');
        // Refrescar el carrito desde el backend para obtener el estado actualizado
        return this.loadBackendBasket().pipe(
          take(1),
          map(() => void 0),
          catchError(() => of(void 0))
        );
      })
    );
  }

  /**
   * 🛍️ AGREGAR PRODUCTO AL CARRITO
   */
  addToBasket(productId: string, quantity: number = 1): Observable<Basket> {
    return this.sesionService.ensureProfileLoaded().pipe(
      take(1),
      switchMap((user) => {
        return this.executeAsUserOrGuest(
          () => this.addToBackend(productId, quantity),
          () => this.handleGuestAdd(productId, quantity)
        );
      }),
      catchError((error) => {
        console.error('Error al agregar al carrito:', error);
        throw error;
      })
    );
  }

  /**
   * 🛍️ AGREGAR AL BACKEND (USUARIO AUTENTICADO)
   */
  private addToBackend(
    productId: string,
    quantity: number
  ): Observable<Basket> {
    return this.http
      .post<Basket>(`${this.apiUrl}/add`, { productId, quantity })
      .pipe(tap((basket) => this.updateBasketState(basket)));
  }

  /**
   * 🛍️ MANEJAR AGREGADO PARA GUEST
   */
  private handleGuestAdd(
    productId: string,
    quantity: number
  ): Observable<Basket> {
    return this.productsService.getProductById(productId).pipe(
      take(1),
      switchMap((product) => {
        if (!product) throw new Error('Producto no encontrado');

        let basket = this.basketSubject.value;

        if (!basket) {
          basket = {
            _id: 'guest-basket',
            userId: 'guest',
            items: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            __v: 0,
          };
        }

        // Buscar si el producto ya está en el carrito
        const existingItemIndex = basket.items.findIndex(
          (item) =>
            (typeof item.product === 'string'
              ? item.product
              : item.product._id) === productId
        );

        if (existingItemIndex !== -1) {
          // Actualizar cantidad existente
          basket.items[existingItemIndex].quantity += quantity;
        } else {
          // Agregar nuevo producto
          basket.items.push({
            product: productId,
            quantity,
          });
        }

        basket.updatedAt = new Date();

        // Guardar en localStorage
        localStorage.setItem('basket', JSON.stringify(basket));

        // Actualizar subjects (helper)
        this.applyBasket(basket, true);

        return of(basket);
      })
    );
  }

  /**
   * ✏️ ACTUALIZAR CANTIDAD DE PRODUCTO
   */
  updateQuantity(productId: string, quantity: number): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.updateQuantityBackend(productId, quantity),
      () => this.handleGuestUpdate(productId, quantity)
    );
  }

  /**
   * ✏️ ACTUALIZAR CANTIDAD EN BACKEND
   */
  private updateQuantityBackend(
    productId: string,
    quantity: number
  ): Observable<Basket> {
    return this.http
      .patch<Basket>(`${this.apiUrl}/update/${productId}`, { quantity })
      .pipe(tap((basket) => this.updateBasketState(basket)));
  }

  /**
   * 🔢 AJUSTAR CANTIDAD (+/-)
   */
  adjustQuantity(productId: string, change: number): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.adjustQuantityBackend(productId, change),
      () => this.adjustQuantityGuest(productId, change)
    );
  }

  /**
   * 🔢 AJUSTAR CANTIDAD EN BACKEND
   */
  private adjustQuantityBackend(
    productId: string,
    change: number
  ): Observable<Basket> {
    return this.http
      .patch<Basket>(`${this.apiUrl}/adjust/${productId}`, { change })
      .pipe(tap((basket) => this.updateBasketState(basket)));
  }

  /**
   * 🔢 AJUSTAR CANTIDAD PARA GUEST
   */
  private adjustQuantityGuest(
    productId: string,
    change: number
  ): Observable<Basket> {
    const basket = this.basketSubject.value;
    if (!basket) throw new Error('No hay carrito');

    const item = basket.items.find((i) => this.getProductId(i) === productId);
    if (!item) throw new Error('Producto no encontrado en carrito');

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
      return this.removeFromBasket(productId);
    } else {
      return this.updateQuantity(productId, newQuantity);
    }
  }

  /**
   * ✏️ MANEJAR ACTUALIZACIÓN PARA GUEST
   */
  private handleGuestUpdate(
    productId: string,
    quantity: number
  ): Observable<Basket> {
    const basket = this.basketSubject.value;
    if (!basket) throw new Error('No hay carrito');

    const itemIndex = basket.items.findIndex(
      (item) =>
        (typeof item.product === 'string' ? item.product : item.product._id) ===
        productId
    );

    if (itemIndex === -1) throw new Error('Producto no encontrado en carrito');

    if (quantity <= 0) {
      // Eliminar producto si cantidad es 0 o negativa
      return this.handleGuestRemove(productId);
    }

    // Actualizar cantidad
    basket.items[itemIndex].quantity = quantity;
    basket.updatedAt = new Date();

    // Guardar en localStorage
    localStorage.setItem('basket', JSON.stringify(basket));

    // Actualizar subjects (helper)
    this.applyBasket(basket, true);

    return of(basket);
  }

  /**
   * 🗑️ ELIMINAR PRODUCTO DEL CARRITO
   */
  removeFromBasket(productId: string): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.removeFromBackend(productId),
      () => this.handleGuestRemove(productId)
    );
  }

  /**
   * 🗑️ ELIMINAR DEL BACKEND
   */
  private removeFromBackend(productId: string): Observable<Basket> {
    return this.http
      .delete<Basket>(`${this.apiUrl}/remove/${productId}`)
      .pipe(tap((basket) => this.updateBasketState(basket)));
  }

  /**
   * 🗑️ MANEJAR ELIMINACIÓN PARA GUEST
   */
  private handleGuestRemove(productId: string): Observable<Basket> {
    const basket = this.basketSubject.value;
    if (!basket) throw new Error('No hay carrito');

    const initialLength = basket.items.length;
    basket.items = basket.items.filter(
      (item) => this.getProductId(item) !== productId
    );

    if (basket.items.length === initialLength) {
      throw new Error('Producto no encontrado en carrito');
    }

    basket.updatedAt = new Date();

    // Guardar en localStorage
    localStorage.setItem('basket', JSON.stringify(basket));

    // Actualizar subjects
    this.updateBasketState(basket, true);

    return of(basket);
  }

  /**
   * 🧹 VACIAR CARRITO
   */
  clearBasket(): Observable<Basket> {
    return this.executeAsUserOrGuest(
      () => this.clearBackendBasket(),
      () => this.clearGuestBasket()
    );
  }

  /**
   * 🧹 VACIAR CARRITO EN BACKEND
   */
  private clearBackendBasket(): Observable<Basket> {
    return this.http.delete<Basket>(`${this.apiUrl}/clear`).pipe(
      tap((basket) => {
        this.basketSubject.next(basket);
        this.basketProductsSubject.next([]);
        this.basketSummarySubject.next({
          itemCount: 0,
          totalQuantity: 0,
          estimatedTotal: 0,
        });
      })
    );
  }

  /**
   * 🧹 VACIAR CARRITO PARA GUEST
   */
  private clearGuestBasket(): Observable<Basket> {
    localStorage.removeItem('basket');
    this.updateBasketState(null, true);
    return of({
      _id: 'guest-basket',
      userId: 'guest',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    });
  }

  /**
   * ✅ VERIFICAR SI PRODUCTO ESTÁ EN CARRITO
   */
  checkProductInBasket(productId: string): Observable<ProductCheck> {
    return this.executeAsUserOrGuest(
      () => this.checkProductBackend(productId),
      () => this.checkProductGuest(productId)
    );
  }

  /**
   * ✅ VERIFICAR EN BACKEND
   */
  private checkProductBackend(productId: string): Observable<ProductCheck> {
    return this.http.get<ProductCheck>(`${this.apiUrl}/check/${productId}`);
  }

  /**
   * ✅ VERIFICAR PARA GUEST
   */
  private checkProductGuest(productId: string): Observable<ProductCheck> {
    const basket = this.basketSubject.value;
    const isInBasket =
      basket?.items.some((item) => this.getProductId(item) === productId) ||
      false;
    return of({ productId, isInBasket });
  }

  /**
   * 📊 CARGAR RESUMEN DEL CARRITO
   */
  loadBasketSummary(): void {
    this.http
      .get<BasketSummary>(`${this.apiUrl}/summary`)
      .pipe(
        take(1),
        tap((summary) => this.basketSummarySubject.next(summary)),
        catchError(() => {
          // Si falla, calcular desde el carrito local
          this.calculateLocalSummary();
          return EMPTY;
        })
      )
      .subscribe();
  }

  /**
   * � HELPER: APLICAR UN BASKET A LOS SUBJECTS
   * Centraliza la lógica común de actualización de estado del carrito.
   * Si `isLocal` es true, calcula el resumen local; en caso contrario intenta
   * cargar el resumen desde el backend.
   */
  private applyBasket(basket: Basket | null, isLocal: boolean = false): void {
    this.basketSubject.next(basket);
    this.extractAndLoadProducts(basket);
    if (isLocal) {
      this.calculateLocalSummary();
    } else {
      this.loadBasketSummary();
    }
  }

  /**
   * �📦 EXTRAER Y CARGAR PRODUCTOS DEL CARRITO
   */
  private extractAndLoadProducts(basket: Basket | null): void {
    if (!basket || !basket.items || basket.items.length === 0) {
      this.basketProductsSubject.next([]);
      return;
    }

    const productIds = basket.items.map((item) => this.getProductId(item));

    this.productsService
      .getProductsByIds(productIds)
      .pipe(
        take(1),
        tap((products) => this.basketProductsSubject.next(products)),
        catchError((error) => {
          console.error('Error al cargar productos del carrito:', error);
          return of([]);
        })
      )
      .subscribe();
  }
  /**
   * 🧮 CALCULAR RESUMEN LOCAL
   */
  private calculateLocalSummary(): void {
    const basket = this.basketSubject.value;
    if (!basket || !basket.items) {
      this.basketSummarySubject.next({
        itemCount: 0,
        totalQuantity: 0,
        estimatedTotal: 0,
      });
      return;
    }

    // Calcular desde productos cargados si están disponibles
    const products = this.basketProductsSubject.value;
    let estimatedTotal = 0;

    if (products.length > 0) {
      estimatedTotal = basket.items.reduce((total, item) => {
        const product = products.find((p) => p._id === this.getProductId(item));
        if (product) {
          const price = product.price || 0;
          const discount = product.discount || 0;
          const finalPrice = price * (1 - discount / 100);
          return total + finalPrice * item.quantity;
        }
        return total;
      }, 0);
    }

    const totalQuantity = basket.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    this.basketSummarySubject.next({
      itemCount: basket.items.length,
      totalQuantity,
      estimatedTotal,
    });
  }

  /**
   * 🔄 REFRESCAR CARRITO
   * Útil para sincronizar después de cambios externos
   */
  refreshBasket(): Observable<Basket | null> {
    return this.sesionService.user$.pipe(
      take(1),
      switchMap((user) => {
        if (user) {
          return this.loadBackendBasket();
        } else {
          this.loadLocalBasket().subscribe();
          return this.basket$.pipe(take(1));
        }
      })
    );
  }

  /**
   * Nota: los accesos sincrónicos directos han sido eliminados.
   * Use los observables públicos `basket$`, `basketSummary$` y `basketProducts$`
   * para obtener el estado actual o `refreshBasket()` cuando sea necesario.
   */
}
