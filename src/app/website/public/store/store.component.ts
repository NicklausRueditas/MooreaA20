import {
  Component, OnInit, OnDestroy, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject, Subscription, debounceTime, distinctUntilChanged, takeUntil
} from 'rxjs';

import { ProductsComponent } from './pages/products/products.component';
import { ProductsService }   from '../../../core/services/catalog/products.service';
import { GeoService, GeoLocation } from '../../../core/services/utils/geo.service';
import { Product }           from '../../../core/interfaces/product.interface';
import { SORT_OPTIONS, RATING_OPTIONS } from '../../../core/constants/product-categories';

/** Máximo precio del slider (S/) */
const MAX_PRICE = 2000;
/** Límite de productos para el caché inicial */
const CATALOG_LIMIT = 100;

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductsComponent],
  templateUrl: './store.component.html',
  styleUrl: './store.component.css',
})
export class StoreComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private catalogSub?: Subscription;

  // ── Datos ─────────────────────────────────────────────────────────────────
  /** Catálogo en caché (varía según el filtro activo) */
  private cacheProducts: Product[] = [];
  /** Productos visibles tras aplicar filtros locales */
  products: Product[] = [];

  // ── GEO ───────────────────────────────────────────────────────────────────
  /** Ubicación resuelta del cliente (disponible en plantilla). */
  geoLocation: GeoLocation | null = null;
  /** true mientras se espera la respuesta de /geo/location */
  geoLoading = false;

  // ── Categorías dinámicas (extraídas del catálogo) ─────────────────────────
  /** Lista de nombres de categoría únicos presentes en el backend */
  dynamicCategories: string[] = [];

  // ── Constantes para la UI ─────────────────────────────────────────────────
  sortOptions    = SORT_OPTIONS;
  ratingOptions  = RATING_OPTIONS;

  // ── Filtros activos ───────────────────────────────────────────────────────
  searchQuery        = '';
  selectedCategory   = 'all';
  selectedPriceRange = 'all';
  selectedRating: number | null = null;
  selectedSort       = 'newest';
  priceValue         = MAX_PRICE;

  // ── Estado UI ─────────────────────────────────────────────────────────────
  isLoading         = false;
  isDropdownOpen    = false;
  showMobileFilters = false;

  // ── Paginación ────────────────────────────────────────────────────────────
  currentPage  = 1;
  itemsPerPage = 12;
  totalItems   = 0;
  get totalPages(): number { return Math.ceil(this.totalItems / this.itemsPerPage); }

  // ── Streams internos ──────────────────────────────────────────────────────
  /** Stream para debounce del texto de búsqueda → fallback al backend */
  private readonly searchTerm$ = new Subject<string>();
  /** Stream para debounce del slider de precio */
  private readonly priceSlider$ = new Subject<number>();

  constructor(
    private readonly productsService: ProductsService,
    private readonly geoService: GeoService,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.setupDebounces();
    this.initGeoAndCatalog();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.catalogSub?.unsubscribe();
  }

  // ─── GEO: Inicialización ──────────────────────────────────────────────────

  /**
   * Resuelve la ubicación del cliente al arrancar /store y luego carga el
   * catálogo GEO (GET /product/active/geo) con las coordenadas obtenidas.
   *
   * Flujo:
   *  1. GeoService.resolve() → GET /geo/location (con Bearer token si está auth)
   *  2. Con lat/lng resueltos → ProductsService.loadGeoCatalog(lat, lng)
   *  3. catalog$ emite con nearestStoreKm en cada producto
   *
   * Mientras espera la GEO (típicamente < 200 ms), el spinner ya está activo
   * porque isLoading se activó en loadInitialCatalog().
   */
  private initGeoAndCatalog(): void {
    this.isLoading  = true;
    this.geoLoading = true;

    this.geoService
      .resolve()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (location) => {
          this.geoLocation = location;
          this.geoLoading  = false;

          // Suscribirse al catálogo antes de disparar la carga
          this.subscribeToGeoGatalog();

          // Cargar catálogo GEO con las coordenadas resueltas
          this.productsService.loadGeoCatalog(location.lat, location.lng, 1, CATALOG_LIMIT);
        },
        error: () => {
          // El GeoService hace fallback interno → esto nunca debería llegar aquí
          this.geoLoading = false;
          this.loadInitialCatalog(); // fallback seguro al catálogo estándar
        },
      });
  }

  /**
   * Se suscribe al catálogo$ del servicio de productos para recibir el
   * catálogo GEO cuando esté disponible. Idéntica lógica a loadInitialCatalog()
   * pero sin disparar la petición HTTP (loadGeoCatalog() ya fue llamado).
   */
  private subscribeToGeoGatalog(): void {
    this.catalogSub?.unsubscribe();
    this.catalogSub = this.productsService.catalog$.subscribe(catalog => {
      this.cacheProducts = catalog;
      this.buildDynamicCategories();
      this.applyLocalFilters();
      if (catalog.length > 0) {
        this.isLoading = false;
      }
    });
  }

  // ─── Setup de debounces ───────────────────────────────────────────────────

  /**
   * Configura los streams con debounce:
   * - Texto: 350 ms → fallback al backend si no hay resultados locales
   * - Precio: 300 ms → consulta al backend
   */
  private setupDebounces(): void {
    // Búsqueda con debounce — siempre filtra sobre el caché local que tiene thumbnailGallery.
    // Solo hace fallback al backend si el caché está vacío (primera carga no completada).
    this.searchTerm$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(query => {
        const snapshot = this.productsService.getCatalogSnapshot();
        if (snapshot.length === 0 && query.trim().length >= 2) {
          // Caché aún vacía → fallback al backend como último recurso
          this.fetchByTags(query.trim());
        } else {
          // Aplicar filtro localmente sobre el caché completo (mantiene thumbnailGallery)
          this.cacheProducts = snapshot;
          this.applyLocalFilters();
        }
      });

    // El slider de precio siempre filtra localmente para preservar thumbnailGallery.
    // El debounce solo sirve para evitar renders excesivos durante el drag.
    this.priceSlider$
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        // Restaurar desde el snapshot completo y re-filtrar localmente
        const snapshot = this.productsService.getCatalogSnapshot();
        this.cacheProducts = snapshot;
        this.applyLocalFilters();
      });
  }

  // ─── Carga de datos ───────────────────────────────────────────────────────

  /**
   * Carga el catálogo estándar (sin GEO) como fallback.
   * Solo hace HTTP la primera vez; las siguientes usan el valor en memoria.
   * Llamado como respaldo cuando el GeoService falla inesperadamente.
   */
  private loadInitialCatalog(): void {
    this.isLoading = true;
    this.catalogSub?.unsubscribe();

    this.catalogSub = this.productsService.catalog$.subscribe(catalog => {
      // Siempre procesamos el emit: vacío al inicio → muestra spinner,
      // con datos → muestra productos. Nunca filtrar por length.
      this.cacheProducts = catalog;
      this.buildDynamicCategories();
      this.applyLocalFilters();
      // Quitamos el spinner solo cuando hay productos o ya cargó
      if (catalog.length > 0) {
        this.isLoading = false;
      }
    });

    this.productsService.loadCatalog(1, CATALOG_LIMIT);

    // Si el catálogo ya estaba cargado (flag interno del servicio),
    // el catalog$ ya emitió con datos → apagamos isLoading manualmente
    const snapshot = this.productsService.getCatalogSnapshot();
    if (snapshot.length > 0) {
      this.cacheProducts = snapshot;
      this.buildDynamicCategories();
      this.applyLocalFilters();
      this.isLoading = false;
    }
  }

  /**
   * Sobrescribe la caché local con los productos de una categoría específica.
   * Llama a GET /product/category/:name
   * @param categoryName Nombre exacto de la categoría en el backend
   */
  private fetchByCategory(categoryName: string): void {
    this.isLoading = true;
    this.productsService.getProductsByCategory(categoryName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.cacheProducts = products;
          this.totalItems    = products.length;
          this.applyLocalFilters();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      });
  }

  /**
   * Busca productos por tags en el backend (fallback cuando no hay resultados locales).
   * Llama a GET /product/search?tags=query
   * @param query Término de búsqueda
   */
  private fetchByTags(query: string): void {
    this.isLoading = true;
    this.productsService.searchByTags([query])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.cacheProducts = products;
          this.totalItems    = products.length;
          this.applyLocalFilters();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      });
  }

  /**
   * Obtiene productos dentro de un rango de precio del backend.
   * Llama a GET /product/price-range?minPrice=&maxPrice=
   * @param min Precio mínimo
   * @param max Precio máximo
   */
  private fetchByPriceRange(min: number, max: number): void {
    this.isLoading = true;
    this.productsService.getProductsByPriceRange(min, max)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.cacheProducts = products;
          this.totalItems    = products.length;
          this.applyLocalFilters();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      });
  }

  // ─── Filtrado local ───────────────────────────────────────────────────────

  /**
   * Aplica los filtros de texto, rating y ordenamiento sobre la caché local.
   * Este método es instantáneo y no genera peticiones HTTP.
   */
  applyLocalFilters(): void {
    let result = [...this.cacheProducts];

    // ── Categoría (filtro local — preserva thumbnailGallery) ──────────────────
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      result = result.filter(p =>
        p.category?.some(c => c.toLowerCase() === this.selectedCategory.toLowerCase())
      );
    }

    // ── Búsqueda por texto ────────────────────────────────────────────────────
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q)   ||
        p.brand?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q)  ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      );
      // Solo emitir al debounce si el caché local ya está vacío
      if (result.length === 0) {
        this.searchTerm$.next(this.searchQuery.trim());
      }
    }

    // ── Rating mínimo ─────────────────────────────────────────────────────────
    if (this.selectedRating) {
      result = result.filter(p => (p.rating?.average ?? 0) >= this.selectedRating!);
    }

    // ── Precio máximo ─────────────────────────────────────────────────────────
    if (this.priceValue < MAX_PRICE) {
      result = result.filter(p => p.basePrice <= this.priceValue);
    }

    // ── Ordenamiento ──────────────────────────────────────────────────────────
    switch (this.selectedSort) {
      case 'price-asc':  result.sort((a, b) => a.basePrice - b.basePrice); break;
      case 'price-desc': result.sort((a, b) => b.basePrice - a.basePrice); break;
      case 'newest':     result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'popular':    result.sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0)); break;
    }

    this.totalItems = result.length;
    // Paginación local
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.products = result.slice(start, start + this.itemsPerPage);
  }

  // ─── Categorías dinámicas ─────────────────────────────────────────────────

  /**
   * Extrae los nombres de categoría únicos del catálogo en caché.
   * Esto sincroniza el menú lateral con lo que realmente existe en el backend.
   */
  private buildDynamicCategories(): void {
    const set = new Set<string>();
    this.cacheProducts.forEach(p => p.category?.forEach(c => set.add(c)));
    this.dynamicCategories = Array.from(set).sort();
  }

  // ─── Acciones del usuario ─────────────────────────────────────────────────

  /** Evento de búsqueda por texto — filtro local inmediato + fallback debounced */
  onSearch(): void {
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  clearSearch(): void { this.searchQuery = ''; this.currentPage = 1; this.applyLocalFilters(); }

  /**
   * Selecciona una categoría. Si es 'all' recarga el catálogo GEO completo;
   * si no, pide al backend solo los productos de esa categoría.
   * @param categoryName Nombre de la categoría o 'all'
   */
  /**
   * Selecciona o deselecciona una categoría del menú lateral.
   * SIEMPRE filtra sobre el caché GEO local para preservar los campos
   * `thumbnailGallery` y `nearestStoreKm` que vienen del endpoint /active/geo.
   * Solo recarga desde el servidor si el caché está vacío.
   *
   * @param categoryName Nombre de la categoría o 'all'
   */
  selectCategory(categoryName: string): void {
    // Toggle: clic en categoría activa → deseleccionar
    if (this.selectedCategory === categoryName) {
      this.selectedCategory = 'all';
      this.currentPage = 1;
      this.cacheProducts = this.productsService.getCatalogSnapshot();
      this.applyLocalFilters();
      return;
    }

    this.selectedCategory = categoryName;
    this.currentPage = 1;

    // Recuperar el snapshot completo del caché (tiene thumbnailGallery)
    const snapshot = this.productsService.getCatalogSnapshot();

    if (snapshot.length > 0) {
      // Caché disponible → filtrar localmente sin HTTP
      this.cacheProducts = snapshot;
      this.applyLocalFilters();
    } else {
      // Caché vacío (rare) → recargar el catálogo GEO completo y luego filtrar
      const coords = this.geoService.coords;
      if (coords) {
        this.subscribeToGeoGatalog();
        this.productsService.loadGeoCatalog(coords.lat, coords.lng, 1, CATALOG_LIMIT, true);
      } else {
        this.loadInitialCatalog();
      }
    }
  }

  /** Actualiza el slider y emite al stream debounced */
  onPriceChange(event: Event): void {
    this.priceValue = +(event.target as HTMLInputElement).value;
    this.currentPage = 1;
    this.applyLocalFilters();           // Respuesta visual inmediata
    this.priceSlider$.next(this.priceValue); // Fallback al backend tras 300ms
  }

  /** Selecciona/deselecciona un rating mínimo */
  selectRating(stars: number): void {
    this.selectedRating = this.selectedRating === stars ? null : stars;
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  /** Cambia el criterio de ordenamiento */
  selectSortOption(optionId: string): void {
    this.selectedSort = optionId;
    this.isDropdownOpen = false;
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  onSortChange(sortId: string): void { this.selectSortOption(sortId); }

  /** Restablece todos los filtros y recarga el catálogo GEO (o estándar si no hay coords) */
  clearFilters(): void {
    this.searchQuery        = '';
    this.selectedCategory   = 'all';
    this.selectedPriceRange = 'all';
    this.selectedRating     = null;
    this.priceValue         = MAX_PRICE;
    this.selectedSort       = 'newest';
    this.currentPage        = 1;
    const coords = this.geoService.coords;
    if (coords) {
      this.subscribeToGeoGatalog();
      this.productsService.loadGeoCatalog(coords.lat, coords.lng, 1, CATALOG_LIMIT, true);
    } else {
      this.loadInitialCatalog();
    }
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.applyLocalFilters();
  }

  // ─── Helpers de UI ────────────────────────────────────────────────────────

  toggleMobileFilters(): void { this.showMobileFilters = !this.showMobileFilters; }
  toggleDropdown():      void { this.isDropdownOpen   = !this.isDropdownOpen; }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const t = event.target as HTMLElement;
    if (!t.closest('.ecommerce-dropdown-button') && !t.closest('.ecommerce-dropdown-menu')) {
      this.isDropdownOpen = false;
    }
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.searchQuery) count++;
    if (this.selectedCategory && this.selectedCategory !== 'all') count++;
    if (this.priceValue < MAX_PRICE) count++;
    if (this.selectedRating) count++;
    return count;
  }

  getSelectedSortLabel(): string {
    return this.sortOptions.find(o => o.id === this.selectedSort)?.label ?? 'Más recientes';
  }

  getSelectedSortIcon(): string {
    return this.sortOptions.find(o => o.id === this.selectedSort)?.icon ?? 'sparkles';
  }

  getSortIcon(iconName: string): string {
    const icons: Record<string, string> = {
      sparkles:   'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
      'arrow-up': 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
      'arrow-down':'M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.511l-5.511-3.181',
      clock:       'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
      fire:        'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z',
    };
    return icons[iconName] ?? icons['sparkles'];
  }

  getCategoryIcon(iconName: string): string {
    const icons: Record<string, string> = {
      grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    };
    return icons[iconName] ?? icons['grid'];
  }
}
