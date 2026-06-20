import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateOrderDto,
  Order,
  OrderListResponse,
  OrderQrResponse,
  OrderResponse,
  OrderStatus,
} from '../../interfaces/order.interface';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly apiUrl = `${environment.apiUrl}/orders`;

  constructor(private readonly http: HttpClient) {}

  // ─── Crear ────────────────────────────────────────────────────────────────

  /**
   * Crea una nueva orden a partir del carrito (o un subset).
   * Llama a POST /orders
   */
  createOrder(dto: CreateOrderDto): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.apiUrl, dto);
  }

  // ─── Mis órdenes (usuario autenticado) ────────────────────────────────────

  /** GET /orders/my — historial del usuario */
  getMyOrders(): Observable<OrderListResponse> {
    return this.http.get<OrderListResponse>(`${this.apiUrl}/my`);
  }

  /** GET /orders/my/:id — detalle de una orden */
  getMyOrder(orderId: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.apiUrl}/my/${orderId}`);
  }

  /**
   * GET /orders/my/:id/qr
   * Retorna { pickupCode, invoiceNumber, qrContent } para generar el QR en el frontend.
   * Solo disponible para órdenes con fulfillment = 'pickup'.
   */
  getPickupQr(orderId: string): Observable<OrderQrResponse> {
    return this.http.get<OrderQrResponse>(`${this.apiUrl}/my/${orderId}/qr`);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  /** GET /orders/all?status=...&fulfillment=...&storeId=... */
  getAllOrders(filters?: {
    status?: OrderStatus;
    fulfillment?: 'delivery' | 'pickup';
    storeId?: string;
  }): Observable<OrderListResponse> {
    let params = new HttpParams();
    if (filters?.status)      params = params.set('status', filters.status);
    if (filters?.fulfillment) params = params.set('fulfillment', filters.fulfillment);
    if (filters?.storeId)     params = params.set('storeId', filters.storeId);
    return this.http.get<OrderListResponse>(`${this.apiUrl}/all`, { params });
  }

  /**
   * PATCH /orders/:id/status
   * Actualiza el estado de la orden (admin/worker).
   */
  updateOrderStatus(orderId: string, status: OrderStatus, cancelReason?: string): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/${orderId}/status`, {
      status,
      ...(cancelReason ? { cancelReason } : {}),
    });
  }

  /**
   * PATCH /orders/pickup/confirm/:code
   * El cajero confirma el retiro escaneando el QR.
   */
  confirmPickup(pickupCode: string): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/pickup/confirm/${pickupCode}`, {});
  }
}
