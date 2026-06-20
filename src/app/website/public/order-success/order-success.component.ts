import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, catchError, of } from 'rxjs';

import { OrderService } from '../../../core/services/commerce/order.service';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import {
  Order,
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

  // QR de retiro
  qrData: OrderQrResponse | null = null;
  qrImageUrl: string | null = null;
  isLoadingQr = false;

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLOR;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: OrderService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const id = params.get('id');
          if (!id) { this.router.navigate(['/']); return of(null); }
          return this.orderService.getMyOrder(id).pipe(
            catchError(() => { this.loadError = true; return of(null); })
          );
        })
      )
      .subscribe(res => {
        this.isLoading = false;
        if (res?.order) {
          this.order = res.order;
          if (this.order.fulfillmentType === 'pickup') {
            this.loadPickupQr(this.order._id);
          }
        }
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
        // Generar QR visual usando la librería qrcode (instalada por el usuario)
        try {
          const QRCode = await import('qrcode');
          this.qrImageUrl = await QRCode.toDataURL(qr.qrContent, {
            width: 220,
            margin: 2,
            color: { dark: '#111827', light: '#ffffff' },
          });
        } catch {
          // Si qrcode no está instalado, mostramos el código textual como fallback
          this.qrImageUrl = null;
        }
      });
  }

  get hasDelivery(): boolean {
    return this.order?.items.some(i => i.deliveryType === 'delivery') ?? false;
  }

  get hasPickup(): boolean {
    return this.order?.items.some(i => i.deliveryType === 'pickup') ?? false;
  }

  get pickupStore(): string {
    const item = this.order?.items.find(i => i.deliveryType === 'pickup');
    return item?.pickupStore?.name ?? 'Tienda';
  }

  get pickupStoreAddress(): string {
    const item = this.order?.items.find(i => i.deliveryType === 'pickup');
    return item?.pickupStore?.address ?? '';
  }
}
