import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { StoresService } from '../../../core/services/catalog/stores.service';
import { AuthService }   from '../../../core/services/auth/auth.service';
import { ToastService }  from '../../../core/services/ui/toast.service';
import { Store } from '../../../core/interfaces/store.interface';
import { FormStoreComponent } from './form-store/form-store.component';

@Component({
    selector: 'app-stores',
    standalone: true,
    imports: [CommonModule, FormsModule, FormStoreComponent, RouterLink],
    templateUrl: './stores.component.html',
    styleUrls: ['./stores.component.css']
})
export class StoresComponent implements OnInit {
    stores: Store[] = [];
    filteredStores: Store[] = [];
    isLoading: boolean = false;

    // Filters & Views
    searchTerm: string = '';
    statusFilter: 'all' | 'active' | 'inactive' = 'all';
    typeFilter: 'all' | 'physical' | 'virtual' | 'hybrid' = 'all';
    viewMode: 'grid' | 'table' = 'grid';

    /** true cuando el usuario autenticado tiene rol 'admin' */
    isAdmin = false;

    /** true cuando el usuario autenticado tiene rol 'seller' (solo ve su tienda) */
    isSeller = false;

    /** ID del seller cuando el admin entra via /business/stores?seller=:sellerId */
    sellerFilter: string | null = null;

    /** Nombre del seller para mostrar en el banner */
    sellerName = '';

    // UI State
    showFormModal: boolean = false;
    selectedStore: Store | null = null;
    isEditMode: boolean = false;

    // Statistics & Omnichannel KPIs
    get totalStores(): number {
        return this.stores.length;
    }

    get activeStores(): number {
        return this.stores.filter(s => s.isActive).length;
    }

    get inactiveStores(): number {
        return this.stores.filter(s => !s.isActive).length;
    }

    get pickupStores(): number {
        return this.stores.filter(s => s.capabilities?.hasPickup).length;
    }

    get deliveryStores(): number {
        return this.stores.filter(s => s.capabilities?.hasDelivery).length;
    }

    get physicalStores(): number {
        return this.stores.filter(s => s.type === 'physical').length;
    }

    get virtualStores(): number {
        return this.stores.filter(s => s.type === 'virtual').length;
    }

    get hybridStores(): number {
        return this.stores.filter(s => s.type === 'hybrid').length;
    }

    get coveredCitiesCount(): number {
        const cities = this.stores
            .map(s => s.location?.city?.trim())
            .filter((c): c is string => !!c);
        return new Set(cities).size;
    }

    constructor(
        private storesService: StoresService,
        private route:         ActivatedRoute,
        private authService:   AuthService,
        private toastService:  ToastService
    ) { }

    ngOnInit(): void {
        this.isAdmin      = this.authService.hasRole('admin');
        this.isSeller     = this.authService.hasRole('seller');
        this.sellerFilter = this.route.snapshot.queryParamMap.get('seller');
        this.sellerName   = this.route.snapshot.queryParamMap.get('sellerName') ?? '';
        this.loadStores();
    }

    /**
     * Carga tiendas según el contexto del usuario autenticado:
     * - Con ?seller=:id → carga solo las tiendas del seller filtrado
     * - Sin param       → carga todas las tiendas (vista general admin)
     */
    loadStores(): void {
        this.isLoading = true;

        // 1. Seller autenticado: consulta sus propias tiendas
        if (this.isSeller && !this.isAdmin) {
            this.storesService.getMyStore()
                .pipe(finalize(() => { this.isLoading = false; }))
                .subscribe({
                    next: (stores: Store[]) => {
                        this.stores = Array.isArray(stores) ? stores : (stores ? [stores] : []);
                        this.applyFilters();
                    },
                    error: (err) => {
                        console.warn('No se pudieron cargar tiendas del seller:', err);
                        this.stores = [];
                        this.applyFilters();
                        this.toastService.showError('No se pudieron cargar tus tiendas');
                    }
                });
            return;
        }

        // 2. Admin viendo tiendas de un seller específico (?seller=:id)
        if (this.sellerFilter) {
            this.storesService.getStoresBySeller(this.sellerFilter)
                .pipe(finalize(() => { this.isLoading = false; }))
                .subscribe({
                    next: (stores) => {
                        this.stores = stores;
                        this.applyFilters();
                    },
                    error: (err) => {
                        console.error('Error loading stores for seller:', err);
                        this.stores = [];
                        this.applyFilters();
                        this.toastService.showError('Error al cargar tiendas del seller');
                    }
                });
            return;
        }

        // 3. Admin / Worker general: carga todas las tiendas
        this.storesService.getAllStores()
            .pipe(finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: (stores) => {
                    this.stores = stores;
                    this.applyFilters();
                },
                error: (err) => {
                    console.error('Error loading stores:', err);
                    this.toastService.showError('Error al cargar tiendas');
                }
            });
    }

    /**
     * Aplica filtros de búsqueda, estado y tipo sobre la lista de tiendas.
     */
    applyFilters(): void {
        let filtered = [...this.stores];

        if (this.statusFilter === 'active') {
            filtered = filtered.filter(s => s.isActive);
        } else if (this.statusFilter === 'inactive') {
            filtered = filtered.filter(s => !s.isActive);
        }

        if (this.typeFilter !== 'all') {
            filtered = filtered.filter(s => (s.type || 'physical') === this.typeFilter);
        }

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase().trim();
            filtered = filtered.filter(s =>
                s.name?.toLowerCase().includes(term) ||
                s.location?.address?.toLowerCase().includes(term) ||
                s.location?.city?.toLowerCase().includes(term) ||
                s.location?.state?.toLowerCase().includes(term) ||
                s.contact?.phone?.includes(term) ||
                s.contact?.email?.toLowerCase().includes(term) ||
                s.code?.toLowerCase().includes(term)
            );
        }

        this.filteredStores = filtered;
    }

    setStatusFilter(status: 'all' | 'active' | 'inactive'): void {
        this.statusFilter = status;
        this.applyFilters();
    }

    setTypeFilter(type: 'all' | 'physical' | 'virtual' | 'hybrid'): void {
        this.typeFilter = type;
        this.applyFilters();
    }

    clearSearch(): void {
        this.searchTerm = '';
        this.applyFilters();
    }

    setViewMode(mode: 'grid' | 'table'): void {
        this.viewMode = mode;
    }

    openCreateModal(): void {
        this.selectedStore = null;
        this.isEditMode = false;
        this.showFormModal = true;
    }

    openEditModal(store: Store): void {
        this.selectedStore = store;
        this.isEditMode = true;
        this.showFormModal = true;
    }

    closeModal(): void {
        this.showFormModal = false;
        this.selectedStore = null;
        this.isEditMode = false;
    }

    onStoreSaved(store: Store): void {
        this.loadStores();
        this.closeModal();
    }

    /**
     * Activa o desactiva una tienda con feedback visual inmediato.
     */
    toggleStoreStatus(store: Store): void {
        const newStatus = !store.isActive;
        const request$ = (this.isSeller && !this.isAdmin)
            ? this.storesService.updateMyStore(store._id!, { isActive: newStatus })
            : this.storesService.updateStore(store._id!, { isActive: newStatus });

        request$.subscribe({
            next: () => {
                store.isActive = newStatus;
                this.applyFilters();
                this.toastService.showSuccess(newStatus ? `"${store.name}" activada` : `"${store.name}" desactivada`);
            },
            error: (err) => {
                console.error('Error actualizando estado:', err);
                this.toastService.showError('No se pudo cambiar el estado de la tienda');
            }
        });
    }

    /**
     * Eliminación con confirmación estilizada a través de ToastService.
     */
    deleteStore(store: Store): void {
        this.toastService.showConfirm(
            `¿Estás seguro de eliminar la tienda "${store.name}"? Esta acción removerá sus inventarios y configuración asociada.`,
            () => {
                const req$ = (this.isSeller && !this.isAdmin)
                    ? this.storesService.deleteMyStore(store._id!)
                    : this.storesService.deleteStore(store._id!);

                req$.subscribe({
                    next: () => {
                        this.loadStores();
                        this.toastService.showSuccess('Tienda eliminada exitosamente');
                    },
                    error: (err) => {
                        console.error('Error deleting store:', err);
                        this.toastService.showError('Error al eliminar la tienda');
                    }
                });
            },
            undefined,
            'Sí, eliminar',
            'Cancelar'
        );
    }
}
