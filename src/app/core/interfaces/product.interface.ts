// ─── thumbnailGallery: nuevo shape calculado por el backend ──────────────────
/** Una entrada de la galería de thumbnails (1 por color único) */
export interface ThumbnailEntry {
  colorCode: string;   // ej: "WHT"
  colorName: string;   // ej: "Blanco"
  colorHex:  string;   // ej: "#FFFFFF"
  image:     string;   // URL de la primera imagen de ese color
}

// ─── Garantía ─────────────────────────────────────────────────────────────────
export interface ProductWarranty {
  duration:     number;
  unit:         'months' | 'days' | 'years';
  type:         'manufacturer' | 'store';
  description?: string;
  policyUrl?:   string;
}

// ─── Producto maestro ─────────────────────────────────────────────────────────
export interface Product {
  _id:            string;
  code:           string;
  name:           string;
  brand:          string;
  model:          string;
  description?:   string;
  specifications?: Record<string, string>;
  basePrice:      number;
  category:       string[];
  gallery:        string[];
  firstVariantImage?: string | null;

  /**
   * Galería de thumbnails calculada por el backend.
   * Una entrada por color único: { colorCode, colorName, colorHex, image }
   */
  thumbnailGallery?: ThumbnailEntry[];

  /** Colores únicos de todas las variantes activas (calculado por backend) */
  availableColors?: { name: string; hex: string; code: string }[];

  discount:  number;
  isActive:  boolean;
  /** Motivo de moderación si el producto fue pausado por el admin */
  moderationReason?: string;
  tags:      string[];
  warranty?: ProductWarranty;

  /**
   * ownerId = null  → producto del catálogo oficial Moorea
   * ownerId = <id>  → producto del catálogo privado del seller
   */
  ownerId?: string | null;

  rating?: {
    average:      number;
    count:        number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  };

  /**
   * Distancia en km a la tienda con stock más cercana al cliente.
   * Solo presente en respuestas de GET /product/active/geo.
   * null → el producto no tiene stock en ninguna tienda activa.
   */
  nearestStoreKm?: number | null;

  // --- 🗺️ CAMPOS GEOLOCALIZADOS Y CALCULADOS (Exclusivos de /geo) ---
  finalPrice?:     number;
  hasLocalStock?:  boolean;
  availableSizes?: string[];
  delivery?: {
    label:           string;
    cost:            number;
    estimatedDays:   number;
    /** true si las 3 condiciones de delivery gratis se cumplen (dist ≤ 2.5 km, precio ≥ S/200, peso ≤ 3 kg) */
    isFree?:          boolean;
    /** Recargo en Soles por peso efectivo > 3 kg. S/ 0 si no aplica. */
    weightSurcharge?: number;
  };

  pickup?: {
    available:     boolean;
    label:         string;
    storeName:     string;
  };

  createdAt: string;
  updatedAt: string;
}

// ─── Respuesta paginada estándar (GET /product/active, /my-catalog) ───────────
export interface PaginatedResponse {
  data:  Product[];
  total: number;
  page:  number;
  limit: number;
}

// ─── Respuesta de GET /product/all (agrupado por catálogo — solo admin) ───────
export interface ProductCatalog {
  /** null = catálogo oficial Moorea; string = sellerId */
  owner:    string | null;
  /** Etiqueta legible: "Moorea" o email/nombre del seller */
  label:    string;
  total:    number;
  products: Product[];
}

export interface CatalogsResponse {
  catalogs: ProductCatalog[];
  total:    number;
}
