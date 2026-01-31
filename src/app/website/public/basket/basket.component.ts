import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { BasketService } from '../../../core/services/basket.service';
import { Basket, BasketItem} from '../../../core/interfaces/basket.interface';
import { Product } from '../../../core/interfaces/product.interface';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import { DeliveryCalculatorService } from '../../../core/services/delivery-calculator.service';

@Component({
  selector: 'app-basket',
  standalone: true,
  imports: [DateFormatPipe, SolCurrencyPipe],
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css'],
})
export class BasketComponent implements OnInit, OnDestroy {
  // Estado del componente
  basket: Basket | null = null;
  products: Product[] = [];
  deliveryOptions: { [productId: string]: 'home' | 'store' } = {};
  shippingCosts: { [productId: string]: number } = {};
  totalShippingCost: number = 0;
  deliveryDistance: number = 10; // Distancia predeterminada en km

  private destroy$ = new Subject<void>();

  constructor(
    private basketService: BasketService,
    private deliveryCalculator: DeliveryCalculatorService
  ) {}

  ngOnInit(): void {
    this.loadBasketData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Métodos de inicialización ---
  private loadBasketData(): void {
    this.basketService.basket$
      .pipe(takeUntil(this.destroy$))
      .subscribe((basket) => {
        this.basket = basket;
        this.initializeDeliveryOptions();
        this.calculateShippingCosts();
      });

    this.basketService.basketProducts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((products) => {
        this.products = products;
        this.calculateShippingCosts();
      });
  }

  private initializeDeliveryOptions(): void {
    if (!this.basket?.items) return;

    this.basket.items.forEach((item) => {
      const pid = item.product?.toString();
      if (!pid) return;
      if (!this.deliveryOptions[pid]) {
        this.deliveryOptions[pid] = 'home'; // Valor por defecto
      }
    });
  }

  // --- Métodos de entrega ---
  updateDeliveryOption(productId: string, option: 'home' | 'store'): void {
    this.deliveryOptions[productId] = option;
    this.calculateShippingCosts();
  }

  updateDeliveryDistance(distance: number): void {
    this.deliveryDistance = distance;
    this.calculateShippingCosts();
  }

  getDeliveryOption(productId: string): 'home' | 'store' {
    return this.deliveryOptions[productId] || 'home';
  }

  getDeliveryDate(daysToAdd: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date;
  }

  // --- Métodos del carrito ---
  increaseQuantity(basketItem: BasketItem): void {
    basketItem.quantity++;
    this.basketService
      .updateQuantity(basketItem.product.toString(), basketItem.quantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.calculateShippingCosts(),
        error: (e) => console.error(e),
      });
  }

  decreaseQuantity(basketItem: BasketItem): void {
    if (basketItem.quantity > 1) {
      basketItem.quantity--;
      this.basketService
        .updateQuantity(basketItem.product.toString(), basketItem.quantity)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.calculateShippingCosts(),
          error: (e) => console.error(e),
        });
    }
  }

  removeItem(productId: string): void {
    this.basketService
      .removeFromBasket(productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.deliveryOptions[productId]) {
            delete this.deliveryOptions[productId];
          }
          this.calculateShippingCosts();
        },
        error: (e) => console.error(e),
      });
  }

  // --- Métodos de cálculo ---
  private calculateShippingCosts(): void {
    if (!this.basket || !this.products.length) {
      this.shippingCosts = {};
      this.totalShippingCost = 0;
      return;
    }

    this.shippingCosts = {};
    this.totalShippingCost = 0;

    this.basket.items.forEach((item) => {
      const pid = item.product.toString();
      const product = this.getProductById(pid);

      if (product && this.deliveryOptions[pid] === 'home') {
        const cost = this.deliveryCalculator.calculateShippingCost(
          product,
          this.deliveryDistance
        );

        this.shippingCosts[pid] = cost;
        this.totalShippingCost += cost * item.quantity;
      } else {
        this.shippingCosts[pid] = 0;
      }
    });
  }

  get totalItems(): number {
    return (
      this.basket?.items.reduce((sum, item) => sum + item.quantity, 0) || 0
    );
  }

  get discountCount(): number {
    return this.products.filter((product) => {
      const basketItem = this.getBasketItem(product._id);
      return basketItem && product.discount && product.discount > 0;
    }).length;
  }

  get subtotal(): number {
    return this.products.reduce((sum, product) => {
      const basketItem = this.getBasketItem(product._id);
      return basketItem ? sum + product.price * basketItem.quantity : sum;
    }, 0);
  }

  get discountTotal(): number {
    return this.products.reduce((sum, product) => {
      const basketItem = this.getBasketItem(product._id);
      if (basketItem && product.discount) {
        const originalPrice = product.price / (1 - product.discount / 100);
        const discountAmount = originalPrice - product.price;
        return sum + discountAmount * basketItem.quantity;
      }
      return sum;
    }, 0);
  }

  get finalTotal(): number {
    return this.subtotal - this.discountTotal + this.totalShippingCost;
  }

  // --- Métodos auxiliares ---

  getProductById(productId: string): Product | undefined {
    return this.products.find((p) => p._id === productId);
  }

  getProductShippingCost(productId: string): number {
    return this.shippingCosts[productId] || 0;
  }

  private getBasketItem(productId: string): BasketItem | undefined {
    return this.basket?.items.find(
      (item) => item.product.toString() === productId
    );
  }

  // Método para obtener las dimensiones formateadas
  getFormattedDimensions(product: Product): string {
    if (!product.dimensions) return 'Sin dimensiones';

    const weight =
      product.dimensions.weight.unit === 'g'
        ? `${product.dimensions.weight.value} g`
        : `${product.dimensions.weight.value} kg`;

    return `${weight} | ${product.dimensions.size.value}`;
  }
}
