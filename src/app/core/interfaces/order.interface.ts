// ─── Tipos de estado ──────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'preparing'
  | 'ready_for_pickup'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type FulfillmentType = 'delivery' | 'pickup';
export type OrderPaymentMethod = 'card' | 'yape' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

// ─── Submodelos ───────────────────────────────────────────────────────────

export interface OrderItemColor {
  name: string;
  hex: string;
  code: string;
}

export interface OrderItemSize {
  type: string;
  value: string;
  region?: string;
}

export interface OrderPickupStore {
  storeId: string;
  name: string;
  address: string;
}

export interface OrderItem {
  variantId: string;
  productName: string;
  sku: string;
  color?: OrderItemColor;
  size?: OrderItemSize;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  deliveryType: FulfillmentType;
  thumbnail?: string;
  pickupStore?: OrderPickupStore;
}

export interface OrderShippingAddress {
  alias?: string;
  street: string;
  streetNumber?: string;
  apartment?: string;
  district: string;
  province: string;
  department?: string;
  country: string;
  lat?: number;
  lng?: number;
}

// ─── Orden ────────────────────────────────────────────────────────────────

export interface Order {
  _id: string;
  invoiceNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;

  items: OrderItem[];

  paymentMethod: OrderPaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency: string;
  gatewayRef?: string;

  shippingAddress?: OrderShippingAddress;
  storeId?: string;

  /** Código legible para retiro en tienda (solo pickup) */
  pickupCode?: string;

  cancelReason?: string;
  createdAt: string;
  paidAt?: string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────

/**
 * Cuerpo del POST /orders.
 * variantIds es opcional: si se omite, el backend toma TODOS los items del carrito.
 */
export interface CreateOrderDto {
  fulfillment: FulfillmentType;
  paymentMethod: OrderPaymentMethod;
  /** Solo si fulfillment = 'delivery' */
  addressId?: string;
  /** Solo si fulfillment = 'pickup' */
  storeId?: string;
  /** Subset del carrito; omitir para tomar todo */
  variantIds?: string[];
}

// ─── Respuestas ───────────────────────────────────────────────────────────

export interface OrderResponse {
  success: boolean;
  message?: string;
  order: Order;
}

export interface OrderListResponse {
  success: boolean;
  orders: Order[];
  total?: number;
}

/** Respuesta de GET /orders/my/:id/qr */
export interface OrderQrResponse {
  pickupCode: string;
  invoiceNumber: string;
  /** Contenido que el frontend debe convertir en imagen QR */
  qrContent: string;
}

// ─── Helpers visuales ────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment:  'Pendiente de pago',
  paid:             'Pagado',
  preparing:        'En preparación',
  ready_for_pickup: 'Listo para retiro',
  shipped:          'En camino',
  delivered:        'Entregado',
  cancelled:        'Cancelado',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment:  'bg-yellow-100 text-yellow-800',
  paid:             'bg-blue-100 text-blue-800',
  preparing:        'bg-orange-100 text-orange-800',
  ready_for_pickup: 'bg-purple-100 text-purple-800',
  shipped:          'bg-indigo-100 text-indigo-800',
  delivered:        'bg-green-100 text-green-800',
  cancelled:        'bg-red-100 text-red-800',
};
