import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Product } from '../../../core/interfaces/product.interface';
import { ProductsService } from '../../../core/services/catalog/products.service';
import { UpdateProductDto } from '../../../core/dtos/update-product.dto';
import { ImageService } from '../../../core/services/utils/image.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
})
export class ProductsComponent implements OnInit {
  // Product data
  products: Product[] = [];
  filteredProducts: Product[] = [];

  // UI state
  isAddModalOpen = false;
  isEditMode = false;
  selectedProduct: Product | null = null;
  viewMode: 'grid' | 'table' = 'table';
  isLoading = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 12;
  totalItems = 0;

  // Search and filters
  searchTerm = '';
  selectedCategory = '';
  selectedBrand = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  sortBy: 'name' | 'basePrice' | 'date' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Statistics
  stats = {
    totalProducts: 0,
    activeProducts: 0,
    totalCategories: 0,
    totalBrands: 0
  };

  constructor(
    private productsService: ProductsService,
    private imageService: ImageService
  ) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  /**
   * Load products with current filters and pagination
   */
  private loadProducts(): void {
    this.isLoading = true;
    this.productsService.getProducts(this.currentPage, this.itemsPerPage).subscribe({
      next: (result) => {
        this.products = result.data;
        this.totalItems = result.total;
        this.applyFilters();
        this.calculateStats();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.isLoading = false;
      },
    });
  }

  /**
   * Apply search and filters to products
   */
  applyFilters(): void {
    let filtered = [...this.products];

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const categoryMatch = Array.isArray(p.category)
          ? p.category.some(cat => cat.toLowerCase().includes(term))
          : false;
        return p.name.toLowerCase().includes(term) ||
          p.brand?.toLowerCase().includes(term) ||
          categoryMatch;
      });
    }

    // Category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(p =>
        Array.isArray(p.category) ? p.category.includes(this.selectedCategory) : p.category === this.selectedCategory
      );
    }

    // Brand filter
    if (this.selectedBrand) {
      filtered = filtered.filter(p => p.brand === this.selectedBrand);
    }

    // Active filter
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (this.activeFilter === 'active') return p.isActive === true;
        if (this.activeFilter === 'inactive') return p.isActive === false;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (this.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'basePrice':
          comparison = (a.basePrice || 0) - (b.basePrice || 0);
          break;
        case 'date':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });

    this.filteredProducts = filtered;
  }

  /**
   * Calculate dashboard statistics
   */
  calculateStats(): void {
    this.stats.totalProducts = this.totalItems;
    this.stats.activeProducts = this.products.filter(p => p.isActive === true).length;

    // Calculate unique categories
    const allCategories = this.products.flatMap(p =>
      Array.isArray(p.category) ? p.category : (p.category ? [p.category] : [])
    );
    this.stats.totalCategories = new Set(allCategories.filter(Boolean)).size;

    // Calculate unique brands
    this.stats.totalBrands = new Set(this.products.map(p => p.brand).filter(Boolean)).size;
  }

  /**
   * Get unique categories from products
   */
  get categories(): string[] {
    const allCategories = this.products.flatMap(p =>
      Array.isArray(p.category) ? p.category : (p.category ? [p.category] : [])
    );
    return Array.from(new Set(allCategories)).filter(Boolean);
  }

  /**
   * Get unique brands from products
   */
  get brands(): string[] {
    return Array.from(new Set(this.products.map(p => p.brand).filter(Boolean)));
  }

  /**
   * Change page
   */
  changePage(page: number): void {
    this.currentPage = page;
    this.loadProducts();
  }

  /**
   * Change items per page
   */
  changeItemsPerPage(size: number): void {
    this.itemsPerPage = size;
    this.currentPage = 1;
    this.loadProducts();
  }

  /**
   * Toggle view mode between grid and table
   */
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'table' : 'grid';
  }

  /**
   * Open/close product modal
   */
  toggleAddModal(isOpen: boolean, product?: Product, isEdit: boolean = false): void {
    this.isAddModalOpen = isOpen;
    this.selectedProduct = product ? { ...product } : null;
    this.isEditMode = isEdit;
  }

  /**
   * Handle product saved event
   */
  onProductSaved(product: Product): void {
    this.isEditMode ? this.updateProduct(product) : this.addProduct(product);
  }

  /**
   * Add new product
   */
  private addProduct(newProduct: Product): void {
    console.log('📤 Sending product to backend:', JSON.stringify(newProduct, null, 2));

    this.productsService.addProduct(newProduct).subscribe({
      next: (response) => {
        this.loadProducts(); // Reload to get updated list
        console.log('✅ Product created:', response);
      },
      error: (err) => {
        console.error('❌ Error creating product:', err);
        console.error('📋 Error details:', err.error);
        if (err.error?.message) {
          console.error('💬 Validation errors:', err.error.message);
        }
      },
    });
  }

  /**
   * Update existing product
   */
  private updateProduct(updatedProduct: Product): void {
    if (!this.selectedProduct) return;

    const changes = this.getModifiedFields(this.selectedProduct, updatedProduct);
    if (Object.keys(changes).length === 0) {
      console.log('No changes to update.');
      return;
    }

    this.productsService.updateProduct(this.selectedProduct._id, changes).subscribe({
      next: (response) => {
        this.loadProducts(); // Reload to get updated list
        console.log('Product updated:', response);
      },
      error: (err) => console.error('Error updating product:', err)
    });
  }

  /**
   * Delete product (soft or hard delete)
   * @param id Product ID
   * @param hardDelete If true, permanently delete the product
   */
  deleteProduct(id: string, hardDelete: boolean = false): void {
    const confirmMessage = hardDelete
      ? '¿Está seguro de que desea eliminar PERMANENTEMENTE este producto? Esta acción no se puede deshacer.'
      : '¿Está seguro de que desea desactivar este producto?';

    if (!confirm(confirmMessage)) {
      return;
    }

    const product = this.products.find(p => p._id === id);

    // Delete images if hard delete
    if (hardDelete && product?.gallery) {
      product.gallery.forEach(imageUrl => {
        const idLink = imageUrl.split('/').pop();
        if (idLink) {
          this.imageService.deleteImage(idLink).subscribe({
            next: () => console.log('Image deleted:', imageUrl),
            error: (err) => console.error('Error deleting image:', err),
          });
        }
      });
    }

    // Call appropriate delete method
    const deleteObservable = hardDelete
      ? this.productsService.hardDeleteProduct(id)
      : this.productsService.deleteProduct(id);

    deleteObservable.subscribe({
      next: () => {
        this.loadProducts(); // Reload to get updated list
        console.log(`Product ${hardDelete ? 'permanently deleted' : 'deactivated'}:`, id);
      },
      error: (err) => console.error('Error deleting product:', err),
    });
  }

  /**
   * Get modified fields between two products
   */
  private getModifiedFields(original: Product, updated: Product): UpdateProductDto {
    const changes: any = {};
    
    Object.keys(updated).forEach((key) => {
      // Skip rating field as it's not part of UpdateProductDto
      if (key === 'rating' || key === '_id' || key === 'createdAt' || key === 'updatedAt') return;
      
      const updatedValue = updated[key as keyof Product];
      const originalValue = original[key as keyof Product];

      if (Array.isArray(updatedValue)) {
        if (!this.arraysAreEqual(updatedValue, originalValue as string[])) {
          changes[key] = updatedValue;
        }
      } else if (typeof updatedValue === 'object' && updatedValue !== null) {
        if (!this.objectsAreEqual(updatedValue, originalValue as object)) {
          changes[key] = updatedValue;
        }
      } else if (updatedValue !== originalValue && updatedValue !== undefined) {
        changes[key] = updatedValue;
      }
    });
    
    return changes as UpdateProductDto;
  }

  /**
   * Compare if two objects are equal
   */
  private objectsAreEqual(obj1: object, obj2: object): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  /**
   * Compare if two arrays are equal
   */
  private arraysAreEqual(arr1: any[], arr2: any[]): boolean {
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
  }


  /**
   * Get displayed range text
   */
  getDisplayedRange(): string {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `Mostrando ${start} a ${end} de ${this.totalItems} productos`;
  }

  /**
   * Get total pages
   */
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedBrand = '';
    this.activeFilter = 'all';
    this.applyFilters();
  }
}