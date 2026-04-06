import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { Product, ThumbnailEntry } from '../../../../../core/interfaces/product.interface';
import { ProductVariant } from '../../../../../core/interfaces/store.interface';
import { ProductVariantsService } from '../../../../../core/services/catalog/product-variants.service';
import { BasketService } from '../../../../../core/services/commerce/basket.service';
import { ToastService } from '../../../../../core/services/ui/toast.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { CloudinaryPipe } from '../../../../../shared/pipes/cloudinary.pipe';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink, CloudinaryPipe],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
})
export class ProductsComponent {
  @Input() products: Product[] = [];

  // ─── QUICK-ADD MODAL STATE ───────────────────────────────────────────────────
  modalProduct: Product | null = null;
  modalVariants: ProductVariant[] = [];
  modalLoading = false;
  modalAddingToCart = false;
  /** URL de la imagen principal seleccionada en la galería del modal */
  modalMainImage = '';

  selectedColorCode = '';
  selectedSizeValue = '';
  selectedVariant: ProductVariant | null = null;

  constructor(
    private router: Router,
    private variantsService: ProductVariantsService,
    private basketService: BasketService,
    private toastService: ToastService,
    private authService: AuthService,
  ) { }

  // ─── IMAGEN DE CARD ───────────────────────────────────────────────────────────

  /**
   * Devuelve la URL de imagen a mostrar en la card del producto.
   * Prioridad:
   *   1. thumbnailGallery[0].image — primera entrada del campo calculado por el backend
   *      (shape: ThumbnailEntry { colorCode, colorName, colorHex, image })
   *   2. product.gallery[0]  — fallback para endpoints que no incluyen thumbnailGallery
   *   3. placeholder SVG
   * @param product Producto a mostrar
   */
  getCardImage(product: Product): string {
    // thumbnailGallery ahora es ThumbnailEntry[] — extraer .image
    const tg = product.thumbnailGallery;
    if (tg && tg.length > 0) return tg[0].image;
    return product.gallery?.[0] || 'assets/images/placeholder.svg';
  }

  // ─── TRIGGER MODAL ───────────────────────────────────────────────────────────

  openQuickAdd(product: Product): void {
    this.modalProduct = product;
    this.modalVariants = [];
    this.modalLoading = true;
    this.selectedColorCode = '';
    this.selectedSizeValue = '';
    this.selectedVariant = null;

    // Usar el endpoint dedicado a variantes activas (/product-variants/product/:id/active)
    // para evitar filtrado manual en el frontend y respetar el contrato del backend.
    this.variantsService.getActiveVariantsByProduct(product._id).pipe(take(1)).subscribe({
      next: (active) => {
        this.modalVariants = active;
        this.modalLoading = false;

        // Si solo hay 1 variante → agregar directamente sin mostrar modal
        if (active.length === 1) {
          this.modalProduct = null;
          this.addVariantToCart(active[0], product);
          return;
        }

        if (active.length === 0) {
          this.modalProduct = null;
          this.toastService.showError('Este producto no tiene variantes disponibles');
          return;
        }

        // Auto-seleccionar si solo hay 1 color
        const uniqueColors = this.getUniqueColors(active);
        if (uniqueColors.length === 1) {
          this.selectedColorCode = uniqueColors[0].code;
          this.resolveVariant();
        }

        // Auto-seleccionar si solo hay 1 talla
        const sizes = this.getAvailableSizes(active, this.selectedColorCode);
        if (sizes.length === 1) {
          this.selectedSizeValue = sizes[0].value;
          this.resolveVariant();
          if (this.selectedVariant && uniqueColors.length === 1) {
            this.modalProduct = null;
            this.addVariantToCart(this.selectedVariant, product);
          }
        }
      },
      error: () => {
        this.modalLoading = false;
        this.toastService.showError('Error al cargar las opciones del producto');
      }
    });
  }

  closeModal(): void {
    this.modalProduct    = null;
    this.modalVariants   = [];
    this.selectedColorCode = '';
    this.selectedSizeValue = '';
    this.selectedVariant = null;
    this.modalMainImage  = ''; // reset imagen de galería del modal
  }

  // ─── SELECTION ───────────────────────────────────────────────────────────────

  selectColor(code: string): void {
    this.selectedColorCode = this.selectedColorCode === code ? '' : code;

    // Saltar a la primera imagen de la variante con ese color
    if (this.selectedColorCode) {
      const variant = this.modalVariants.find(v => v.color?.code === this.selectedColorCode);
      const firstImg = variant?.gallery?.[0] ?? '';
      this.modalMainImage = firstImg;
    }

    // Resetear talla si no es válida para el nuevo color
    if (this.selectedSizeValue) {
      const available = this.getAvailableSizes(this.modalVariants, this.selectedColorCode);
      if (!available.some(s => s.value === this.selectedSizeValue)) {
        this.selectedSizeValue = '';
      }
    }
    this.resolveVariant();
  }

  selectSize(value: string): void {
    this.selectedSizeValue = this.selectedSizeValue === value ? '' : value;
    this.resolveVariant();
  }

  private resolveVariant(): void {
    this.selectedVariant = this.modalVariants.find(v => {
      const colorMatch = !this.selectedColorCode || v.color?.code === this.selectedColorCode;
      const sizeMatch = !this.selectedSizeValue || v.size?.value === this.selectedSizeValue;
      return colorMatch && sizeMatch;
    }) ?? null;
  }

  // ─── ADD TO CART ─────────────────────────────────────────────────────────────

  confirmQuickAdd(): void {
    if (!this.selectedVariant || !this.modalProduct) return;
    this.addVariantToCart(this.selectedVariant, this.modalProduct);
  }

  private addVariantToCart(variant: ProductVariant, product: Product): void {
    this.modalAddingToCart = true;

    this.basketService.addToBasket(variant, 1, product).pipe(take(1)).subscribe({
      next: () => {
        const isGuest = !this.authService.currentUserSubject.value;
        const parts = [variant.color?.name, variant.size?.value].filter(Boolean).join(' · ');
        const label = `${product.name}${parts ? ` (${parts})` : ''}`;

        if (isGuest) {
          this.toastService.showInfo(`✓ ${label} · Inicia sesión para guardar tu pedido`);
        } else {
          this.toastService.showSuccess(`Agregado: ${label}`);
        }
        this.modalAddingToCart = false;
        this.closeModal();
      },
      error: (err) => {
        console.error('[QuickAdd] Error:', err);
        const msg = err?.error?.message ?? 'Error al agregar al carrito';
        this.toastService.showError(msg);
        this.modalAddingToCart = false;
      }
    });
  }
  // ─── COMPUTED HELPERS ────────────────────────────────────────────────────────

  /**
   * Recolecta TODAS las imágenes de las variantes cargadas en el modal (modalVariants).
   * Si aún no se cargaron variantes, usa thumbnailGallery o gallery del maestro como fallback.
   * Las URLs duplicadas se eliminan para evitar repeticiones.
   * @returns Array de URLs únicas en orden de aparición
   */
  getModalGallery(): string[] {
    // Con variantes cargadas → concatenar gallery de cada variante (deduplicado)
    if (this.modalVariants.length > 0) {
      const seen = new Set<string>();
      const imgs: string[] = [];
      for (const v of this.modalVariants) {
        for (const url of (v.gallery ?? [])) {
          if (!seen.has(url)) { seen.add(url); imgs.push(url); }
        }
      }
      if (imgs.length > 0) return imgs;
    }
    // Fallback antes de que carguen las variantes
    if (!this.modalProduct) return [];
    const tg = this.modalProduct.thumbnailGallery;
    // thumbnailGallery ahora es ThumbnailEntry[] — mapear a URLs
    if (tg && tg.length > 0) return (tg as ThumbnailEntry[]).map(t => t.image);
    return this.modalProduct.gallery ?? [];
  }

  /**
   * Navega a la imagen siguiente en la galería del modal.
   * Cicla de forma circular al llegar al final.
   */
  nextImage(): void {
    const gallery = this.getModalGallery();
    if (gallery.length <= 1) return;
    const idx = gallery.indexOf(this.modalMainImage || gallery[0]);
    this.modalMainImage = gallery[(idx + 1) % gallery.length];
  }

  /**
   * Navega a la imagen anterior en la galería del modal.
   * Cicla de forma circular al llegar al inicio.
   */
  prevImage(): void {
    const gallery = this.getModalGallery();
    if (gallery.length <= 1) return;
    const idx = gallery.indexOf(this.modalMainImage || gallery[0]);
    this.modalMainImage = gallery[(idx - 1 + gallery.length) % gallery.length];
  }

  getUniqueColors(variants: ProductVariant[]): { name: string; hex: string; code: string }[] {
    const seen = new Set<string>();
    return variants
      .filter(v => v.color)
      .map(v => v.color!)
      .filter(c => {
        if (seen.has(c.code)) return false;
        seen.add(c.code);
        return true;
      });
  }

  getAvailableSizes(variants: ProductVariant[], colorCode: string): { value: string; type: string }[] {
    const source = colorCode ? variants.filter(v => v.color?.code === colorCode) : variants;
    const seen = new Set<string>();
    return source
      .filter(v => v.size)
      .map(v => v.size!)
      .filter(s => {
        if (seen.has(s.value)) return false;
        seen.add(s.value);
        return true;
      })
      .sort((a, b) => this.compareSizes(a.value, b.value));
  }

  isSizeAvailable(sizeValue: string): boolean {
    return this.modalVariants.some(v =>
      v.size?.value === sizeValue &&
      (!this.selectedColorCode || v.color?.code === this.selectedColorCode)
    );
  }

  private compareSizes(a: string, b: string): number {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const ia = order.indexOf(a.toUpperCase()), ib = order.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.localeCompare(b);
  }

  get canConfirmAdd(): boolean {
    if (!this.modalVariants.length) return false;
    const hasColors = this.getUniqueColors(this.modalVariants).length > 0;
    const hasSizes = this.getAvailableSizes(this.modalVariants, this.selectedColorCode).length > 0;
    if (hasColors && !this.selectedColorCode) return false;
    if (hasSizes && !this.selectedSizeValue) return false;
    return !!this.selectedVariant;
  }

  // ─── MISC ────────────────────────────────────────────────────────────────────

  getDiscountPercentage(product: Product): number { return product.discount ?? 0; }

  getOriginalPrice(product: Product): number {
    const d = product.discount ?? 0;
    return d <= 0 ? product.basePrice : product.basePrice / (1 - d / 100);
  }

  getPrimaryCategory(product: Product): string { return product.category?.[0] ?? ''; }

  isNewProduct(product: Product): boolean {
    if (!product.createdAt) return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(product.createdAt) > thirtyDaysAgo;
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.svg';
    img.onerror = null;
  }
}
