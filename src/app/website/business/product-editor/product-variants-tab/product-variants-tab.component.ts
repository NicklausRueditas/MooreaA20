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

  /** Array mutable de grupos de color — permite reordenar via drag & drop */
  colorGroups: ColorGroup[] = [];

  /** Índice del grupo que se está arrastrando (-1 = ninguno) */
  dragSrcIndex = -1;

  /** true mientras hay un drag activo — controla estilos visuales de drop zone */
  isDragging = false;

  /** true mientras se persiste el nuevo orden en el backend */
  isSavingOrder = false;

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

  // ─── Agrupación por color ─────────────────────────────────────────────────

  /**
   * Reconstruye el array mutable `colorGroups` desde `this.variants`.
   * Se llama tras cargar variantes y tras modificarlas (crear/editar/borrar).
   * El orden previo de los grupos se respeta si ya existe un array (drag reordenado).
   */
  private buildColorGroups(): void {
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
    const newGroups = Array.from(map.values());
    // Primera carga: asignar directamente
    if (this.colorGroups.length === 0) {
      this.colorGroups = newGroups;
      return;
    }
    // Re-cargas posteriores: respetar el orden que dejó el drag
    const ordered: ColorGroup[] = [];
    for (const existing of this.colorGroups) {
      const fresh = newGroups.find(g => g.colorCode === existing.colorCode);
      if (fresh) ordered.push(fresh);
    }
    // Añadir grupos nuevos que no existían antes
    for (const g of newGroups) {
      if (!ordered.find(o => o.colorCode === g.colorCode)) ordered.push(g);
    }
    this.colorGroups = ordered;
  }

  // ─── Drag & Drop de grupos de color ──────────────────────────────────────

  /**
   * Registra el índice del grupo que comenzó a arrastrarse.
   * @param event  - Evento nativo DragEvent
   * @param index  - Posición del grupo en colorGroups[]
   */
  onGroupDragStart(event: DragEvent, index: number): void {
    this.dragSrcIndex = index;
    this.isDragging   = true;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  /**
   * Mueve el grupo en el array mientras el usuario arrastra encima de otro.
   * Produce el efecto visual de reorden en tiempo real.
   * @param event  - DragEvent (prevenido para habilitar el drop)
   * @param index  - Posición del grupo sobre el que se arrastra
   */
  onGroupDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.dragSrcIndex === -1 || this.dragSrcIndex === index) return;
    const groups = [...this.colorGroups];
    const [moved] = groups.splice(this.dragSrcIndex, 1);
    groups.splice(index, 0, moved);
    this.colorGroups  = groups;
    this.dragSrcIndex = index;
  }

  /**
   * Finaliza el drag: sincroniza `this.variants` con el nuevo orden y persiste en el backend.
   * El nuevo orden impacta directamente en qué grupo de color aparece primero en el catálogo.
   */
  onGroupDragEnd(): void {
    this.isDragging   = false;
    this.dragSrcIndex = -1;
    // Sincronizar variants con el nuevo orden de grupos
    this.variants = this.colorGroups.flatMap(g => g.variants);

    // Persistir el nuevo orden en el backend
    const orderedIds = this.variants.map(v => v._id);
    this.isSavingOrder = true;
    this.variantsService.reorderVariants(this.productId, orderedIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSavingOrder = false;
          this.toastService.showSuccess(`✓ Orden guardado (${res.updated} variantes)`);
        },
        error: () => {
          this.isSavingOrder = false;
          this.toastService.showError('Error al guardar el orden. Intenta de nuevo.');
        },
      });
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

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
    this.buildColorGroups();
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
          this.buildColorGroups();
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
          this.buildColorGroups();
          this.toastService.showSuccess('Variante eliminada permanentemente');
        },
        error: () => this.toastService.showError('Error al eliminar'),
      });
  }

  /**
   * Elimina permanentemente TODAS las variantes de un grupo de color (hard delete masivo).
   * Muestra confirmación con el nombre del color y la cantidad de tallas antes de operar.
   *
   * @param group - Grupo de color a eliminar (contiene colorCode, colorName y variants[])
   */
  deleteGroupByColor(group: ColorGroup): void {
    const tallaCount = group.variants.length;
    const confirmed = confirm(
      `⚠️ ¿Eliminar permanentemente el color "${group.colorName}" (${group.colorCode})?\n` +
      `Se borrarán ${tallaCount} talla(s) de forma definitiva.\n\n` +
      `Esta acción NO se puede deshacer.`,
    );
    if (!confirmed) return;

    this.variantsService.deleteColorGroup(this.productId, group.colorCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          // Eliminar del array local sin recargar
          this.variants = this.variants.filter(v => v.color?.code !== group.colorCode);
          this.buildColorGroups();
          this.toastService.showSuccess(
            `🗑️ Color "${group.colorName}" eliminado (${res.deleted} variante(s))`,
          );
        },
        error: () => this.toastService.showError(`Error al eliminar el color "${group.colorName}"`),
      });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  get totalColors(): number { return this.colorGroups.length; }
  get totalSizes(): number { return this.variants.length; }
  get activeVariantsCount(): number { return this.variants.filter(v => v.isActive).length; }

  /** Precio sin descuento (base + ajuste de variante). */
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

  // ─── Carga ────────────────────────────────────────────────────────────────

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
      .subscribe({
        next: (v) => { this.variants = v; this.buildColorGroups(); },
        error: () => { this.variants = []; this.colorGroups = []; },
      });
  }
}
