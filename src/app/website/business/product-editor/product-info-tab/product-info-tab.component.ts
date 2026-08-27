import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { ImageService } from '../../../../core/services/utils/image.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { Product }      from '../../../../core/interfaces/product.interface';
import { ProductCardComponent } from '../../../../shared/components/product-card/product-card.component';
import {
  CATEGORY_GROUPS, TAG_GROUPS,
  type CategoryGroup, type TagGroup,
} from '../../../../core/constants/product-options.constants';

@Component({
  selector: 'app-product-info-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ProductCardComponent],
  templateUrl: './product-info-tab.component.html',
})
export class ProductInfoTabComponent implements OnInit, OnDestroy {
  /** FormGroup construído por el padre y compartido via Input */
  @Input()  productForm!: FormGroup;
  @Input()  product:      Product | null = null;
  @Input()  isNew         = false;

  private readonly destroy$ = new Subject<void>();

  readonly categoryGroups: CategoryGroup[] = CATEGORY_GROUPS;
  readonly tagGroups:      TagGroup[]      = TAG_GROUPS;
  readonly popularCategories = ['Polos', 'Zapatillas', 'Casacas', 'Pantalones', 'Accesorios', 'Camisas', 'Shorts', 'Ropa Deportiva'];
  readonly objectKeys = Object.keys;

  readonly specKeyCtrl   = new FormControl('');
  readonly specValueCtrl = new FormControl('');
  readonly tagCtrl       = new FormControl('');
  readonly categorySearchCtrl = new FormControl('');

  isCategoryDropdownOpen = false;
  isUploadingImage = false;

  constructor(
    private readonly fb:           FormBuilder,
    private readonly imageService: ImageService,
    private readonly toastService: ToastService,
  ) {}

  ngOnInit(): void {}
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  /* ── FormArray getters ──────────────────────────────────────────────────── */
  get categoryArray(): FormArray  { return this.productForm.get('category') as FormArray; }
  get tagsArray():     FormArray  { return this.productForm.get('tags')     as FormArray; }
  get galleryArray():  FormArray  { return this.productForm.get('gallery')  as FormArray; }
  get specifications(): Record<string, string> {
    return this.productForm.get('specifications')?.value ?? {};
  }

  /* ── Garantía ───────────────────────────────────────────────────────────── */
  get warrantyGroup(): FormGroup { return this.productForm.get('warranty') as FormGroup; }
  get hasWarranty():   boolean   { return !!this.productForm.get('hasWarranty')?.value; }
  get warrantyType():  string    { return this.warrantyGroup?.get('type')?.value ?? ''; }

  applyWarrantyPreset(preset: '1yr-factory' | '6mo-store' | '30d-swap' | 'custom' | 'none'): void {
    if (preset === 'none') {
      this.productForm.get('hasWarranty')?.setValue(false);
      return;
    }

    this.productForm.get('hasWarranty')?.setValue(true);

    if (preset === '1yr-factory') {
      this.warrantyGroup.patchValue({
        duration: 12,
        unit: 'months',
        type: 'manufacturer',
        description: 'Garantía oficial por defectos de fabricación.',
        policyUrl: '',
      });
    } else if (preset === '6mo-store') {
      this.warrantyGroup.patchValue({
        duration: 6,
        unit: 'months',
        type: 'store',
        description: 'Garantía de tienda para cambio o servicio técnico.',
        policyUrl: '',
      });
    } else if (preset === '30d-swap') {
      this.warrantyGroup.patchValue({
        duration: 30,
        unit: 'days',
        type: 'store',
        description: 'Cambio o devolución directa en tienda.',
        policyUrl: '',
      });
    } else if (preset === 'custom') {
      if (!this.warrantyGroup.get('duration')?.value) {
        this.warrantyGroup.patchValue({
          duration: 12,
          unit: 'months',
          type: 'manufacturer',
          description: '',
          policyUrl: '',
        });
      }
    }
  }

  isPresetActive(preset: '1yr-factory' | '6mo-store' | '30d-swap' | 'custom' | 'none'): boolean {
    if (!this.hasWarranty) return preset === 'none';
    const d = this.warrantyGroup.get('duration')?.value;
    const u = this.warrantyGroup.get('unit')?.value;
    const t = this.warrantyGroup.get('type')?.value;

    if (preset === '1yr-factory') return d === 12 && u === 'months' && t === 'manufacturer';
    if (preset === '6mo-store')   return d === 6  && u === 'months' && t === 'store';
    if (preset === '30d-swap')    return d === 30 && u === 'days'   && t === 'store';
    if (preset === 'custom')      return !( (d === 12 && u === 'months' && t === 'manufacturer') || (d === 6 && u === 'months' && t === 'store') || (d === 30 && u === 'days' && t === 'store') );
    return false;
  }

  /* ── Descuentos Rápidos y Métricas ─────────────────────────────────────── */
  applyQuickDiscount(pct: number): void {
    this.productForm.get('discount')?.setValue(pct);
  }

  get completionPercentage(): number {
    let score = 0;
    if (this.productForm.get('name')?.value?.trim()) score += 20;
    if (this.productForm.get('code')?.value?.trim()) score += 15;
    if (this.productForm.get('brand')?.value?.trim()) score += 15;
    if ((this.productForm.get('basePrice')?.value ?? 0) > 0) score += 20;
    if (this.categoryArray.length > 0) score += 15;
    if (this.galleryArray.length > 0) score += 15;
    return Math.min(100, score);
  }

  /** Precio real que ve el cliente = basePrice × (1 - discount/100) */
  get clientPrice(): number {
    const base     = +(this.productForm.get('basePrice')?.value ?? 0);
    const discount = +(this.productForm.get('discount')?.value  ?? 0);
    return base * (1 - discount / 100);
  }

  /* ── Previsualización en Vivo (Product Card) ────────────────────────────── */
  get previewProduct(): Product {
    const raw = this.productForm.value;
    const basePrice = +(raw.basePrice || 0);
    const discount = +(raw.discount || 0);
    const finalPrice = basePrice * (1 - discount / 100);

    let gallery = (this.galleryArray?.value || []).filter((g: any) => typeof g === 'string' && g.trim());
    if (gallery.length === 0 && this.product?.gallery && this.product.gallery.length > 0) {
      gallery = this.product.gallery;
    }
    if (gallery.length === 0 && this.product?.thumbnailGallery && this.product.thumbnailGallery.length > 0) {
      gallery = this.product.thumbnailGallery.map(t => t.image);
    }
    if (gallery.length === 0) {
      gallery = ['assets/images/placeholder.svg'];
    }

    return {
      _id: this.product?._id ?? 'preview-temp-id',
      code: raw.code || 'BASH-DALLAS',
      name: raw.name || 'Nombre del Producto',
      brand: raw.brand || 'Moorea',
      model: raw.model || '',
      description: raw.description || '',
      basePrice: basePrice,
      discount: discount,
      finalPrice: finalPrice,
      isActive: raw.isActive ?? true,
      category: this.categoryArray?.value || [],
      tags: this.tagsArray?.value || [],
      gallery: gallery,
      thumbnailGallery: this.product?.thumbnailGallery,
      availableColors: this.product?.availableColors,
      warranty: raw.hasWarranty ? raw.warranty : undefined,
      rating: this.product?.rating ?? { average: 5.0, count: 12, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 10 } },
      createdAt: this.product?.createdAt ?? new Date().toISOString(),
      updatedAt: this.product?.updatedAt ?? new Date().toISOString(),
    };
  }

  /* ── Categorías ─────────────────────────────────────────────────────────── */
  get filteredCategoryGroups(): CategoryGroup[] {
    const search = this.categorySearchCtrl.value?.trim().toLowerCase() ?? '';
    if (!search) return this.categoryGroups;
    return this.categoryGroups.map(g => {
      const options = g.options.filter(opt => opt.toLowerCase().includes(search));
      return { ...g, options };
    }).filter(g => g.options.length > 0);
  }

  togglePopularCategory(cat: string): void {
    const idx = this.categoryArray.value.indexOf(cat);
    if (idx >= 0) {
      this.categoryArray.removeAt(idx);
    } else {
      this.categoryArray.push(this.fb.control(cat, Validators.required));
    }
  }

  isCategorySelected(cat: string): boolean {
    return this.categoryArray.value.includes(cat);
  }

  selectCategory(value: string): void {
    if (value && !this.categoryArray.value.includes(value)) {
      this.categoryArray.push(this.fb.control(value, Validators.required));
    }
    this.categorySearchCtrl.setValue('');
    this.isCategoryDropdownOpen = false;
  }

  removeCategory(i: number): void { this.categoryArray.removeAt(i); }

  /* ── Tags ───────────────────────────────────────────────────────────────── */
  addTag(customTag?: string): void {
    const tag = (customTag ?? this.tagCtrl.value)?.trim();
    if (tag && !this.tagsArray.value.includes(tag)) {
      this.tagsArray.push(this.fb.control(tag));
      if (!customTag) this.tagCtrl.reset();
    }
  }
  onTagKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.addTag(); }
  }
  removeTag(i: number): void { this.tagsArray.removeAt(i); }

  /* ── Especificaciones ───────────────────────────────────────────────────── */
  specJsonMode  = false;
  jsonSpecError = '';
  readonly specJsonCtrl   = new FormControl('');
  readonly jsonPlaceholder = '{\n  "material": "Cuero sintético",\n  "suela": "Goma"\n}';

  toggleJsonMode(): void {
    this.specJsonMode = !this.specJsonMode;
    this.jsonSpecError = '';
    if (this.specJsonMode) {
      // Precarga el textarea con las specs actuales formateadas
      const current = this.specifications;
      this.specJsonCtrl.setValue(
        Object.keys(current).length
          ? JSON.stringify(current, null, 2)
          : '{\n  \n}'
      );
    }
  }

  applyJsonSpecs(): void {
    try {
      const raw  = JSON.parse(this.specJsonCtrl.value ?? '{}');
      // Solo acepta objetos planos con valores string
      if (typeof raw !== 'object' || Array.isArray(raw)) {
        this.jsonSpecError = 'Debe ser un objeto JSON (clave: valor)'; return;
      }
      const parsed: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v !== 'string' && typeof v !== 'number') {
          this.jsonSpecError = `El valor de "${k}" debe ser string o número`; return;
        }
        parsed[k] = String(v);
      }
      this.productForm.get('specifications')?.setValue(
        Object.keys(parsed).length ? parsed : null
      );
      this.jsonSpecError = '';
      this.specJsonMode  = false;
    } catch {
      this.jsonSpecError = 'JSON inválido — revisa la sintaxis';
    }
  }

  addSpecification(): void {
    const key = this.specKeyCtrl.value?.trim();
    const val = this.specValueCtrl.value?.trim();
    if (key && val) {
      const current = { ...(this.specifications ?? {}) };
      current[key] = val;
      this.productForm.get('specifications')?.setValue(current);
      this.specKeyCtrl.reset(); this.specValueCtrl.reset();
    }
  }
  removeSpecification(key: string): void {
    const current = { ...(this.specifications ?? {}) };
    delete current[key];
    this.productForm.get('specifications')?.setValue(
      Object.keys(current).length ? current : null
    );
  }

  /* ── Galería ────────────────────────────────────────────────────────────── */
  onGalleryFileSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) return;
    this.isUploadingImage = true;
    let pending = files.length;
    files.forEach(file => {
      this.imageService.uploadImage(file).pipe(takeUntil(this.destroy$)).subscribe({
        next: res => {
          this.galleryArray.push(this.fb.control(res.secureUrl ?? res.cloudinaryUrl));
          if (--pending === 0) this.isUploadingImage = false;
        },
        error: () => {
          this.toastService.showError(`Error al subir ${file.name}`);
          if (--pending === 0) this.isUploadingImage = false;
        },
      });
    });
    (event.target as HTMLInputElement).value = '';
  }
  removeGalleryImage(i: number): void { this.galleryArray.removeAt(i); }

  /* ── Helper ─────────────────────────────────────────────────────────────── */
  isFieldInvalid(field: string): boolean {
    const ctrl = this.productForm.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }
}
