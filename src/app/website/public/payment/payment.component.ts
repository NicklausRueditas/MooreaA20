import { Component, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of, finalize, forkJoin } from 'rxjs';

import { BasketService } from '../../../core/services/commerce/basket.service';
import { AddressService } from '../../../core/services/utils/address.service';
import { CardService } from '../../../core/services/ui/card.service';
import { StoresService } from '../../../core/services/catalog/stores.service';
import { ConfigService } from '../../../core/services/utils/config.service';
import { OrderService } from '../../../core/services/commerce/order.service';
import { AddressModalComponent } from '../../../shared/components/address-modal/address-modal.component';
import { CardModalComponent } from '../../../shared/components/card-modal/card-modal.component';

import { Basket, BasketItem } from '../../../core/interfaces/basket.interface';
import { AddressData } from '../../../core/interfaces/address.interface';
import { Card } from '../../../core/interfaces/card.interface';
import { Store } from '../../../core/interfaces/store.interface';
import { CreateOrderDto, OrderPaymentMethod } from '../../../core/interfaces/order.interface';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';

export type CheckoutStep    = 'address' | 'payment' | 'review';
export type ItemDelivery    = 'delivery' | 'pickup';
export type PaymentMethod   = 'card' | 'yape' | 'cash';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AddressModalComponent,
    CardModalComponent,
    SolCurrencyPipe,
  ],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
})
export class PaymentComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ─── Paso actual ──────────────────────────────────────────────────────────
  currentStep = signal<CheckoutStep>('address');
  readonly steps: CheckoutStep[] = ['address', 'payment', 'review'];

  // ─── Carrito ──────────────────────────────────────────────────────────────
  basket: Basket | null = null;
  isLoadingBasket = false;

  // ─── Entrega por producto ─────────────────────────────────────────────────
  /** Modo de entrega por variantId */
  itemDeliveryModes = new Map<string, ItemDelivery>();
  /** Tienda seleccionada por variantId (para recojo) */
  itemPickupStores  = new Map<string, Store>();
  /** Controla si el panel de tiendas está expandido por item */
  itemStorePickerOpen = new Map<string, boolean>();

  // ─── Tiendas ──────────────────────────────────────────────────────────────
  stores: Store[] = [];
  isLoadingStores = false;
  userLat: number | null = null;
  userLng: number | null = null;

  // ─── Direcciones ──────────────────────────────────────────────────────────
  addresses: AddressData[] = [];
  selectedAddress: AddressData | null = null;
  isLoadingAddresses = false;
  showAddressModal = false;
  googleMapsApiKey = '';

  // ─── Pago ─────────────────────────────────────────────────────────────────
  cards: Card[] = [];
  selectedCard: Card | null = null;
  paymentMethod = signal<PaymentMethod>('card');
  isLoadingCards = false;
  showCardModal = false;

  // ─── Confirmación ─────────────────────────────────────────────────────────
  isProcessingOrder = false;
  orderError: string | null = null;
  acceptedTerms = false;

  constructor(
    private readonly basketService: BasketService,
    private readonly addressService: AddressService,
    private readonly cardService: CardService,
    private readonly storesService: StoresService,
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadBasket();
    this.basketService.refreshBasket().pipe(takeUntil(this.destroy$)).subscribe();
    this.loadAddresses();
    this.loadCards();
    this.loadStores();
    this.getUserLocation();
    this.configService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        if (config) this.googleMapsApiKey = config.googleMapsApiKey;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Helpers para identificar item ───────────────────────────────────────

  getItemKey(item: any): string {
    if (!item) return '';
    if (typeof item.variantId === 'string' && item.variantId) return item.variantId;
    if (item.variantId?._id) return String(item.variantId._id);
    if (item.variant?._id) return String(item.variant._id);
    if (item.variant?.id) return String(item.variant.id);
    if (item.productId?._id) return String(item.productId._id);
    if (item.product?._id) return String(item.product._id);
    if (item._id) return String(item._id);
    return '';
  }

  // ─── Navegación ───────────────────────────────────────────────────────────

  goToStep(step: CheckoutStep): void {
    this.currentStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Información de cuotas sin interés para el checkout */
  get installmentInfo(): { count: number; amount: number } | null {
    const total = this.totalOrder;
    if (total < 500) return null;
    let count = 3;
    if (total >= 2000) count = 24;
    else if (total >= 1000) count = 12;
    return {
      count,
      amount: parseFloat((total / count).toFixed(2))
    };
  }

  getItemColorHex(item: any): string | null {
    const v = (item as any)?.variant;
    return v?.color?.hex ?? null;
  }

  get stepIndex(): number { return this.steps.indexOf(this.currentStep()); }

  get canContinueFromAddress(): boolean {
    // Si hay items de delivery: se necesita dirección
    const deliveryOk = !this.hasDeliveryItems() || !!this.selectedAddress;
    // Cada item de pickup necesita tienda seleccionada
    const pickupOk = this.basketItems
      .filter(i => this.getItemDeliveryMode(i) === 'pickup')
      .every(i => !!this.getItemPickupStore(i));
    return deliveryOk && pickupOk;
  }

  get canContinueFromPayment(): boolean {
    return (
      (this.paymentMethod() === 'card' && !!this.selectedCard) ||
      this.paymentMethod() === 'yape' ||
      this.paymentMethod() === 'cash'
    );
  }

  continueToPayment(): void {
    if (!this.canContinueFromAddress) return;
    this.goToStep('payment');
  }

  continueToReview(): void {
    if (!this.canContinueFromPayment) return;
    this.goToStep('review');
  }

  backToAddress(): void { this.goToStep('address'); }
  backToPayment(): void { this.goToStep('payment'); }

  // ─── Carrito ──────────────────────────────────────────────────────────────

  private loadBasket(): void {
    this.isLoadingBasket = true;
    let basketLoaded = false;
    this.basketService.basket$
      .pipe(takeUntil(this.destroy$))
      .subscribe((basket) => {
        this.basket = basket;
        if (basket !== null) {
          this.isLoadingBasket = false;
          // Inicializa modos de entrega si no estaban
          basket.items.forEach(item => {
            const key = this.getItemKey(item);
            if (key && !this.itemDeliveryModes.has(key)) {
              this.itemDeliveryModes.set(key, 'delivery');
            }
          });
          if (basketLoaded && basket.items.length === 0) {
            this.router.navigate(['/basket']);
          }
          basketLoaded = true;
        }
      });
  }

  get basketItems(): BasketItem[] {
    return this.basket?.items ?? [];
  }

  /** Cantidad total de unidades de productos en el carrito */
  get totalItemCount(): number {
    const items = this.basketItems;
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }

  /** Precio unitario seguro por ítem */
  getItemUnitPrice(item: any): number {
    if (!item) return 0;
    const price = item.finalPrice ?? item.price ?? item.variant?.finalPrice ?? item.variant?.price ?? item.product?.basePrice ?? 0;
    return Number(price) || 0;
  }

  /** Subtotal seguro por ítem (precio unitario * cantidad) */
  getItemSubtotal(item: any): number {
    if (!item) return 0;
    if (item.subtotal != null && Number(item.subtotal) > 0) {
      return Number(item.subtotal);
    }
    const unitPrice = this.getItemUnitPrice(item);
    const qty = Number(item.quantity) || 1;
    return unitPrice * qty;
  }

  getVariant(item: BasketItem): any  { return item.variant ?? null; }
  getProduct(item: BasketItem): any  { return item.product ?? null; }
  getThumbnail(item: BasketItem): string { return item.variant?.gallery?.[0] ?? (item as any)?.product?.gallery?.[0] ?? ''; }
  getProductName(item: BasketItem): string { return item.product?.name ?? item.variant?.sku ?? 'Producto'; }
  getColorLabel(item: BasketItem): string  { return item.variant?.color?.name ?? ''; }
  getSizeLabel(item: BasketItem): string   { return item.variant?.size?.value ?? ''; }

  /** Subtotal general calculado de forma directa sumando cada línea del carrito */
  get subtotalAmount(): number {
    const items = this.basketItems;
    if (!items || items.length === 0) {
      return Number(this.basket?.totalAmount) || 0;
    }
    const total = items.reduce((sum, item) => sum + this.getItemSubtotal(item), 0);
    return total > 0 ? total : (Number(this.basket?.totalAmount) || 0);
  }

  /** Descuentos totales calculados */
  get savingsAmount(): number {
    if (this.basket?.totalSavings != null && Number(this.basket.totalSavings) > 0) {
      return Number(this.basket.totalSavings);
    }
    const items = this.basketItems;
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const base = Number(item?.product?.basePrice ?? 0);
      const final = this.getItemUnitPrice(item);
      if (base > final) {
        return sum + ((base - final) * (Number(item.quantity) || 1));
      }
      return sum;
    }, 0);
  }

  /**
   * Cálculo dinámico del costo de envío basado en reglas de negocio de Moorea:
   * 1. Si no hay items con delivery (todos en recojo en tienda) -> S/ 0.00
   * 2. Si el subtotal es >= S/ 200 -> Envío GRATIS (S/ 0.00)
   * 3. Si es < S/ 200 -> Tarifa según la distancia estimada a la tienda más cercana
   */
  get deliveryCost(): number {
    // Si todos los productos están configurados en 'pickup' (recojo en tienda), costo = 0
    if (!this.hasDeliveryItems()) {
      return 0;
    }

    // Si el subtotal califica para envío gratis (>= S/ 200)
    if (this.subtotalAmount >= 200) {
      return 0;
    }

    // Tarifa calculada según la distancia física a la tienda
    const minDistance = this.getMinDeliveryDistance();
    if (minDistance !== null) {
      if (minDistance <= 5) return 5.00;
      if (minDistance <= 15) return 7.50;
      if (minDistance <= 30) return 10.00;
      return 15.00;
    }

    return 7.50; // Tarifa estándar por defecto para delivery local
  }

  /** Obtiene la distancia mínima en km hacia las tiendas que despachan */
  private getMinDeliveryDistance(): number | null {
    if (this.userLat == null || this.userLng == null || !this.stores?.length) return null;
    let min = Infinity;
    for (const store of this.stores) {
      const coords = store.location?.coordinates?.coordinates;
      if (coords && coords.length >= 2) {
        const d = this.calcDistance(this.userLat, this.userLng, coords[1], coords[0]);
        if (d < min) min = d;
      }
    }
    return min === Infinity ? null : min;
  }

  /** Total final de la orden (Subtotal + Costo de Envío) */
  get totalOrder(): number {
    const subtotal = Number(this.subtotalAmount) || 0;
    const shipping = Number(this.deliveryCost) || 0;
    return parseFloat((subtotal + shipping).toFixed(2));
  }

  // ─── Entrega por producto ─────────────────────────────────────────────────

  getItemDeliveryMode(item: BasketItem): ItemDelivery {
    return this.itemDeliveryModes.get(this.getItemKey(item)) ?? 'delivery';
  }

  setItemDeliveryMode(item: BasketItem, mode: ItemDelivery): void {
    const key = this.getItemKey(item);
    this.itemDeliveryModes.set(key, mode);
    if (mode === 'delivery') {
      this.itemPickupStores.delete(key);
      this.itemStorePickerOpen.delete(key);
    } else if (mode === 'pickup') {
      // 🎯 Auto-seleccionar automáticamente la tienda más cercana disponible
      if (!this.itemPickupStores.has(key) && this.stores.length > 0) {
        const closestStore = this.findClosestStore();
        if (closestStore) {
          this.itemPickupStores.set(key, closestStore);
        }
      }
    }
    this.cdr.markForCheck();
  }

  /** Encuentra la tienda física más cercana a las coordenadas del usuario */
  private findClosestStore(): Store | null {
    if (!this.stores.length) return null;
    if (this.userLat == null || this.userLng == null) return this.stores[0];

    let closest: Store = this.stores[0];
    let minDistance = Infinity;

    for (const store of this.stores) {
      const coords = store.location?.coordinates?.coordinates;
      if (coords && coords.length >= 2) {
        const dist = this.calcDistance(this.userLat, this.userLng, coords[1], coords[0]);
        if (dist < minDistance) {
          minDistance = dist;
          closest = store;
        }
      }
    }
    return closest;
  }

  hasDeliveryItems(): boolean {
    return this.basketItems.some(i => this.getItemDeliveryMode(i) === 'delivery');
  }

  hasPickupItems(): boolean {
    return this.basketItems.some(i => this.getItemDeliveryMode(i) === 'pickup');
  }

  // ─── Tiendas / Recojo ─────────────────────────────────────────────────────

  private loadStores(): void {
    this.isLoadingStores = true;
    this.storesService.getActiveStores()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([] as Store[])),
        finalize(() => { this.isLoadingStores = false; })
      )
      .subscribe(stores => {
        this.stores = stores;
        // Auto-asignar tienda más cercana a items que ya estén en pickup
        this.basketItems.forEach(item => {
          const key = this.getItemKey(item);
          if (this.getItemDeliveryMode(item) === 'pickup' && !this.itemPickupStores.has(key)) {
            const closest = this.findClosestStore();
            if (closest) this.itemPickupStores.set(key, closest);
          }
        });
      });
  }

  getItemPickupStore(item: BasketItem): Store | null {
    return this.itemPickupStores.get(this.getItemKey(item)) ?? null;
  }

  setItemPickupStore(item: BasketItem, store: Store): void {
    const key = this.getItemKey(item);
    this.itemPickupStores.set(key, store);
    this.itemStorePickerOpen.set(key, false);
    this.cdr.markForCheck();
  }

  isStorePickerOpen(item: BasketItem): boolean {
    return this.itemStorePickerOpen.get(this.getItemKey(item)) ?? false;
  }

  toggleStorePicker(item: BasketItem): void {
    const key = this.getItemKey(item);
    this.itemStorePickerOpen.set(key, !this.itemStorePickerOpen.get(key));
  }

  /** Haversine distance formula (km) */
  calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Calcula la distancia en km entre el usuario y la tienda.
   * Usa las coordenadas de store.location.coordinates [lng, lat].
   */
  getStoreDistance(store: Store): string {
    if (this.userLat == null || this.userLng == null) return '—';
    const coords = store.location?.coordinates?.coordinates;
    if (!coords) return '—';
    const km = this.calcDistance(this.userLat, this.userLng, coords[1], coords[0]);
    return `${km} km`;
  }

  /**
   * Devuelve la tienda más cercana al usuario (por Haversine).
   * Fallback: primera tienda si no hay geolocalización o coordenadas.
   */
  getNearestStore(): Store | null {
    if (!this.stores.length) return null;
    if (this.userLat == null || this.userLng == null) return this.stores[0];
    return this.stores.reduce((nearest, store) => {
      const cS = store.location?.coordinates?.coordinates;
      const cN = nearest.location?.coordinates?.coordinates;
      if (!cS) return nearest;
      if (!cN) return store;
      const d  = this.calcDistance(this.userLat!, this.userLng!, cS[1], cS[0]);
      const dN = this.calcDistance(this.userLat!, this.userLng!, cN[1], cN[0]);
      return d < dN ? store : nearest;
    });
  }

  /** Solicitar geolocalización del navegador */
  private getUserLocation(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLat = pos.coords.latitude;
          this.userLng = pos.coords.longitude;
        },
        () => {} // sin error visible
      );
    }
  }

  // ─── Fechas estimadas ─────────────────────────────────────────────────────

  /** Siguiente día hábil (excluye sábado y domingo) */
  private nextBusinessDays(daysToAdd: number): Date {
    const d = new Date();
    let added = 0;
    while (added < daysToAdd) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }
    return d;
  }

  get pickupDateLabel(): string {
    return this.nextBusinessDays(1).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  get deliveryDateLabel(): string {
    return this.nextBusinessDays(3).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  // ─── Direcciones ──────────────────────────────────────────────────────────

  private loadAddresses(): void {
    this.isLoadingAddresses = true;
    this.addressService.getUserAddresses()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
        finalize(() => { this.isLoadingAddresses = false; })
      )
      .subscribe((res) => {
        if (!res) return;
        const list: AddressData[] = (res as any).addresses ?? (res as any).address ?? [];
        this.addresses = list;
        this.selectedAddress = list.find(a => a.isDefault) ?? list[0] ?? null;
      });
  }

  selectAddress(address: AddressData): void { this.selectedAddress = address; }


  /** Llamado cuando el AddressModalComponent guarda una nueva dirección */
  onAddressModalSaved(saved: AddressData): void {
    this.addresses = [saved, ...this.addresses];
    this.selectedAddress = saved;
    this.showAddressModal = false;
  }

  formatAddressFull(addr: AddressData): string {
    const parts = [addr.street, addr.streetNumber, addr.apartment].filter(Boolean).join(' ');
    return `${parts}, ${addr.district}, ${addr.province}`;
  }

  // ─── Tarjetas ─────────────────────────────────────────────────────────────

  private loadCards(): void {
    this.isLoadingCards = true;
    this.cardService.getCards()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
        finalize(() => { this.isLoadingCards = false; })
      )
      .subscribe((res) => {
        if (!res) return;
        const list: Card[] = Array.isArray(res) ? res : ((res as any).cards ?? []);
        this.cards = list;
        this.selectedCard = list[0] ?? null;
      });
  }

  selectCard(card: Card): void { this.selectedCard = card; this.paymentMethod.set('card'); }

  /** Llamado cuando CardModalComponent guarda una nueva tarjeta */
  onCardModalSaved(saved: Card): void {
    this.cards = [saved, ...this.cards];
    this.selectedCard = saved;
    this.paymentMethod.set('card');
  }

  maskCard(card: Card): string {
    const n = card.cardNumber?.replace(/\s/g, '') ?? '';
    return n.length >= 4 ? `**** **** **** ${n.slice(-4)}` : card.cardNumber;
  }

  // ─── Orden ────────────────────────────────────────────────────────────────

  /**
   * Confirma la orden agrupando los items del carrito por fulfillment:
   *   delivery → 1 llamada con addressId
   *   pickup   → 1 llamada por tienda con storeId + variantIds
   * Usa forkJoin para ejecutar ambas en paralelo.
   */
  confirmOrder(): void {
    if (!this.acceptedTerms || !this.basket) return;
    this.isProcessingOrder = true;
    this.orderError = null;

    const paymentMethod = this.paymentMethod() as OrderPaymentMethod;
    const calls: ReturnType<OrderService['createOrder']>[] = [];

    // ── Grupo delivery ─────────────────────────────────────────────────────
    const deliveryItems = this.basketItems.filter(
      i => this.getItemDeliveryMode(i) === 'delivery'
    );
    if (deliveryItems.length > 0 && this.selectedAddress?._id) {
      const dto: CreateOrderDto = {
        fulfillment:   'delivery',
        paymentMethod,
        addressId:     this.selectedAddress._id,
        variantIds:    deliveryItems.map(i => this.getItemKey(i)).filter(Boolean),
      };
      calls.push(this.orderService.createOrder(dto));
    }

    // ── Grupos pickup (agrupados por tienda) ───────────────────────────────
    const pickupItems = this.basketItems.filter(
      i => this.getItemDeliveryMode(i) === 'pickup'
    );
    // Agrupar por storeId
    const pickupByStore = new Map<string, BasketItem[]>();
    for (const item of pickupItems) {
      const store = this.getItemPickupStore(item);
      if (!store?._id) continue;
      if (!pickupByStore.has(store._id)) pickupByStore.set(store._id, []);
      pickupByStore.get(store._id)!.push(item);
    }
    for (const [storeId, items] of pickupByStore) {
      const dto: CreateOrderDto = {
        fulfillment:   'pickup',
        paymentMethod,
        storeId,
        variantIds:    items.map(i => this.getItemKey(i)).filter(Boolean),
      };
      calls.push(this.orderService.createOrder(dto));
    }

    if (calls.length === 0) {
      this.orderError = 'No se pudo determinar el tipo de entrega. Revisa tu carrito.';
      this.isProcessingOrder = false;
      return;
    }

    forkJoin(calls)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.orderError = err?.error?.message ?? 'Error al procesar tu orden. Intenta de nuevo.';
          this.isProcessingOrder = false;
          return of(null);
        })
      )
      .subscribe(responses => {
        if (!responses) return;
        // Vaciar carrito
        this.basketService.clearBasket().pipe(takeUntil(this.destroy$)).subscribe();
        // Navegar a la pantalla de éxito con la primera orden creada
        const firstOrder = responses[0]?.order;
        if (firstOrder?._id) {
          this.router.navigate(['/orders', firstOrder._id, 'success']);
        } else {
          this.router.navigate(['/my-account/orders']);
        }
      });
  }

  /**
   * Determina si la tienda está abierta en el momento actual.
   * businessHours es un objeto: { monday: {open, close}, ... }
   */
  isStoreOpen(store: Store): boolean {
    const dayKey = this.currentDayKey();
    const hours  = store.businessHours?.[dayKey];
    return !!hours; // si tiene registro ese día, está abierto
  }

  /**
   * Devuelve el horario de la tienda para hoy.
   * Formato: "09:00 – 18:00" o "Cerrado hoy"
   */
  getStoreHours(store: Store): string {
    const dayKey = this.currentDayKey();
    const hours  = store.businessHours?.[dayKey];
    return hours ? `${hours.open} – ${hours.close}` : 'Cerrado hoy';
  }

  /** Mapea el número de día JS (0=Dom ... 6=Sáb) a la clave del backend */
  private currentDayKey(): import('../../../core/interfaces/store.interface').DayKey {
    const keys: import('../../../core/interfaces/store.interface').DayKey[] =
      ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    return keys[new Date().getDay()];
  }
}
