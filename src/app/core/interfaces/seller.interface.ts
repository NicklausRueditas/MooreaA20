/**
 * Datos bancarios del seller para recibir pagos.
 */
export interface BankInfo {
  bank:    string; // nombre del banco (BCP, Interbank, etc.)
  account: string; // número de cuenta
  cci:     string; // código de cuenta interbancario
}

/**
 * Perfil de tienda del seller.
 * Se crea en POST /sellers/profile y se edita en PATCH /sellers/profile.
 */
export interface SellerProfile {
  _id?:        string;
  userId:      string; // referencia al User con rol seller
  storeName:   string;
  description?: string;
  logoUrl?:    string;
  bankInfo?:   BankInfo;
  status:      'pending' | 'approved' | 'rejected';
  createdAt?:  string;
  updatedAt?:  string;
}

/**
 * Usuario con rol seller tal como lo devuelve GET /admin/sellers.
 * Incluye el perfil de su tienda (populado).
 */
export interface SellerUser {
  _id:          string;
  email:        string;
  displayName:  string;
  phone?:       string;
  dni?:         string;
  roles:        string[];
  isActive:     boolean;
  sellerProfile?: SellerProfile; // puede estar ausente si aún no creó su perfil
  createdAt?:   string;
}

/**
 * DTO para crear un perfil de tienda (POST /sellers/profile).
 */
export interface CreateSellerProfileDto {
  storeName:    string;
  description?: string;
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
