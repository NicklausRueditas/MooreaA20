import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoresService } from '../../../../core/services/catalog/stores.service';
import { ProductsService } from '../../../../core/services/catalog/products.service';
import { ProductVariantsService } from '../../../../core/services/catalog/product-variants.service';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
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
  addInventoryForm: FormGroup;

  // Selector en cascada: producto → variante
  selectedProductId = '';
  variantsForModal: ProductVariant[] = [];
  isLoadingVariants = false;

  // Filters
  searchTerm = '';

  // Accordion state — persists across getter recalculations
  private expandedGroups = new Map<string, boolean>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storesService: StoresService,
    private productsService: ProductsService,
    private variantsService: ProductVariantsService,
    private fb: FormBuilder
  ) {
    this.addInventoryForm = this.fb.group({
      variantId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      cost: [null],
      wholesalePrice: [null],
      reorderPoint: [10],
      reorderQuantity: [50]
    });
  }

  ngOnInit(): void {
    this.storeId = this.route.snapshot.paramMap.get('id') || '';
    if (this.storeId) {
      this.loadStore();
      this.loadInventory();
      this.loadProducts();
    }
  }

  // ─── DATA LOADING ────────────────────────────────────────────────────────────

  loadStore(): void {
    this.storesService.getStoreById(this.storeId).subscribe({
      next: (store) => { this.store = store; },
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

  /** Carga todos los productos maestros usando el caché compartido del servicio */
  loadProducts(): void {
    this.productsService.catalog$.subscribe({
      next: (products) => {
        this.allProducts = products;
        this.productMap.clear();
        products.forEach(p => this.productMap.set(p._id, p));
      },
      error: (err) => console.error('Error loading products:', err)
    });
    this.productsService.loadCatalog();
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
  private getProductId(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return 'sin-producto';
    const pid = v.productId;
    if (typeof pid === 'string') return pid;
    return pid?._id ?? 'sin-producto';
  }

  /** Extrae el nombre del producto maestro */
  private getProductName(item: InventoryItem): string {
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
  private getProductCode(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return '';
    const pid = v.productId;
    if (typeof pid === 'object' && pid !== null) return pid.code;
    return this.productMap.get(pid as string)?.code ?? '';
  }

  /** Extrae la marca del producto maestro */
  private getProductBrand(item: InventoryItem): string {
    const v = this.getVariant(item);
    if (!v) return '';
    const pid = v.productId;
    if (typeof pid === 'object' && pid !== null) return pid.brand;
    return this.productMap.get(pid as string)?.brand ?? '';
  }

  /** Extrae la imagen del producto */
  private getProductImage(item: InventoryItem): string {
    const v = this.getVariant(item);
    // Primero intenta la galería de la variante, luego la del producto maestro
    return v?.gallery?.[0] ?? this.productMap.get(this.getProductId(item))?.gallery?.[0] ?? '';
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

  openAddModal(): void {
    this.addInventoryForm.reset({ quantity: 1, reorderPoint: 10, reorderQuantity: 50 });
    this.selectedProductId = '';
    this.variantsForModal = [];
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.selectedProductId = '';
    this.variantsForModal = [];
    this.addInventoryForm.reset();
  }

  /** Al seleccionar un producto en el modal, carga sus variantes */
  onModalProductChange(productId: string): void {
    this.addInventoryForm.get('variantId')?.setValue('');
    this.variantsForModal = [];
    if (!productId) return;
    this.isLoadingVariants = true;
    this.variantsService.getVariantsByProduct(productId).subscribe({
      next: (variants) => {
        // Filtrar variantes ya presentes en inventario de esta tienda
        const existingVariantIds = new Set(
          this.inventory.map(item => typeof item.variantId === 'string' ? item.variantId : (item.variantId as ProductVariant)._id)
        );
        this.variantsForModal = variants.filter(v => !existingVariantIds.has(v._id));
        this.isLoadingVariants = false;
      },
      error: () => { this.isLoadingVariants = false; }
    });
  }

  /** Etiqueta amigable para mostrar en el select de variantes */
  variantLabel(v: ProductVariant): string {
    const color = v.color ? `${v.color.name}` : '';
    const size  = v.size  ? v.size.value : '';
    const region = v.size?.region ? ` (${v.size.region})` : '';
    return [v.sku, color, size + region].filter(Boolean).join(' · ');
  }

  onAddInventory(): void {
    if (!this.addInventoryForm.valid) return;
    const fv = this.addInventoryForm.value;
    this.storesService.createInventoryItem({
      variantId: fv.variantId,
      storeId: this.storeId,
      quantity: fv.quantity,
      reorderPoint: fv.reorderPoint || undefined,
      reorderQuantity: fv.reorderQuantity || undefined,
      cost: fv.cost || undefined,
      wholesalePrice: fv.wholesalePrice || undefined
    }).subscribe({
      next: (created) => {
        this.inventory = [...this.inventory, created];
        this.closeAddModal();
      },
      error: (err) => console.error('❌ Error creating inventory item:', err)
    });
  }

  updateQuantity(item: InventoryItem, newQuantity: number): void {
    if (newQuantity < 0) return;
    const diff = newQuantity - item.quantity;
    if (diff === 0) return;

    const variantId = this.getVariantId(item);
    const obs = diff > 0
      ? this.storesService.increaseStock(variantId, this.storeId, diff)
      : this.storesService.reduceStock(variantId, this.storeId, Math.abs(diff));

    obs.subscribe({
      next: (updated) => { item.quantity = updated.quantity; },
      error: (err) => console.error('❌ Error updating stock:', err)
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
