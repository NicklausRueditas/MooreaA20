import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { BasketService } from '../../../core/services/commerce/basket.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { Basket, BasketItem } from '../../../core/interfaces/basket.interface';
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

  // Cupones y beneficios
  couponCode = '';
  couponApplied = false;
  couponDiscount = 0;
  couponError: string | null = null;

  /** Umbral para delivery gratuito en soles */
  readonly freeDeliveryThreshold = 500;

  private destroy$ = new Subject<void>();

  constructor(
    private basketService: BasketService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
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
    if (typeof item.variantId === 'string' && item.variantId) return item.variantId;
    if (item.variant?._id) return item.variant._id;
    if (item.variant?.id) return item.variant.id;
    if (!item._corruptedId) item._corruptedId = `corrupted-${Math.random()}`;
    return item._corruptedId;
  }

  /** Objeto variante populado */
  getVariant(item: any): any | null {
    if (item.variant && typeof item.variant === 'object') return item.variant;
    if (item.variantId && typeof item.variantId === 'object') return item.variantId;
    return null;
  }

  /** Objeto producto populado */
  getProduct(item: any): any | null {
    if (item.product && typeof item.product === 'object') return item.product;
    if (item.productId && typeof item.productId === 'object') return item.productId;
    return null;
  }

  getColorName(item: BasketItem): string {
    return this.getVariant(item)?.color?.name ?? '';
  }

  getColorHex(item: BasketItem): string {
    return this.getVariant(item)?.color?.hex ?? '#e5e7eb';
  }

  getSizeValue(item: BasketItem): string {
    return this.getVariant(item)?.size?.value ?? '';
  }

  getThumbnail(item: BasketItem): string {
    return this.getVariant(item)?.gallery?.[0] ?? '';
  }

  getSku(item: BasketItem): string {
    return this.getVariant(item)?.sku ?? '';
  }

  getProductName(item: any): string {
    return this.getProduct(item)?.name ?? '';
  }

  getBrand(item: any): string {
    return this.getProduct(item)?.brand ?? '';
  }

  getProductId(item: any): string {
    const p = this.getProduct(item);
    return p?._id ?? (typeof item.productId === 'string' ? item.productId : '');
  }

  getBasePrice(item: any): number {
    return this.getProduct(item)?.basePrice ?? 0;
  }

  // ─── ACCIONES DEL CARRITO ────────────────────────────────────────────

  increaseQuantity(item: BasketItem): void {
    const variantId = this.getVariantId(item);
    this.loadingItems.add(variantId);

    this.basketService
      .adjustQuantity(variantId, 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadingItems.delete(variantId),
        error: () => {
          this.toastService.showError('No se pudo incrementar la cantidad');
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
          this.toastService.showError('No se pudo reducir la cantidad');
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
        next: () => {
          this.loadingItems.delete(variantId);
          this.toastService.showSuccess('Producto eliminado de la bolsa');
        },
        error: () => {
          this.toastService.showError('Error al eliminar el producto');
          this.loadingItems.delete(variantId);
        },
      });
  }

  isItemLoading(item: BasketItem): boolean {
    return this.loadingItems.has(this.getVariantId(item));
  }

  // ─── CUPONES Y BENEFICIOS ────────────────────────────────────────────

  get freeDeliveryProgress(): number {
    if (!this.totalAmount || this.totalAmount <= 0) return 0;
    return Math.min(100, Math.round((this.totalAmount / this.freeDeliveryThreshold) * 100));
  }

  get freeDeliveryRemaining(): number {
    return Math.max(0, parseFloat((this.freeDeliveryThreshold - this.totalAmount).toFixed(2)));
  }

  get totalSavings(): number {
    if (!this.basket?.items) return 0;
    return this.basket.items.reduce((sum, item) => {
      const base = this.getBasePrice(item);
      const final = item.finalPrice ?? base;
      if (base > final) {
        return sum + (base - final) * item.quantity;
      }
      return sum;
    }, 0);
  }

  get installmentInfo(): { count: number; amount: number } | null {
    const total = this.finalPayableAmount;
    if (total <= 0) return null;
    const count = 3;
    return {
      count,
      amount: parseFloat((total / count).toFixed(2)),
    };
  }

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
    if (code === 'MOOREA10' || code === 'DESC10') {
      this.couponDiscount = parseFloat((this.totalAmount * 0.1).toFixed(2));
      this.couponApplied = true;
      this.toastService.showSuccess(`Cupón ${code} aplicado: 10% de descuento`);
    } else if (code === 'BIENVENIDO' || code === 'FREE20') {
      this.couponDiscount = 20.0;
      this.couponApplied = true;
      this.toastService.showSuccess(`Cupón ${code} aplicado: S/ 20.00 de descuento`);
    } else {
      this.couponError = 'Cupón inválido o no aplicable';
      this.toastService.showError('El código de cupón no es válido');
    }
  }

  removeCoupon(): void {
    this.couponApplied = false;
    this.couponDiscount = 0;
    this.couponCode = '';
    this.couponError = null;
    this.toastService.showInfo('Cupón removido');
  }

  clearBasket(): void {
    if (!this.basket?.items?.length) return;
    if (confirm('¿Estás seguro de que deseas vaciar tu bolsa de compras?')) {
      const items = [...this.basket.items];
      items.forEach((item) => this.removeItem(this.getVariantId(item)));
    }
  }

  clearError(): void {
    this.error = null;
  }

  // ─── TOTALES ─────────────────────────────────────────────────────────

  get totalQuantity(): number {
    return this.basket?.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  }

  get totalAmount(): number {
    if (this.basket?.totalAmount != null) return this.basket.totalAmount;
    return this.basket?.items?.reduce((sum, i) => sum + (i.subtotal ?? 0), 0) ?? 0;
  }
}
