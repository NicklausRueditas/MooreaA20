import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Product } from '../../../../core/interfaces/product.interface';
import { ImageService } from '../../../../core/services/utils/image.service';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CATEGORY_OPTIONS } from '../../../../core/constants/product-options.constants';

@Component({
  selector: 'app-form-product',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-product.component.html',
  styleUrls: ['./form-product.component.css'],
})
export class FormProductComponent {
  @Input() selectedProduct: Partial<Product> | null = null; // Producto para editar
  @Input() isEditMode: boolean = false; // Indica si el formulario está en modo edición
  @Output() closeModal = new EventEmitter<boolean>(); // Evento para cerrar el modal
  @Output() productAdded = new EventEmitter<Product>(); // Evento para emitir el producto guardado

  buttonSaveEnable: boolean = true; // Estado del botón de guardar

  productForm: FormGroup; // Formulario reactivo para el producto

  // Controles reactivos independientes para especificaciones
  objectKeys = Object.keys; // Utilidad para obtener las claves de un objeto
  specKeyControl = new FormControl(''); // Control para la clave de la especificación
  specValueControl = new FormControl(''); // Control para el valor de la especificación
  tagControl = new FormControl(''); // Control para agregar tags

  // Sistema de limpieza de imágenes temporales
  private uploadedImages: string[] = []; // Track cloudinaryIds de imágenes subidas
  private isFormSaved: boolean = false; // Flag para saber si el formulario fue guardado

  constructor(private imageService: ImageService, private fb: FormBuilder) {
    // Inicialización del formulario reactivo con validaciones
    this.productForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4)]], // Código único del producto
      name: ['', Validators.required], // Nombre del producto
      brand: ['', Validators.required], // Marca del producto
      model: ['', Validators.required], // Modelo del producto
      description: [''], // Descripción opcional
      specifications: [null], // Especificaciones dinámicas (clave-valor)
      basePrice: [0, [Validators.required, Validators.min(0)]], // Precio base del producto
      category: this.fb.array([], Validators.required), // Categorías del producto (FormArray)
      tags: this.fb.array([]), // Tags del producto (FormArray)
      gallery: this.fb.array([], Validators.required), // URLs de imágenes (FormArray)
      discount: [0, [Validators.min(0), Validators.max(100)]], // Descuento (0-100)
      isActive: [true], // Estado activo del producto
    });
  }

  // Constantes importadas para opciones del formulario
  categoryOptions = CATEGORY_OPTIONS; // Opciones de categoría

  /**
   * Habilita o deshabilita los controles del formulario según el modo (edición o visualización).
   */
  disableInputs(): void {
    if (this.selectedProduct) {
      if (this.isEditMode) {
        this.buttonSaveEnable = true; // Habilita el botón de guardar en modo edición
      } else {
        this.productForm.disable(); // Deshabilita el formulario en modo visualización
        this.buttonSaveEnable = false; // Deshabilita el botón de guardar
      }
    } else {
      this.productForm.enable(); // Habilita el formulario si no hay producto seleccionado
      this.buttonSaveEnable = true; // Habilita el botón de guardar
    }
  }

  /**
   * Método del ciclo de vida de Angular que se ejecuta cuando hay cambios en las propiedades de entrada.
   * @param changes Objeto que contiene los cambios en las propiedades de entrada.
   */
  ngOnChanges(changes: SimpleChanges): void {
    this.disableInputs(); // Actualiza el estado de los controles del formulario

    // Si hay un producto seleccionado, carga sus datos en el formulario
    if (changes['selectedProduct']?.currentValue) {
      this.productForm.reset(); // Limpia el formulario antes de llenarlo

      // Cargar categorías en el FormArray
      const categoryArray = this.productForm.get('category') as FormArray;
      this.clearFormArray(categoryArray); // Limpia el FormArray de categorías
      this.selectedProduct?.category?.forEach(
        (cat) => categoryArray.push(this.fb.control(cat, Validators.required)) // Agrega cada categoría al FormArray
      );

      // Cargar tags en el FormArray
      const tagsArray = this.productForm.get('tags') as FormArray;
      this.clearFormArray(tagsArray); // Limpia el FormArray de tags
      this.selectedProduct?.tags?.forEach(
        (tag) => tagsArray.push(this.fb.control(tag)) // Agrega cada tag al FormArray
      );

      // Cargar galería en el FormArray
      const galleryArray = this.productForm.get('gallery') as FormArray;
      this.clearFormArray(galleryArray); // Limpia el FormArray de la galería
      this.selectedProduct?.gallery?.forEach(
        (item) => galleryArray.push(this.fb.control(item, Validators.required)) // Agrega cada imagen al FormArray
      );

      // Rellenar el resto del formulario con los datos del producto seleccionado
      this.productForm.patchValue(this.selectedProduct || {});
    } else {
      this.productForm.reset(); // Limpia el formulario si no hay producto seleccionado
    }
  }



  /**
   * Función para eliminar todos los elementos de un FormArray.
   * @param formArray El FormArray que será limpiado.
   */
  private clearFormArray(formArray: FormArray): void {
    // Elimina todos los controles del FormArray
    while (formArray.length) {
      formArray.removeAt(0); // Elimina el primer elemento
    }
  }

  /**
   * Función para cerrar el modal.
   * Si hay imágenes subidas pero no guardadas, las elimina de Cloudinary.
   */
  onCloseModal(): void {
    // Si hay imágenes subidas pero el formulario no fue guardado, limpiarlas
    if (this.uploadedImages.length > 0 && !this.isFormSaved) {
      console.log('🗑️ Limpiando imágenes temporales no guardadas...');
      this.cleanupUploadedImages();
    }

    // Resetear el tracking
    this.uploadedImages = [];
    this.isFormSaved = false;

    this.closeModal.emit(true); // Emite el evento de cierre del modal
  }

  /**
   * Función para enviar el formulario.
   */
  onSubmit(): void {
    if (this.productForm.valid) {
      // Marcar como guardado para evitar limpieza de imágenes
      this.isFormSaved = true;
      console.log('✅ Formulario guardado, imágenes permanentes');

      // Emitir los datos del formulario como un producto
      this.productAdded.emit(this.productForm.value as Product);

      // Limpiar tracking antes de cerrar
      this.uploadedImages = [];

      this.onCloseModal(); // Cierra el modal después de guardar
    }
  }

  /**
   * Limpia las imágenes subidas temporalmente de Cloudinary.
   * Se ejecuta cuando el usuario cancela sin guardar.
   */
  private cleanupUploadedImages(): void {
    console.log(`🗑️ Eliminando ${this.uploadedImages.length} imagen(es) temporal(es)...`);

    this.uploadedImages.forEach((cloudinaryId, index) => {
      this.imageService.deleteImage(cloudinaryId).subscribe({
        next: () => {
          console.log(`✅ Imagen ${index + 1}/${this.uploadedImages.length} eliminada: ${cloudinaryId}`);
        },
        error: (err) => {
          console.error(`❌ Error al eliminar imagen ${cloudinaryId}:`, err);
        }
      });
    });
  }

  /**
   * Función para obtener el FormArray de 'category'.
   * @returns El FormArray de categorías.
   */
  get categoryArray(): FormArray {
    return this.productForm.get('category') as FormArray;
  }

  /**
   * Función para agregar una categoría al FormArray.
   * @param event Evento del select que contiene la categoría seleccionada.
   */
  addCategory(event: Event): void {
    // Obtener el valor seleccionado desde el evento
    const category = (event.target as HTMLSelectElement).value;

    // Verificar si el valor es válido y no está vacío
    if (
      category &&
      category.trim() &&
      !this.categoryArray.value.includes(category)
    ) {
      // Agregar la categoría al FormArray
      this.categoryArray.push(
        this.fb.control(category.trim(), Validators.required)
      );

      // Reiniciar el valor del select (opcional)
      (event.target as HTMLSelectElement).value = '';
    }
  }

  /**
   * Función para eliminar una categoría del FormArray.
   * @param index Índice de la categoría a eliminar.
   */
  removeCategory(index: number): void {
    if (index >= 0 && index < this.categoryArray.length) {
      this.categoryArray.removeAt(index);
    }
  }

  /**
   * Drag & Drop para Categorías - Inicio del arrastre
   */
  onCategoryDragStart(event: DragEvent, index: number): void {
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', index.toString());
  }

  /**
   * Drag & Drop para Categorías - Permitir soltar
   */
  onCategoryDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  /**
   * Drag & Drop para Categorías - Soltar y reordenar
   */
  onCategoryDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    const dragIndex = parseInt(event.dataTransfer!.getData('text/plain'), 10);

    if (dragIndex !== dropIndex) {
      const categories = this.categoryArray.value;
      const [draggedItem] = categories.splice(dragIndex, 1);
      categories.splice(dropIndex, 0, draggedItem);

      // Actualizar el FormArray
      this.categoryArray.clear();
      categories.forEach((cat: string) => this.categoryArray.push(this.fb.control(cat, Validators.required)));
    }
  }

  /* ------------------------especificaciones---------------------------- */

  /**
   * Función para obtener el valor actual de 'specifications'.
   * @returns Un objeto con las especificaciones actuales o un objeto vacío si no hay.
   */
  get specifications(): Record<string, string> | null {
    return this.productForm.get('specifications')?.value || {};
  }

  /**
   * Función para agregar o actualizar una especificación.
   */
  addOrUpdateSpecification(): void {
    const key = this.specKeyControl.value;
    const value = this.specValueControl.value;
    if (key?.trim() && value?.trim()) {
      const currentSpecs = this.specifications || {};
      currentSpecs[key.trim()] = value.trim(); // Agregar o actualizar la especificación
      this.productForm.get('specifications')?.setValue(currentSpecs); // Actualiza el campo 'specifications'

      // Limpiar los campos de entrada
      this.specKeyControl.reset();
      this.specValueControl.reset();
    }
  }

  /**
   * Función para eliminar una especificación por clave.
   * @param key Clave de la especificación a eliminar.
   */
  removeSpecification(key: string): void {
    if (key && key.trim()) {
      const currentSpecs = { ...this.specifications }; // Copia actual de las especificaciones
      delete currentSpecs[key.trim()]; // Eliminar la clave especificada
      this.productForm.get('specifications')?.setValue(currentSpecs); // Actualiza el campo 'specifications'
    }
  }

  /**
   * Función para listar todas las especificaciones.
   * @returns Un objeto con todas las especificaciones.
   */
  listSpecifications(): Record<string, string> {
    return this.specifications || {};
  }

  /**
   * Función para limpiar todas las especificaciones.
   */
  clearSpecifications(): void {
    this.productForm.get('specifications')?.setValue(null); // Resetea el campo
  }

  /* ------------------------tags---------------------------- */

  /**
   * Función para obtener el FormArray de 'tags'.
   * @returns El FormArray de tags.
   */
  get tagsArray(): FormArray {
    return this.productForm.get('tags') as FormArray;
  }

  /**
   * Función para agregar un tag al FormArray.
   */
  addTag(): void {
    const tag = this.tagControl.value;
    if (tag && tag.trim() && !this.tagsArray.value.includes(tag.trim())) {
      this.tagsArray.push(this.fb.control(tag.trim()));
      this.tagControl.reset();
    }
  }

  /**
   * Función para eliminar un tag del FormArray.
   * @param index Índice del tag a eliminar.
   */
  removeTag(index: number): void {
    if (index >= 0 && index < this.tagsArray.length) {
      this.tagsArray.removeAt(index);
    }
  }

  /**
   * Drag & Drop para Tags - Inicio del arrastre
   */
  onTagDragStart(event: DragEvent, index: number): void {
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', index.toString());
  }

  /**
   * Drag & Drop para Tags - Permitir soltar
   */
  onTagDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  /**
   * Drag & Drop para Tags - Soltar y reordenar
   */
  onTagDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    const dragIndex = parseInt(event.dataTransfer!.getData('text/plain'), 10);

    if (dragIndex !== dropIndex) {
      const tags = this.tagsArray.value;
      const [draggedItem] = tags.splice(dragIndex, 1);
      tags.splice(dropIndex, 0, draggedItem);

      // Actualizar el FormArray
      this.tagsArray.clear();
      tags.forEach((tag: string) => this.tagsArray.push(this.fb.control(tag)));
    }
  }

  /* ------------------------galeria---------------------------- */

  /**
   * Función para manejar la selección de múltiples imágenes.
   * @param event Evento de selección de archivo.
   */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    console.log('📸 onImageSelected triggered');
    console.log('Files selected:', input.files?.length);

    if (!input.files || input.files.length === 0) {
      console.warn('⚠️ No files selected');
      return;
    }

    // Convertir FileList a Array para iterar
    const filesArray = Array.from(input.files);
    console.log(`📤 Uploading ${filesArray.length} file(s)...`);

    // Subir cada imagen
    filesArray.forEach((file, index) => {
      console.log(`📤 Uploading file ${index + 1}/${filesArray.length}: ${file.name} (${file.size} bytes)`);

      this.imageService.uploadImage(file).subscribe({
        next: (response) => {
          console.log(`✅ File ${index + 1} uploaded successfully:`, response);

          // Trackear el cloudinaryId para limpieza posterior si se cancela
          this.uploadedImages.push(response.cloudinaryId);
          console.log(`📝 Tracked image: ${response.cloudinaryId}`);

          // El backend devuelve secureUrl, no url
          const imageUrl = response.secureUrl || response.cloudinaryUrl;
          console.log(`🖼️ Adding image to gallery: ${imageUrl}`);
          this.addGalleryImage(imageUrl);
        },
        error: (error) => {
          console.error(`❌ Error uploading file ${index + 1}:`, error);
          console.error('Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error
          });
          alert(`Error al subir ${file.name}: ${error.error?.message || error.message || 'Error desconocido'}`);
        }
      });
    });

    // Resetear el input para permitir seleccionar los mismos archivos nuevamente
    input.value = '';
    console.log('🔄 Input reset');
  }

  /**
   * Función para obtener el FormArray de 'gallery'.
   * @returns El FormArray de la galería de imágenes.
   */
  get galleryArray(): FormArray {
    return this.productForm.get('gallery') as FormArray;
  }

  /**
   * Función para agregar una URL de imagen al FormArray.
   * @param url URL de la imagen a agregar.
   */
  addGalleryImage(url: string): void {
    if (url && url.trim()) {
      this.galleryArray.push(this.fb.control(url.trim(), Validators.required));
    }
  }

  /**
   * Función para eliminar una URL de imagen del FormArray.
   * @param index Índice de la imagen a eliminar.
   * @param url URL de la imagen a eliminar.
   */
  removeImage(index: number, url: string): void {
    // Validar que el índice y la URL sean válidos
    if (index >= 0 && index < this.galleryArray.length && url && url.trim()) {
      const idLink = url.split('/').pop();

      // Verificar que el idLink sea válido
      if (idLink) {
        this.imageService.deleteImage(idLink).subscribe({
          next: () => {
            console.log('Imagen eliminada del servidor:', url);
            // Eliminar del FormArray después de la confirmación del servidor
            this.galleryArray.removeAt(index);
          },
          error: (err) => {
            console.error('Error al eliminar la imagen del servidor:', err);
          },
        });
      } else {
        console.error('ID de imagen no válido extraído de la URL:', url);
      }
    } else {
      console.error('Índice o URL no válidos:', { index, url });
    }
  }

  // Variable para almacenar el índice del elemento arrastrado
  draggedIndex: number | null = null;

  /**
   * Función que se ejecuta al iniciar el arrastre.
   * @param index Índice del elemento arrastrado.
   */
  onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  /**
   * Función que se ejecuta cuando un elemento es soltado.
   * @param event Evento de soltar.
   * @param dropIndex Índice donde se soltó el elemento.
   */
  onDrop(event: Event, dropIndex: number): void {
    event.preventDefault(); // Prevenir el comportamiento por defecto del navegador

    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
      const controls = this.galleryArray.controls;

      // Mover el elemento dentro del array
      const draggedControl = controls[this.draggedIndex];
      controls.splice(this.draggedIndex, 1); // Eliminar el elemento arrastrado
      controls.splice(dropIndex, 0, draggedControl); // Insertarlo en la nueva posición

      // Actualizar el array y limpiar el índice arrastrado
      this.galleryArray.updateValueAndValidity();
      this.draggedIndex = null;
    }
  }

  /* ------------------------modal---------------------------- */

}
