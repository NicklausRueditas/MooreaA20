import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment.development';
import { 
  AddressData, 
  UpdateAddressDto, 
  AddressResponse,
  CreateAddressResponse,
  ListAddressesResponse,
  DefaultAddressResponse
} from '../interfaces/address.interface';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly apiUrl = `${environment.apiUrl}/addresses`;
  private headers: HttpHeaders;

  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });
  }

  // ==================== MÉTODOS PRIVADOS ====================
  private getToken(): string {
    return localStorage.getItem('authToken') || '';
  }

  private handleError(error: any): Observable<never> {
    console.error('Error en AddressService:', error);
    return throwError(() => ({
      status: error.status,
      message: error.error?.message || 'Error en la solicitud'
    }));
  }

  // ==================== MÉTODOS PÚBLICOS ====================

  /**
   * Crea una nueva dirección para el usuario autenticado
   * @param addressData Datos de la dirección a crear (sin campos autogenerados)
   * @returns Observable con la respuesta de creación que incluye la dirección creada
   */
  createAddress(addressData: Omit<AddressData, '_id' | 'createdAt' | 'updatedAt' | 'userId'>): Observable<CreateAddressResponse> {
    return this.http.post<CreateAddressResponse>(
      this.apiUrl, 
      { address: addressData }, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Obtiene todas las direcciones del usuario
   * @returns Observable con la respuesta que incluye el listado de direcciones y el conteo
   */
  getUserAddresses(): Observable<ListAddressesResponse> {
    return this.http.get<ListAddressesResponse>(
      this.apiUrl, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Actualiza una dirección existente
   * @param addressId ID de la dirección a actualizar
   * @param updateData Campos a modificar (DTO de actualización)
   * @returns Observable con la respuesta que incluye la dirección actualizada
   */
  updateAddress(addressId: string, updateData: UpdateAddressDto): Observable<AddressResponse> {
    return this.http.put<AddressResponse>(
      `${this.apiUrl}/${addressId}`, 
      { updateData }, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Elimina una dirección específica
   * @param addressId ID de la dirección a eliminar
   * @returns Observable con la respuesta de confirmación
   */
  deleteAddress(addressId: string): Observable<AddressResponse> {
    return this.http.delete<AddressResponse>(
      `${this.apiUrl}/${addressId}`, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Elimina TODAS las direcciones del usuario
   * @returns Observable con la respuesta de confirmación
   */
  deleteAllAddresses(): Observable<AddressResponse> {
    return this.http.delete<AddressResponse>(
      this.apiUrl, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Establece una dirección como predeterminada
   * @param addressId ID de la dirección a marcar como principal
   * @returns Observable con la respuesta que incluye el estado de dirección predeterminada
   */
  setDefaultAddress(addressId: string): Observable<DefaultAddressResponse> {
    return this.http.put<DefaultAddressResponse>(
      `${this.apiUrl}/${addressId}/default`, 
      {}, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Obtiene la dirección predeterminada del usuario
   * @returns Observable con la respuesta que incluye la dirección principal
   */
  getDefaultAddress(): Observable<DefaultAddressResponse> {
    return this.http.get<DefaultAddressResponse>(
      `${this.apiUrl}/default`, 
      { headers: this.headers }
    ).pipe(catchError(this.handleError));
  }
}