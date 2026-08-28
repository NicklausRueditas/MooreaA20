import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SellersService } from '../../../core/services/catalog/sellers.service';
import { ProductsService } from '../../../core/services/catalog/products.service';
import { StoresService } from '../../../core/services/catalog/stores.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import {
  ApprovalStatus,
  SellerUser,
  SellerProfile,
} from '../../../core/interfaces/seller.interface';
import { Product } from '../../../core/interfaces/product.interface';
import { Store } from '../../../core/interfaces/store.interface';
import { User } from '../../../core/interfaces/user.interface';

/**
 * Entorno de Perfil Centralizado de Business (/business/profile).
 *
 * Se adapta de forma inteligente y dinámica según el rol activo:
 * - Admin: Estadísticas del Marketplace global, todas las tiendas y acceso a gestión de sellers.
 * - Seller: Métricas comerciales de su catálogo, su tienda y edición de cuentas bancarias (CCI).
 * - Worker: Sucursal/local asignado, pedidos de retiro y control de entregas QR.
 */
@Component({
  selector: 'app-business-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './business-profile.component.html',
  styleUrl: './business-profile.component.css',
})
export class BusinessProfileComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  currentUser: User | null = null;
  seller: SellerUser | null = null;
  isLoading = false;

  // ── Tiendas ───────────────────────────────────────────────────────────────
  myStores: Store[] = [];
  myStore: Store | null = null;
  isLoadingStore = false;

  // ── Resumen de Catálogo / Plataforma ───────────────────────────────────────
  totalProducts = 0;
  activeProducts = 0;
  inactiveProducts = 0;
  isLoadingStats = false;
  isGlobalCatalogView = false;
  totalSellers = 0;

  // ── Modal de Edición de Perfil Comercial (Para Sellers) ────────────────────
  isEditModalOpen = false;
  editForm!: FormGroup;
  isSaving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly sellersService: SellersService,
    private readonly productsService: ProductsService,
    private readonly storesService: StoresService,
    private readonly authService: AuthService,
    private readonly toastService: ToastService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
    this.loadProfileData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Roles Getters ──────────────────────────────────────────────────────────
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

  get roleBadgeInfo(): { label: string; icon: string; classes: string } {
    if (this.isAdmin) {
      return {
        label: 'Administrador Global',
        icon: '👑',
        classes: 'bg-purple-50 text-purple-700 border-purple-200'
      };
    }
    if (this.isSeller) {
      return {
        label: 'Vendedor Comercial (Seller)',
        icon: '🏪',
        classes: 'bg-rose-50 text-primary border-primary/20'
      };
    }
    if (this.isWorker) {
      return {
        label: 'Colaborador de Operaciones (Worker)',
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

  get primaryProfile(): SellerProfile | null {
    return this.seller?.sellerProfiles?.[0] ?? null;
  }

  get isApproved(): boolean {
    return this.primaryProfile?.approvalStatus === 'approved';
  }

  get isPending(): boolean {
    return this.primaryProfile?.approvalStatus === 'pending';
  }

  get hasPhysicalStore(): boolean {
    return this.myStores.length > 0;
  }

  get isPhysicalStoreActive(): boolean {
    return this.myStore?.isActive ?? false;
  }

  get totalPhysicalStores(): number {
    return this.myStores.length;
  }

  private buildForm(): void {
    this.editForm = this.fb.group({
      description: ['', [Validators.maxLength(500)]],
      logoUrl: [''],
      bank: ['', [Validators.required]],
      account: ['', [Validators.required, Validators.minLength(5)]],
      cci: [''],
    });
  }

  loadProfileData(): void {
    this.isLoading = true;

    if (this.isSeller) {
      this.sellersService.getMySellerDetails()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (seller: SellerUser) => {
            this.seller = seller;
            this.isLoading = false;
            this.loadProductStats(seller._id);
            this.loadStoreData();
          },
          error: () => {
            this.isLoading = false;
            // Si el seller falla o es un admin sin seller profile
            if (this.isAdmin) {
              this.loadGlobalAdminData();
            }
          },
        });
    } else {
      // Si es Admin o Worker
      this.loadGlobalAdminData();
    }
  }

  private loadGlobalAdminData(): void {
    this.isLoading = false;
    this.loadStoreData();
    this.loadGlobalCatalogStats();

    if (this.isAdmin) {
      this.sellersService.getAllSellers()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (sellers: SellerUser[]) => {
            this.totalSellers = Array.isArray(sellers) ? sellers.length : 0;
          },
          error: () => { this.totalSellers = 0; }
        });
    }
  }

  private loadProductStats(sellerId: string): void {
    this.isLoadingStats = true;
    this.productsService.getProductsByOwner(sellerId, 1, 100, 'all')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const prods: Product[] = res.data ?? [];
          if (prods.length > 0) {
            this.totalProducts = res.total ?? prods.length;
            this.activeProducts = prods.filter((p: Product) => p.isActive === true).length;
            this.inactiveProducts = prods.filter((p: Product) => p.isActive === false).length;
            this.isGlobalCatalogView = false;
            this.isLoadingStats = false;
          } else if (this.isAdmin) {
            this.loadGlobalCatalogStats();
          } else {
            this.totalProducts = 0;
            this.activeProducts = 0;
            this.inactiveProducts = 0;
            this.isGlobalCatalogView = false;
            this.isLoadingStats = false;
          }
        },
        error: () => {
          if (this.isAdmin) {
            this.loadGlobalCatalogStats();
          } else {
            this.isLoadingStats = false;
          }
        },
      });
  }

  private loadGlobalCatalogStats(): void {
    this.isLoadingStats = true;
    this.productsService.getProducts(1, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (globalRes: any) => {
          const globalProds: Product[] = globalRes.data ?? (Array.isArray(globalRes) ? globalRes : []);
          this.totalProducts = globalRes.total ?? globalProds.length;
          this.activeProducts = globalProds.filter((p: Product) => p.isActive === true).length;
          this.inactiveProducts = globalProds.filter((p: Product) => p.isActive === false).length;
          this.isGlobalCatalogView = true;
          this.isLoadingStats = false;
        },
        error: () => {
          this.isLoadingStats = false;
        }
      });
  }

  private loadStoreData(): void {
    this.isLoadingStore = true;
    if (this.isAdmin) {
      this.storesService.getAllStores()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (stores: Store[]) => {
            this.myStores = Array.isArray(stores) ? stores : [];
            this.myStore = this.myStores[0] ?? null;
            this.isLoadingStore = false;
          },
          error: () => {
            this.myStores = [];
            this.myStore = null;
            this.isLoadingStore = false;
          }
        });
    } else {
      this.storesService.getMyStore()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (stores: Store[]) => {
            this.myStores = Array.isArray(stores) ? stores : (stores ? [stores] : []);
            this.myStore = this.myStores[0] ?? null;
            this.isLoadingStore = false;
          },
          error: () => {
            this.myStores = [];
            this.myStore = null;
            this.isLoadingStore = false;
          }
        });
    }
  }

  openEditModal(): void {
    const prof = this.primaryProfile;
    this.editForm.patchValue({
      description: prof?.description ?? '',
      logoUrl: prof?.logoUrl ?? '',
      bank: prof?.bankInfo?.bank ?? '',
      account: prof?.bankInfo?.account ?? '',
      cci: prof?.bankInfo?.cci ?? '',
    });
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
  }

  saveProfile(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { description, logoUrl, bank, account, cci } = this.editForm.value;
    const dto = {
      description,
      logoUrl: logoUrl || undefined,
      bankInfo: { bank, account, cci: cci || undefined },
    };

    this.isSaving = true;
    this.sellersService.updateProfile(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated: any) => {
          this.loadProfileData();
          this.isSaving = false;
          this.closeEditModal();
          this.toastService.showSuccess('Perfil actualizado con éxito');
        },
        error: () => {
          this.isSaving = false;
          this.toastService.showError('No se pudo guardar los cambios');
        },
      });
  }
}
