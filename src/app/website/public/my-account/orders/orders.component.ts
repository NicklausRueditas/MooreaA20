import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { OrderService } from '../../../../core/services/commerce/order.service';
import { SolCurrencyPipe } from '../../../../shared/pipes/sol-currency.pipe';
import { CloudinaryPipe } from '../../../../shared/pipes/cloudinary.pipe';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
} from '../../../../core/interfaces/order.interface';

export type OrderTab = 'all' | 'in_progress' | 'delivered' | 'cancelled';

/**
 * Componente que muestra el historial de órdenes del usuario autenticado con estética moderna luxury e-commerce.
 */
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SolCurrencyPipe, CloudinaryPipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];
  isLoading = true;
  loadError = false;
  isRefreshing = false;

  activeTab: OrderTab = 'all';
  searchQuery = '';

  constructor(
    private readonly orderService: OrderService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  /** Consulta las órdenes del usuario */
  fetchOrders(isManualRefresh = false): void {
    if (isManualRefresh) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }
    this.loadError = false;

    this.orderService.getMyOrders()
      .pipe(
        catchError((err) => {
          console.error('Error al obtener órdenes:', err);
          this.loadError = true;
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
          return of([] as Order[]);
        })
      )
      .subscribe((res: any) => {
        this.isLoading = false;
        this.isRefreshing = false;
        if (Array.isArray(res)) {
          this.orders = res;
        } else if (res && Array.isArray(res.orders)) {
          this.orders = res.orders;
        } else {
          this.orders = [];
        }
        this.cdr.markForCheck();
      });
  }

  // Getters para filtrado y pestañas

  get filteredOrders(): Order[] {
    return this.orders.filter((order) => {
      // Filtro por pestaña
      if (this.activeTab === 'in_progress') {
        if (!['paid', 'preparing', 'ready_for_pickup', 'shipped'].includes(order.status)) {
          return false;
        }
      } else if (this.activeTab === 'delivered') {
        if (order.status !== 'delivered') {
          return false;
        }
      } else if (this.activeTab === 'cancelled') {
        if (order.status !== 'cancelled') {
          return false;
        }
      }

      // Filtro por búsqueda
      const query = this.searchQuery.trim().toLowerCase();
      if (query) {
        const matchInvoice = (order.invoiceNumber || '').toLowerCase().includes(query);
        const matchStore = (order.pickupStore?.name || '').toLowerCase().includes(query);
        const matchDistrict = (order.shippingAddress?.district || '').toLowerCase().includes(query);
        const matchProduct = order.items?.some((item) =>
          (item.productName || '').toLowerCase().includes(query) ||
          (item.sku || '').toLowerCase().includes(query)
        );
        return matchInvoice || matchStore || matchDistrict || matchProduct;
      }

      return true;
    });
  }

  get countInProgress(): number {
    return this.orders.filter((o) =>
      ['paid', 'preparing', 'ready_for_pickup', 'shipped'].includes(o.status)
    ).length;
  }

  get countDelivered(): number {
    return this.orders.filter((o) => o.status === 'delivered').length;
  }

  get countCancelled(): number {
    return this.orders.filter((o) => o.status === 'cancelled').length;
  }

  setTab(tab: OrderTab): void {
    this.activeTab = tab;
  }

  // Helpers de estado luxury

  getStatusLabel(status: OrderStatus | string): string {
    const key = status as OrderStatus;
    return ORDER_STATUS_LABELS[key] ?? status;
  }

  getStatusColor(status: OrderStatus | string): string {
    switch (status) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      case 'preparing':
        return 'bg-sky-50 text-sky-800 border-sky-200/80';
      case 'ready_for_pickup':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'shipped':
        return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'delivered':
        return 'bg-neutral-900 text-white border-neutral-900';
      case 'cancelled':
        return 'bg-neutral-100 text-neutral-500 border-neutral-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  }

  getStatusDotColor(status: OrderStatus | string): string {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500';
      case 'preparing':
        return 'bg-sky-500 animate-pulse';
      case 'ready_for_pickup':
        return 'bg-amber-500 animate-pulse';
      case 'shipped':
        return 'bg-blue-500 animate-pulse';
      case 'delivered':
        return 'bg-emerald-400';
      case 'cancelled':
        return 'bg-neutral-400';
      default:
        return 'bg-neutral-400';
    }
  }
}
