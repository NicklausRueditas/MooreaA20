/**
 * Interfaces para el sistema de autenticación
 * 
 * Este archivo contiene todas las interfaces relacionadas con:
 * - Modelos de usuario
 * - Respuestas de la API
 * - DTOs para autenticación
 */

/**
 * Modelo básico de Usuario
 */
export interface User {
  id: string;
  email?: string;
  roles?: string[];
  // Puedes añadir más propiedades según necesidades
}

/**
 * Respuesta del endpoint de login
 */
export interface LoginResponse {
  access_token: string;
  // Puedes añadir más campos como refresh_token si es necesario
}

/**
 * Respuesta del endpoint de usuario actual
 */
export interface CurrentUserResponse {
  authenticated: boolean;
  user: {
    id: string;
    roles: string[];
  };
}

/**
 * DTO para registro de nuevos usuarios
 */
export interface CreateUserDto {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  dni: string;
  roles?: string[];
}

/**
 * DTO para inicio de sesión
 */
export interface LoginUserDto {
  email: string;
  password: string;
}

/**
 * Opcional: Tipo para los roles disponibles en la aplicación
 */
export type AppRole = 'admin' | 'user' | 'editor'; // Ajustar según necesidades