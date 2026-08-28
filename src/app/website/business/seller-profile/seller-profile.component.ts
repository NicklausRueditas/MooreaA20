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

import { SellersService }  from '../../../core/services/catalog/sellers.service';
import { ProductsService } from '../../../core/services/catalog/products.service';
import { StoresService }   from '../../../core/services/catalog/stores.service';
import { AuthService }     from '../../../core/services/auth/auth.service';
import { ToastService }    from '../../../core/services/ui/toast.service';
import {
  ApprovalStatus,
  SellerUser,
  SellerProfile,
} from '../../../core/interfaces/seller.interface';
import { Product } from '../../../core/interfaces/product.interface';
import { Store } from '../../../core/interfaces/store.interface';

/**
 * Entorno de Perfil para el Seller (/business/profile).
 *
 * Muestra los datos de la cuenta comercial del vendedor y tarjetas de resumen
 * con enlaces directos hacia sus anexos (Catálogo, Tiendas y Pedidos).
 */
@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './seller-profile.component.html',
})
export class SellerProfileComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  seller:        SellerUser | null = null;
  isLoading      = false;

  // ── Tienda Física / Virtual (Colección Stores) ───────────────────────────
  myStore: Store | null = null;
  isLoadingStore = false;

  // ── Resumen de Catálogo ───────────────────────────────────────────────────
  totalProducts    = 0;
  activeProducts   = 0;
  inactiveProducts = 0;
  isLoadingStats   = false;
  isGlobalCatalogView = false;

  // ── Modal de Edición de Perfil y Banco ─────────────────────────────────────
  isEditModalOpen = false;
  editForm!: FormGroup;
  isSaving = false;

  constructor(
    private readonly fb:              FormBuilder,
    private readonly sellersService:  SellersService,
    private readonly productsService: ProductsService,
    private readonly storesService:   StoresService,
    private readonly authService:     AuthService,
    private readonly toastService:    ToastService,
    private readonly router:          Router,
  ) {}

  get isAdmin(): boolean {
    return this.authService.hasRole('admin');
  }

  ngOnInit(): void {
    this.buildForm();
    this.loadSellerData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    this.editForm = this.fb.group({
      description: ['', [Validators.maxLength(500)]],
      logoUrl:     [''],
      bank:        ['', [Validators.required]],
      account:     ['', [Validators.required, Validators.minLength(5)]],
      cci:         [''],
    });
  }

  loadSellerData(): void {
    this.isLoading = true;
    this.sellersService.getMySellerDetails()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (seller: SellerUser) => {
          this.seller    = seller;
          this.isLoading = false;
          this.loadProductStats(seller._id);
          this.loadStoreData();
        },
        error: () => {
          this.isLoading = false;
          this.toastService.showError('No se pudo cargar tu perfil de vendedor');
        },
      });
  }

  private loadProductStats(sellerId: string): void {
    this.isLoadingStats = true;
    this.productsService.getProductsByOwner(sellerId, 1, 100, 'all')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const prods: Product[] = res.data ?? [];
          if (prods.length > 0) {
            this.totalProducts       = res.total ?? prods.length;
            this.activeProducts      = prods.filter((p: Product) => p.isActive === true).length;
            this.inactiveProducts    = prods.filter((p: Product) => p.isActive === false).length;
            this.isGlobalCatalogView = false;
            this.isLoadingStats      = false;
          } else if (this.isAdmin) {
            // Si el Admin no tiene productos asignados a su ID personal, cargamos el catálogo global del sistema
            this.loadGlobalCatalogStats();
          } else {
            this.totalProducts       = 0;
            this.activeProducts      = 0;
            this.inactiveProducts    = 0;
            this.isGlobalCatalogView = false;
            this.isLoadingStats      = false;
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
    this.productsService.getProducts(1, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (globalRes: any) => {
          const globalProds: Product[] = globalRes.data ?? (Array.isArray(globalRes) ? globalRes : []);
          this.totalProducts       = globalRes.total ?? globalProds.length;
          this.activeProducts      = globalProds.filter((p: Product) => p.isActive === true).length;
          this.inactiveProducts    = globalProds.filter((p: Product) => p.isActive === false).length;
          this.isGlobalCatalogView = true;
          this.isLoadingStats      = false;
        },
        error: () => {
          this.isLoadingStats = false;
        }
      });
  }

  myStores: Store[] = [];

  private loadStoreData(): void {
    this.isLoadingStore = true;
    if (this.isAdmin) {
      this.storesService.getAllStores()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (stores: Store[]) => {
            this.myStores = Array.isArray(stores) ? stores : [];
            this.myStore  = this.myStores[0] ?? null;
            this.isLoadingStore = false;
          },
          error: () => {
            this.myStores = [];
            this.myStore  = null;
            this.isLoadingStore = false;
          }
        });
    } else {
      this.storesService.getMyStore()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (stores: Store[]) => {
            this.myStores = Array.isArray(stores) ? stores : (stores ? [stores] : []);
            this.myStore  = this.myStores[0] ?? null;
            this.isLoadingStore = false;
          },
          error: () => {
            this.myStores = [];
            this.myStore  = null;
            this.isLoadingStore = false;
          }
        });
    }
  }

  get hasPhysicalStore(): boolean {
    return this.myStores.length > 0;
  }

  get totalPhysicalStores(): number {
    return this.myStores.length;
  }

  get totalActivePhysicalStores(): number {
    return this.myStores.filter(s => s.isActive).length;
  }

  get isPhysicalStoreActive(): boolean {
    return this.myStores.some(s => s.isActive);
  }

  // ── Getters de Resumen de Tiendas ─────────────────────────────────────────

  get primaryProfile(): SellerProfile | null {
    if (!this.seller?.sellerProfiles || this.seller.sellerProfiles.length === 0) return null;
    return this.seller.sellerProfiles[0];
  }

  get totalStores(): number {
    return this.seller?.sellerProfiles?.length || 0;
  }

  get activeStores(): number {
    return this.seller?.sellerProfiles?.filter(p => p.approvalStatus === 'approved' && p.isActive !== false).length || 0;
  }

  get pendingStores(): number {
    return this.seller?.sellerProfiles?.filter(p => p.approvalStatus === 'pending').length || 0;
  }

  get rejectedStores(): number {
    return this.seller?.sellerProfiles?.filter(p => p.approvalStatus === 'rejected').length || 0;
  }

  // ── Edición ───────────────────────────────────────────────────────────────

  openEditModal(): void {
    const p = this.primaryProfile;
    this.editForm.patchValue({
      description: p?.description ?? '',
      logoUrl:     p?.logoUrl     ?? '',
      bank:        p?.bankInfo?.bank    ?? 'BCP',
      account:     p?.bankInfo?.account ?? '',
      cci:         p?.bankInfo?.cci     ?? '',
    });
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.isSaving        = false;
  }

  saveProfile(): void {
    if (this.editForm.invalid || this.isSaving) return;
    this.isSaving = true;

    const val = this.editForm.value;
    const dto = {
      description: val.description,
      logoUrl:     val.logoUrl,
      bankInfo: {
        bank:    val.bank,
        account: val.account,
        cci:     val.cci || undefined,
      },
    };

    this.sellersService.updateProfile(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (_updatedProfile: SellerProfile) => {
          this.isSaving        = false;
          this.isEditModalOpen = false;
          this.toastService.showSuccess('Perfil comercial y datos bancarios actualizados');
          this.loadSellerData();
        },
        error: () => {
          this.isSaving = false;
          this.toastService.showError('Error al guardar los cambios');
        },
      });
  }

  getStatusClass(status: ApprovalStatus | undefined): string {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default:         return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  }

  getStatusLabel(status: ApprovalStatus | undefined): string {
    switch (status) {
      case 'approved': return 'Vendedor Oficial Verificado';
      case 'rejected': return 'Solicitud Denegada / Suspendida';
      default:         return 'Afiliación en Revisión';
    }
  }
}
