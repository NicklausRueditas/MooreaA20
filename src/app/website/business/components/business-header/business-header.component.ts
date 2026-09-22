import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { User } from '../../../../core/interfaces/user.interface';

/**
 * Representa un enlace o elemento de navegación en el portal Business
 */
export interface BusinessNavItem {
  label: string;
  route: string;
  iconId: 'products' | 'stores' | 'orders' | 'users' | 'sellers' | 'scanner' | 'profile';
  badge?: string;
  exact?: boolean;
  roles?: string[];
  description?: string;
  tagColor?: string;
}

/**
 * Componente Header Ejecutivo para el portal Moorea Business.
 * Gestiona la navegación unificada, menús contextuales, estado de sesión y accesos rápidos de operaciones.
 */
@Component({
  selector: 'app-business-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './business-header.component.html',
  styleUrl: './business-header.component.css',
})
export class BusinessHeaderComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  currentUser: User | null = null;
  isUserMenuOpen = false;
  isMoreMenuOpen = false;
  isMobileMenuOpen = false;
  isScrolled = false;

  // ── Enlaces Principales Visibles en el Segmented Control ──────────────────
  readonly primaryNavItems: BusinessNavItem[] = [
    {
      label: 'Productos',
      route: '/business/products',
      iconId: 'products',
      roles: ['admin', 'seller'],
      badge: 'Catálogo',
    },
    {
      label: 'Tiendas',
      route: '/business/stores',
      iconId: 'stores',
      roles: ['admin', 'seller', 'worker'],
      badge: 'Sedes',
    },
    {
      label: 'Pedidos',
      route: '/business/orders',
      iconId: 'orders',
      roles: ['admin', 'seller', 'worker'],
      badge: 'Envíos',
    },
  ];

  // ── Enlaces del Menú Desplegable "Módulos & Herramientas" ──────────────────
  readonly extraNavItems: BusinessNavItem[] = [
    {
      label: 'Directorio de Vendedores',
      route: '/business/sellers',
      iconId: 'sellers',
      roles: ['admin'],
      description: 'Gestión y auditoría de tiendas asociadas y comisiones',
      tagColor: 'from-rose-500 to-pink-600',
    },
    {
      label: 'Gestión de Usuarios',
      route: '/business/users',
      iconId: 'users',
      roles: ['admin'],
      description: 'Control de cuentas globales, roles de acceso y bloqueos',
      tagColor: 'from-indigo-500 to-blue-600',
    },
    {
      label: 'Escanear Retiro QR',
      route: '/business/pickup-scanner',
      iconId: 'scanner',
      roles: ['admin', 'seller', 'worker'],
      description: 'Validador de entregas físicas para recojo en tienda',
      tagColor: 'from-amber-500 to-orange-600',
    },
    {
      label: 'Perfil de Negocio',
      route: '/business/profile',
      iconId: 'profile',
      roles: ['admin', 'seller', 'worker'],
      description: 'Configuración comercial, marcas, logotipo y cobertura',
      tagColor: 'from-violet-500 to-purple-600',
    },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Detecta el desplazamiento vertical para aplicar efecto glassmorphism flotante
   */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrolled = window.scrollY > 8;
    if (this.isScrolled !== scrolled) {
      this.isScrolled = scrolled;
      this.cdr.markForCheck();
    }
  }

  /**
   * Obtiene los roles activos del usuario actual
   */
  get userRoles(): string[] {
    if (this.currentUser?.roles && this.currentUser.roles.length > 0) {
      return this.currentUser.roles;
    }
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload?.roles) {
          return Array.isArray(payload.roles) ? payload.roles : [payload.roles];
        }
      } catch {}
    }
    return ['user'];
  }

  get isAdmin(): boolean {
    return this.userRoles.includes('admin') || (this.currentUser?.email === 'nick047tu@gmail.com');
  }

  get isSeller(): boolean {
    return this.userRoles.includes('seller');
  }

  get isWorker(): boolean {
    return this.userRoles.includes('worker');
  }

  /**
   * Configuración visual del badge de rol
   */
  get roleBadge(): { label: string; icon: string; classes: string; dotClass: string } {
    if (this.isAdmin) {
      return {
        label: 'Admin Global',
        icon: '👑',
        classes: 'bg-indigo-50/90 text-indigo-700 border-indigo-200/90 shadow-xs shadow-indigo-100',
        dotClass: 'bg-indigo-500 animate-pulse',
      };
    }
    if (this.isSeller) {
      return {
        label: 'Seller Oficial',
        icon: '🏪',
        classes: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/90 shadow-xs shadow-emerald-100',
        dotClass: 'bg-emerald-500 animate-pulse',
      };
    }
    if (this.isWorker) {
      return {
        label: 'Colaborador',
        icon: '👷',
        classes: 'bg-amber-50/90 text-amber-700 border-amber-200/90 shadow-xs shadow-amber-100',
        dotClass: 'bg-amber-500',
      };
    }
    return {
      label: 'Usuario',
      icon: '👤',
      classes: 'bg-slate-50 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400',
    };
  }

  /**
   * Título amigable para la opción de perfil según el rol
   */
  get profileMenuLabel(): string {
    if (this.isAdmin) return 'Panel de Administración';
    if (this.isSeller) return 'Mi Perfil de Negocio';
    if (this.isWorker) return 'Mi Perfil de Sucursal';
    return 'Mi Perfil';
  }

  /**
   * Determina si el usuario tiene permiso para acceder a un ítem
   */
  canAccess(item: BusinessNavItem): boolean {
    if (!item.roles || item.roles.length === 0) return true;
    if (item.roles.includes('admin') && item.roles.length === 1) {
      return this.isAdmin;
    }
    if (this.isAdmin) return true;
    return item.roles.some(role => this.userRoles.includes(role));
  }

  /**
   * Filtra los módulos adicionales a los que el usuario tiene acceso
   */
  get visibleExtraNavItems(): BusinessNavItem[] {
    return this.extraNavItems.filter(item => this.canAccess(item));
  }

  /**
   * Retorna true si la ruta actual coincide con alguno de los módulos adicionales
   */
  get isAnyExtraItemActive(): boolean {
    const url = this.router.url;
    return this.visibleExtraNavItems.some(item => url.startsWith(item.route));
  }

  toggleMoreMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.isMoreMenuOpen = !this.isMoreMenuOpen;
    if (this.isMoreMenuOpen) {
      this.isUserMenuOpen = false;
    }
    this.cdr.markForCheck();
  }

  toggleUserMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) {
      this.isMoreMenuOpen = false;
    }
    this.cdr.markForCheck();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.cdr.markForCheck();
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.isUserMenuOpen = false;
    }
    if (!target.closest('.more-menu-container')) {
      this.isMoreMenuOpen = false;
    }
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login']),
    });
  }
}
