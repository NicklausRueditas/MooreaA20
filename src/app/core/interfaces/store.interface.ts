import { VariantSizeType, WeightUnit, LengthUnit } from '../constants/product-options.constants';

export interface BusinessHours {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    openTime: string;  // "09:00"
    closeTime: string; // "18:00"
    isOpen: boolean;
}

/** Variante de producto tal como la devuelve la API (populada) */
export interface ProductVariant {
    _id: string;
    productId: string | { _id: string; name: string; code: string; brand: string; gallery?: string[] };
    sku: string;
    color?: {
        name: string;
        hex: string;
        code: string;
    };
    size?: {
        type: VariantSizeType;  // enum exacto del backend (clothing, footwear, etc.)
        value: string;          // "M", "38", "256GB", etc.
        region?: string;        // EU | US | UK | CM (para footwear)
    };
    dimensions?: {
        length?: number;
        width?:  number;
        height?: number;
        unit?:   LengthUnit;    // 'cm' por defecto
        weight?: { value: number; unit: WeightUnit };
    };
    gallery?: string[];
    priceAdjustment?: number;
    isActive?: boolean;
}

/**
 * Inventario — colección separada en /inventory
 * variantId puede venir como string (ID) o como objeto populado
 */
export interface InventoryItem {
    _id?: string;
    variantId: string | ProductVariant;  // populado por la API
    storeId: string;
    quantity: number;
    reservedQuantity?: number;
    location?: {
        aisle?: string;
        shelf?: string;
        bin?: string;
    };
    reorderPoint?: number;
    reorderQuantity?: number;
    cost?: number;
    wholesalePrice?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface StoreWorker {
    userId: string;
    role: 'manager' | 'cashier' | 'stock_keeper';
}

export interface CoverageZone {
    _id?: string;
    name: string;
    coordinates: number[][]; // [lng, lat] pairs for polygon
    deliveryFee: number;
}

export interface Store {
    _id?: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    phone: string;
    email: string;
    isActive: boolean;
    businessHours: BusinessHours[];
    workers?: StoreWorker[];
    coverageZones?: CoverageZone[];
    createdAt?: Date;
    updatedAt?: Date;
}
