// basket.interface.ts
// Refleja el nuevo formato unificado del backend: GET /basket → { items, summary }

export interface BasketItemVariant {
  _id: string;
  sku?: string;
  color?: { name: string; hex: string; code: string };
  size?: { type: string; value: string; region?: string };
  gallery?: string[];
  priceAdjustment?: number;
  isActive?: boolean;
}

export interface BasketItemProduct {
  _id: string;
  name: string;
  brand: string;
  basePrice: number;
  discount?: number;
  isActive?: boolean;
}

/**
 * Ítem unificado con variante y producto populados + cálculos de precio.
 * Estructura que devuelve GET /basket (nuevo formato):
 * { variantId: string, productId: string, variant: {...}, product: {...}, quantity, finalPrice, ... }
 */
export interface BasketItem {
  variantId?: string;                     // ID string de la variante
  productId?: string;                     // ID string del producto
  variant?: BasketItemVariant;            // Variante populada (backend nuevo + localStorage guest)
  product?: BasketItemProduct;            // Producto maestro populado (backend nuevo)
  quantity: number;
  addedAt?: Date;
  // Campos calculados (ya vienen en la respuesta del backend)
  finalPrice?: number;
  discount?: number;
  subtotal?: number;
  subtotalWithDiscount?: number;
  savings?: number;
}

/** Resumen global del carrito (bloque `summary` de GET /basket) */
export interface BasketSummaryData {
  itemCount: number;
  totalQuantity: number;
  totalWithoutDiscount: number;
  totalWithDiscount: number;
  totalSavings: number;
}

/** Respuesta completa de GET /basket (nuevo formato unificado) */
export interface BasketApiResponse {
  items: BasketItem[];
  summary: BasketSummaryData;
}

/** Representación interna del carrito en el estado del servicio */
export interface Basket {
  _id?: string;
  userId?: string;
  items: BasketItem[];
  // Totales mapeados desde summary
  totalItems?: number;
  totalQuantity?: number;
  totalAmount?: number;
  totalSavings?: number;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

/** DTO para agregar/migrar un ítem al carrito */
export interface AddToBasketDto {
  variantId: string;
  quantity: number;
}