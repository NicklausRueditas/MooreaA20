/**
 * Interfaces para el servicio de direcciones
 * 
 * Este archivo contiene todas las interfaces necesarias para el módulo de direcciones
 * en una aplicación Angular.
 */

// ====================================================
// Interfaces principales
// ====================================================

/**
 * Datos básicos de una dirección
 */
export interface AddressData {
  _id?: string;               // Opcional para creación
  alias: string;
  street: string;
  streetNumber: string;
  apartment?: string;
  district: string;
  province: string;
  department: string;
  postalCode: string;
  country: string;
  references?: string;
  isDefault: boolean;
  lat?: number;
  lng?: number;
  placeId?: string;
  distanceFromStore?: number;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;            // Opcional para algunas respuestas
}

/**
 * DTO para actualización de dirección
 */
export interface UpdateAddressDto {
  alias?: string;
  street?: string;
  streetNumber?: string;
  apartment?: string | null;  // Permite null para eliminar el valor
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  country?: string;
  references?: string | null; // Permite null para eliminar el valor
  isDefault?: boolean;
}

/**
 * Respuesta estándar del API para operaciones de dirección
 */
export interface AddressResponse {
  success: boolean;
  message?: string;
  address?: AddressData;
  addresses?: AddressData[];
}

// ====================================================
// Interfaces para parámetros de solicitud
// ====================================================

/**
 * Parámetros para creación de dirección
 */
export interface CreateAddressParams {
  address: Omit<AddressData, '_id' | 'createdAt' | 'updatedAt' | 'userId'>;
}

/**
 * Parámetros para actualización de dirección
 */
export interface UpdateAddressParams {
  addressId: string;
  updateData: UpdateAddressDto;
}

/**
 * Parámetros para eliminación de dirección
 */
export interface DeleteAddressParams {
  addressId: string;
}

// ====================================================
// Interfaces para respuestas específicas
// ====================================================

/**
 * Respuesta para operaciones de creación
 */
export interface CreateAddressResponse extends AddressResponse {
  address: AddressData;
}

/**
 * Respuesta para operaciones de listado
 */
export interface ListAddressesResponse extends AddressResponse {
  addresses: AddressData[];
  count: number;
}

/**
 * Respuesta para operaciones de dirección predeterminada
 */
export interface DefaultAddressResponse extends AddressResponse {
  isDefault: boolean;
}
