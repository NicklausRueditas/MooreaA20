import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ProductsService } from '../../../core/services/catalog/products.service';
import { ToastService }    from '../../../core/services/ui/toast.service';
import { Product }         from '../../../core/interfaces/product.interface';

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
  productForm!: FormGroup;

  constructor(
    private readonly fb:              FormBuilder,
    private readonly route:           ActivatedRoute,
    private readonly router:          Router,
    private readonly productsService: ProductsService,
    private readonly toastService:    ToastService,
  ) {}

  ngOnInit(): void {
    this.buildForm();

    const id              = this.route.snapshot.paramMap.get('id');
    const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

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
    });
  }

  private loadProduct(id: string): void {
    this.isLoading = true;
    this.productsService.getProductById(id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (p) => { this.product = p; this.patchForm(p); },
        error: () => this.toastService.showError('No se pudo cargar el producto'),
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
    });
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  saveProduct(): void {
    if (this.productForm.invalid) { this.productForm.markAllAsTouched(); return; }
    if (!this.isNew && !this.productId) {
      this.toastService.showError('Producto sin ID'); return;
    }

    this.isSaving = true;
    const payload = this.productForm.value as Product;
    const obs = this.isNew
      ? this.productsService.createProduct(payload)
      : this.productsService.updateProduct(this.productId!, payload);

    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; }))
      .subscribe({
        next: (saved) => {
          this.toastService.showSuccess(this.isNew ? 'Producto creado ✅' : 'Producto actualizado ✅');
          if (this.isNew) {
            const newId = saved._id ?? (saved as any).id;
            newId
              ? this.router.navigate(['/business/products', newId, 'edit'])
              : this.router.navigate(['/business/products']);
          } else {
            this.product = saved;
          }
        },
        error: (err) => this.toastService.showError(err?.error?.message ?? 'Error al guardar'),
      });
  }
}
