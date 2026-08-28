import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface IzipayInitPaymentResponse {
  formToken: string;
  publicKey: string;
  jsUrl: string;
  amount: number;
  invoiceNumber: string;
  currency: string;
}

export interface IzipayTestCard {
  brand: string;
  type: string;
  number: string;
  exp: string;
  cvv: string;
  status: 'approved' | 'insufficient_funds' | 'bank_blocked';
  label: string;
  badgeColor: string;
  errorMessage?: string;
}

/**
 * Servicio para la gestión de la pasarela de pagos Izipay en el Frontend
 */
@Injectable({
  providedIn: 'root',
})
export class IzipayPaymentService {
  private readonly apiUrl = `${environment.apiUrl}/orders`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Solicita al backend la inicialización de la sesión de pago con Izipay
   */
  initPayment(orderId: string): Observable<IzipayInitPaymentResponse> {
    return this.http.post<IzipayInitPaymentResponse>(
      `${this.apiUrl}/${orderId}/payment/init`,
      {}
    );
  }

  /**
   * Confirma el pago exitoso de la orden ante el backend
   */
    /**
   * Registra el fallo o rechazo bancario de la orden ante el backend
   */
  failPayment(orderId: string, details?: { errorCode?: string; reason?: string }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${orderId}/payment/fail`,
      details ?? {}
    );
  }

  confirmPayment(orderId: string, details?: { gatewayRef?: string; brand?: string; last4?: string }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${orderId}/payment/confirm`,
      details ?? {}
    );
  }

  /**
   * Tarjetas de prueba oficiales de Izipay Sandbox para desarrollo y validación
   */
  getSandboxTestCards(): IzipayTestCard[] {
    return [
      {
        brand: 'VISA Aprobada',
        type: 'Crédito',
        number: '4900 0000 0000 0000',
        exp: '12/28',
        cvv: '123',
        status: 'approved',
        label: 'Aprobación Inmediata ✓',
        badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      },
      {
        brand: 'VISA Sin Fondos',
        type: 'Débito',
        number: '4000 0000 0000 0005',
        exp: '10/27',
        cvv: '456',
        status: 'insufficient_funds',
        label: 'Rechazo: Fondos Insuficientes ⚠️',
        badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
        errorMessage: 'Transacción rechazada por el banco emisor: Saldo insuficiente en la tarjeta (Código: ERR_IZI_05).',
      },
      {
        brand: 'VISA Bloqueada',
        type: 'Crédito',
        number: '4000 0000 0000 0004',
        exp: '08/26',
        cvv: '789',
        status: 'bank_blocked',
        label: 'Rechazo: Bloqueo Bancario 🚫',
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
        errorMessage: 'Transacción denegada: La entidad bancaria bloqueó la tarjeta por seguridad (Código: ERR_IZI_14).',
      },
    ];
  }
}
