import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { OrderService } from '../../../../core/services/commerce/order.service';
import { SolCurrencyPipe } from '../../../../shared/pipes/sol-currency.pipe';
import {
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../../core/interfaces/order.interface';
import { catchError, of } from 'rxjs';

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

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLOR;

  constructor(private readonly orderService: OrderService) {}

  ngOnInit(): void {
    this.orderService.getMyOrders()
      .pipe(catchError(() => { this.loadError = true; return of(null); }))
      .subscribe(res => {
        this.isLoading = false;
        this.orders = res?.orders ?? [];
      });
  }

  /** Cuenta los items únicos (líneas) de la orden */
  itemCount(order: Order): number {
    return order.items.length;
  }

  /** Primer thumbnail del primer item */
  thumbnail(order: Order): string | null {
    return order.items[0]?.thumbnail ?? null;
  }
}
