import { Component, OnInit } from '@angular/core';
import { Product } from '../../../core/interfaces/product.interface';
import { ProductsService } from '../../../core/services/products.service';
import { FormProductComponent } from './form-product/form-product.component';
import { UpdateProductDto } from '../../../core/dtos/update-product.dto';
import { ImageService } from '../../../core/services/image.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormProductComponent],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
})
export class InventoryComponent implements OnInit {
  products: Product[] = []; // Lista de productos
  isAddModalOpen = false; // Estado del modal
  isEditMode = false; // Modo de edición
  selectedProduct: Product | null = null; // Producto seleccionado para edición o detalles
  currentPage: number = 1; // Página actual
  itemsPerPage: number = 12; // Número de productos por página
  totalItems: number = 0; // Total de productos disponibles

  constructor(
    private productsService: ProductsService,
    private imageService: ImageService
  ) {}

  ngOnInit(): void {
    this.loadProducts(); // Carga los productos al inicializar el componente
  }

  /**
   * Carga la lista de productos desde el servicio con paginación.
   */
  private loadProducts(): void {
    this.productsService.getProducts(this.currentPage, this.itemsPerPage).subscribe({
      next: (result) => {
        this.products = result.data; // Asigna los productos
        this.totalItems = result.total; // Asigna el total de productos
      },
      error: (err) => console.error('Error al cargar productos:', err),
    });
  }

  /**
   * Cambia la página actual y recarga los productos.
   * @param page Número de la página a la que se desea navegar.
   */
  changePage(page: number): void {
    this.currentPage = page;
    this.loadProducts(); // Recarga los productos para la nueva página
  }

  /**
   * Abre o cierra el modal de producto.
   * @param isOpen Indica si el modal debe abrirse o cerrarse.
   * @param product Producto seleccionado (opcional, solo en edición).
   * @param isEdit Indica si se está en modo edición.
   */
  toggleAddModal(isOpen: boolean, product?: Product, isEdit: boolean = false): void {
    this.isAddModalOpen = isOpen;
    this.selectedProduct = product ? { ...product } : null; // Clona el producto para evitar mutaciones
    this.isEditMode = isEdit;
  }

  /**
   * Maneja el evento cuando se guarda un producto (nuevo o editado).
   * @param product Producto a guardar.
   */
  onProductSaved(product: Product): void {
    this.isEditMode ? this.updateProduct(product) : this.addProduct(product);
  }

  /**
   * Agrega un nuevo producto a la lista.
   * @param newProduct Producto a agregar.
   */
  private addProduct(newProduct: Product): void {
    this.productsService.addProduct(newProduct).subscribe({
      next: (response) => {
        this.products.push(response); // Agrega el nuevo producto a la lista
        console.log('Producto creado:', response);
      },
      error: (err) => console.error('Error al crear el producto:', err),
    });
  }

  /**
   * Actualiza un producto existente si hay cambios.
   * @param updatedProduct Producto con datos actualizados.
   */
  private updateProduct(updatedProduct: Product): void {
    if (!this.selectedProduct) return;

    const productId = this.selectedProduct._id;

    const changes = this.getModifiedFields(this.selectedProduct, updatedProduct);
    if (Object.keys(changes).length === 0) {
      console.log('No hay cambios para actualizar.');
      return;
    }

    this.productsService.updateProduct(this.selectedProduct._id, changes).subscribe({
      next: (response) => {
        const index = this.products.findIndex(p => p._id === productId);
        if (index !== -1) {
          // Creamos un nuevo array para triggerear la detección de cambios
          this.products = [
            ...this.products.slice(0, index),
            { ...response }, // Usamos el objeto completo de respuesta
            ...this.products.slice(index + 1)
          ];
        } else {
          console.warn('Producto no encontrado en la lista local');
        }
        console.log('Producto actualizado:', response);
      },
      error: (err) => {
        console.error('Error al actualizar el producto:', err);
        // Podrías mostrar un mensaje al usuario aquí
      }
    });
  }

  /**
   * Elimina un producto y sus imágenes asociadas.
   * @param id Identificador del producto a eliminar.
   */
  deleteProduct(id: string): void {
    if (!confirm('¿Está seguro de que desea eliminar este producto?')) {
      return;
    }

    const product = this.products.find(p => p._id === id);
    if (product?.gallery) {
      product.gallery.forEach(imageUrl => {
        const idLink = imageUrl.split('/').pop();
        if (idLink) {
          this.imageService.deleteImage(idLink).subscribe({
            next: () => console.log('Imagen eliminada:', imageUrl),
            error: (err) => console.error('Error al eliminar imagen:', err),
          });
        }
      });
    }

    this.productsService.deleteProduct(id).subscribe({
      next: () => {
        this.products = this.products.filter(p => p._id !== id); // Filtra y elimina el producto de la lista
        console.log('Producto eliminado:', id);
      },
      error: (err) => console.error('Error al eliminar el producto:', err),
    });
  }

  /**
   * Obtiene los campos modificados entre dos productos.
   * @param original Producto original.
   * @param updated Producto actualizado.
   * @returns Un objeto con los cambios detectados.
   */
  private getModifiedFields(original: Product, updated: Product): UpdateProductDto {
    return Object.keys(updated).reduce((changes, key) => {
      const updatedValue = updated[key as keyof Product];
      const originalValue = original[key as keyof Product];

      if (Array.isArray(updatedValue)) {
        if (!this.arraysAreEqual(updatedValue, originalValue as string[])) {
          changes[key] = updatedValue;
        }
      } else if (typeof updatedValue === 'object' && updatedValue !== null) {
        if (!this.objectsAreEqual(updatedValue, originalValue as object)) {
          changes[key] = updatedValue;
        }
      } else if (updatedValue !== originalValue && updatedValue !== undefined) {
        changes[key] = updatedValue;
      }
      return changes;
    }, {} as UpdateProductDto);
  }

  /**
   * Compara si dos objetos son iguales.
   * @param obj1 Primer objeto.
   * @param obj2 Segundo objeto.
   * @returns Verdadero si los objetos son iguales, falso si no lo son.
   */
  private objectsAreEqual(obj1: object, obj2: object): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  /**
   * Compara si dos arreglos son iguales.
   * @param arr1 Primer arreglo.
   * @param arr2 Segundo arreglo.
   * @returns Verdadero si los arreglos son iguales, falso si no lo son.
   */
  private arraysAreEqual(arr1: any[], arr2: any[]): boolean {
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
  }

  /**
   * Calcula el rango de productos que se están mostrando.
   * @returns Un string con el formato "Mostrando X a Y de Z productos".
   */
  getDisplayedRange(): string {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `Mostrando ${start} a ${end} de ${this.totalItems} productos`;
  }
}