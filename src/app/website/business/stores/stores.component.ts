import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StoresService } from '../../../core/services/catalog/stores.service';
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

    // Filters
    searchTerm: string = '';
    statusFilter: 'all' | 'active' | 'inactive' = 'all';

    // UI State
    showFormModal: boolean = false;
    selectedStore: Store | null = null;
    isEditMode: boolean = false;

    // Statistics
    get totalStores(): number {
        return this.stores.length;
    }

    get activeStores(): number {
        return this.stores.filter(s => s.isActive).length;
    }

    get inactiveStores(): number {
        return this.stores.filter(s => !s.isActive).length;
    }

    constructor(private storesService: StoresService) { }

    ngOnInit(): void {
        this.loadStores();
    }

    /**
     * Load all stores
     */
    loadStores(): void {
        this.storesService.getAllStores().subscribe({
            next: (stores) => {
                this.stores = stores;
                this.applyFilters();
            },
            error: (err) => console.error('Error loading stores:', err)
        });
    }

    /**
     * Apply search and status filters
     */
    applyFilters(): void {
        let filtered = [...this.stores];

        // Status filter
        if (this.statusFilter === 'active') {
            filtered = filtered.filter(s => s.isActive);
        } else if (this.statusFilter === 'inactive') {
            filtered = filtered.filter(s => !s.isActive);
        }

        // Search filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.address.toLowerCase().includes(term) ||
                s.phone.includes(term) ||
                s.email.toLowerCase().includes(term)
            );
        }

        this.filteredStores = filtered;
    }

    /**
     * Open form modal for creating new store
     */
    openCreateModal(): void {
        this.selectedStore = null;
        this.isEditMode = false;
        this.showFormModal = true;
    }

    /**
     * Open form modal for editing store
     */
    openEditModal(store: Store): void {
        this.selectedStore = store;
        this.isEditMode = true;
        this.showFormModal = true;
    }

    /**
     * Close form modal
     */
    closeModal(): void {
        this.showFormModal = false;
        this.selectedStore = null;
        this.isEditMode = false;
    }

    /**
     * Handle store saved (created or updated)
     */
    onStoreSaved(store: Store): void {
        this.loadStores();
        this.closeModal();
    }

    /**
     * Toggle store active status
     */
    toggleStoreStatus(store: Store): void {
        const newStatus = !store.isActive;
        this.storesService.updateStore(store._id!, { isActive: newStatus }).subscribe({
            next: () => {
                store.isActive = newStatus;
                this.applyFilters();
                console.log(`✅ Store ${newStatus ? 'activated' : 'deactivated'}`);
            },
            error: (err) => console.error('Error updating store status:', err)
        });
    }

    /**
     * Delete store
     */
    deleteStore(store: Store): void {
        const confirmDelete = confirm(`¿Estás seguro de eliminar la tienda "${store.name}"?`);
        if (confirmDelete) {
            this.storesService.deleteStore(store._id!).subscribe({
                next: () => {
                    this.loadStores();
                    console.log('✅ Store deleted');
                },
                error: (err) => console.error('Error deleting store:', err)
            });
        }
    }
}
