export interface Product {
  _id: string; // ID del producto (generado automáticamente por MongoDB)
  code: string; // Código único del producto
  name: string; // Nombre del producto
  brand: string; // Marca del producto
  model: string; // Modelo del producto
  description?: string; // Descripción opcional del producto
  specifications?: Record<string, string>; // Especificaciones dinámicas (clave-valor)
  supplier: string; // Proveedor del producto
  color?: string; // Color del producto (opcional)
  dimensions: {
    weight: {
      value: number; // Valor numérico del peso
      unit: string; // Unidad de peso como string
    };
    size: {
      type: string; // Tipo de tamaño como string
      height?: string; // Alto (opcional)
      width?: string; // Ancho (opcional)
      depth?: string; // Profundidad (opcional)
      value?: string; // Valor descriptivo del tamaño (opcional)
    };
  };
  information?: string; // Información adicional opcional
  price: number; // Precio del producto
  category: string[]; // Categorías del producto
  gallery: string[]; // Galería de imágenes del producto
  stock: number; // Stock del producto
  discount: number; // Descuento del producto (porcentaje)
  createdAt: string; // Fecha de creación (generada automáticamente)
  updatedAt: string; // Fecha de actualización (generada automáticamente)
}

export interface PaginatedResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}
