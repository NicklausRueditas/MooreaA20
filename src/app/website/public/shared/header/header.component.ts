import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SesionService } from '../../../../core/services/auth/sesion.service';
import { User } from '../../../../core/interfaces/user.interface';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BasketService } from '../../../../core/services/commerce/basket.service';
import { Basket } from '../../../../core/interfaces/basket.interface';
import { GeoService } from '../../../../core/services/utils/geo.service';
import { Subscription, take } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
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

  searchQuery: string = '';
  cityName: string = 'Huancayo';
  isScrolled: boolean = false;
  avatarError: boolean = false;

  isMenuUserOpen = false;
  isMenuCartOpen = false;
  isMenuMobileOpen = false;
  isSearchOpenMobile = false;

  private subscriptions = new Subscription();

  /** Umbral en Soles para acceder a delivery gratuito local */
  readonly freeDeliveryThreshold = 500;

  constructor(
    private sesionService: SesionService,
    private authService: AuthService,
    private basketService: BasketService,
    private geoService: GeoService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadUserData();
    this.initBasketSubscriptions();
    this.initGeoLocation();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 15;
  }

  private initGeoLocation(): void {
    const geoSub = this.geoService.location$.subscribe(loc => {
      if (loc?.city) {
        this.cityName = loc.city;
      }
    });
    this.subscriptions.add(geoSub);
  }

  private loadUserData(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const userSub = this.sesionService.getProfile().subscribe({
      next: (user) => {
        this.userData = user;
        this.avatarError = false;
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
   * Limpia el estado inmediatamente y navega, mientras el HTTP logout se dispara en segundo plano.
   */
  logout(): void {
    this.userData = null;
    this.basket = null;
    this.basketSummary = { itemCount: 0, totalQuantity: 0, estimatedTotal: 0 };
    this.closeAllMenus();

    this.authService.logout().pipe(take(1)).subscribe({
      error: (err) => console.warn('[Header] logout HTTP error (ignorado):', err)
    });
  }

  onSearch(): void {
    const query = this.searchQuery?.trim();
    if (query) {
      this.router.navigate(['/store'], { queryParams: { search: query } });
    } else {
      this.router.navigate(['/store']);
    }
    this.closeAllMenus();
    this.isSearchOpenMobile = false;
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  toggleSearchMobile(): void {
    this.isSearchOpenMobile = !this.isSearchOpenMobile;
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
    if (!target.closest('#user-menu') && !target.closest('#user-trigger') &&
        !target.closest('#cart-menu') && !target.closest('#cart-trigger') &&
        !target.closest('#mobile-menu') && !target.closest('#mobile-trigger')) {
      this.closeAllMenus();
    }
  }

  public closeAllMenus(): void {
    this.isMenuUserOpen = false;
    this.isMenuCartOpen = false;
    this.isMenuMobileOpen = false;
  }

  onAvatarError(): void {
    this.avatarError = true;
  }

  get userFirstName(): string {
    if (!this.userData?.displayName) return 'Mi Perfil';
    return this.userData.displayName.trim().split(' ')[0];
  }

  get userInitial(): string {
    const name = this.userData?.displayName?.trim();
    if (name && name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    const email = this.userData?.email?.trim();
    if (email && email.length > 0) {
      return email.charAt(0).toUpperCase();
    }
    return 'U';
  }

  get userAvatar(): string | null {
    if (this.avatarError) return null;
    const pic = this.userData?.profilePicture;
    if (!pic || typeof pic !== 'string' || pic.trim() === '' || pic.includes('default.png')) {
      return null;
    }
    return pic;
  }

  get userRoleLabel(): string {
    if (this.isAdmin) return 'Administrador';
    if (this.isSeller) return 'Vendedor';
    return 'Cliente';
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
    if (typeof item.variantId === 'string' && item.variantId) return item.variantId;
    if (item.variant?._id) return item.variant._id;
    if (!item._corruptedId) item._corruptedId = `corrupted-${Math.random()}`;
    return item._corruptedId;
  }

  /** Label color · talla para el mini-carrito del header */
  getVariantLabel(item: any): string {
    const v = item.variant && typeof item.variant === 'object' ? item.variant : null;
    if (!v) return '';
    const color = v.color?.name ?? '';
    const size = v.size?.value ?? '';
    return [color, size].filter(Boolean).join(' · ');
  }

  /** Primera imagen de la variante para el mini-carrito */
  getVariantThumbnail(item: any): string {
    const v = item.variant && typeof item.variant === 'object' ? item.variant : null;
    return v?.gallery?.[0] ?? '';
  }

  removeFromCart(variantId: string): void {
    if (!variantId || variantId.startsWith('corrupted-')) {
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
      this.basketService.cleanupCorruptedItems();
      return;
    }
    this.basketService.adjustQuantity(variantId, change).pipe(take(1)).subscribe({
      next: () => console.log('Cantidad actualizada'),
      error: (err) => console.error('Error:', err)
    });
  }

  getProductName(item: any): string {
    if (item.product && typeof item.product === 'object') return item.product.name ?? '';
    return '';
  }

  getSku(item: any): string {
    if (item.variant && typeof item.variant === 'object') return item.variant.sku ?? '';
    return '';
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.closeAllMenus();
  }

  // ─── CART FLYOUT HELPERS ──────────────────────────────────────────────────

  get freeDeliveryProgress(): number {
    if (!this.totalPrice || this.totalPrice <= 0) return 0;
    return Math.min(100, Math.round((this.totalPrice / this.freeDeliveryThreshold) * 100));
  }

  get freeDeliveryRemaining(): number {
    return Math.max(0, parseFloat((this.freeDeliveryThreshold - this.totalPrice).toFixed(2)));
  }

  getItemUnitPrice(item: any): number {
    return item?.finalPrice ?? item?.price ?? 0;
  }

  getItemSubtotal(item: any): number {
    return this.getItemUnitPrice(item) * (item?.quantity ?? 1);
  }

  getItemColorHex(item: any): string | null {
    return item?.variant?.color?.hex ?? null;
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

  get currentUrl(): string {
    return this.router.url;
  }
}
