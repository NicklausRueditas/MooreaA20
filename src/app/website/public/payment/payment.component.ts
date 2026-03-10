import { Component, OnInit, OnDestroy, signal } from '@angular/core';
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
  ) {}

  ngOnInit(): void {
    this.loadBasket();
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

  getItemKey(item: BasketItem): string {
    return item.variantId ?? item.variant?._id ?? '';
  }

  // ─── Navegación ───────────────────────────────────────────────────────────

  goToStep(step: CheckoutStep): void {
    this.currentStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  get basketItems(): BasketItem[] { return this.basket?.items ?? []; }

  getVariant(item: BasketItem): any  { return item.variant ?? null; }
  getProduct(item: BasketItem): any  { return item.product ?? null; }
  getThumbnail(item: BasketItem): string { return item.variant?.gallery?.[0] ?? ''; }
  getProductName(item: BasketItem): string { return item.product?.name ?? item.variant?.sku ?? '—'; }
  getColorLabel(item: BasketItem): string  { return item.variant?.color?.name ?? ''; }
  getSizeLabel(item: BasketItem): string   { return item.variant?.size?.value ?? ''; }

  get subtotalAmount(): number { return this.basket?.totalAmount ?? 0; }
  get savingsAmount(): number  { return this.basket?.totalSavings ?? 0; }

  get deliveryCost(): number {
    return this.hasDeliveryItems() ? 15 : 0;
  }

  get totalOrder(): number { return this.subtotalAmount + this.deliveryCost; }

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
    }
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
      .subscribe(stores => { this.stores = stores; });
  }

  getItemPickupStore(item: BasketItem): Store | null {
    return this.itemPickupStores.get(this.getItemKey(item)) ?? null;
  }

  setItemPickupStore(item: BasketItem, store: Store): void {
    const key = this.getItemKey(item);
    this.itemPickupStores.set(key, store);
    this.itemStorePickerOpen.set(key, false);
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

  getStoreDistance(store: Store): string {
    if (this.userLat != null && this.userLng != null) {
      const km = this.calcDistance(this.userLat, this.userLng, store.lat, store.lng);
      return `${km} km`;
    }
    return '—';
  }

  getNearestStore(): Store | null {
    if (!this.stores.length || this.userLat == null) return this.stores[0] ?? null;
    return this.stores.reduce((nearest, store) => {
      const d = this.calcDistance(this.userLat!, this.userLng!, store.lat, store.lng);
      const dNearest = this.calcDistance(this.userLat!, this.userLng!, nearest.lat, nearest.lng);
      return d < dNearest ? store : nearest;
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

  isStoreOpen(store: Store): boolean {
    const day = new Date().getDay();
    const hours = store.businessHours?.find(h => h.dayOfWeek === day);
    return hours?.isOpen ?? false;
  }

  getStoreHours(store: Store): string {
    const day = new Date().getDay();
    const hours = store.businessHours?.find(h => h.dayOfWeek === day);
    if (!hours?.isOpen) return 'Cerrado hoy';
    return `${hours.openTime} – ${hours.closeTime}`;
  }
}
