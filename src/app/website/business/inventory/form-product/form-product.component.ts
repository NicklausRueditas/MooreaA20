import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Product } from '../../../../core/interfaces/product.interface';
import { ImageService } from '../../../../core/services/image.service';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgClass } from '@angular/common';
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  TYPE_OPTIONS,
  UNIDAD_OPTIONS,
} from '../../../../core/constants/product-options.constants';

@Component({
  selector: 'app-form-product',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
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

  constructor(private imageService: ImageService, private fb: FormBuilder) {
    // Inicialización del formulario reactivo con validaciones
    this.productForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4)]], // Código único del producto
      name: ['', Validators.required], // Nombre del producto
      brand: ['', Validators.required], // Marca del producto
      model: ['', Validators.required], // Modelo del producto
      description: [''], // Descripción opcional
      specifications: [null], // Especificaciones dinámicas
      supplier: ['', Validators.required], // Proveedor
      color: [''], // Color (opcional)
      dimensions: this.fb.group({
        weight: this.fb.group({
          value: [0, [Validators.required, Validators.min(0)]], // Valor del peso
          unit: ['kg', Validators.required], // Unidad de peso
        }),
        size: this.fb.group({
          type: ['', Validators.required], // Tipo de tamaño
          height: [''], // Alto (opcional)
          width: [''], // Ancho (opcional)
          depth: [''], // Profundidad (opcional)
          value: [''], // Valor descriptivo (opcional)
        }),
      }),
      information: [''], // Información adicional opcional
      price: [0, [Validators.required, Validators.min(0)]], // Precio del producto
      category: this.fb.array([], Validators.required), // Categorías del producto (FormArray)
      gallery: this.fb.array([], Validators.required), // URLs de imágenes (FormArray)
      stock: [0, [Validators.required, Validators.min(0)]], // Inventario disponible
      discount: [0, [Validators.min(0), Validators.max(100)]], // Descuento (0-100)
    });
  }

  // Constantes importadas para opciones del formulario
  categoryOptions = CATEGORY_OPTIONS; // Opciones de categoría
  colorOptions = COLOR_OPTIONS; // Opciones de color
  unidadOptions = UNIDAD_OPTIONS; // Opciones de unidad
  typeOptions = TYPE_OPTIONS; // Opciones de tipo

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
   * Método que se ejecuta al enviar el formulario.
   * Emite el producto guardado si el formulario es válido.
   */
  onSubmit(): void {
    if (this.productForm.valid) {
      // Emitir los datos del formulario como un producto
      this.productAdded.emit(this.productForm.value as Product);
      this.onCloseModal(); // Cierra el modal después de guardar
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

  /* ------------------------galeria---------------------------- */

  /**
   * Función para manejar la selección de imagen.
   * @param event Evento de selección de archivo.
   */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.imageService.uploadImage(file).subscribe(
        (response) => {
          this.addGalleryImage(response.url); // Agregar la URL al array
        },
        (error) => {
          console.error('Error uploading image:', error);
        }
      );
    }
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

  /**
   * Función para cerrar el modal.
   */
  onCloseModal(): void {
    // Resetea los datos del formulario
    this.productForm.reset();
    this.closeModal.emit(); // Notifica al padre que se cerró el modal
  }
}
