import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize, forkJoin } from 'rxjs';

import {
  ProductVariantsService,
  CreateVariantDto,
} from '../../../../core/services/catalog/product-variants.service';
import { ImageService } from '../../../../core/services/utils/image.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { Product } from '../../../../core/interfaces/product.interface';
import { ProductVariant } from '../../../../core/interfaces/store.interface';
import {
  COLOR_OPTIONS,
  TALLAS_POR_TIPO,
  VARIANT_TYPE_OPTIONS,
  type VariantSizeType,
  type VariantTypeOption,
} from '../../../../core/constants/product-options.constants';

@Component({
  selector: 'app-variant-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './variant-modal.component.html',
})
export class VariantModalComponent implements OnInit, OnDestroy, OnChanges {
  /* ── Inputs ─────────────────────────────────────────────────────────────── */
  @Input() productId!: string;
  @Input() product: Product | null = null;
  @Input() variants: ProductVariant[] = [];
  @Input() editingVariant: ProductVariant | null = null;
  /** Variante origen cuando se clona. null = modo creación/edición normal. */
  @Input() cloneSource: ProductVariant | null = null;

  /* ── Outputs ────────────────────────────────────────────────────────────── */
  @Output() saved  = new EventEmitter<ProductVariant>();
  @Output() closed = new EventEmitter<void>();

  /* ── Estado interno ─────────────────────────────────────────────────────── */
  variantForm!: FormGroup;
  isSaving = false;
  isUploadingVariantImage = false;
  shareGalleryByColor = false;

  /**
   * Mensaje de error del backend que se muestra inline en el modal.
   * Se limpia al iniciar un nuevo intento de guardado.
   * Null = sin error.
   */
  saveError: string | null = null;

  /**
   * URLs heredadas del color (del clone o de auto-detect).
   * Se muestran como solo-lectura con 🔒. No se suben de nuevo.
   */
  lockedUrls: string[] = [];

  /**
   * URLs nuevas que agrega el trabajador (siempre editables).
   */
  extraUrls: string[] = [];

  readonly colorOptions         = COLOR_OPTIONS;
  readonly variantTypeOptions: VariantTypeOption[] = VARIANT_TYPE_OPTIONS;

  /** Índice de la imagen que se está arrastrando en la galería (-1 = ninguna) */
  imgDragSrcIndex = -1;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb:              FormBuilder,
    private readonly variantsService: ProductVariantsService,
    private readonly imageService:    ImageService,
    private readonly toastService:    ToastService,
  ) {}

  /* ── Lifecycle ──────────────────────────────────────────────────────────── */

  ngOnInit(): void {
    this.buildForm();
    this.populateForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['editingVariant'] || changes['cloneSource']) && this.variantForm) {
      this.populateForm();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Modo ───────────────────────────────────────────────────────────────── */

  get isCloneMode(): boolean { return this.cloneSource !== null && !this.editingVariant; }
  get isEditMode():  boolean { return this.editingVariant !== null; }
  get isCreateMode(): boolean { return !this.editingVariant && !this.cloneSource; }

  /**
   * Controla si el formulario se puede enviar.
   * Bloquea si:
   *   - El formulario es inválido
   *   - Hay imágenes subiendo (isUploadingVariantImage)
   *   - No hay ninguna imagen cargada (lockedUrls + extraUrls vacías)
   */
  get canSave(): boolean {
    if (this.variantForm.invalid) return false;
    if (this.isUploadingVariantImage) return false;
    const totalImages = this.lockedUrls.length + this.extraUrls.length;
    if (totalImages === 0) return false;
    return true;
  }

  get modalTitle(): string {
    if (this.isEditMode)  return 'Editar Variante';
    if (this.isCloneMode) return `Clonar → ${this.cloneSource!.color?.name ?? 'variante'} · Nueva talla`;
    return 'Nueva Variante';
  }

  /* ── Getters dinámicos ──────────────────────────────────────────────────── */

  get currentSizeTallas(): string[] {
    const type = this.variantForm?.get('sizeType')?.value as VariantSizeType;
    return TALLAS_POR_TIPO[type] ?? [];
  }

  get currentTypeRequiresDimensions(): boolean {
    const type = this.variantForm?.get('sizeType')?.value as VariantSizeType;
    return VARIANT_TYPE_OPTIONS.find(t => t.value === type)?.requiresDimensions ?? false;
  }

  get currentSizePlaceholder(): string {
    const type = this.variantForm?.get('sizeType')?.value as VariantSizeType;
    return VARIANT_TYPE_OPTIONS.find(t => t.value === type)?.placeholder ?? '';
  }

  get siblingVariantCount(): number {
    const colorCode = this.variantForm?.get('colorCode')?.value;
    if (!colorCode) return 0;
    return this.variants.filter(
      v => v._id !== this.editingVariant?._id && v.color?.code === colorCode
    ).length;
  }

  get pricePreview(): number {
    const base       = this.product?.basePrice ?? 0;
    const adjustment = this.variantForm?.get('priceAdjustment')?.value ?? 0;
    const discount   = this.product?.discount ?? 0;
    const raw        = base + adjustment;
    return raw * (1 - discount / 100);
  }

  /** Variante hermana con el mismo color (para auto-detect) */
  private sibling(colorCode: string): ProductVariant | undefined {
    return this.variants.find(v =>
      v._id !== this.editingVariant?._id && v.color?.code === colorCode
    );
  }

  /* ── Form ───────────────────────────────────────────────────────────────── */

  private buildForm(): void {
    this.variantForm = this.fb.group({
      sku:             ['', [Validators.required, Validators.minLength(3)]],
      colorPreset:     [''],
      colorName:       [''],
      colorHex:        ['#000000'],
      colorCode:       [''],
      sizeType:        ['footwear'],
      sizeValue:       [''],
      sizePreset:      [''],
      priceAdjustment: [0],
      isActive:        [true],
      dimLength:     [null],
      dimWidth:      [null],
      dimHeight:     [null],
      dimWeight:     [null],
      dimWeightUnit: ['kg'],
    });

    // Preset color → autocompleta name/hex/code + auto-detect galería shared
    this.variantForm.get('colorPreset')?.valueChanges.subscribe(code => {
      if (!code) return;
      const found = this.colorOptions.find(c => c.code === code);
      if (found) {
        this.variantForm.patchValue(
          { colorName: found.name, colorHex: found.hex, colorCode: found.code },
          { emitEvent: false },
        );
        this.applyColorAutoDetect(found.code);
        this.suggestSku();
      }
    });

    // colorCode manual → también dispara auto-detect (en modo create)
    this.variantForm.get('colorCode')?.valueChanges.subscribe(code => {
      if (this.isCreateMode && code && code.length >= 2) {
        this.applyColorAutoDetect(code.toUpperCase());
      }
      this.suggestSku();
    });

    // Preset talla
    this.variantForm.get('sizePreset')?.valueChanges.subscribe(val => {
      if (val) {
        this.variantForm.get('sizeValue')?.setValue(val, { emitEvent: false });
        this.suggestSku();
      }
    });

    this.variantForm.get('sizeValue')?.valueChanges.subscribe(() => this.suggestSku());
  }

  /**
   * Auto-detect: si el color ya tiene variantes existentes,
   * carga sus URLs como lockedUrls y copia su precio.
   */
  private applyColorAutoDetect(colorCode: string): void {
    if (!this.isCreateMode) return; // solo en modo CREAR, no en editar/clonar
    const existing = this.sibling(colorCode);
    if (!existing) {
      // Color nuevo → limpia solo si venían de auto-detect (no de clone)
      if (!this.cloneSource) { this.lockedUrls = []; }
      return;
    }
    // Color ya existente → hereda galería y precio
    this.lockedUrls = existing.gallery ? [...existing.gallery] : [];
    this.variantForm.get('priceAdjustment')?.setValue(existing.priceAdjustment ?? 0, { emitEvent: false });
    this.toastService.showSuccess(`📋 Imágenes del color "${existing.color?.name}" cargadas automáticamente`);
  }

  private populateForm(): void {
    this.lockedUrls  = [];
    this.extraUrls   = [];
    this.shareGalleryByColor = false;

    if (this.editingVariant) {
      // ── EDIT MODE ────────────────────────────────────────────────────────
      this.lockedUrls = []; // en edición todas las fotos son editables
      this.extraUrls  = this.editingVariant.gallery ? [...this.editingVariant.gallery] : [];

      this.variantForm.patchValue({
        sku:            this.editingVariant.sku,
        colorName:      this.editingVariant.color?.name ?? '',
        colorHex:       this.editingVariant.color?.hex  ?? '#000000',
        colorCode:      this.editingVariant.color?.code ?? '',
        sizeType:       this.editingVariant.size?.type  ?? 'footwear',
        sizeValue:      this.editingVariant.size?.value ?? '',
        priceAdjustment: this.editingVariant.priceAdjustment ?? 0,
        isActive:       this.editingVariant.isActive ?? true,
      });

    } else if (this.cloneSource) {
      // ── CLONE MODE ───────────────────────────────────────────────────────
      this.lockedUrls = this.cloneSource.gallery ? [...this.cloneSource.gallery] : [];

      this.variantForm.reset({ colorHex: '#000000', sizeType: 'footwear', priceAdjustment: 0, isActive: true });
      this.variantForm.patchValue({
        colorName:       this.cloneSource.color?.name  ?? '',
        colorHex:        this.cloneSource.color?.hex   ?? '#000000',
        colorCode:       this.cloneSource.color?.code  ?? '',
        sizeType:        this.cloneSource.size?.type   ?? 'footwear',
        priceAdjustment: this.cloneSource.priceAdjustment ?? 0,
        isActive:        true,
        // SKU y talla en blanco para que el trabajador los complete
        sku:      this.product ? `${this.product.code}-` : '',
        sizeValue: '',
      });

      // Bloquear campos de color (no se pueden cambiar al clonar)
      this.variantForm.get('colorName')?.disable();
      this.variantForm.get('colorHex')?.disable();
      this.variantForm.get('colorCode')?.disable();
      this.variantForm.get('colorPreset')?.disable();

    } else {
      // ── CREATE MODE ──────────────────────────────────────────────────────
      this.variantForm.enable();
      this.variantForm.reset({ colorHex: '#000000', sizeType: 'footwear', priceAdjustment: 0, isActive: true });
      if (this.product) {
        this.variantForm.get('sku')?.setValue(`${this.product.code}-`);
      }
    }
  }

  private suggestSku(): void {
    if (this.isEditMode) return;
    const code      = this.product?.code ?? '';
    const colorCode = (this.isCloneMode
      ? this.cloneSource?.color?.code
      : this.variantForm.get('colorCode')?.value
    )?.trim().toUpperCase();
    const sizeVal   = this.variantForm.get('sizeValue')?.value?.trim().toUpperCase();
    const parts     = [code, colorCode, sizeVal].filter(Boolean);
    if (parts.length > 1) {
      this.variantForm.get('sku')?.setValue(parts.join('-'), { emitEvent: false });
    }
  }

  /* ── Guardar ────────────────────────────────────────────────────────────── */

  save(): void {
    if (this.variantForm.invalid || !this.productId) return;

    // getRawValue() incluye campos disabled (colorName, colorCode en modo clone)
    const fv = this.variantForm.getRawValue();

    const gallery = [...this.lockedUrls, ...this.extraUrls];

    const dto: CreateVariantDto = {
      productId:       this.productId,
      sku:             fv.sku.trim().toUpperCase(),
      priceAdjustment: fv.priceAdjustment ?? 0,
    };
    // isActive solo se envía en el POST de creación (el backend lo acepta aunque no esté en UpdateVariantDto)
    if (!this.isEditMode) { (dto as any)['isActive'] = fv.isActive; }

    if (fv.colorName?.trim()) {
      dto.color = {
        name: fv.colorName.trim(),
        hex:  fv.colorHex,
        code: fv.colorCode?.trim().toUpperCase() || fv.colorHex,
      };
    }

    const sizeType     = fv.sizeType as VariantSizeType;
    const requiresDims = VARIANT_TYPE_OPTIONS.find(t => t.value === sizeType)?.requiresDimensions;

    if (requiresDims) {
      const dims: Record<string, unknown> = {};
      if (fv.dimLength) dims['length'] = fv.dimLength;
      if (fv.dimWidth)  dims['width']  = fv.dimWidth;
      if (fv.dimHeight) dims['height'] = fv.dimHeight;
      if (fv.dimWeight) dims['weight'] = { value: fv.dimWeight, unit: fv.dimWeightUnit ?? 'kg' };

      dto.size = {
        type:  sizeType,
        value: fv.sizeValue?.trim() || Object.values(dims).join('x') || 'DIMS',
      };
      if (Object.keys(dims).length > 0) {
        (dto as any).dimensions = dims;
      } else {
        dto.size.value = fv.sizeValue?.trim() || 'STD';
      }
    } else if (fv.sizeValue?.trim()) {
      dto.size = { type: sizeType, value: fv.sizeValue.trim() };
    }

    if (gallery.length > 0) { dto.gallery = gallery; }

    this.saveError = null; // Limpiar error previo
    this.isSaving = true;

    // PATCH /:id solo acepta: color, size, dimensions, gallery, priceAdjustment
    // (NO sku, NO isActive, NO productId — tienen endpoints propios)
    const updateDto: import('../../../../core/services/catalog/product-variants.service').UpdateVariantDto = {
      ...(dto.color           && { color:           dto.color }),
      ...(dto.size            && { size:             dto.size }),
      ...((dto as any).dimensions && { dimensions:  (dto as any).dimensions }),
      ...(dto.gallery         && { gallery:          dto.gallery }),
      priceAdjustment: dto.priceAdjustment ?? 0,
    };

    const obs = this.isEditMode
      ? this.variantsService.updateVariant(this.editingVariant!._id, this.productId, updateDto)
      : this.variantsService.createVariant(dto);

    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; }))
      .subscribe({
        next: (savedVariant) => {
          if (this.shareGalleryByColor && gallery.length > 0) {
            this.propagateGallery(savedVariant._id, savedVariant.color?.code, gallery);
          }
          this.saveError = null;
          this.toastService.showSuccess('Variante guardada ✅');
          this.saved.emit(savedVariant);
        },
        error: (err) => {
          // Parsear el mensaje del backend (puede ser string o string[])
          const body = err?.error;
          let msg: string;
          if (Array.isArray(body?.message)) {
            // class-validator devuelve un array de strings
            msg = body.message.join(' • ');
          } else if (typeof body?.message === 'string') {
            msg = body.message;
          } else {
            msg = 'Error al guardar la variante. Verifica los datos e inténtalo de nuevo.';
          }
          this.saveError = msg;
          this.toastService.showError(msg);
        },
      });
  }

  close(): void {
    this.saveError = null;
    this.closed.emit();
  }

  /* ── Galería ────────────────────────────────────────────────────────────── */

  onGallerySelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) return;
    this.isUploadingVariantImage = true;
    let pending = files.length;

    files.forEach(file => {
      this.imageService.uploadImage(file).pipe(takeUntil(this.destroy$)).subscribe({
        next: res => {
          this.extraUrls = [...this.extraUrls, res.secureUrl ?? res.cloudinaryUrl];
          if (--pending === 0) this.isUploadingVariantImage = false;
        },
        error: () => {
          this.toastService.showError(`Error al subir ${file.name}`);
          if (--pending === 0) this.isUploadingVariantImage = false;
        },
      });
    });
    (event.target as HTMLInputElement).value = '';
  }

  removeExtraImage(index: number): void {
    this.extraUrls = this.extraUrls.filter((_, i) => i !== index);
  }

  // ─── Drag & Drop de imágenes en la galería ────────────────────────────────────

  /**
   * Registra el índice de la imagen que comienza a arrastrarse.
   * @param event  - DragEvent nativo
   * @param index  - Posición de la imagen en extraUrls[]
   */
  onImgDragStart(event: DragEvent, index: number): void {
    this.imgDragSrcIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  /**
   * Mueve la imagen en el array mientras el cursor pasa encima de otra.
   * Produce el reorden visual en tiempo real.
   * @param event  - DragEvent (prevenido para habilitar el drop)
   * @param index  - Posición de la imagen destino
   */
  onImgDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.imgDragSrcIndex === -1 || this.imgDragSrcIndex === index) return;
    const urls = [...this.extraUrls];
    const [moved] = urls.splice(this.imgDragSrcIndex, 1);
    urls.splice(index, 0, moved);
    this.extraUrls       = urls;
    this.imgDragSrcIndex = index;
  }

  /**
   * Limpia el estado del drag de imágenes al soltar.
   */
  onImgDragEnd(): void {
    this.imgDragSrcIndex = -1;
  }

  private propagateGallery(savedId: string, colorCode: string | undefined, gallery: string[]): void {
    if (!colorCode) return;
    const siblings = this.variants.filter(v => v._id !== savedId && v.color?.code === colorCode);
    if (!siblings.length) return;

    const patches$ = siblings.map(sib =>
      this.variantsService.updateVariant(sib._id, this.productId, { gallery: [...gallery] })
        .pipe(takeUntil(this.destroy$))
    );

    forkJoin(patches$).subscribe({
      next: () => this.toastService.showSuccess(`📋 Galería copiada a ${siblings.length} variante(s) del mismo color`),
      error: () => this.toastService.showError('Error al propagar galería'),
    });
  }
}
