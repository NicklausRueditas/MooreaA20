import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { BasketService } from '../../../core/services/commerce/basket.service';
import { Basket, BasketItem } from '../../../core/interfaces/basket.interface';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import { CloudinaryPipe } from '../../../shared/pipes/cloudinary.pipe';

@Component({
  selector: 'app-basket',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CloudinaryPipe],
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css'],
})
export class BasketComponent implements OnInit, OnDestroy {
  basket: Basket | null = null;
  isLoading = true;
  error: string | null = null;
  loadingItems = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(private basketService: BasketService) {}

  ngOnInit(): void {
    // Suscribirse al carrito completo con cálculos cuando esté disponible
    this.basketService.basket$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (basket) => {
          this.basket = basket;
          this.isLoading = false;
        },
        error: () => {
          this.error = 'Error al cargar el carrito. Por favor, intenta de nuevo.';
          this.isLoading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── HELPERS DE VARIANTE ──────────────────────────────────────────────

  /**
   * String ID de la variante para trackBy y llamadas al API.
   * Prioridad: item.variantId (nuevo backend) → item.variant._id (guest localStorage)
   */
  getVariantId(item: any): string {
    if (!item) return 'empty';
    // Nuevo formato backend: variantId es siempre string
    if (typeof item.variantId === 'string' && item.variantId) return item.variantId;
    // Guest localStorage: variant es objeto populado
    if (item.variant?._id) return item.variant._id;
    if (item.variant?.id)  return item.variant.id;
    // Fallback anticrash — estable por sesión
    if (!item._corruptedId) item._corruptedId = `corrupted-${Math.random()}`;
    return item._corruptedId;
  }

  /** Objeto variante populado (nuevo: item.variant; legacy: item.variantId si era objeto) */
  getVariant(item: any): any | null {
    if (item.variant && typeof item.variant === 'object') return item.variant;
    if (item.variantId && typeof item.variantId === 'object') return item.variantId;
    return null;
  }

  /** Objeto producto populado (nuevo: item.product; legacy: item.productId si era objeto) */
  getProduct(item: any): any | null {
    if (item.product && typeof item.product === 'object') return item.product;
    if (item.productId && typeof item.productId === 'object') return item.productId;
    return null;
  }

  /** Nombre del color para mostrar */
  getColorName(item: BasketItem): string {
    return this.getVariant(item)?.color?.name ?? '';
  }

  /** Color hex para el badge de color */
  getColorHex(item: BasketItem): string {
    return this.getVariant(item)?.color?.hex ?? '#e5e7eb';
  }

  /** Talla para mostrar */
  getSizeValue(item: BasketItem): string {
    return this.getVariant(item)?.size?.value ?? '';
  }

  /** Primera imagen de la variante */
  getThumbnail(item: BasketItem): string {
    return this.getVariant(item)?.gallery?.[0] ?? '';
  }

  /** SKU de la variante */
  getSku(item: BasketItem): string {
    return this.getVariant(item)?.sku ?? '';
  }

  /** Nombre del producto maestro */
  getProductName(item: any): string {
    return this.getProduct(item)?.name ?? '';
  }

  /** Marca del producto maestro */
  getBrand(item: any): string {
    return this.getProduct(item)?.brand ?? '';
  }

  /** _id del producto maestro para el enlace al detalle */
  getProductId(item: any): string {
    const p = this.getProduct(item);
    return p?._id ?? (typeof item.productId === 'string' ? item.productId : '');
  }

  /** Precio base antes del ajuste (para mostrar precio original tachado) */
  getBasePrice(item: any): number {
    return this.getProduct(item)?.basePrice ?? 0;
  }

  // ─── ACCIONES DEL CARRITO ────────────────────────────────────────────────────

  increaseQuantity(item: BasketItem): void {
    const variantId = this.getVariantId(item);
    this.loadingItems.add(variantId);

    this.basketService
      .adjustQuantity(variantId, 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadingItems.delete(variantId),
        error: () => {
          this.error = 'Error al actualizar la cantidad';
          this.loadingItems.delete(variantId);
        },
      });
  }

  decreaseQuantity(item: BasketItem): void {
    const variantId = this.getVariantId(item);
    if (item.quantity <= 1) {
      this.removeItem(variantId);
      return;
    }

    this.loadingItems.add(variantId);
    this.basketService
      .adjustQuantity(variantId, -1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadingItems.delete(variantId),
        error: () => {
          this.error = 'Error al actualizar la cantidad';
          this.loadingItems.delete(variantId);
        },
      });
  }

  removeItem(variantId: string): void {
    this.loadingItems.add(variantId);
    this.basketService
      .removeFromBasket(variantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadingItems.delete(variantId),
        error: () => {
          this.error = 'Error al eliminar el producto';
          this.loadingItems.delete(variantId);
        },
      });
  }

  isItemLoading(item: BasketItem): boolean {
    return this.loadingItems.has(this.getVariantId(item));
  }

  // ─── CUPONES Y BENEFICIOS ──────────────────────────────────────────────
  couponCode = '';
  couponApplied = false;
  couponDiscount = 0;
  couponError: string | null = null;

  /** Umbral para delivery gratuito */
  readonly freeDeliveryThreshold = 200;

  /** Progreso hacia el envío gratis (0 - 100%) */
  get freeDeliveryProgress(): number {
    if (!this.totalAmount || this.totalAmount <= 0) return 0;
    return Math.min(100, Math.round((this.totalAmount / this.freeDeliveryThreshold) * 100));
  }

  /** Monto restante para envío gratis */
  get freeDeliveryRemaining(): number {
    return Math.max(0, parseFloat((this.freeDeliveryThreshold - this.totalAmount).toFixed(2)));
  }

  /** Ahorro total acumulado en descuentos de productos */
  get totalSavings(): number {
    if (!this.basket?.items) return 0;
    return this.basket.items.reduce((sum, item) => {
      const base = this.getBasePrice(item);
      const final = item.finalPrice ?? base;
      if (base > final) {
        return sum + ((base - final) * item.quantity);
      }
      return sum;
    }, 0);
  }

  /** Información de cuotas sin interés si el monto califica (>= S/ 500) */
  get installmentInfo(): { count: number; amount: number } | null {
    const total = this.finalPayableAmount;
    if (total < 500) return null;
    let count = 3;
    if (total >= 2000) count = 24;
    else if (total >= 1000) count = 12;
    return {
      count,
      amount: parseFloat((total / count).toFixed(2))
    };
  }

  /** Monto final a pagar considerando cupones */
  get finalPayableAmount(): number {
    return Math.max(0, this.totalAmount - this.couponDiscount);
  }

  applyCoupon(): void {
    const code = this.couponCode.trim().toUpperCase();
    this.couponError = null;
    if (!code) {
      this.couponError = 'Ingresa un código de cupón válido';
      return;
    }
    // Códigos promocionales de ejemplo integrados
    if (code === 'MOOREA10' || code === 'DESC10') {
      this.couponDiscount = parseFloat((this.totalAmount * 0.10).toFixed(2));
      this.couponApplied = true;
    } else if (code === 'BIENVENIDO' || code === 'FREE20') {
      this.couponDiscount = 20.00;
      this.couponApplied = true;
    } else {
      this.couponError = 'Cupón inválido o expirado';
    }
  }

  removeCoupon(): void {
    this.couponApplied = false;
    this.couponDiscount = 0;
    this.couponCode = '';
    this.couponError = null;
  }

  clearBasket(): void {
    if (!this.basket?.items?.length) return;
    if (confirm('¿Estás seguro de que deseas vaciar tu carrito?')) {
      const items = [...this.basket.items];
      items.forEach(item => this.removeItem(this.getVariantId(item)));
    }
  }

  clearError(): void {
    this.error = null;
  }

  // ─── TOTALES ─────────────────────────────────────────────────────────────────

  /** Total de unidades en el carrito */
  get totalQuantity(): number {
    return this.basket?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  }

  /** Monto total (viene pre-calculado del backend en basket.totalAmount) */
  get totalAmount(): number {
    if (this.basket?.totalAmount != null) return this.basket.totalAmount;
    return this.basket?.items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0) ?? 0;
  }
}
