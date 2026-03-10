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
import {
  CATEGORY_GROUPS, TAG_GROUPS,
  type CategoryGroup, type TagGroup,
} from '../../../../core/constants/product-options.constants';

@Component({
  selector: 'app-product-info-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
  readonly objectKeys = Object.keys;

  readonly specKeyCtrl   = new FormControl('');
  readonly specValueCtrl = new FormControl('');
  readonly tagCtrl       = new FormControl('');

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

  /* ── Categorías ─────────────────────────────────────────────────────────── */
  addCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value && !this.categoryArray.value.includes(value)) {
      this.categoryArray.push(this.fb.control(value, Validators.required));
      (event.target as HTMLSelectElement).value = '';
    }
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
