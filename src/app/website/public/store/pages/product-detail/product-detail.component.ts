import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ProductsService } from '../../../../../core/services/catalog/products.service';
import { ProductVariantsService } from '../../../../../core/services/catalog/product-variants.service';
import { BasketService } from '../../../../../core/services/commerce/basket.service';
import { ToastService } from '../../../../../core/services/ui/toast.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { GeoService } from '../../../../../core/services/utils/geo.service';
import { Product } from '../../../../../core/interfaces/product.interface';
import { ProductVariant } from '../../../../../core/interfaces/store.interface';
import { CloudinaryPipe } from '../../../../../shared/pipes/cloudinary.pipe';
import { ProductReviewsComponent } from './product-reviews/product-reviews.component';
import { RelatedProductsComponent } from './related-products/related-products.component';

/** Elemento de la galería unificada (producto maestro + variantes) */
interface GalleryItem {
  url: string;
  colorCode?: string; // code del color de la variante (undefined si es del producto maestro)
  colorName?: string; // nombre legible del color
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CloudinaryPipe, ProductReviewsComponent, RelatedProductsComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  variants: ProductVariant[] = [];
  selectedVariant: ProductVariant | null = null;

  selectedImage: string = '';
  /** Clave que cambia con cada imagen para forzar la animación CSS de fade */
  imageKey: number = 0;
  /** Índice activo en el slider de thumbnails */
  sliderIndex: number = 0;
  quantity: number = 1;
  loading: boolean = true;
  loadingVariants: boolean = false;
  addingToCart: boolean = false;

  // Color/size selectors
  selectedColorCode: string = '';
  selectedSizeValue: string = '';

  // Premium UI states
  activeTab: 'description' | 'specifications' | 'shipping' = 'description';

  // Magnifier Zoom state
  zoomX: number = 50;
  zoomY: number = 50;
  isZooming: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private productsService: ProductsService,
    private variantsService: ProductVariantsService,
    private basketService: BasketService,
    private toastService: ToastService,
    private authService: AuthService,
    private geoService: GeoService
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('id');
    if (productId) {
      this.loadProduct(productId);
    } else {
      this.router.navigate(['/store']);
    }
  }

  // ─── DATA LOADING ────────────────────────────────────────────────────────────

  loadProduct(id: string): void {
    this.loading = true;

    const cached = this.productsService.getCatalogSnapshot().find((p: Product) => p._id === id);
    if (cached) {
      this.product = cached;
      this.selectedImage = cached.gallery?.[0] ?? '';
      this.titleService.setTitle(`${cached.name} | Moorea`);
      this.loading = false;
      this.loadVariants(id);
      return;
    }

    // Fallback: el usuario llegó directo a la URL sin pasar por el store
    this.productsService.getProductById(id).subscribe({
      next: (product) => {
        this.product = product;
        this.selectedImage = product.gallery?.[0] ?? '';
        this.titleService.setTitle(`${product.name} | Moorea`);
        this.loading = false;
        this.loadVariants(id);
      },
      error: () => {
        this.toastService.showError('Error al cargar el producto');
        this.loading = false;
        this.router.navigate(['/store']);
      }
    });
  }

  loadVariants(productId: string): void {
    this.loadingVariants = true;
    this.geoService.resolve().subscribe({
      next: (location) => {
        this.variantsService.getGeoVariantsByProduct(productId, location.lat, location.lng).subscribe({
          next: (variants) => {
            this.variants = variants
              .filter(v => v.isActive !== false)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            this.loadingVariants = false;
            // Auto-seleccionar la variante que coincida con el primer color o imagen principal
            if (this.variants.length > 0) {
              const primaryColor = this.product?.thumbnailGallery?.[0]?.colorCode ?? '';
              let matched = this.variants.find(v => v.color?.code === primaryColor);
              if (!matched) {
                const primaryImg = this.product?.gallery?.[0] ?? '';
                matched = this.variants.find(v => v.gallery?.includes(primaryImg));
              }
              this.autoSelectVariant(matched ?? this.variants[0]);
            }
          },
          error: () => { this.loadingVariants = false; }
        });
      },
      error: () => {
        // Fallback si falla la geolocalización
        this.variantsService.getVariantsByProduct(productId).subscribe({
          next: (variants) => {
            this.variants = variants
              .filter(v => v.isActive !== false)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            this.loadingVariants = false;
            if (this.variants.length > 0) {
              const primaryColor = this.product?.thumbnailGallery?.[0]?.colorCode ?? '';
              let matched = this.variants.find(v => v.color?.code === primaryColor);
              if (!matched) {
                const primaryImg = this.product?.gallery?.[0] ?? '';
                matched = this.variants.find(v => v.gallery?.includes(primaryImg));
              }
              this.autoSelectVariant(matched ?? this.variants[0]);
            }
          },
          error: () => { this.loadingVariants = false; }
        });
      }
    });
  }

  private autoSelectVariant(v: ProductVariant): void {
    this.selectedColorCode = v.color?.code ?? '';
    this.selectedSizeValue = v.size?.value ?? '';
    this.selectedVariant = v;
    this.updateImageForVariant(v);
  }

  // ─── VARIANT COMPUTED LISTS ──────────────────────────────────────────────────

  /** Colores únicos entre todas las variantes */
  get uniqueColors(): { name: string; hex: string; code: string }[] {
    const seen = new Set<string>();
    return this.variants
      .filter(v => v.color)
      .map(v => v.color!)
      .filter(c => {
        if (seen.has(c.code)) return false;
        seen.add(c.code);
        return true;
      });
  }

  /** Devuelve el hex de un color por su code, o un gris si no se encuentra */
  getColorHex(code: string | undefined): string {
    if (!code) return '#e5e7eb';
    return this.uniqueColors.find(c => c.code === code)?.hex ?? '#e5e7eb';
  }

  /** Tallas disponibles para el color seleccionado (o todos si no hay color) */
  get availableSizes(): { value: string; type: string; region?: string }[] {
    const source = this.selectedColorCode
      ? this.variants.filter(v => v.color?.code === this.selectedColorCode)
      : this.variants;

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

  private compareSizes(a: string, b: string): number {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const ia = order.indexOf(a.toUpperCase());
    const ib = order.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.localeCompare(b);
  }

  /** ¿La talla tiene stock para el color seleccionado? */
  isSizeAvailable(sizeValue: string): boolean {
    return this.variants.some(v =>
      v.size?.value === sizeValue &&
      (!this.selectedColorCode || v.color?.code === this.selectedColorCode)
    );
  }

  // ─── SELECTION LOGIC ─────────────────────────────────────────────────────────

  selectColor(code: string): void {
    if (this.selectedColorCode === code) {
      this.selectedColorCode = '';
      this.selectedSizeValue = '';
      this.selectedVariant = null;
      // Volver a la primera imagen del producto maestro
      const firstItem = this.combinedGallery[0];
      if (firstItem) { this.selectedImage = firstItem.url; this.sliderIndex = 0; }
      return;
    }
    this.selectedColorCode = code;
    // Resetear talla si no existe para el nuevo color
    if (this.selectedSizeValue && !this.isSizeAvailable(this.selectedSizeValue)) {
      this.selectedSizeValue = '';
    }
    // Auto-seleccionar la imagen correspondiente al color en la galeria combinada
    const idx = this.combinedGallery.findIndex(item => item.colorCode === code);
    if (idx !== -1) {
      this.sliderIndex = idx;
      this.selectedImage = this.combinedGallery[idx].url;
    }
    this.resolveSelectedVariant();
  }

  selectSize(value: string): void {
    this.selectedSizeValue = this.selectedSizeValue === value ? '' : value;
    this.resolveSelectedVariant();
  }

  private resolveSelectedVariant(): void {
    if (!this.selectedColorCode && !this.selectedSizeValue) {
      this.selectedVariant = null;
      return;
    }
    const match = this.variants.find(v => {
      const colorMatch = !this.selectedColorCode || v.color?.code === this.selectedColorCode;
      const sizeMatch = !this.selectedSizeValue || v.size?.value === this.selectedSizeValue;
      return colorMatch && sizeMatch;
    });
    this.selectedVariant = match ?? null;
    if (match) this.updateImageForVariant(match);
  }

  private updateImageForVariant(v: ProductVariant): void {
    let url = this.selectedImage;
    if (v.gallery && v.gallery.length > 0) {
      url = v.gallery[0];
    } else if (this.product?.gallery?.[0]) {
      url = this.product.gallery[0];
    }
    this.setImage(url);
    // Sincronizar sliderIndex con la posición en combinedGallery
    const idx = this.combinedGallery.findIndex(item => item.url === url);
    this.sliderIndex = idx !== -1 ? idx : 0;
  }

  // ─── GALLERY ─────────────────────────────────────────────────────────────────

  /**
   * Galería unificada: las imágenes de la variante seleccionada (o variante 1 por defecto)
   * van primero, seguidas de las imágenes del producto maestro como complemento.
   * Si no hay variante seleccionada, muestra todas las imágenes de variantes en orden
   * y luego las del maestro. Las URLs se deduiplican para evitar repeticiones.
   */
  get combinedGallery(): GalleryItem[] {
    const items: GalleryItem[] = [];
    const seenUrls = new Set<string>();

    // Helper para agregar URL si no fue vista aún
    const push = (url: string, colorCode?: string, colorName?: string) => {
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        items.push({ url, colorCode, colorName });
      }
    };

    // 1. Imágenes de la variante seleccionada primero (o de todas en orden si no hay selección)
    if (this.selectedVariant?.gallery?.length) {
      for (const url of this.selectedVariant.gallery) {
        push(url, this.selectedVariant.color?.code, this.selectedVariant.color?.name);
      }
      // Resto de variantes (sin la seleccionada) a continuación
      for (const variant of this.variants) {
        if (variant._id === this.selectedVariant._id) continue;
        for (const url of (variant.gallery ?? [])) {
          push(url, variant.color?.code, variant.color?.name);
        }
      }
    } else {
      // Sin variante seleccionada: todas las variantes en orden
      for (const variant of this.variants) {
        for (const url of (variant.gallery ?? [])) {
          push(url, variant.color?.code, variant.color?.name);
        }
      }
    }

    // 2. Imágenes del producto maestro al final (lifestyle, guía de tallas, etc.) — complementarias
    for (const url of (this.product?.gallery ?? [])) {
      push(url);
    }

    return items;
  }

  selectImage(item: GalleryItem): void {
    this.setImage(item.url);
    const idx = this.combinedGallery.findIndex(g => g.url === item.url);
    if (idx !== -1) this.sliderIndex = idx;
  }

  nextImage(): void {
    const g = this.combinedGallery;
    if (!g.length) return;
    this.sliderIndex = (this.sliderIndex + 1) % g.length;
    this.setImage(g[this.sliderIndex].url);
  }

  previousImage(): void {
    const g = this.combinedGallery;
    if (!g.length) return;
    this.sliderIndex = this.sliderIndex === 0 ? g.length - 1 : this.sliderIndex - 1;
    this.setImage(g[this.sliderIndex].url);
  }

  /** Abre la imagen actual en pantalla completa (pestaña nueva) */
  openFullscreen(): void {
    if (this.selectedImage) window.open(this.selectedImage, '_blank');
  }

  /** Cambia la imagen seleccionada e incrementa imageKey para disparar animación CSS */
  private setImage(url: string): void {
    this.selectedImage = url;
    this.imageKey++;
  }

  // ─── PRICE ───────────────────────────────────────────────────────────────────

  get finalPrice(): number {
    const base = this.product?.basePrice ?? 0;
    const adj = this.selectedVariant?.priceAdjustment ?? 0;
    const disc = this.product?.discount ?? 0;
    return (base + adj) * (1 - disc / 100);
  }

  get originalPrice(): number {
    const base = this.product?.basePrice ?? 0;
    const adj = this.selectedVariant?.priceAdjustment ?? 0;
    return base + adj;
  }

  get discountPct(): number { return this.product?.discount ?? 0; }

  // ─── QUANTITY ────────────────────────────────────────────────────────────────

  increaseQuantity(): void { this.quantity++; }
  decreaseQuantity(): void { if (this.quantity > 1) this.quantity--; }

  // ─── CART ────────────────────────────────────────────────────────────────────

  get canAddToCart(): boolean {
    if (!this.product) return false;
    const hasColors = this.uniqueColors.length > 0;
    const hasSizes  = this.availableSizes.length > 0;
    if (hasColors && !this.selectedColorCode) return false;
    if (hasSizes  && !this.selectedSizeValue)  return false;
    // El backend requiere variantId: si hay colores o tallas, la variante debe estar resuelta
    if ((hasColors || hasSizes) && !this.selectedVariant) return false;
    return true;
  }

  get cartValidationMsg(): string {
    const hasColors = this.uniqueColors.length > 0;
    const hasSizes  = this.availableSizes.length > 0;
    if (hasColors && !this.selectedColorCode) return 'Selecciona un color';
    if (hasSizes  && !this.selectedSizeValue)  return 'Selecciona una talla';
    if ((hasColors || hasSizes) && !this.selectedVariant)
      return 'La combinación de color y talla no está disponible';
    return '';
  }

  addToCart(): void {
    if (!this.canAddToCart) {
      this.toastService.showError(this.cartValidationMsg || 'Selecciona las opciones del producto');
      return;
    }

    // El backend requiere siempre un variantId
    const variantId = this.selectedVariant?._id;
    if (!variantId) {
      this.toastService.showError('Selecciona color y talla antes de agregar al carrito');
      return;
    }

    this.addingToCart = true;

    this.basketService.addToBasket(this.selectedVariant!, this.quantity, this.product!).subscribe({
      next: () => {
        const color = this.selectedVariant?.color?.name ?? '';
        const size  = this.selectedVariant?.size?.value ?? '';
        const parts = [color, size].filter(Boolean).join(' · ');
        const isGuest = !this.authService.currentUserSubject.value;

        if (isGuest) {
          this.toastService.showInfo(
            `✓ Agregado al carrito${parts ? ` (${parts})` : ''} · Inicia sesión para guardar tu pedido`
          );
        } else {
          this.toastService.showSuccess(
            `Agregado al carrito${parts ? ` (${parts})` : ''}`
          );
        }
        this.addingToCart = false;
      },
      error: () => {
        this.toastService.showError('Error al agregar al carrito');
        this.addingToCart = false;
      }
    });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  goBack(): void { this.router.navigate(['/store']); }

  getSizeLabel(type: string): string {
    const map: Record<string, string> = {
      TALLA: 'Talla (calzado)', TALLA_ROPA: 'Talla', UNIQUE: 'Única'
    };
    return map[type] ?? 'Talla';
  }

  /** Nombre del color actualmente seleccionado */
  get selectedColorName(): string {
    return this.uniqueColors.find(c => c.code === this.selectedColorCode)?.name ?? '';
  }

  /**
   * Determina si un color hex es claro (para poner el check oscuro encima).
   * Usa luminancia relativa per ITU-R BT.709.
   */
  isLightColor(hex: string): boolean {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Luminancia relativa
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  }

  getFilledStars(): number[] {
    const n = Math.floor(this.product?.rating?.average ?? 0);
    return Array(n).fill(0).map((_, i) => i);
  }

  getEmptyStars(): number[] {
    const n = 5 - Math.floor(this.product?.rating?.average ?? 0);
    return Array(Math.max(0, n)).fill(0).map((_, i) => i);
  }

  getRatingPercentage(stars: number): number {
    if (!this.product?.rating?.distribution || !this.product.rating.count) return 0;
    const count = this.product.rating.distribution[stars as 1 | 2 | 3 | 4 | 5] || 0;
    return (count / this.product.rating.count) * 100;
  }

  getSpecificationsArray(): { key: string; value: string }[] {
    if (!this.product?.specifications) return [];
    return Object.entries(this.product.specifications).map(([key, value]) => ({ key, value: value as string }));
  }

  /** Fallback cuando una imagen (Cloudinary u otra) falla al cargar */
  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.svg';
    img.onerror = null; // evita loop infinito
  }

  getWarrantyUnitLabel(unit: string | undefined): string {
    if (!unit) return '';
    const map: Record<string, string> = {
      days: 'días',
      months: 'meses',
      years: 'años'
    };
    return map[unit] || unit;
  }

  getWarrantyTypeLabel(type: string | undefined): string {
    if (!type) return 'Garantía';
    const map: Record<string, string> = {
      manufacturer: 'Garantía de Fábrica',
      store: 'Garantía de la Tienda',
      none: 'Sin Garantía'
    };
    return map[type] || 'Garantía';
  }

  // ─── Premium UI Methods ──────────────────────────────────────────────────────

  selectTab(tab: 'description' | 'specifications' | 'shipping'): void {
    this.activeTab = tab;
  }

  onMouseMove(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    this.zoomX = x;
    this.zoomY = y;
  }

  onMouseEnter(): void {
    this.isZooming = true;
  }

  onMouseLeave(): void {
    this.isZooming = false;
  }

  scrollToReviews(): void {
    const el = document.getElementById('reviews-section') || document.querySelector('app-product-reviews');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
