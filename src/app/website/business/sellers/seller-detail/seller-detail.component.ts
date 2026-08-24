import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SellersService }  from '../../../../core/services/catalog/sellers.service';
import { ProductsService } from '../../../../core/services/catalog/products.service';
import { StoresService }   from '../../../../core/services/catalog/stores.service';
import { ToastService }    from '../../../../core/services/ui/toast.service';
import {
  ApprovalStatus,
  SellerUser,
  SellerProfile,
} from '../../../../core/interfaces/seller.interface';
import { Product } from '../../../../core/interfaces/product.interface';
import { Store } from '../../../../core/interfaces/store.interface';

/**
 * Componente de detalle y supervisión de un seller para el panel de administración.
 *
 * Ruta: /business/sellers/:id
 *
 * Pestañas:
 *   1. "Información y Tiendas": Datos del contacto, perfiles de tienda y aprobación/rechazo.
 *   2. "Catálogo de Productos": Inspección de productos del seller, búsqueda, filtros y moderación (pausar/activar con motivo).
 */
@Component({
  selector: 'app-seller-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './seller-detail.component.html',
})
export class SellerDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ── Pestaña Activa ────────────────────────────────────────────────────────
  activeTab: 'info' | 'catalog' = 'info';

  // ── Estado general ────────────────────────────────────────────────────────
  seller:    SellerUser | null = null;
  isLoading  = false;
  sellerId   = '';

  // ── Edición de perfil de tienda ───────────────────────────────────────────
  editingProfileIndex = -1;
  profileForm!: FormGroup;
  isSaving = false;
  processingProfileId: string | null = null;

  // ── Tiendas físicas/virtuales del seller (colección stores) ─────────────
  sellerStores: Store[] = [];
  isLoadingStores = false;

  // ── Catálogo de productos del seller ──────────────────────────────────────
  sellerProducts:    Product[] = [];
  filteredProducts:  Product[] = [];
  isLoadingCatalog   = false;
  catalogSearchTerm  = '';
  catalogStatusFilter: 'all' | 'active' | 'inactive' = 'all';
  catalogTotal       = 0;

  // ── Modal de Moderación / Motivo de cambio ─────────────────────────────────
  showModerationModal    = false;
  productToModerate:     Product | null = null;
  selectedReasonOption   = 'stock';
  customReasonText       = '';
  isModerating           = false;

  readonly quickReasons = [
    { key: 'stock',  label: 'Falta de stock / desabastecimiento recurrente' },
    { key: 'price',  label: 'Precio inconsistente o erróneo' },
    { key: 'images', label: 'Imágenes o fotos no cumplen con estándares de calidad' },
    { key: 'policy', label: 'Incumplimiento de políticas de publicación de Moorea' },
    { key: 'other',  label: 'Otro motivo (especificado manualmente)' },
  ];

  constructor(
    private readonly route:           ActivatedRoute,
    private readonly router:          Router,
    private readonly fb:              FormBuilder,
    private readonly sellersService:  SellersService,
    private readonly productsService: ProductsService,
    private readonly storesService:   StoresService,
    private readonly toastService:    ToastService,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.sellerId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.sellerId) {
      this.router.navigate(['/business/sellers']);
      return;
    }
    this.buildForm();
    this.loadSeller();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  /**
   * Carga los datos del seller por su ID desde el backend.
   */
  loadSeller(): void {
    this.isLoading = true;
    this.sellersService.getSellerById(this.sellerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (seller) => {
          this.seller    = seller;
          this.isLoading = false;
          // Cargar catálogo y tiendas reales en segundo plano
          this.loadSellerProducts();
          this.loadSellerStores();
        },
        error: () => {
          this.isLoading = false;
          this.toastService.showError('No se pudo cargar el seller');
          this.router.navigate(['/business/sellers']);
        },
      });
  }

  /**
   * Carga las tiendas físicas/virtuales registradas de este seller desde el StoresService.
   */
  loadSellerStores(): void {
    this.isLoadingStores = true;
    this.storesService.getStoresBySeller(this.sellerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stores) => {
          this.sellerStores = stores;
          this.isLoadingStores = false;
        },
        error: () => {
          this.sellerStores = [];
          this.isLoadingStores = false;
        }
      });
  }

  /** Total de tiendas físicas/virtuales reales registradas en /business/stores */
  get totalStoresCount(): number {
    return this.sellerStores.length;
  }

  /** Tiendas activas */
  get totalActiveStoresCount(): number {
    return this.sellerStores.filter(s => s.isActive).length;
  }

  /** Tiendas inactivas */
  get totalInactiveStoresCount(): number {
    return this.sellerStores.filter(s => !s.isActive).length;
  }

  // ── Gestión del Catálogo del Seller ───────────────────────────────────────

  setTab(tab: 'info' | 'catalog'): void {
    this.activeTab = tab;
    if (tab === 'catalog' && this.sellerProducts.length === 0) {
      this.loadSellerProducts();
    }
  }

  loadSellerProducts(): void {
    this.isLoadingCatalog = true;
    this.productsService.getProductsByOwner(this.sellerId, 1, 100, 'all')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.sellerProducts = res.data ?? [];
          this.catalogTotal   = res.total ?? this.sellerProducts.length;
          this.applyCatalogFilters();
          this.isLoadingCatalog = false;
        },
        error: () => {
          this.isLoadingCatalog = false;
          this.toastService.showError('Error al cargar el catálogo del seller');
        },
      });
  }

  applyCatalogFilters(): void {
    let list = [...this.sellerProducts];

    if (this.catalogSearchTerm.trim()) {
      const term = this.catalogSearchTerm.toLowerCase().trim();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term) ||
        p.category?.some(c => c.toLowerCase().includes(term))
      );
    }

    if (this.catalogStatusFilter === 'active') {
      list = list.filter(p => p.isActive === true);
    } else if (this.catalogStatusFilter === 'inactive') {
      list = list.filter(p => p.isActive === false);
    }

    this.filteredProducts = list;
  }

  setCatalogFilter(status: 'all' | 'active' | 'inactive'): void {
    this.catalogStatusFilter = status;
    this.applyCatalogFilters();
  }

  get totalActiveProducts(): number {
    return this.sellerProducts.filter(p => p.isActive === true).length;
  }

  get totalInactiveProducts(): number {
    return this.sellerProducts.filter(p => p.isActive === false).length;
  }

  // ── Moderación: Pausar y Activar Producto ─────────────────────────────────

  openModerationModal(product: Product): void {
    this.productToModerate    = product;
    this.selectedReasonOption = 'stock';
    this.customReasonText     = '';
    this.showModerationModal  = true;
  }

  closeModerationModal(): void {
    this.showModerationModal = false;
    this.productToModerate   = null;
    this.customReasonText    = '';
    this.isModerating        = false;
  }

  confirmDeactivation(): void {
    if (!this.productToModerate) return;

    let finalReason = '';
    if (this.selectedReasonOption === 'other') {
      finalReason = this.customReasonText.trim() || 'Modificación o pausa administrativa';
    } else {
      const option = this.quickReasons.find(r => r.key === this.selectedReasonOption);
      finalReason = option ? option.label : 'Pausa administrativa';
      if (this.customReasonText.trim()) {
        finalReason += ` — Detalle: ${this.customReasonText.trim()}`;
      }
    }

    this.isModerating = true;
    this.productsService.deactivateProduct(this.productToModerate._id, finalReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProduct) => {
          this.isModerating = false;
          this.closeModerationModal();
          this.toastService.showSuccess(`Producto "${updatedProduct.name}" pausado con motivo de moderación.`);

          // Actualizar estado local
          const index = this.sellerProducts.findIndex(p => p._id === updatedProduct._id);
          if (index !== -1) {
            this.sellerProducts[index] = { ...this.sellerProducts[index], ...updatedProduct };
            this.applyCatalogFilters();
          }
        },
        error: () => {
          this.isModerating = false;
          this.toastService.showError('Error al pausar el producto');
        },
      });
  }

  activateProduct(product: Product): void {
    if (!confirm(`¿Reactivar el producto "${product.name}" en el catálogo?`)) return;

    this.productsService.activateProduct(product._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProduct) => {
          this.toastService.showSuccess(`Producto "${updatedProduct.name}" reactivado correctamente.`);

          // Actualizar estado local
          const index = this.sellerProducts.findIndex(p => p._id === updatedProduct._id);
          if (index !== -1) {
            this.sellerProducts[index] = { ...this.sellerProducts[index], ...updatedProduct, moderationReason: '' };
            this.applyCatalogFilters();
          }
        },
        error: () => {
          this.toastService.showError('Error al activar el producto');
        },
      });
  }

  // ── Edición de perfil de tienda ───────────────────────────────────────────

  private buildForm(): void {
    this.profileForm = this.fb.group({
      shopName:       ['', [Validators.required, Validators.minLength(2)]],
      description:    [''],
      logoUrl:        [''],
      commissionRate: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  startEditProfile(index: number, profile: SellerProfile): void {
    this.editingProfileIndex = index;
    this.profileForm.patchValue({
      shopName:       profile.shopName,
      description:    profile.description   ?? '',
      logoUrl:        profile.logoUrl       ?? '',
      commissionRate: profile.commissionRate ?? 10,
    });
  }

  cancelEdit(): void {
    this.editingProfileIndex = -1;
    this.profileForm.reset();
  }

  isInvalid(field: string): boolean {
    const ctrl = this.profileForm.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  saveProfile(profileId?: string): void {
    if (this.profileForm.invalid || this.isSaving) return;
    this.isSaving = true;

    this.sellersService.updateProfile(this.profileForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.isSaving = false;
          this.editingProfileIndex = -1;
          this.toastService.showSuccess('Perfil actualizado correctamente');
          if (this.seller && this.seller.sellerProfiles) {
            const idx = this.seller.sellerProfiles.findIndex(p => p._id === profileId);
            if (idx !== -1) this.seller.sellerProfiles[idx] = updated;
          }
        },
        error: () => {
          this.isSaving = false;
          this.toastService.showError('Error al actualizar el perfil');
        },
      });
  }

  // ── Acciones de aprobación / rechazo ──────────────────────────────────────

  approveSellerAll(): void {
    if (!this.seller) return;
    this.processingProfileId = 'approve-all';
    this.sellersService.approveSeller(this.seller._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processingProfileId = null;
          this.toastService.showSuccess('Seller y sus tiendas aprobados exitosamente');
          this.loadSeller();
        },
        error: () => {
          this.processingProfileId = null;
          this.toastService.showError('Error al aprobar el seller');
        },
      });
  }

  rejectSellerAll(): void {
    if (!this.seller) return;
    if (!confirm(`¿Rechazar/suspender a "${this.seller.displayName || this.seller.email}"?`)) return;

    this.processingProfileId = 'reject-all';
    this.sellersService.rejectSeller(this.seller._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processingProfileId = null;
          this.toastService.showWarning('Seller y sus tiendas han sido suspendidos');
          this.loadSeller();
        },
        error: () => {
          this.processingProfileId = null;
          this.toastService.showError('Error al suspender el seller');
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getStatusClass(status: ApprovalStatus | undefined): string {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default:         return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  }

  getStatusLabel(status: ApprovalStatus | undefined): string {
    switch (status) {
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Denegado / Suspendido';
      default:         return 'Pendiente';
    }
  }

  get consolidatedStatus(): ApprovalStatus {
    const profiles = this.seller?.sellerProfiles ?? [];
    if (profiles.length === 0) return 'pending';
    if (profiles.some(p => p.approvalStatus === 'approved' && p.isActive !== false)) return 'approved';
    if (profiles.every(p => p.approvalStatus === 'rejected')) return 'rejected';
    return 'pending';
  }

  /**
   * Retorna el primer perfil de tienda aprobado o el primero disponible.
   * Usado en el header banner para mostrar el logo y nombre de la tienda principal.
   */
  get primaryProfile(): SellerProfile | null {
    if (!this.seller?.sellerProfiles?.length) return null;
    return (
      this.seller.sellerProfiles.find(p => p.approvalStatus === 'approved') ??
      this.seller.sellerProfiles[0]
    );
  }

  /**
   * Retorna la fecha de registro del seller formateada en español.
   * Ejemplo: "agosto 2025"
   */
  get memberSince(): string {
    const date = (this.seller as any)?.createdAt;
    if (!date) return 'Fecha desconocida';
    return new Date(date).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  }

  /** Cantidad de tiendas activas y aprobadas del seller. */
  get totalApprovedStores(): number {
    return this.seller?.sellerProfiles?.filter(p => p.approvalStatus === 'approved').length ?? 0;
  }

  /** Cantidad de tiendas pendientes o en revisión. */
  get totalPendingStores(): number {
    return this.seller?.sellerProfiles?.filter(p => p.approvalStatus === 'pending').length ?? 0;
  }
}
