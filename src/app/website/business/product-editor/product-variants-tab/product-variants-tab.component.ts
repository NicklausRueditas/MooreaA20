import {
  Component, Input, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ProductVariantsService } from '../../../../core/services/catalog/product-variants.service';
import { ToastService }           from '../../../../core/services/ui/toast.service';
import { Product }                from '../../../../core/interfaces/product.interface';
import { ProductVariant }         from '../../../../core/interfaces/store.interface';
import { VARIANT_TYPE_OPTIONS }   from '../../../../core/constants/product-options.constants';

import { VariantModalComponent }  from '../variant-modal/variant-modal.component';

/** Grupo de variantes del mismo color */
export interface ColorGroup {
  colorCode:  string;
  colorName:  string;
  colorHex:   string;
  variants:   ProductVariant[];
}

@Component({
  selector: 'app-product-variants-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, VariantModalComponent],
  templateUrl: './product-variants-tab.component.html',
})
export class ProductVariantsTabComponent implements OnInit, OnDestroy {
  @Input() productId!: string;
  @Input() product:    Product | null = null;

  variants:          ProductVariant[] = [];
  isLoadingVariants  = false;
  editingVariant:    ProductVariant | null = null;
  cloneSource:       ProductVariant | null = null;
  isModalOpen        = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly variantsService: ProductVariantsService,
    private readonly toastService:    ToastService,
  ) {}

  ngOnInit(): void { this.loadVariants(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Agrupación por color ────────────────────────────────────────────────

  get colorGroups(): ColorGroup[] {
    const map = new Map<string, ColorGroup>();

    for (const v of this.variants) {
      const key  = v.color?.code ?? '__no_color__';
      const name = v.color?.name ?? 'Sin color';
      const hex  = v.color?.hex  ?? '#e5e7eb';

      if (!map.has(key)) {
        map.set(key, { colorCode: key, colorName: name, colorHex: hex, variants: [] });
      }
      map.get(key)!.variants.push(v);
    }

    return Array.from(map.values());
  }

  // ─── Modal ───────────────────────────────────────────────────────────────

  openModal(variant?: ProductVariant, clone?: ProductVariant): void {
    this.editingVariant = variant ?? null;
    this.cloneSource    = clone   ?? null;
    this.isModalOpen    = true;
  }

  closeModal(): void {
    this.isModalOpen    = false;
    this.editingVariant = null;
    this.cloneSource    = null;
  }

  onVariantSaved(saved: ProductVariant): void {
    if (this.editingVariant) {
      const idx = this.variants.findIndex(v => v._id === this.editingVariant!._id);
      this.variants = idx !== -1
        ? this.variants.map((v, i) => i === idx ? saved : v)
        : [...this.variants, saved];
    } else {
      this.variants = [...this.variants, saved];
    }
    this.closeModal();
  }

  /** Activa o desactiva la variante usando los endpoints dedicados. */
  toggleVariantActive(variant: ProductVariant): void {
    const activate = !variant.isActive;
    const req$ = activate
      ? this.variantsService.activateVariant(variant._id, this.productId)
      : this.variantsService.deactivateVariant(variant._id, this.productId);

    req$.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.variants = this.variants.map(v => v._id === updated._id ? updated : v);
          this.toastService.showSuccess(activate ? '✅ Variante activada' : '⭕ Variante desactivada');
        },
        error: () => this.toastService.showError('Error al cambiar estado'),
      });
  }

  /** Elimina permanentemente la variante (hard delete — libera el SKU en DB) */
  deleteVariant(variant: ProductVariant): void {
    if (!confirm(`⚠️ ¿Eliminar permanentemente "${variant.sku}"?\nEsta acción no se puede deshacer.`)) return;
    this.variantsService.deleteVariant(variant._id, this.productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.variants = this.variants.filter(v => v._id !== variant._id);
          this.toastService.showSuccess('Variante eliminada permanentemente');
        },
        error: () => this.toastService.showError('Error al eliminar'),
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Precio sin descuento (base + ajuste). */
  rawPrice(variant: ProductVariant): number {
    return (this.product?.basePrice ?? 0) + (variant.priceAdjustment ?? 0);
  }

  /** Precio real al cliente = rawPrice × (1 − descuento/100). */
  finalPrice(variant: ProductVariant): number {
    const raw      = this.rawPrice(variant);
    const discount = this.product?.discount ?? 0;
    return raw * (1 - discount / 100);
  }

  sizeLabel(variant: ProductVariant): string {
    if (!variant.size) return '—';
    const opt = VARIANT_TYPE_OPTIONS.find(t => t.value === variant.size!.type);
    const typeLabel = opt?.label.replace(/^\S+\s/, '') ?? variant.size.type;
    return `${typeLabel}: ${variant.size.value}`;
  }

  // ─── Carga ───────────────────────────────────────────────────────────────

  /**
   * Carga las variantes desde el servicio (usa caché BehaviorSubject).
   * NO invalida el caché — la invalidación la hacen los métodos de escritura
   * (createVariant, updateVariant, deleteVariant, etc.) mediante tap().
   * De este modo, cambiar de tab 'info' ↔ 'variants' no genera peticiones HTTP extra.
   */
  private loadVariants(): void {
    this.isLoadingVariants = true;
    this.variantsService.getVariantsByProduct(this.productId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVariants = false; }))
      .subscribe({ next: v => { this.variants = v; }, error: () => { this.variants = []; } });
  }
}
