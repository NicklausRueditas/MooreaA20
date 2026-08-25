import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StoresService } from '../../../../core/services/catalog/stores.service';
import {
  ProductVariantsService,
  FlatCatalogVariant,
  CatalogVariantGroup,
  CatalogProduct,
} from '../../../../core/services/catalog/product-variants.service';
import { Store, InventoryItem, ProductVariant } from '../../../../core/interfaces/store.interface';
import { Product } from '../../../../core/interfaces/product.interface';

/** Variante con su registro de inventario, lista para mostrar */
export interface InventoryRow {
  item: InventoryItem;
  variant: ProductVariant | null;
}

/** Grupo de variantes que comparten el mismo producto maestro */
export interface ProductGroup {
  productId: string;
  productName: string;
  productCode: string;
  productBrand: string;
  productImage: string;
  rows: InventoryRow[];
  totalStock: number;
  isExpanded: boolean;
}

@Component({
  selector: 'app-store-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './store-inventory.component.html',
  styleUrls: ['./store-inventory.component.css']
})
export class StoreInventoryComponent implements OnInit {
  store: Store | null = null;
  storeId: string = '';
  inventory: InventoryItem[] = [];
  allProducts: Product[] = [];
  private productMap = new Map<string, Product>();
  isLoading = false;

  // UI State
  showAddModal = false;
  modalStep: 1 | 2 | 3 = 1;
  selectedModalVariant: FlatCatalogVariant | null = null;
  isAddingToInventory = false;
  addInventoryForm: FormGroup;
  showEditModal = false;
  editInventoryForm: FormGroup;
  editingItem: InventoryItem | null = null;
  isSavingEdit = false;

  // Selector en cascada: producto → variante
  selectedProductId = '';
  modalProductSearch = '';
  /** Todas las variantes aplanadas del catálogo (FlatCatalogVariant.product.basePrice disponible) */
  allCatalogVariants: FlatCatalogVariant[] = [];
  /** Variantes filtradas por el producto seleccionado en el modal */
  variantsForModal: FlatCatalogVariant[] = [];
  isLoadingVariants = false;

  // Filters
  searchTerm = '';

  // Accordion state — persists across getter recalculations
  private expandedGroups = new Map<string, boolean>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storesService: StoresService,
    private variantsService: ProductVariantsService,
    private fb: FormBuilder
  ) {
    this.addInventoryForm = this.fb.group({
      variantId:       ['', Validators.required],
      quantity:        [1, [Validators.required, Validators.min(1)]],
      cost:            [null],
      wholesalePrice:  [null],
      reorderPoint:    [5],   // umbral por defecto: 5 unidades
      reorderQuantity: [20],  // cantidad a reponer por defecto: 20 unidades
      // Ubicación física en almacén — .http L537-541: location.aisle / .shelf / .bin
      locationAisle: [null],
      locationShelf: [null],
      locationBin:   [null],
    });

    this.editInventoryForm = this.fb.group({
      quantity:         [1, [Validators.required, Validators.min(0)]],
      reservedQuantity: [0, [Validators.required, Validators.min(0)]],
      cost:             [null],
      wholesalePrice:   [null],
      reorderPoint:     [5],
      reorderQuantity:  [20],
      locationAisle:    [null],
      locationShelf:    [null],
      locationBin:      [null],
    });
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────────

  /**
   * Acceso tipado al FormControl del radio de variantes.
   * Requerido por el template: [formControl]="variantIdCtrl".
   * Sin este getter Angular no puede conectar el radio y (change) nunca dispara.
   */
  get variantIdCtrl() {
    return this.addInventoryForm.get('variantId') as import('@angular/forms').FormControl;
  }

  ngOnInit(): void {
    this.storeId = this.route.snapshot.paramMap.get('id') || '';
    if (this.storeId) {
      this.loadStore();
      this.loadInventory();
    }
  }

  // ─── DATA LOADING ────────────────────────────────────────────────────────────

  loadStore(): void {
    this.storesService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        this.store = store;
        // Cargar variantes del catálogo correspondiente a esta tienda
        this.loadCatalogVariants();
      },
      error: (err) => console.error('Error loading store:', err)
    });
  }

  loadInventory(): void {
    this.isLoading = true;
    this.storesService.getInventoryByStore(this.storeId).subscribe({
      next: (items) => {
        this.inventory = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading inventory:', err);
        this.isLoading = false;
      }
    });
  }

  /**
   * Carga el catálogo de productos y variantes correspondiente a la tienda.
   * Si la tienda pertenece a un seller (store.ownerId), consulta las variantes de ese seller.
   * Si la tienda es oficial de Moorea (store.ownerId = null), consulta el catálogo de Moorea.
   */
  loadCatalogVariants(): void {
    const owner = this.store?.ownerId ? this.store.ownerId : 'moorea';
    this.isLoadingVariants = true;

    this.variantsService.getVariantsByCatalog(owner).subscribe({
      next: (groups: CatalogVariantGroup[]) => {
        this.productMap.clear();
        this.allProducts = [];
        this.allCatalogVariants = [];

        for (const group of groups) {
          const p = group.product;
          // Construir productMap y allProducts desde el campo product del grupo
          if (!this.productMap.has(p._id)) {
            this.productMap.set(p._id, p as unknown as Product);
            this.allProducts.push(p as unknown as Product);
          }
          // Aplanar variantes adjuntando el producto a cada una
          for (const v of group.variants) {
            this.allCatalogVariants.push({ ...v, product: p } as FlatCatalogVariant);
          }
        }
        this.isLoadingVariants = false;
      },
      error: (err) => {
        console.error('Error cargando variantes del catálogo:', err);
        this.isLoadingVariants = false;
      }
    });
  }

  // ─── VARIANT HELPERS ─────────────────────────────────────────────────────────

  /** Extrae el objeto ProductVariant del campo variantId (string o populado) */
  getVariant(item: InventoryItem): ProductVariant | null {
    if (!item.variantId) return null;
    if (typeof item.variantId === 'object') return item.variantId as ProductVariant;
    return null; // solo ID string, sin datos populados
  }

  /** Devuelve el SKU de la variante */
  getVariantSku(item: InventoryItem): string {
    const v = this.getVariant(item);
    return v?.sku ?? (typeof item.variantId === 'string' ? item.variantId : '—');
  }

  /** Devuelve el ID string de la variante */
  getVariantId(item: InventoryItem): string {
    if (typeof item.variantId === 'string') return item.variantId;
    return (item.variantId as ProductVariant)?._id ?? '—';
  }

  /** Devuelve el nombre del color */
  getColorName(item: InventoryItem): string {
    const v = this.getVariant(item);
    return v?.color?.name ?? '—';
  }

  /** Devuelve el hex del color para el swatch */
  getColorHex(item: InventoryItem): string {
    const v = this.getVariant(item);
    return v?.color?.hex ?? '#e5e7eb';
  }

  /** Devuelve la talla como string */
  getSizeLabel(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v?.size) return '—';
    return `${v.size.value}${v.size.region ? ' ' + v.size.region : ''}`;
  }

  /** Extrae el productId como string (puede estar populado) */
  getProductId(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return 'sin-producto';
    const pid = v.productId;
    if (typeof pid === 'string') return pid;
    return pid?._id ?? 'sin-producto';
  }

  /** Extrae el nombre del producto maestro */
  getProductName(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return 'Producto desconocido';
    const pid = v.productId;
    // Caso 1: productId populado como objeto
    if (typeof pid === 'object' && pid !== null) return pid.name;
    // Caso 2: productId es string — buscar en el mapa de productos cargados
    const product = this.productMap.get(pid as string);
    return product?.name ?? `ID: ${pid}`;
  }

  /** Extrae el código del producto maestro */
  getProductCode(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return '';
    const pid = v.productId;
    if (typeof pid === 'object' && pid !== null) return pid.code;
    return this.productMap.get(pid as string)?.code ?? '';
  }

  /** Extrae la marca del producto maestro */
  getProductBrand(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return '';
    const pid = v.productId;
    if (typeof pid === 'object' && pid !== null) return pid.brand;
    return this.productMap.get(pid as string)?.brand ?? '';
  }

  /** Extrae la mejor imagen disponible para el producto o variante */
  getProductImage(item: InventoryItem): string {
    const v = this.getVariant(item);
    // 1. Galería directa de la variante
    if (v?.gallery && v.gallery.length > 0 && v.gallery[0]) {
      return v.gallery[0];
    }
    // 2. Galería del productId populado como objeto
    if (v && typeof v.productId === 'object' && v.productId !== null && (v.productId as any).gallery?.length > 0) {
      return (v.productId as any).gallery[0];
    }
    // 3. Galería del producto maestro en el mapa en memoria
    const pid = this.getProductId(item);
    const prod = this.productMap.get(pid);
    if (prod?.gallery && prod.gallery.length > 0 && prod.gallery[0]) {
      return prod.gallery[0];
    }
    // 4. Buscar en las variantes del catálogo de este producto
    const catVar = this.allCatalogVariants.find(
      cv => cv.product?._id === pid && cv.gallery && cv.gallery.length > 0 && cv.gallery[0]
    );
    if (catVar?.gallery?.[0]) {
      return catVar.gallery[0];
    }
    // 5. Buscar en la lista general de productos
    const allProd = this.allProducts.find(p => p._id === pid);
    if (allProd?.gallery && allProd.gallery.length > 0 && allProd.gallery[0]) {
      return allProd.gallery[0];
    }
    return '';
  }

  // ─── GROUPED VIEW ────────────────────────────────────────────────────────────

  /** Agrupa los items de inventario por producto maestro */
  get productGroups(): ProductGroup[] {
    const term = this.searchTerm.toLowerCase();
    const groupMap = new Map<string, ProductGroup>();

    for (const item of this.inventory) {
      const productId = this.getProductId(item);
      const productName = this.getProductName(item);
      const productCode = this.getProductCode(item);
      const productBrand = this.getProductBrand(item);
      const variant = this.getVariant(item);

      // Filtro de búsqueda
      if (term) {
        const matches =
          productName.toLowerCase().includes(term) ||
          productCode.toLowerCase().includes(term) ||
          productBrand.toLowerCase().includes(term) ||
          variant?.sku?.toLowerCase().includes(term) ||
          variant?.color?.name?.toLowerCase().includes(term) ||
          variant?.size?.value?.toLowerCase().includes(term);
        if (!matches) continue;
      }

      if (!groupMap.has(productId)) {
        // Usar estado guardado; por defecto contraído la primera vez
        const isExpanded = this.expandedGroups.has(productId)
          ? this.expandedGroups.get(productId)!
          : false;
        groupMap.set(productId, {
          productId,
          productName,
          productCode,
          productBrand,
          productImage: this.getProductImage(item),
          rows: [],
          totalStock: 0,
          isExpanded
        });
      }

      const group = groupMap.get(productId)!;
      group.rows.push({ item, variant });
      group.totalStock += item.quantity;
      if (!group.productImage) {
        group.productImage = this.getProductImage(item);
      }
    }

    return Array.from(groupMap.values());
  }

  toggleGroup(group: ProductGroup): void {
    const next = !group.isExpanded;
    this.expandedGroups.set(group.productId, next);
    group.isExpanded = next;
  }

  /** Devuelve colores únicos (sin repetir hex) de un grupo para los swatches */
  getUniqueColors(group: ProductGroup): Array<{ name: string; hex: string }> {
    const seen = new Set<string>();
    const colors: Array<{ name: string; hex: string }> = [];
    for (const row of group.rows) {
      const color = row.variant?.color;
      if (color && !seen.has(color.hex)) {
        seen.add(color.hex);
        colors.push({ name: color.name, hex: color.hex });
      }
    }
    return colors;
  }

  // ─── INVENTORY ACTIONS ───────────────────────────────────────────────────────

  /** Calcula cuántas variantes de un producto aún no están en esta tienda */
  getAvailableVariantsCount(product: Product): number {
    const existingIds = new Set(
      this.inventory.map(item =>
        typeof item.variantId === 'string'
          ? item.variantId
          : (item.variantId as ProductVariant)._id
      )
    );
    return this.allCatalogVariants.filter(
      v => v.product._id === product._id && !existingIds.has(v._id)
    ).length;
  }

  /** Selecciona un producto en el wizard y avanza automáticamente al paso 2 */
  selectProductInWizard(product: Product): void {
    this.selectedProductId = product._id;
    this.onModalProductChange(product._id);
    this.selectedModalVariant = null;
    this.modalStep = 2;
  }

  /** Selecciona una variante en el wizard y avanza automáticamente al paso 3 */
  selectVariantInWizard(variant: FlatCatalogVariant): void {
    this.selectedModalVariant = variant;
    this.addInventoryForm.get('variantId')?.setValue(variant._id);
    this.onVariantSelected(variant);
    this.modalStep = 3;
  }

  /** Cambia de paso manualmente desde el stepper superior */
  goToModalStep(step: 1 | 2 | 3): void {
    if (step === 2 && !this.selectedProductId) return;
    if (step === 3 && (!this.selectedProductId || !this.addInventoryForm.get('variantId')?.value)) return;
    this.modalStep = step;
  }

  openAddModal(): void {
    this.addInventoryForm.reset({ quantity: 10, reorderPoint: 5, reorderQuantity: 20 });
    this.selectedProductId = '';
    this.modalProductSearch = '';
    this.variantsForModal = [];
    this.modalStep = 1;
    this.selectedModalVariant = null;
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.selectedProductId = '';
    this.modalProductSearch = '';
    this.variantsForModal = [];
    this.modalStep = 1;
    this.selectedModalVariant = null;
    this.addInventoryForm.reset();
  }

  /**
   * Al seleccionar un producto en el modal, filtra las variantes ya cargadas.
   * No hace petición HTTP adicional — filtra sobre allCatalogVariants.
   * Excluye las variantes que ya existen en el inventario de esta tienda.
   * FlatCatalogVariant.product._id siempre disponible — acceso directo.
   */
  /** Productos disponibles para el modal, filtrados por el término de búsqueda */
  get filteredModalProducts(): Product[] {
    if (!this.modalProductSearch.trim()) {
      return this.allProducts;
    }
    const term = this.modalProductSearch.toLowerCase().trim();
    return this.allProducts.filter(p =>
      p.name?.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term) ||
      p.brand?.toLowerCase().includes(term)
    );
  }

  /** Producto actualmente seleccionado en el modal */
  get selectedModalProduct(): Product | null {
    if (!this.selectedProductId) return null;
    return this.productMap.get(this.selectedProductId) ??
      (this.allProducts.find(p => p._id === this.selectedProductId) ?? null);
  }

  /**
   * Obtiene la mejor imagen disponible para previsualizar el producto.
   * Busca en la galería del producto o en la primera variante con imagen.
   */
  getProductPreviewImage(product: Product | CatalogProduct | null): string | null {
    if (!product) return null;
    if ((product as any).gallery && (product as any).gallery.length > 0) {
      return (product as any).gallery[0];
    }
    const vWithImg = this.allCatalogVariants.find(
      v => v.product._id === product._id && v.gallery && v.gallery.length > 0
    );
    if (vWithImg?.gallery?.[0]) {
      return vWithImg.gallery[0];
    }
    return null;
  }

  onModalProductChange(productId: string): void {
    this.addInventoryForm.get('variantId')?.setValue('');
    this.variantsForModal = [];
    if (!productId) return;

    const existingIds = new Set(
      this.inventory.map(item =>
        typeof item.variantId === 'string'
          ? item.variantId
          : (item.variantId as ProductVariant)._id
      )
    );

    // product._id viene directo en FlatCatalogVariant
    this.variantsForModal = this.allCatalogVariants.filter(v =>
      v.product._id === productId && !existingIds.has(v._id)
    );
  }

  /**
   * Al seleccionar una card de variante, auto-rellena los precios:
   *   - cost          = product.basePrice + priceAdjustment de la variante
   *   - wholesalePrice = cost * 0.90 (precio al por mayor = costo −10%)
   *
   * FlatCatalogVariant garantiza que product.basePrice está disponible.
   * @param variant FlatCatalogVariant seleccionada en el modal
   */
  onVariantSelected(variant: FlatCatalogVariant): void {
    const basePrice  = variant.product.basePrice ?? 0;
    const adjustment = variant.priceAdjustment ?? 0;

    const cost         = parseFloat((basePrice + adjustment).toFixed(2));
    const wholesalePrice = parseFloat((cost * 0.90).toFixed(2));

    this.addInventoryForm.patchValue({ cost, wholesalePrice });
  }

  /** Etiqueta amigable para mostrar en el select de variantes */
  variantLabel(v: ProductVariant): string {
    const color = v.color ? `${v.color.name}` : '';
    const size = v.size ? v.size.value : '';
    const region = v.size?.region ? ` (${v.size.region})` : '';
    return [v.sku, color, size + region].filter(Boolean).join(' · ');
  }

  // ─── QUANTITY QUICK HELPERS ──────────────────────────────────────────────────

  /** Ajusta la cantidad del formulario de adición */
  adjustAddQuantity(delta: number): void {
    const current = this.addInventoryForm.get('quantity')?.value || 0;
    const next = Math.max(1, current + delta);
    this.addInventoryForm.patchValue({ quantity: next });
  }

  /** Asigna una cantidad directa en el formulario de adición */
  setAddQuantity(val: number): void {
    this.addInventoryForm.patchValue({ quantity: val });
  }

  /** Ajusta la cantidad del formulario de edición */
  adjustEditQuantity(field: 'quantity' | 'reservedQuantity', delta: number): void {
    const current = this.editInventoryForm.get(field)?.value || 0;
    const next = Math.max(0, current + delta);
    this.editInventoryForm.patchValue({ [field]: next });
  }

  // ─── EDIT MODAL ─────────────────────────────────────────────────────────────

  /** Abre el modal de edición para un registro de inventario */
  openEditModal(item: InventoryItem): void {
    this.editingItem = item;
    const loc = (item as any).location || {};
    this.editInventoryForm.patchValue({
      quantity:         item.quantity ?? 0,
      reservedQuantity: item.reservedQuantity ?? 0,
      cost:             item.cost ?? null,
      wholesalePrice:   item.wholesalePrice ?? null,
      reorderPoint:     item.reorderPoint ?? 5,
      reorderQuantity:  item.reorderQuantity ?? 20,
      locationAisle:    loc.aisle || null,
      locationShelf:    loc.shelf || null,
      locationBin:      loc.bin || null,
    });
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingItem = null;
    this.editInventoryForm.reset();
  }

  /** Guarda los cambios de edición del ítem de inventario */
  onSaveEditInventory(): void {
    if (!this.editInventoryForm.valid || !this.editingItem?._id) return;
    this.isSavingEdit = true;
    const fv = this.editInventoryForm.value;

    const location = (fv.locationAisle || fv.locationShelf || fv.locationBin)
      ? {
          aisle: fv.locationAisle || undefined,
          shelf: fv.locationShelf || undefined,
          bin:   fv.locationBin   || undefined,
        }
      : undefined;

    this.storesService.updateInventoryItem(this.editingItem._id, {
      quantity:         fv.quantity,
      reservedQuantity: fv.reservedQuantity,
      cost:             fv.cost ?? undefined,
      wholesalePrice:   fv.wholesalePrice ?? undefined,
      reorderPoint:     fv.reorderPoint ?? undefined,
      reorderQuantity:  fv.reorderQuantity ?? undefined,
      location,
    }).subscribe({
      next: (updated) => {
        // Actualizar el ítem en la lista local
        const idx = this.inventory.findIndex(i => i._id === this.editingItem?._id);
        if (idx !== -1) {
          this.inventory[idx] = {
            ...this.inventory[idx],
            quantity:         updated.quantity,
            reservedQuantity: updated.reservedQuantity,
            cost:             updated.cost,
            wholesalePrice:   updated.wholesalePrice,
            reorderPoint:     updated.reorderPoint,
            reorderQuantity:  updated.reorderQuantity,
            location:         (updated as any).location,
          };
          this.inventory = [...this.inventory];
        }
        this.isSavingEdit = false;
        this.closeEditModal();
      },
      error: (err) => {
        console.error('❌ Error updating inventory item:', err);
        this.isSavingEdit = false;
      }
    });
  }

  onAddInventory(): void {
    if (!this.addInventoryForm.valid) return;
    const fv = this.addInventoryForm.value;

    // Construir location solo si se informó al menos un campo (.http L537-541)
    const location = (fv.locationAisle || fv.locationShelf || fv.locationBin)
      ? {
          aisle: fv.locationAisle || undefined,
          shelf: fv.locationShelf || undefined,
          bin:   fv.locationBin   || undefined,
        }
      : undefined;

    this.isAddingToInventory = true;
    this.storesService.createInventoryItem({
      variantId:        fv.variantId,
      storeId:          this.storeId,
      quantity:         fv.quantity,
      location,
      reorderPoint:     fv.reorderPoint    || undefined,
      reorderQuantity:  fv.reorderQuantity || undefined,
      cost:             fv.cost            || undefined,
      wholesalePrice:   fv.wholesalePrice  || undefined,
    }).subscribe({
      next: (created) => {
        this.inventory = [...this.inventory, created];
        this.isAddingToInventory = false;
        this.closeAddModal();
      },
      error: (err) => {
        console.error('❌ Error creating inventory item:', err);
        this.isAddingToInventory = false;
      }
    });
  }

  /**
   * Actualiza la cantidad de stock directamente en el servidor al presionar [+] o [-] o editar el input
   * @param item Ítem de inventario
   * @param newQuantity Nueva cantidad de stock
   */
  updateQuantity(item: InventoryItem, newQuantity: number): void {
    if (newQuantity < 0 || !item._id) return;
    const previous = item.quantity;
    if (previous === newQuantity) return;

    // Actualización optimista en UI
    item.quantity = newQuantity;

    this.storesService.updateInventoryItem(item._id, { quantity: newQuantity }).subscribe({
      next: (updated) => {
        item.quantity = updated.quantity;
      },
      error: (err) => {
        console.error('❌ Error updating stock:', err);
        // Revertir en caso de error
        item.quantity = previous;
      }
    });
  }

  removeFromInventory(item: InventoryItem): void {
    const id = item._id;
    if (!id) return;
    const sku = this.getVariantSku(item);
    if (!confirm(`¿Eliminar "${sku}" del inventario?`)) return;

    this.storesService.deleteInventoryItem(id).subscribe({
      next: () => {
        this.inventory = this.inventory.filter(i => i._id !== id);
      },
      error: (err) => console.error('❌ Error removing item:', err)
    });
  }

  // ─── STATS ───────────────────────────────────────────────────────────────────

  get totalVariants(): number { return this.inventory.length; }
  get totalStock(): number { return this.inventory.reduce((s, i) => s + i.quantity, 0); }
  get lowStockCount(): number {
    return this.inventory.filter(i => i.quantity <= (i.reorderPoint ?? 10)).length;
  }

  goBack(): void {
    this.router.navigate(['/business/stores']);
  }
}

