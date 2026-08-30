import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of, finalize } from 'rxjs';

import { OrderService } from '../../../core/services/commerce/order.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../core/interfaces/order.interface';

@Component({
  selector: 'app-orders-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, SolCurrencyPipe],
  templateUrl: './orders-admin.component.html',
})
export class OrdersAdminComponent implements OnInit {
  orders: Order[] = [];
  isLoading = false;
  activeFilter: OrderStatus | 'all' = 'all';

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLOR;

  readonly filters: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Pendiente pago', value: 'pending_payment' },
    { label: 'Pagadas', value: 'paid' },
    { label: 'En preparación', value: 'preparing' },
    { label: 'Listo retiro', value: 'ready_for_pickup' },
    { label: 'En camino', value: 'shipped' },
    { label: 'Entregadas', value: 'delivered' },
    { label: 'Canceladas', value: 'cancelled' },
  ];

  constructor(
    private readonly orderService: OrderService,
    private readonly authService: AuthService,
  ) {}

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  get userRole(): string {
    return this.currentUser?.roles?.[0] || 'user';
  }

  get isAdmin(): boolean {
    return this.userRole === 'admin' || (this.currentUser?.roles?.includes('admin' as any) ?? false);
  }

  get isWorker(): boolean {
    return this.userRole === 'worker' || (this.currentUser?.roles?.includes('worker' as any) ?? false);
  }

  get isSeller(): boolean {
    return this.userRole === 'seller' || (this.currentUser?.roles?.includes('seller' as any) ?? false);
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    const filterParam = this.activeFilter !== 'all' ? this.activeFilter : undefined;
    this.orderService.getAllOrders(filterParam ? { status: filterParam } : undefined)
      .pipe(
        catchError(() => of(null)),
        finalize(() => { this.isLoading = false; })
      )
      .subscribe(res => {
        this.orders = Array.isArray(res) ? res : (res?.orders ?? []);
      });
  }

  setFilter(filter: OrderStatus | 'all'): void {
    this.activeFilter = filter;
    this.loadOrders();
  }

  updateStatus(order: Order, status: OrderStatus): void {
    this.orderService.updateOrderStatus(order._id, status).subscribe({
      next: res => {
        const updated = res?.order ?? res;
        const idx = this.orders.findIndex(o => o._id === order._id);
        if (idx !== -1 && updated) this.orders[idx] = updated;
      },
      error: () => {},
    });
  }

  /** Acciones disponibles según estado actual */
  nextActions(order: Order): { label: string; status: OrderStatus; color: string }[] {
    switch (order.status) {
      case 'paid':
        return [{ label: 'Marcar en preparación', status: 'preparing', color: 'orange' }];
      case 'preparing':
        return order.fulfillmentType === 'pickup' || (order as any).fulfillment === 'pickup'
          ? [{ label: 'Listo para retiro', status: 'ready_for_pickup', color: 'purple' }]
          : [{ label: 'Marcar enviado', status: 'shipped', color: 'indigo' }];
      case 'shipped':
        return [{ label: 'Marcar entregado', status: 'delivered', color: 'green' }];
      default:
        return [];
    }
  }

  totalItems(order: Order): number {
    return (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
  }

  getOrderTotal(order: Order): number {
    return Number(order?.pricing?.total ?? (order as any)?.totalAmount ?? 0);
  }
}
