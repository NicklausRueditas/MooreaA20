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
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

// ─── Submodelos canónicos de la Orden ──────────────────────────────────────

export interface OrderPricing {
  subtotalBeforeDiscount: number;
  discount: number;
  shippingCost: number;
  total: number;
}

export interface OrderItemSnapshot {
  variantId: string;
  productId?: string;
  productName: string;
  sku: string;
  color: any;
  size: any;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  deliveryType?: FulfillmentType;
  thumbnail?: string;
  pickupStore?: OrderPickupStoreSnapshot;
}

export interface OrderShippingAddressSnapshot {
  alias?: string;
  street: string;
  streetNumber?: string;
  apartment?: string;
  district: string;
  province: string;
  department?: string;
  country: string;
  postalCode?: string;
  references?: string;
  lat?: number;
  lng?: number;
}

export interface OrderPickupStoreSnapshot {
  storeId: string;
  name: string;
  address: string;
  phone?: string;
}

// ─── Documento de Orden Principal ─────────────────────────────────────────

export interface Order {
  _id: string;
  userId: string;
  invoiceNumber: string;
  fulfillment: FulfillmentType;
  fulfillmentType?: FulfillmentType;
  items: OrderItemSnapshot[];
  pricing: OrderPricing;
  totalAmount?: number;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: PaymentStatus;
  currency: string;
  gatewayRef?: string;
  shippingAddress?: OrderShippingAddressSnapshot;
  pickupStore?: OrderPickupStoreSnapshot;
  storeId?: string;
  pickupCode?: string;
  pickupUsedAt?: string;
  status: OrderStatus;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

// ─── DTOs de Entrada ──────────────────────────────────────────────────────

export interface CreateOrderDto {
  fulfillment: FulfillmentType;
  paymentMethod: OrderPaymentMethod;
  addressId?: string;
  storeId?: string;
  variantIds?: string[];
}

// ─── Respuestas del Backend ───────────────────────────────────────────────

export interface OrderResponse {
  success?: boolean;
  message?: string;
  order?: Order;
  _id?: string;
  [key: string]: any;
}

export interface OrderListResponse {
  success?: boolean;
  orders?: Order[];
  total?: number;
  [key: string]: any;
}

export interface OrderQrResponse {
  pickupCode: string;
  invoiceNumber: string;
  qrContent: string;
}

// ─── Helpers visuales y etiquetas ─────────────────────────────────────────

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
  pending_payment:  'bg-amber-100 text-amber-800 border-amber-200',
  paid:             'bg-emerald-100 text-emerald-800 border-emerald-200',
  preparing:        'bg-blue-100 text-blue-800 border-blue-200',
  ready_for_pickup: 'bg-purple-100 text-purple-800 border-purple-200',
  shipped:          'bg-indigo-100 text-indigo-800 border-indigo-200',
  delivered:        'bg-green-100 text-green-800 border-green-200',
  cancelled:        'bg-rose-100 text-rose-800 border-rose-200',
};
