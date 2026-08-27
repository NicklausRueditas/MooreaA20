import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ProductsService }        from '../../../core/services/catalog/products.service';
import { ProductVariantsService } from '../../../core/services/catalog/product-variants.service';
import { ToastService }           from '../../../core/services/ui/toast.service';
import { Product, ProductWarranty } from '../../../core/interfaces/product.interface';
import { ProductVariant }         from '../../../core/interfaces/store.interface';

import { ProductInfoTabComponent }     from './product-info-tab/product-info-tab.component';
import { ProductVariantsTabComponent } from './product-variants-tab/product-variants-tab.component';

export type EditorTab = 'info' | 'variants';

@Component({
  selector: 'app-product-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ProductInfoTabComponent, ProductVariantsTabComponent],
  templateUrl: './product-editor.component.html',
})
export class ProductEditorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  productId: string | null = null;
  isNew     = false;
  isSaving  = false;
  isLoading = false;
  activeTab = signal<EditorTab>('info');

  product:      Product | null = null;
  variants:     ProductVariant[] = [];
  productForm!: FormGroup;

  constructor(
    private readonly fb:              FormBuilder,
    private readonly route:           ActivatedRoute,
    private readonly router:          Router,
    private readonly productsService: ProductsService,
    private readonly variantsService: ProductVariantsService,
    private readonly toastService:    ToastService,
  ) {}

  ngOnInit(): void {
    this.buildForm();

    const id              = this.route.snapshot.paramMap.get('id');
    const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

    // Leer tab inicial desde queryParam (?tab=variants)
    const tabParam = this.route.snapshot.queryParamMap.get('tab') as EditorTab | null;
    if (tabParam === 'variants') this.activeTab.set('variants');

    if (!id || id === 'new') {
      this.isNew = true;
    } else if (OBJECT_ID_REGEX.test(id)) {
      this.productId = id;
      this.loadProduct(id);
    } else {
      this.toastService.showError('ID de producto inválido');
      this.router.navigate(['/business/products']);
    }
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ─── Formulario ───────────────────────────────────────────────────────────

  private buildForm(): void {
    this.productForm = this.fb.group({
      code:           ['', [Validators.required, Validators.minLength(3)]],
      name:           ['', Validators.required],
      brand:          ['', Validators.required],
      model:          [''],
      description:    [''],
      basePrice:      [0, [Validators.required, Validators.min(0)]],
      discount:       [0, [Validators.min(0), Validators.max(100)]],
      isActive:       [true],
      category:       this.fb.array([], Validators.required),
      tags:           this.fb.array([]),
      gallery:        this.fb.array([]),
      specifications: [null],
      // ── Garantía ──────────────────────────────────────────────────────────
      hasWarranty:    [false],
      warranty: this.fb.group({
        duration:    [12, [Validators.required, Validators.min(1)]],
        unit:        ['months'],
        type:        ['manufacturer'],
        description: [''],
        policyUrl:   [''],
      }),
    });
  }

  private loadProduct(id: string): void {
    this.isLoading = true;
    this.productsService.getProductById(id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (p) => {
          this.product = p;
          this.patchForm(p);
          this.loadVariants(id);
        },
        error: () => this.toastService.showError('No se pudo cargar el producto'),
      });
  }

  private loadVariants(id: string): void {
    this.variantsService.getVariantsByProduct(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (v) => {
          this.variants = v.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        },
      });
  }

  private patchForm(p: Product): void {
    const categoryArr = this.productForm.get('category') as FormArray;
    const tagsArr     = this.productForm.get('tags')     as FormArray;
    const galleryArr  = this.productForm.get('gallery')  as FormArray;

    categoryArr.clear(); tagsArr.clear(); galleryArr.clear();

    p.category?.forEach(c => categoryArr.push(this.fb.control(c, Validators.required)));
    p.tags?.forEach(t     => tagsArr.push(this.fb.control(t)));
    p.gallery?.forEach(g  => galleryArr.push(this.fb.control(g)));

    this.productForm.patchValue({
      code: p.code, name: p.name, brand: p.brand, model: p.model,
      description: p.description, basePrice: p.basePrice, discount: p.discount,
      isActive: p.isActive, specifications: p.specifications ?? null,
      hasWarranty: !!p.warranty,
      warranty: p.warranty ?? { duration: 12, unit: 'months', type: 'manufacturer', description: '', policyUrl: '' },
    });
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  saveProduct(): void {
    if (this.productForm.invalid) { this.productForm.markAllAsTouched(); return; }
    if (!this.isNew && !this.productId) {
      this.toastService.showError('Producto sin ID'); return;
    }

    this.isSaving = true;
    const raw     = this.productForm.value;
    const payload = { ...raw } as Product;
    // Incluir warranty solo si el usuario habilitó la garantía
    if (!raw.hasWarranty) {
      if (this.isNew) {
        delete (payload as any).warranty;
      } else {
        (payload as any).warranty = null;
      }
    } else {
      // Limpiar campos opcionales vacíos
      const w = { ...(payload as any).warranty };
      if (!w.description?.trim()) delete (w as any).description;
      if (!w.policyUrl?.trim())   delete (w as any).policyUrl;
      (payload as any).warranty = w;
    }
    delete (payload as any).hasWarranty;
    const obs = this.isNew
      ? this.productsService.createProduct(payload)
      : (() => {
          // PATCH /:id no acepta code (inmutable) ni isActive (endpoints propios)
          const { isActive: _a, code: _c, ...updatePayload } = payload as any;
          return this.productsService.updateProduct(this.productId!, updatePayload);
        })();

    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; }))
      .subscribe({
        next: (saved) => {
          this.toastService.showSuccess(this.isNew ? 'Producto creado ✅' : 'Producto actualizado ✅');
          if (this.isNew) {
            const newId = saved._id ?? (saved as any).id;
            // Al crear, redirigir directamente al tab de variantes para que el
            // usuario pueda configurarlas sin pasos adicionales.
            newId
              ? this.router.navigate(['/business/products', newId, 'edit'], { queryParams: { tab: 'variants' } })
              : this.router.navigate(['/business/products']);
          } else {
            this.product = saved;
          }
        },
        error: (err) => this.toastService.showError(err?.error?.message ?? 'Error al guardar'),
      });
  }
}
