import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { User } from '../../../../core/interfaces/user.interface';

export interface BusinessNavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  roles?: string[]; // Si incluye 'admin' únicamente, solo visible para admin
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

  readonly allNavItems: BusinessNavItem[] = [
    { label: 'Productos', route: '/business/products', icon: '📦', roles: ['admin', 'seller'] },
    { label: 'Tiendas', route: '/business/stores', icon: '🏪', roles: ['admin', 'seller', 'worker'] },
    { label: 'Pedidos', route: '/business/orders', icon: '📋', roles: ['admin', 'seller', 'worker'] },
    { label: 'Escanear QR', route: '/business/pickup-scanner', icon: '📷', roles: ['admin', 'seller', 'worker'] },
    // ⚠️ SOLO ADMIN: Vendedores nunca debe aparecer para Sellers o Workers
    { label: 'Vendedores', route: '/business/sellers', icon: '👥', roles: ['admin'] },
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

  get roleBadge(): { label: string; icon: string; classes: string } {
    if (this.isAdmin) {
      return {
        label: 'Admin',
        icon: '👑',
        classes: 'bg-purple-50 text-purple-700 border-purple-200'
      };
    }
    if (this.isSeller) {
      return {
        label: 'Seller',
        icon: '🏪',
        classes: 'bg-rose-50 text-primary border-primary/20'
      };
    }
    if (this.isWorker) {
      return {
        label: 'Worker',
        icon: '👷',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    return {
      label: 'Usuario',
      icon: '👤',
      classes: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  }

  get profileMenuLabel(): string {
    if (this.isAdmin) return 'Panel de Administración';
    if (this.isSeller) return 'Mi Perfil de Negocio';
    if (this.isWorker) return 'Mi Perfil de Colaborador';
    return 'Mi Perfil';
  }

  canAccess(item: BusinessNavItem): boolean {
    if (!item.roles || item.roles.length === 0) return true;
    if (item.roles.includes('admin') && item.roles.length === 1) {
      return this.isAdmin;
    }
    if (this.isAdmin) return true;
    return item.roles.some(role => this.userRoles.includes(role));
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
