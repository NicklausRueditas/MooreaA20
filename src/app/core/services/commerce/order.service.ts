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

  /**
   * Crea una nueva orden a partir del carrito
   * POST /orders
   */
  createOrder(dto: CreateOrderDto): Observable<any> {
    return this.http.post<any>(this.apiUrl, dto);
  }

  /**
   * GET /orders/my — historial de órdenes del usuario autenticado
   */
  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/my`);
  }

  /**
   * GET /orders/my/:id — detalle de una orden
   */
  getMyOrder(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/my/${orderId}`);
  }

  /**
   * GET /orders/my/:id/qr — datos QR de retiro en tienda
   */
  getPickupQr(orderId: string): Observable<OrderQrResponse> {
    return this.http.get<OrderQrResponse>(`${this.apiUrl}/my/${orderId}/qr`);
  }

  /**
   * GET /orders/all — todas las órdenes (Admin)
   */
  getAllOrders(filters?: {
    status?: OrderStatus;
    fulfillment?: 'delivery' | 'pickup';
    storeId?: string;
  }): Observable<any> {
    let params = new HttpParams();
    if (filters?.status)      params = params.set('status', filters.status);
    if (filters?.fulfillment) params = params.set('fulfillment', filters.fulfillment);
    if (filters?.storeId)     params = params.set('storeId', filters.storeId);
    return this.http.get<any>(`${this.apiUrl}/all`, { params });
  }

  /**
   * PATCH /orders/:id/status — actualizar estado (Admin)
   */
  updateOrderStatus(orderId: string, status: OrderStatus, cancelReason?: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${orderId}/status`, {
      status,
      ...(cancelReason ? { cancelReason } : {}),
    });
  }

  /**
   * PATCH /orders/pickup/confirm/:code — confirmar retiro en tienda
   */
  confirmPickup(pickupCode: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/pickup/confirm/${pickupCode}`, {});
  }
}
