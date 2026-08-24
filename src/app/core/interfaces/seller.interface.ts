/**
 * Estado del proceso de aprobación de un seller en la plataforma.
 *
 * - pending  → Recién registrado, esperando revisión del admin
 * - approved → Aprobado; puede gestionar productos y tiendas
 * - rejected → Rechazado/suspendido por el admin
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Datos bancarios del seller para recibir pagos.
 */
export interface BankInfo {
  bank:    string; // nombre del banco (BCP, Interbank, etc.)
  account: string; // número de cuenta
  cci?:    string; // código de cuenta interbancario (opcional)
}

/**
 * Perfil de una tienda del seller.
 * Un seller puede tener múltiples tiendas (multiple SellerProfile por userId).
 */
export interface SellerProfile {
  _id?:           string;
  userId:         string;           // referencia al User con rol seller
  shopName:       string;
  description?:   string;
  logoUrl?:       string;
  bankInfo?:      BankInfo;
  commissionRate?: number;          // % de comisión Moorea (ej: 10)
  approvalStatus: ApprovalStatus;   // estado del proceso de aprobación
  isActive?:      boolean;
  createdAt?:     string;
  updatedAt?:     string;
}

/**
 * Usuario con rol seller tal como lo devuelve GET /admin/sellers.
 * Incluye todas sus tiendas (sellerProfiles) embebidas.
 * La aggregation del backend agrupa los perfiles bajo el usuario.
 */
export interface SellerUser {
  _id:            string;
  email:          string;
  displayName:    string;
  phone?:         string;
  dni?:           string;
  roles:          string[];
  isActive:       boolean;
  sellerProfiles: SellerProfile[];  // array: un seller puede tener varias tiendas
  createdAt?:     string;
}

/**
 * DTO para crear un perfil de tienda (POST /sellers/profile).
 */
export interface CreateSellerProfileDto {
  shopName:    string;
  description?: string;
  logoUrl?:     string;
  bankInfo?:    BankInfo;
}

/**
 * DTO para actualizar perfil de tienda (PATCH /sellers/profile).
 */
export type UpdateSellerProfileDto = Partial<CreateSellerProfileDto>;

/**
 * DTO para crear un usuario con rol seller (POST /manage/user/create).
 */
export interface CreateSellerUserDto {
  email:       string;
  password:    string;
  displayName: string;
  phone?:      string;
  dni?:        string;
  roles:       ['seller'];
}

/**
 * Shape del catálogo privado del seller (GET /product/my-catalog).
 * Reutiliza PaginatedResponse de product.interface.
 */
export interface MyCatalogQuery {
  page?:  number;
  limit?: number;
}
