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
import { GeoService } from '../../../../../core/services/utils/geo.service';
import { CloudinaryPipe } from '../../../../../shared/pipes/cloudinary.pipe';
import { ProductCardComponent } from '../../../../../shared/components/product-card/product-card.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, CloudinaryPipe, ProductCardComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
})
export class ProductsComponent {
  @Input() products: Product[] = [];

  // ─── CARD SLIDER STATE ────────────────────────────────────────────────────────
  /**
   * Mapa productId → índice activo de imagen en el mini-slider de la card.
   * Cada card gestiona su propio índice independientemente.
   */
  private cardSliderIndex = new Map<string, number>();

  // ─── QUICK-ADD MODAL STATE ───────────────────────────────────────────────────
  modalProduct: Product | null = null;
  modalVariants: ProductVariant[] = [];
  modalLoading = false;
  modalAddingToCart = false;
  cardActionLoadingId: string | null = null;
  modalQuantity: number = 1;
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
    private geoService: GeoService,
  ) { }

  // ─── CARD SLIDER ──────────────────────────────────────────────────────────────

  /**
   * Devuelve el array de imágenes para el slider de una card.
   * Prioridad:
   *   1. thumbnailGallery[].image — una imagen por color único (calculado por backend)
   *   2. product.gallery          — galería plana del maestro
   * @param product Producto de la card
   * @returns Array de URLs de imágenes (mínimo 1)
   */
  getCardImages(product: Product): string[] {
    const tg = product.thumbnailGallery;
    if (tg && tg.length > 0) return tg.map((t: ThumbnailEntry) => t.image);
    if (product.gallery?.length > 0) return product.gallery;
    return ['assets/images/placeholder.svg'];
  }

  /**
   * Devuelve la URL de la imagen activa en el slider de una card.
   * @param product Producto de la card
   * @returns URL de la imagen actualmente visible
   */
  getCardImage(product: Product): string {
    const imgs = this.getCardImages(product);
    const idx = this.cardSliderIndex.get(product._id) ?? 0;
    return imgs[idx] ?? imgs[0];
  }

  /**
   * Devuelve el índice activo del slider para una card dada.
   * @param productId ID del producto
   */
  getCardSliderIndex(productId: string): number {
    return this.cardSliderIndex.get(productId) ?? 0;
  }

  /**
   * Avanza al siguiente slide del mini-slider de la card.
   * @param event MouseEvent para detener propagación (evita navegar al detalle)
   * @param product Producto de la card
   */
  cardNext(event: Event, product: Product): void {
    event.preventDefault();
    event.stopPropagation();
    const imgs = this.getCardImages(product);
    if (imgs.length <= 1) return;
    const cur = this.cardSliderIndex.get(product._id) ?? 0;
    this.cardSliderIndex.set(product._id, (cur + 1) % imgs.length);
  }

  /**
   * Retrocede al slide anterior del mini-slider de la card.
   * @param event MouseEvent para detener propagación
   * @param product Producto de la card
   */
  cardPrev(event: Event, product: Product): void {
    event.preventDefault();
    event.stopPropagation();
    const imgs = this.getCardImages(product);
    if (imgs.length <= 1) return;
    const cur = this.cardSliderIndex.get(product._id) ?? 0;
    this.cardSliderIndex.set(product._id, (cur - 1 + imgs.length) % imgs.length);
  }

  /**
   * Salta directamente a un slide específico en la card.
   * @param event MouseEvent para detener propagación
   * @param product Producto de la card
   * @param idx Índice al que saltar
   */
  cardGoTo(event: Event, product: Product, idx: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.cardSliderIndex.set(product._id, idx);
  }

  // ─── TRIGGER MODAL ───────────────────────────────────────────────────────────

  openQuickAdd(product: Product): void {
    this.cardActionLoadingId = product._id;
    this.modalQuantity = 1;

    // Obtener la geolocalización y luego cargar variantes GEO
    this.geoService.resolve().pipe(take(1)).subscribe({
      next: (location) => {
        this.variantsService.getGeoVariantsByProduct(product._id, location.lat, location.lng).pipe(take(1)).subscribe({
          next: (active) => {
            this.cardActionLoadingId = null;

            if (!active || active.length === 0) {
              this.toastService.showError('Este producto no tiene variantes con stock disponible');
              return;
            }

            // 🎯 SI SOLO HAY 1 VARIANTE DISPONIBLE:
            // Agregar DIRECTO al carrito sin abrir el modal para evitar parpadeos
            if (active.length === 1) {
              this.addVariantToCart(active[0], product, 1);
              return;
            }

            // 🎯 SI HAY 2 O MÁS VARIANTES:
            // Abrir el Quick Add Modal para que el cliente elija color y talla
            this.modalProduct = product;
            this.modalVariants = active;
            this.modalLoading = false;
            this.selectedColorCode = '';
            this.selectedSizeValue = '';
            this.selectedVariant = null;
            this.modalMainImage = product.gallery?.[0] ?? (product.thumbnailGallery?.[0] as any)?.image ?? '';

            // Auto-seleccionar primer color disponible y primera talla
            const uniqueColors = this.getUniqueColors(active);
            if (uniqueColors.length > 0) {
              const firstColor = uniqueColors[0].code;
              this.selectedColorCode = '';
              this.selectColor(firstColor);

              const sizes = this.getAvailableSizes(active, firstColor);
              if (sizes.length > 0) {
                this.selectedSizeValue = '';
                this.selectSize(sizes[0].value);
              }
            }
          },
          error: () => {
            this.cardActionLoadingId = null;
            this.toastService.showError('Error al cargar las opciones del producto');
          }
        });
      },
      error: () => {
        this.cardActionLoadingId = null;
        this.toastService.showError('No se pudo resolver tu ubicación');
      }
    });
  }

  closeModal(): void {
    this.modalProduct = null;
    this.modalVariants = [];
    this.selectedColorCode = '';
    this.selectedSizeValue = '';
    this.selectedVariant = null;
    this.modalMainImage = ''; // reset imagen de galería del modal
  }

  // ─── SELECTION ───────────────────────────────────────────────────────────────

  /**
   * Selecciona un color en el modal Quick-Add.
   * Actualiza la imagen principal a la foto de esa variante y adapta la talla seleccionada.
   */
  selectColor(code: string): void {
    this.selectedColorCode = code;

    // Actualizar imagen principal a la primera imagen de la variante con ese color
    const variant = this.modalVariants.find(v => v.color?.code === this.selectedColorCode);
    if (variant?.gallery?.length) {
      this.modalMainImage = variant.gallery[0];
    }

    // Validar o auto-seleccionar talla compatible
    const availableSizes = this.getAvailableSizes(this.modalVariants, this.selectedColorCode);
    if (!this.selectedSizeValue || !availableSizes.some(s => s.value === this.selectedSizeValue)) {
      this.selectedSizeValue = availableSizes.length > 0 ? availableSizes[0].value : '';
    }
    this.resolveVariant();
  }

  /**
   * Selecciona una talla en el modal Quick-Add.
   */
  selectSize(value: string): void {
    this.selectedSizeValue = value;
    this.resolveVariant();
  }

  /**
   * Devuelve el nombre legible del color seleccionado actualmente.
   */
  get selectedColorName(): string {
    if (!this.selectedColorCode) return '';
    const match = this.getUniqueColors(this.modalVariants).find(c => c.code === this.selectedColorCode);
    return match?.name ?? '';
  }

  private resolveVariant(): void {
    this.selectedVariant = this.modalVariants.find(v => {
      const colorMatch = !this.selectedColorCode || v.color?.code === this.selectedColorCode;
      const sizeMatch = !this.selectedSizeValue || v.size?.value === this.selectedSizeValue;
      return colorMatch && sizeMatch;
    }) ?? null;
  }

  // ─── ADD TO CART ─────────────────────────────────────────────────────────────

  // ─── MODAL QUANTITY & PRICE HELPERS ─────────────────────────────────────────

  incrementModalQty(): void {
    this.modalQuantity++;
  }

  decrementModalQty(): void {
    if (this.modalQuantity > 1) {
      this.modalQuantity--;
    }
  }

  get modalUnitFinalPrice(): number {
    if (!this.modalProduct) return 0;
    const base = this.modalProduct.finalPrice ?? this.modalProduct.basePrice ?? 0;
    const adj = this.selectedVariant?.priceAdjustment ?? 0;
    return Math.max(0, base + adj);
  }

  get modalTotalPrice(): number {
    return this.modalUnitFinalPrice * this.modalQuantity;
  }

  confirmQuickAdd(): void {
    if (!this.selectedVariant || !this.modalProduct) return;
    this.addVariantToCart(this.selectedVariant, this.modalProduct, this.modalQuantity);
  }

  private addVariantToCart(variant: ProductVariant, product: Product, qty: number = 1): void {
    this.modalAddingToCart = true;

    this.basketService.addToBasket(variant, qty, product).pipe(take(1)).subscribe({
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

  /**
   * Calcula el número de cuotas sin interés sugeridas para mostrar en la card.
   * Heurística simple basada en el precio final del producto.
   * @param product Producto maestro
   * @returns Número de cuotas (6, 12 o 24)
   */
  getInstallments(product: Product): number {
    const price = product.finalPrice ?? product.basePrice ?? 0;
    if (price >= 2000) return 24;
    if (price >= 1000) return 12;
    if (price >= 500) return 3;
    return 0;
  }

  /**
   * Determina si una posición de estrella debe renderizarse como media estrella.
   * @param position Posición de la estrella (1–5)
   * @param average  Promedio de rating (ej: 3.5)
   * @returns true si el promedio cae en la mitad de esa posición
   */
  isHalfStar(position: number, average: number): boolean {
    return average > position - 1 && average < position && (average % 1) >= 0.4;
  }

  /**
   * Determina si el producto puede retirarse en 24 horas en tienda física.
   * Condición: `nearestStoreKm` está presente, no es null, y es ≤ threshold.
   * Threshold: 5 km — tiendas a ≤ 5 km se consideran de retiro rápido.
   *
   * @param product Producto maestro con campo GEO `nearestStoreKm`
   * @returns true → mostrar badge "Retira en 24hr"
   */
  canPickupFast(product: Product): boolean {
    const km = product.nearestStoreKm;
    return km !== undefined && km !== null && km <= 5;
  }

    /**
   * Determina si un color hexadecimal es claro para adaptar contraste de checkmarks y bordes.
   * @param hex Código hexadecimal del color (ej. '#ffffff', '#1e3a5f')
   * @returns true si el color tiene luminancia alta
   */
  isLightColor(hex?: string): boolean {
    if (!hex) return false;
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 180;
    }
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 180;
    }
    return false;
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.svg';
    img.onerror = null;
  }
}

