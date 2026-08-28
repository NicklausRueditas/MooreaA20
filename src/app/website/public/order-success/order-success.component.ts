import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, catchError, of } from 'rxjs';

import { OrderService } from '../../../core/services/commerce/order.service';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import {
  Order,
  OrderStatus,
  OrderQrResponse,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../core/interfaces/order.interface';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterLink, SolCurrencyPipe],
  templateUrl: './order-success.component.html',
})
export class OrderSuccessComponent implements OnInit {
  order: Order | null = null;
  isLoading = true;
  loadError = false;

  qrData: OrderQrResponse | null = null;
  qrImageUrl: string | null = null;
  isLoadingQr = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: OrderService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const id = params.get('id');
          if (!id) {
            this.router.navigate(['/']);
            return of(null);
          }
          return this.orderService.getMyOrder(id).pipe(
            catchError((err) => {
              console.error('Error cargando orden:', err);
              this.loadError = true;
              this.isLoading = false;
              this.cdr.markForCheck();
              return of(null);
            })
          );
        })
      )
      .subscribe((res: any) => {
        this.isLoading = false;
        if (res) {
          this.order = (res as any).order ?? res;
          if (this.order && this.order.fulfillment === 'pickup') {
            this.loadPickupQr(this.order._id);
          }
        }
        this.cdr.markForCheck();
      });
  }

  private loadPickupQr(orderId: string): void {
    this.isLoadingQr = true;
    this.orderService.getPickupQr(orderId)
      .pipe(catchError(() => of(null)))
      .subscribe(async qr => {
        this.isLoadingQr = false;
        if (!qr) return;
        this.qrData = qr;
        try {
          const QRCode = await import('qrcode');
          this.qrImageUrl = await QRCode.toDataURL(qr.qrContent, {
            width: 220,
            margin: 2,
            color: { dark: '#111827', light: '#ffffff' },
          });
        } catch {
          this.qrImageUrl = null;
        }
        this.cdr.markForCheck();
      });
  }

  getStatusLabel(status?: OrderStatus): string {
    if (!status) return '';
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  getStatusColor(status?: OrderStatus): string {
    if (!status) return '';
    return ORDER_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-800';
  }

  get hasDelivery(): boolean {
    return this.order?.fulfillment === 'delivery';
  }

  get hasPickup(): boolean {
    return this.order?.fulfillment === 'pickup';
  }

  get pickupStore(): string {
    return this.order?.pickupStore?.name ?? 'Tienda Física';
  }

  get pickupStoreAddress(): string {
    return this.order?.pickupStore?.address ?? '';
  }
}
