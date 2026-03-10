import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsComponent } from './pages/products/products.component';
import { ProductsService } from '../../../core/services/catalog/products.service';
import { Product } from '../../../core/interfaces/product.interface';
import { Subscription } from 'rxjs';
import {
  PRODUCT_CATEGORIES,
  PRICE_RANGES,
  SORT_OPTIONS,
  RATING_OPTIONS,
  Category
} from '../../../core/constants/product-categories';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductsComponent],
  templateUrl: './store.component.html',
  styleUrl: './store.component.css'
})
export class StoreComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  private allProducts: Product[] = []; // catálogo completo sin filtrar
  private catalogSub?: Subscription;

  // Constants from product-categories
  categories = PRODUCT_CATEGORIES;
  priceRanges = PRICE_RANGES;
  sortOptions = SORT_OPTIONS;
  ratingOptions = RATING_OPTIONS;

  // Active filters
  searchQuery: string = '';
  selectedCategory: string | null = null;
  selectedSubcategory: string | null = null;
  selectedPriceRange: string = 'all';
  selectedRating: number | null = null;
  selectedSort: string = 'newest';
  priceValue: number = 2000;

  // UI State
  expandedCategories: Set<string> = new Set();
  showMobileFilters: boolean = false;
  isDropdownOpen: boolean = false;

  constructor(private productsService: ProductsService) { }

  ngOnInit(): void {
    this.selectedCategory = 'all';
    // Suscribirse al caché — la carga HTTP ocurre solo la 1ra vez
    this.catalogSub = this.productsService.catalog$.subscribe(catalog => {
      this.allProducts = catalog;
      this.applyFilters();
    });
    this.productsService.loadCatalog();
  }

  ngOnDestroy(): void {
    this.catalogSub?.unsubscribe();
  }

  /** Aplica filtros localmente sobre el catálogo en memoria */
  applyFilters(): void {
    let result = [...this.allProducts];

    // Búsqueda por texto
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Categoría
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      result = result.filter(p =>
        p.category?.some(c => c.toLowerCase() === this.selectedCategory!.toLowerCase())
      );
    }

    // Subcategoría
    if (this.selectedSubcategory) {
      result = result.filter(p =>
        p.category?.some(c => c.toLowerCase() === this.selectedSubcategory!.toLowerCase())
      );
    }

    // Precio máximo
    if (this.priceValue < 2000) {
      result = result.filter(p => p.basePrice <= this.priceValue);
    }

    // Rating
    if (this.selectedRating) {
      result = result.filter(p => (p.rating?.average ?? 0) >= this.selectedRating!);
    }

    // Ordenar
    switch (this.selectedSort) {
      case 'price-asc':  result.sort((a, b) => a.basePrice - b.basePrice); break;
      case 'price-desc': result.sort((a, b) => b.basePrice - a.basePrice); break;
      case 'newest':     result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'popular':    result.sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0)); break;
    }

    this.products = result;
  }

  // Search
  onSearch(): void { this.applyFilters(); }
  clearSearch(): void { this.searchQuery = ''; this.applyFilters(); }

  // Category selection
  selectCategory(categoryId: string): void {
    const previousCategory = this.selectedCategory;

    if (this.selectedCategory === categoryId) {
      this.selectedCategory = null;
      this.selectedSubcategory = null;
      this.expandedCategories.delete(categoryId);
    } else {
      if (previousCategory) {
        this.expandedCategories.delete(previousCategory);
      }
      this.selectedCategory = categoryId;
      this.selectedSubcategory = null;
      this.expandedCategories.add(categoryId);
    }
    this.applyFilters();
  }

  selectSubcategory(subcategoryId: string): void {
    const previousCategory = this.selectedCategory;

    this.selectedSubcategory = this.selectedSubcategory === subcategoryId ? null : subcategoryId;

    if (this.selectedSubcategory) {
      const parentCategoryId = this.getParentCategoryId(subcategoryId);
      if (parentCategoryId) {
        if (previousCategory && previousCategory !== parentCategoryId) {
          this.expandedCategories.delete(previousCategory);
        }
        this.selectedCategory = parentCategoryId;
        this.expandedCategories.add(parentCategoryId);
      }
    } else {
      if (previousCategory) {
        this.selectedCategory = null;
        this.expandedCategories.delete(previousCategory);
      }
    }
    this.applyFilters();
  }

  toggleCategoryExpansion(categoryId: string): void {
    if (this.expandedCategories.has(categoryId)) {
      this.expandedCategories.delete(categoryId);
    } else {
      this.expandedCategories.add(categoryId);
    }
  }

  isCategoryExpanded(categoryId: string): boolean {
    return this.expandedCategories.has(categoryId);
  }

  getCategoryById(categoryId: string): Category | undefined {
    return this.categories.find(cat => cat.id === categoryId);
  }

  onCategoryHover(categoryId: string): void {
    if (this.selectedCategory !== categoryId && !this.expandedCategories.has(categoryId)) {
      this.expandedCategories.add(categoryId);
    }
  }

  onCategoryLeave(categoryId: string): void {
    if (this.selectedCategory !== categoryId) {
      this.expandedCategories.delete(categoryId);
    }
  }

  getParentCategoryId(subcategoryId: string): string | null {
    for (const category of this.categories) {
      if (category.subcategories) {
        const hasSubcategory = category.subcategories.some(sub => sub.id === subcategoryId);
        if (hasSubcategory) {
          return category.id;
        }
      }
    }
    return null;
  }

  // Price range
  selectPriceRange(rangeId: string): void {
    this.selectedPriceRange = rangeId;
    const range = this.priceRanges.find(r => r.id === rangeId);
    if (range) {
      this.priceValue = range.max === Infinity ? 2000 : range.max;
    }
    this.applyFilters();
  }

  onPriceChange(event: any): void {
    this.priceValue = event.target.value;
    this.selectedPriceRange = 'custom';
    this.applyFilters();
  }

  // Rating
  selectRating(stars: number): void {
    this.selectedRating = this.selectedRating === stars ? null : stars;
    this.applyFilters();
  }

  // Sort
  onSortChange(sortId: string): void {
    this.selectedSort = sortId;
    this.applyFilters();
  }

  // Clear filters
  clearFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.selectedSubcategory = null;
    this.selectedPriceRange = 'all';
    this.selectedRating = null;
    this.priceValue = 2000;
    this.expandedCategories.clear();
    this.applyFilters();
  }

  // Mobile filters
  toggleMobileFilters(): void {
    this.showMobileFilters = !this.showMobileFilters;
  }

  // Active filters count
  get activeFiltersCount(): number {
    let count = 0;
    if (this.searchQuery) count++;
    if (this.selectedCategory && this.selectedCategory !== 'all') count++;
    if (this.selectedSubcategory) count++;
    if (this.selectedPriceRange !== 'all') count++;
    if (this.selectedRating) count++;
    return count;
  }

  getPriceRangeLabel(): string {
    const range = this.priceRanges.find(r => r.id === this.selectedPriceRange);
    return range ? range.label : '';
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.ecommerce-dropdown-button') || target.closest('.ecommerce-dropdown-menu');
    if (!clickedInside && this.isDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }

  selectSortOption(optionId: string): void {
    this.selectedSort = optionId;
    this.isDropdownOpen = false;
    this.applyFilters();
  }

  getSelectedSortLabel(): string {
    const option = this.sortOptions.find(opt => opt.id === this.selectedSort);
    return option ? option.label : 'Más recientes';
  }

  getSelectedSortIcon(): string {
    const option = this.sortOptions.find(opt => opt.id === this.selectedSort);
    return option?.icon || 'sparkles';
  }

  getSortIcon(iconName: string): string {
    const icons: { [key: string]: string } = {
      'sparkles': 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
      'arrow-up': 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
      'arrow-down': 'M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.511l-5.511-3.181',
      'clock': 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
      'fire': 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z'
    };
    return icons[iconName] || icons['sparkles'];
  }

  getCategoryIcon(iconName: string): string {
    const icons: { [key: string]: string } = {
      'grid': 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
      'desktop': 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
      'shopping-bag': 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
      'home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
      'trophy': 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0',
      'sparkles': 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
      'puzzle': 'M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z',
      'book': 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
      'truck': 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12'
    };
    return icons[iconName] || icons['grid'];
  }
}
