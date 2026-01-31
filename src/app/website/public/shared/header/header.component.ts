import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SesionService } from '../../../../core/services/sesion.service';
import { User } from '../../../../core/interfaces/user.interface';
import { AuthService } from '../../../../core/services/auth.service';
import { BasketService } from '../../../../core/services/basket.service';
import { Basket } from '../../../../core/interfaces/basket.interface';
import { Product } from '../../../../core/interfaces/product.interface';
import { Subscription, combineLatest, take } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  userData: User | null = null;
  basket: Basket | null = null;
  products: Product[] = [];
  basketSummary = {
    itemCount: 0,
    totalQuantity: 0,
    estimatedTotal: 0
  };
  
  isMenuUserOpen = false;
  isMenuCartOpen = false;
  loading = true;
  error: string | null = null;
  
  private subscriptions = new Subscription();

  constructor(
    private sesionService: SesionService,
    private authService: AuthService,
    private basketService: BasketService,
    private router: Router
  ) {}

  /* ======================= Inicialización ======================= */

  ngOnInit(): void {
    this.loadUserData();
    this.initBasketSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadUserData(): void {
    if (!this.authService.isAuthenticated()) {
      this.loading = false;
      return;
    }

    this.sesionService.getProfile().pipe(
      take(1)
    ).subscribe({
      next: (user) => {
        this.userData = user;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.error = 'Error al cargar datos del usuario';
        this.loading = false;
        this.authService.logout();
      }
    });
  }

  private initBasketSubscriptions(): void {
    // Suscribirse al basket completo
    const basketSub = this.basketService.basket$.subscribe(basket => {
      this.basket = basket;
    });

    // Suscribirse a los productos del basket
    const productsSub = this.basketService.basketProducts$.subscribe(products => {
      this.products = products;
    });

    // Suscribirse al resumen del basket
    const summarySub = this.basketService.basketSummary$.subscribe(summary => {
      this.basketSummary = summary;
    });

    // Agregar todas las suscripciones al manager
    this.subscriptions.add(basketSub);
    this.subscriptions.add(productsSub);
    this.subscriptions.add(summarySub);
  }

  /* ======================= Manejo de Sesión ======================= */

  logout(): void {
    this.authService.logout();
    this.userData = null;
    this.basket = null;
    this.products = [];
    this.basketSummary = { itemCount: 0, totalQuantity: 0, estimatedTotal: 0 };
    this.router.navigate(['/']);
    this.closeAllMenus();
  }

  /* ======================= Manejo de Menús ======================= */

  toggleMenu(menu: 'user' | 'cart', event: Event): void {
    event.stopPropagation();
    if (menu === 'user') {
      this.isMenuUserOpen = !this.isMenuUserOpen;
      this.isMenuCartOpen = false;
    } else {
      this.isMenuCartOpen = !this.isMenuCartOpen;
      this.isMenuUserOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  closeMenus(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('#user-menu') && !target.closest('#cart-menu')) {
      this.closeAllMenus();
    }
  }

  private closeAllMenus(): void {
    this.isMenuUserOpen = false;
    this.isMenuCartOpen = false;
  }

  /* ======================= Carrito de Compras ======================= */

  get totalPrice(): number {
    // Usa el estimatedTotal del basketSummary (más eficiente)
    return this.basketSummary.estimatedTotal;
  }

  get totalItems(): number {
    // Usa el totalQuantity del basketSummary
    return this.basketSummary.totalQuantity;
  }

  get uniqueItemsCount(): number {
    return this.basketSummary.itemCount;
  }

  getProductById(productId: string | any): Product | undefined {
    // Extraer el ID si es un objeto
    const id = this.extractProductId(productId);
    return this.products.find(p => p._id === id);
  }

  getProductName(productId: string | any): string {
    const product = this.getProductById(productId);
    return product?.name || 'Producto no encontrado';
  }

  getProductPrice(productId: string | any): number {
    const product = this.getProductById(productId);
    return product?.price || 0;
  }

  getProductImage(productId: string | any): string {
    const product = this.getProductById(productId);
    return product?.gallery?.[0] || 'assets/images/placeholder.jpg';
  }

  getProductQuantity(productId: string | any): number {
    if (!this.basket?.items) return 0;
    
    const id = this.extractProductId(productId);
    const item = this.basket.items.find(item => 
      this.extractProductId(item.product) === id
    );
    
    return item?.quantity || 0;
  }

  // Método helper para extraer el ID del producto (puede ser string o objeto)
  private extractProductId(product: string | any): string {
    if (typeof product === 'string') {
      return product;
    } else if (product && typeof product === 'object' && product._id) {
      return product._id;
    }
    return '';
  }

  /* ======================= Métodos del Carrito ======================= */

  removeFromCart(productId: string): void {
    this.basketService.removeFromBasket(productId).pipe(
      take(1)
    ).subscribe({
      next: () => {
        console.log('Producto eliminado del carrito');
      },
      error: (err) => {
        console.error('Error al eliminar producto:', err);
      }
    });
  }

  updateQuantity(productId: string, change: number): void {
    this.basketService.adjustQuantity(productId, change).pipe(
      take(1)
    ).subscribe({
      next: () => {
        console.log('Cantidad actualizada');
      },
      error: (err) => {
        console.error('Error al actualizar cantidad:', err);
      }
    });
  }

  clearCart(): void {
    this.basketService.clearBasket().pipe(
      take(1)
    ).subscribe({
      next: () => {
        console.log('Carrito vaciado');
        this.closeAllMenus();
      },
      error: (err) => {
        console.error('Error al vaciar carrito:', err);
      }
    });
  }

  /* ======================= Navegación Segura ======================= */

  navigateTo(route: string): void {
    if (!this.authService.isAuthenticated() && route.includes('/dashboard')) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: route } });
      return;
    }
    this.router.navigate([route]);
    this.closeAllMenus();
  }

  navigateToCheckout(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    
    if (!this.basket || this.basket.items.length === 0) {
      // Opcional: mostrar mensaje de carrito vacío
      console.log('El carrito está vacío');
      return;
    }
    
    this.router.navigate(['/checkout']);
    this.closeAllMenus();
  }
}