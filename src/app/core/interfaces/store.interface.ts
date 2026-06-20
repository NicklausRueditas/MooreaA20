import { VariantSizeType, WeightUnit, LengthUnit } from '../constants/product-options.constants';

// ─── Horario de atención ───────────────────────────────────────────────────────
// Backend espera: { monday: { open: "09:00", close: "18:00" }, ... }

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DaySchedule {
  open:  string; // "09:00"
  close: string; // "18:00"
}

/** businessHours es un objeto cuya clave es el nombre del día en inglés minúscula */
export type BusinessHours = Partial<Record<DayKey, DaySchedule>>;

// ─── Sub-interfaces de Store ───────────────────────────────────────────────────

export interface StoreLocation {
  address:      string;
  city:         string;
  state:        string;
  country:      string;
  postalCode?:  string;
  coordinates?: {
    type:        'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface StoreContact {
  phone?: string;
  email?: string;
}

export interface StoreCapabilities {
  hasPickup?:      boolean;
  hasDelivery?:    boolean;
  deliveryRadius?: number;
  acceptsReturns?: boolean;
}

// ─── Store principal ──────────────────────────────────────────────────────────

export interface Store {
  _id?:           string;
  code?:          string;
  name:           string;
  type?:          'physical' | 'virtual' | 'hybrid';
  location:       StoreLocation;
  contact?:       StoreContact;
  businessHours?: BusinessHours;
  capabilities?:  StoreCapabilities;
  isActive:       boolean;
  /** null → tienda Moorea; string → tienda del seller con ese userId */
  ownerId?:       string | null;
  workers?:       StoreWorker[];
  coverageZones?: CoverageZone[];
  createdAt?:     Date;
  updatedAt?:     Date;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type CreateStoreDto = Omit<Store, '_id' | 'isActive' | 'workers' | 'coverageZones' | 'createdAt' | 'updatedAt'>;
export type UpdateStoreDto = Partial<CreateStoreDto & { isActive: boolean }>;

// ─── Variante de producto (populada) ─────────────────────────────────────────

export interface ProductVariant {
  _id: string;
  productId: string | {
    _id:        string;
    name:       string;
    code:       string;
    brand:      string;
    basePrice:  number;   // necesario para auto-calcular cost en el modal
    discount?:  number;
    gallery?:   string[];
  };
  sku: string;
  color?: { name: string; hex: string; code: string };
  size?: {
    type:    VariantSizeType;
    value:   string;
    region?: string;
  };
  dimensions?: {
    length?: number;
    width?:  number;
    height?: number;
    unit?:   LengthUnit;
    weight?: { value: number; unit: WeightUnit };
  };
  gallery?:           string[];
  priceAdjustment?:   number;
  isActive?:          boolean;
}

// ─── GEO: Disponibilidad por tienda con distancia (endpoint /product-variants/product/:id/geo) ───

/**
 * Disponibilidad de una variante en una tienda específica con datos GEO.
 * Presente en cada elemento de `storeAvailability[]` del endpoint /geo.
 */
export interface StoreAvailability {
  /** Nombre de la tienda */
  storeName: string;
  /** Tipo de tienda: physical | virtual | hybrid */
  storeType: 'physical' | 'virtual' | 'hybrid';
  /** Ciudad de la tienda */
  city: string;
  /** Dirección de la tienda */
  address: string;
  /** Unidades disponibles en esa tienda */
  availableQty: number;
  /** Distancia Haversine en km desde el cliente a la tienda */
  distanceKm: number;
  /**
   * Costo de delivery estimado.
   * S/ 0 si distanceKm ≤ 2 km;  S/ X.XX si aplica (S/ 2.20/km extra)
   */
  deliveryCost: number;
  /** true si distanceKm ≤ 2 y la tienda hace delivery */
  isFreeDelivery: boolean;
  /** true si distanceKm ≤ capabilities.deliveryRadius de la tienda */
  isWithinDeliveryRange: boolean;
}

/**
 * Variante extendida con disponibilidad GEO por tienda.
 * Shape exacto del endpoint GET /product-variants/product/:id/geo
 */
export interface ProductVariantGeo extends ProductVariant {
  /**
   * Disponibilidad de la variante en cada tienda activa con stock,
   * ordenadas de menor a mayor distancia al cliente.
   */
  storeAvailability: StoreAvailability[];
}


// ─── Inventario (/inventory) ──────────────────────────────────────────────────

export interface InventoryItem {
  _id?:              string;
  variantId:         string | ProductVariant;
  storeId:           string;
  quantity:          number;
  reservedQuantity?: number;
  location?: {
    aisle?: string;
    shelf?: string;
    bin?:   string;
  };
  reorderPoint?:     number;
  reorderQuantity?:  number;
  cost?:             number;
  wholesalePrice?:   number;
  createdAt?:        Date;
  updatedAt?:        Date;
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

export interface StoreWorker {
  userId: string;
  role:   'manager' | 'cashier' | 'stock_keeper';
}

export interface CoverageZone {
  _id?:         string;
  name:         string;
  coordinates:  number[][];
  deliveryFee:  number;
}
