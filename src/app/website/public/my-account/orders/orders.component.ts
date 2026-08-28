import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { OrderService } from '../../../../core/services/commerce/order.service';
import { SolCurrencyPipe } from '../../../../shared/pipes/sol-currency.pipe';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../../core/interfaces/order.interface';
import { catchError, of } from 'rxjs';

/**
 * Componente que muestra el historial de órdenes del usuario autenticado
 */
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, SolCurrencyPipe],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];
  isLoading = true;
  loadError = false;

  constructor(
    private readonly orderService: OrderService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  /** Consulta las órdenes del usuario */
  fetchOrders(): void {
    this.isLoading = true;
    this.loadError = false;

    this.orderService.getMyOrders()
      .pipe(
        catchError((err) => {
          console.error('Error al obtener órdenes:', err);
          this.loadError = true;
          this.isLoading = false;
          this.cdr.markForCheck();
          return of([] as Order[]);
        })
      )
      .subscribe((res: any) => {
        this.isLoading = false;
        if (Array.isArray(res)) {
          this.orders = res;
        } else if (res && Array.isArray(res.orders)) {
          this.orders = res.orders;
        } else {
          this.orders = [];
        }
        console.log('Órdenes cargadas exitosamente:', this.orders.length, this.orders);
        this.cdr.markForCheck();
      });
  }

  /** Retorna el texto legible del estado */
  getStatusLabel(status: OrderStatus | string): string {
    const key = status as OrderStatus;
    return ORDER_STATUS_LABELS[key] ?? status;
  }

  /** Retorna las clases CSS correspondientes al estado */
  getStatusColor(status: OrderStatus | string): string {
    const key = status as OrderStatus;
    return ORDER_STATUS_COLOR[key] ?? 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
