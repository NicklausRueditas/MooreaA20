import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { User } from '../../../../core/interfaces/user.interface';

export interface NavGroup {
  groupName: string;
  items: BusinessNavItem[];
}

export interface BusinessNavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  roles?: string[]; // Si está vacío, accesible por todos los roles de business
}

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
  isMobileMenuOpen = false;

  readonly navGroups: NavGroup[] = [
    {
      groupName: 'Catálogo & Tiendas',
      items: [
        { label: 'Productos', route: '/business/products', icon: '📦', roles: ['admin', 'seller'] },
        { label: 'Tiendas', route: '/business/stores', icon: '🏪', roles: ['admin', 'seller', 'worker'] },
      ]
    },
    {
      groupName: 'Operaciones',
      items: [
        { label: 'Pedidos', route: '/business/orders', icon: '📋', roles: ['admin', 'seller', 'worker'] },
        { label: 'Escanear QR', route: '/business/pickup-scanner', icon: '📷', roles: ['admin', 'seller', 'worker'] },
      ]
    },
    {
      groupName: 'Administración',
      items: [
        // ⚠️ SOLO ADMIN: Vendedores nunca debe aparecer para Sellers o Workers
        { label: 'Vendedores', route: '/business/sellers', icon: '👥', roles: ['admin'] },
      ]
    }
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get userRoles(): string[] {
    return this.currentUser?.roles || ['user'];
  }

  get isAdmin(): boolean {
    return this.userRoles.includes('admin');
  }

  get isSeller(): boolean {
    return this.userRoles.includes('seller');
  }

  get isWorker(): boolean {
    return this.userRoles.includes('worker');
  }

  get roleBadge(): { label: string; icon: string; classes: string; gradient: string } {
    if (this.isAdmin) {
      return {
        label: 'Administrador',
        icon: '👑',
        classes: 'bg-purple-50 text-purple-700 border-purple-200',
        gradient: 'from-purple-600 to-indigo-600'
      };
    }
    if (this.isSeller) {
      return {
        label: 'Vendedor',
        icon: '🏪',
        classes: 'bg-rose-50 text-primary border-primary/20',
        gradient: 'from-primary to-rose-600'
      };
    }
    if (this.isWorker) {
      return {
        label: 'Colaborador',
        icon: '👷',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        gradient: 'from-emerald-600 to-teal-600'
      };
    }
    return {
      label: 'Usuario',
      icon: '👤',
      classes: 'bg-slate-50 text-slate-700 border-slate-200',
      gradient: 'from-slate-700 to-slate-900'
    };
  }

  canAccess(item: BusinessNavItem): boolean {
    if (!item.roles || item.roles.length === 0) return true;
    // Si el ítem requiere 'admin' (ej: Vendedores), SOLO el admin puede verlo
    if (item.roles.includes('admin') && item.roles.length === 1) {
      return this.isAdmin;
    }
    if (this.isAdmin) return true;
    return item.roles.some(role => this.userRoles.includes(role));
  }

  hasVisibleItemsInGroup(group: NavGroup): boolean {
    return group.items.some(item => this.canAccess(item));
  }

  toggleUserMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.isUserMenuOpen = false;
    }
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login'])
    });
  }
}
