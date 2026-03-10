export interface Product {
  _id: string; // ID del producto (generado automáticamente por MongoDB)
  code: string; // Código único del producto
  name: string; // Nombre del producto
  brand: string; // Marca del producto
  model: string; // Modelo del producto
  description?: string; // Descripción opcional del producto
  specifications?: Record<string, string>; // Especificaciones dinámicas (clave-valor)
  basePrice: number; // Precio base del producto
  category: string[]; // Categorías del producto
  gallery: string[]; // Galería de imágenes del producto
  discount: number; // Descuento del producto (porcentaje)
  isActive: boolean; // Estado activo/inactivo del producto
  tags: string[]; // Tags para búsqueda y filtrado
  rating?: { // Sistema de rating (opcional)
    average: number; // Promedio de rating (0-5)
    count: number; // Cantidad total de reseñas
    distribution: { // Distribución de ratings
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  };
  createdAt: string; // Fecha de creación (generada automáticamente)
  updatedAt: string; // Fecha de actualización (generada automáticamente)
}

export interface PaginatedResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}
