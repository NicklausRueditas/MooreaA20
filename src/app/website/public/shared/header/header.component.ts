import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SesionService } from '../../../../core/services/auth/sesion.service';
import { User } from '../../../../core/interfaces/user.interface';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BasketService } from '../../../../core/services/commerce/basket.service';
import { Basket, BasketItem } from '../../../../core/interfaces/basket.interface';
import { Subscription, take } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  userData: User | null = null;
  basket: Basket | null = null;
  basketSummary = {
    itemCount: 0,
    totalQuantity: 0,
    estimatedTotal: 0
  };

  isMenuUserOpen = false;
  isMenuCartOpen = false;
  isMenuMobileOpen = false;

  private subscriptions = new Subscription();

  constructor(
    private sesionService: SesionService,
    private authService: AuthService,
    private basketService: BasketService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadUserData();
    this.initBasketSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadUserData(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    // Llamar a getProfile() directamente
    // Si AuthService ya cargó el perfil, getProfile() usará el caché
    const userSub = this.sesionService.getProfile().subscribe({
      next: (user) => {
        console.log('[HeaderComponent] User received from getProfile:', user);
        this.userData = user;
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
      }
    });

    this.subscriptions.add(userSub);
  }

  private initBasketSubscriptions(): void {
    const basketSub = this.basketService.basket$.subscribe(basket => {
      this.basket = basket;
    });

    const summarySub = this.basketService.basketSummary$.subscribe(summary => {
      this.basketSummary = summary;
    });

    this.subscriptions.add(basketSub);
    this.subscriptions.add(summarySub);
  }

  /**
   * Cierra sesión del usuario.
   * Estrategia local-first: limpia el estado inmediatamente y navega,
   * mientras el HTTP logout se dispara en segundo plano.
   * Evita que el usuario quede "bloqueado" si el backend tarda o falla.
   */
  logout(): void {
    // 1. Limpiar estado local de manera inmediata
    this.userData = null;
    this.basket = null;
    this.basketSummary = { itemCount: 0, totalQuantity: 0, estimatedTotal: 0 };
    this.closeAllMenus();

    // 2. Disparar HTTP logout (debe suscribirse para que se ejecute)
    this.authService.logout().pipe(take(1)).subscribe({
      error: (err) => console.warn('[Header] logout HTTP error (ignorado):', err)
    });
  }

  toggleMenu(menu: 'user' | 'cart' | 'mobile', event: Event): void {
    event.stopPropagation();
    if (menu === 'user') {
      this.isMenuUserOpen = !this.isMenuUserOpen;
      this.isMenuCartOpen = false;
      this.isMenuMobileOpen = false;
    } else if (menu === 'cart') {
      this.isMenuCartOpen = !this.isMenuCartOpen;
      this.isMenuUserOpen = false;
      this.isMenuMobileOpen = false;
    } else if (menu === 'mobile') {
      this.isMenuMobileOpen = !this.isMenuMobileOpen;
      this.isMenuUserOpen = false;
      this.isMenuCartOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  closeMenus(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('#user-menu') && !target.closest('#cart-menu') && !target.closest('#mobile-menu')) {
      this.closeAllMenus();
    }
  }

  public closeAllMenus(): void {
    this.isMenuUserOpen = false;
    this.isMenuCartOpen = false;
    this.isMenuMobileOpen = false;
  }

  get totalPrice(): number {
    return this.basketSummary.estimatedTotal;
  }

  get totalItems(): number {
    return this.basketSummary.totalQuantity;
  }

  /** String ID de la variante para trackBy y llamadas al API */
  getVariantId(item: any): string {
    if (!item) return 'empty';
    // Nuevo formato: variantId es string
    if (typeof item.variantId === 'string' && item.variantId) return item.variantId;
    // Guest localStorage: variant es objeto
    if (item.variant?._id) return item.variant._id;
    if (!item._corruptedId) item._corruptedId = `corrupted-${Math.random()}`;
    return item._corruptedId;
  }

  /** Label color · talla para el mini-carrito del header */
  getVariantLabel(item: any): string {
    const v = item.variant && typeof item.variant === 'object' ? item.variant : null;
    if (!v) return '';
    const color = v.color?.name ?? '';
    const size  = v.size?.value ?? '';
    return [color, size].filter(Boolean).join(' · ');
  }

  /** Primera imagen de la variante para el mini-carrito */
  getVariantThumbnail(item: any): string {
    const v = item.variant && typeof item.variant === 'object' ? item.variant : null;
    return v?.gallery?.[0] ?? '';
  }

  removeFromCart(variantId: string): void {
    if (!variantId || variantId.startsWith('corrupted-')) {
      // Ítem corrupto: limpiarlo del carrito local sin llamar al API
      this.basketService.cleanupCorruptedItems();
      return;
    }
    this.basketService.removeFromBasket(variantId).pipe(take(1)).subscribe({
      next: () => console.log('Variante eliminada'),
      error: (err) => console.error('Error:', err)
    });
  }

  updateQuantity(variantId: string, change: number): void {
    if (!variantId || variantId.startsWith('corrupted-')) {
      // Ítem corrupto: limpiarlo del carrito local sin llamar al API
      this.basketService.cleanupCorruptedItems();
      return;
    }
    this.basketService.adjustQuantity(variantId, change).pipe(take(1)).subscribe({
      next: () => console.log('Cantidad actualizada'),
      error: (err) => console.error('Error:', err)
    });
  }

  /** Nombre del producto maestro extraido desde item.product (nuevo backend) */
  getProductName(item: any): string {
    if (item.product && typeof item.product === 'object') return item.product.name ?? '';
    return '';
  }

  /** SKU de la variante (item.variant.sku) */
  getSku(item: any): string {
    if (item.variant && typeof item.variant === 'object') return item.variant.sku ?? '';
    return '';
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.closeAllMenus();
  }

  navigateToCheckout(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/basket' } });
      return;
    }
    if (!this.basket || this.basket.items.length === 0) return;
    this.router.navigate(['/basket']);
    this.closeAllMenus();
  }

  get isSeller(): boolean {
    return this.userData?.roles?.includes('seller') ?? false;
  }

  get isAdmin(): boolean {
    return this.userData?.roles?.includes('admin') ?? false;
  }

  /** Retorna la URL actual del navegador para usar como returnUrl en login */
  get currentUrl(): string {
    return this.router.url;
  }
}
