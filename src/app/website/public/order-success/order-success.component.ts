import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, catchError, of } from 'rxjs';

import { OrderService } from '../../../core/services/commerce/order.service';
import { PdfReportService } from '../../../core/services/ui/pdf-report.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import { CloudinaryPipe } from '../../../shared/pipes/cloudinary.pipe';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../core/interfaces/order.interface';

/**
 * Componente de éxito y detalle de orden (/orders/:id/success).
 * Soportando dos modos fluidos:
 * 1. Modo Compra Agrupada (por defecto tras finalizar checkout): muestra todas las entregas/despachos de la compra.
 * 2. Modo Pedido Individual (?single=true, desde Mis Pedidos): enfocado exclusivamente en la orden seleccionada,
 *    con opción interactiva de alternar a la compra completa si pertenece a un grupo.
 */
@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterLink, SolCurrencyPipe, CloudinaryPipe],
  templateUrl: './order-success.component.html',
})
export class OrderSuccessComponent implements OnInit {
  /** Orden principal consultada por la ruta */
  order: Order | null = null;
  isLoading = true;
  loadError = false;

  /** Modo de visualización: si es true, muestra únicamente este pedido individual */
  isSingleView = false;

  /** Mapa de códigos QR de retiro por ID de orden para compras con múltiples tiendas/recojos */
  pickupQrMap = new Map<string, { code: string; qrUrl: string }>();
  isLoadingQrMap = new Map<string, boolean>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: OrderService,
    private readonly pdfReportService: PdfReportService,
    private readonly toastService: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Escuchar parámetros de consulta (?single=true)
    this.route.queryParamMap.subscribe(queryParams => {
      this.isSingleView = queryParams.get('single') === 'true';
      this.cdr.markForCheck();
    });

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
          // Cargar los QR para cada sub-orden de tipo pickup
          const ordersToScan = this.order?.relatedOrders && this.order.relatedOrders.length > 0
            ? this.order.relatedOrders
            : [this.order!];

          ordersToScan.forEach(o => {
            if (o.fulfillment === 'pickup') {
              this.loadPickupQr(o._id);
            }
          });
        }
        this.cdr.markForCheck();
      });
  }

  /**
   * Obtiene la lista de órdenes a renderizar en la vista según el modo activo.
   * En modo individual (?single=true) solo devuelve la orden consultada.
   * En modo agrupado devuelve todas las sub-órdenes del grupo de compra.
   */
  get allOrders(): Order[] {
    if (this.isSingleView) {
      return this.order ? [this.order] : [];
    }
    if (this.order?.relatedOrders && this.order.relatedOrders.length > 0) {
      return this.order.relatedOrders;
    }
    return this.order ? [this.order] : [];
  }

  /** Determina si la vista actual está mostrando múltiples despachos agrupados */
  get isGroupedOrder(): boolean {
    return !this.isSingleView && (this.order?.relatedOrders?.length ?? 0) > 1;
  }

  /** Indica si la orden consultada tiene otras órdenes hermanas en su grupo de compra */
  get hasSisterOrders(): boolean {
    return (this.order?.relatedOrders?.length ?? 0) > 1;
  }

  /** Cantidad total de órdenes que componen el grupo de compra */
  get sisterOrdersCount(): number {
    return this.order?.relatedOrders?.length ?? 1;
  }

  /** Alterna interactivamente entre ver solo este pedido o ver toda la compra agrupada */
  toggleViewMode(): void {
    this.isSingleView = !this.isSingleView;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.isSingleView ? { single: 'true' } : { single: null },
      queryParamsHandling: 'merge',
    });
  }

  /** Total acumulado de artículos en las órdenes mostradas */
  get totalGroupItemsCount(): number {
    return this.allOrders.reduce((sum, o) => {
      const count = (o.items || []).reduce((itemSum, item) => itemSum + (Number(item.quantity) || 1), 0);
      return sum + count;
    }, 0);
  }

  /** Total financiero acumulado pagado */
  get totalGroupAmount(): number {
    return this.allOrders.reduce((sum, o) => sum + (Number(o.pricing?.total) || Number(o.totalAmount) || 0), 0);
  }

  /** Subtotal acumulado de productos */
  get totalGroupSubtotal(): number {
    return this.allOrders.reduce((sum, o) => sum + (Number(o.pricing?.subtotalBeforeDiscount) || 0), 0);
  }

  /** Costo acumulado de envío */
  get totalGroupShipping(): number {
    return this.allOrders.reduce((sum, o) => sum + (Number(o.pricing?.shippingCost) || 0), 0);
  }

  /** Ahorro acumulado por descuentos */
  get totalGroupSavings(): number {
    return this.allOrders.reduce((sum, o) => sum + (Number(o.pricing?.discount) || 0), 0);
  }

  /**
   * Carga y renderiza el código QR de retiro para una sub-orden específica
   * @param orderId ID de la orden de retiro
   */
  private loadPickupQr(orderId: string): void {
    if (this.pickupQrMap.has(orderId)) return;
    this.isLoadingQrMap.set(orderId, true);

    this.orderService.getPickupQr(orderId)
      .pipe(catchError(() => of(null)))
      .subscribe(async qr => {
        this.isLoadingQrMap.set(orderId, false);
        if (!qr) return;
        try {
          const QRCode = await import('qrcode');
          const qrImageUrl = await QRCode.toDataURL(qr.qrContent, {
            width: 220,
            margin: 2,
            color: { dark: '#111827', light: '#ffffff' },
          });
          this.pickupQrMap.set(orderId, { code: qr.pickupCode, qrUrl: qrImageUrl });
        } catch {
          this.pickupQrMap.set(orderId, { code: qr.pickupCode, qrUrl: '' });
        }
        this.cdr.markForCheck();
      });
  }

  getQrDataForOrder(orderId: string) {
    return this.pickupQrMap.get(orderId) ?? null;
  }

  isQrLoadingForOrder(orderId: string): boolean {
    return this.isLoadingQrMap.get(orderId) ?? false;
  }

  getStatusLabel(status?: OrderStatus): string {
    if (!status) return '';
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  getStatusColor(status?: OrderStatus): string {
    if (!status) return '';
    return ORDER_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-800';
  }

  // ─── Helpers de Facturación y Comprobante ──────────────────────────────────

  isFactura(o?: Order | null): boolean {
    const target = o || this.order;
    return target?.billing?.invoiceType === 'factura';
  }

  getInvoiceTypeLabel(o?: Order | null): string {
    return this.isFactura(o) ? 'Factura Electrónica' : 'Boleta de Venta Electrónica';
  }

  getDocumentNumber(o?: Order | null): string {
    const target = o || this.order;
    return target?.billing?.documentNumber || (target?.user as any)?.dni || '';
  }

  getCustomerOrBusinessName(o?: Order | null): string {
    const target = o || this.order;
    if (this.isFactura(target)) {
      return target?.billing?.businessName || (target?.user as any)?.businessName || 'Cliente Corporativo';
    }
    return target?.billing?.customerName || (target?.user as any)?.displayName || 'Cliente Moorea';
  }

  /**
   * Genera y descarga el comprobante formal de una orden específica
   * @param targetOrder Orden a descargar (o la orden activa por defecto)
   * @param format 'a4' para formato estándar PDF o 'ticket80' para tirilla de 80mm
   */
  downloadInvoice(targetOrder?: Order | null, format: 'a4' | 'ticket80' = 'a4'): void {
    const o = targetOrder || this.order;
    if (!o) return;
    const label = format === 'ticket80' ? 'Ticket 80mm' : 'A4';
    this.toastService.show(`Descargando ${this.getInvoiceTypeLabel(o)} (${label})...`, 'info');
    this.pdfReportService.generateCustomerInvoice(o, format, 'save');
  }

  /**
   * Abre el comprobante en una nueva pestaña del navegador para impresión inmediata
   * @param targetOrder Orden a imprimir
   * @param format 'a4' o 'ticket80'
   */
  printInvoice(targetOrder?: Order | null, format: 'a4' | 'ticket80' = 'a4'): void {
    const o = targetOrder || this.order;
    if (!o) return;
    this.pdfReportService.generateCustomerInvoice(o, format, 'open');
  }
}
