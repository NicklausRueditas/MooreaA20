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
    weight?:        { value: number; unit: WeightUnit };
    /** Unidad de longitud para length, width y height (cm | mm | m | in | ft) */
    dimensionUnit?: LengthUnit;
    length?:        number;
    width?:         number;
    height?:        number;
  };
  gallery?:           string[];
  priceAdjustment?:   number;
  isActive?:          boolean;
  sortOrder?:         number;
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
   * Costo de delivery estimado en Soles.
   * S/ 0 si las 3 condiciones de gratuidad se cumplen; S/ X.XX si no.
   */
  deliveryCost: number;
  /**
   * true si las 3 condiciones de delivery gratuito se cumplen simultáneamente:
   *   1. distanceKm       ≤ 2.5 km
   *   2. finalPrice       ≥ S/ 200
   *   3. effectiveWeightKg ≤ 3 kg
   */
  isFreeDelivery: boolean;
  /** true si distanceKm ≤ capabilities.deliveryRadius de la tienda */
  isWithinDeliveryRange: boolean;
  /** Label de delivery calculado por el backend (ej. "Delivery Gratis" o "Costo S/ X.XX") */
  deliveryLabel?: string;
  /** Label de recojo en tienda (ej. "Recoge hoy mismo (Gratis)") */
  pickupLabel?: string;
  /** Días estimados de entrega */
  deliveryDays?: number;
  /** Si la tienda realiza delivery */
  hasDelivery?: boolean;
  /** Si la tienda soporta recojo en tienda */
  hasPickup?: boolean;

  // ── Nuevos campos: Precio final y Peso Volumétrico (backend v2) ────────────

  /**
   * Precio final del producto en Soles (basePrice + priceAdjustment - descuento).
   * Uno de los 3 criterios para delivery gratuito (debe ser ≥ S/ 200).
   */
  finalPrice?: number;

  /**
   * Recargo adicional en Soles por exceder el límite de peso (> 3 kg).
   * S/ 1.50 por cada kg adicional sobre los 3 kg. S/ 0 si no aplica.
   */
  weightSurcharge?: number;

  /**
   * Peso efectivo del envío en kg: MAX(pesoFísico, pesoVolumetrico).
   * Es el peso que cobra el courier según la regla estándar del mercado peruano.
   */
  effectiveWeightKg?: number;

  /**
   * Peso volumétrico calculado en kg.
   * Fórmula: (largo × ancho × alto) / 5000  (Factor DIM estándar — Olva / Shalom)
   * Si la variante no tiene dimensiones, se usa un preset por SizeType.
   */
  volumetricWeightKg?: number;

  /**
   * Peso físico declarado en kg (convertido desde WeightUnit).
   * null si la variante no tiene `dimensions.weight` declarado.
   */
  physicalWeightKg?: number | null;

  /**
   * Origen del peso efectivo usado para el cálculo de delivery:
   * - 'physical'   → el peso físico supera al volumétrico
   * - 'volumetric' → el peso volumétrico supera al físico
   * - 'preset'     → sin dimensiones; se usó preset por SizeType
   */
  weightSource?: 'physical' | 'volumetric' | 'preset';

  /**
   * true cuando la variante usó el peso genérico de 1.0 kg por defecto.
   * Indica que el seller no ha completado el campo `dimensions`.
   * Útil para mostrar una advertencia en el panel de administración.
   */
  usedDefaultPreset?: boolean;
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
