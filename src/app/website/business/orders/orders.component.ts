import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';

import { OrderService } from '../../../core/services/commerce/order.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { SolCurrencyPipe } from '../../../shared/pipes/sol-currency.pipe';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../core/interfaces/order.interface';
import { User } from '../../../core/interfaces/user.interface';

/**
 * Modelo de vista pre-calculado para optimizar el rendimiento del DOM
 * Evita la invocación repetitiva de funciones complejas en las directivas de plantilla de Angular.
 */
export interface OrderViewModel {
  raw: Order;
  _id: string;
  invoiceNumber: string;
  createdAt: string;
  status: OrderStatus;
  statusLabel: string;
  statusColorClass: string;
  pickupCode?: string;
  pickupUsedAt?: string;
  cancelReason?: string;
  paymentStatus?: string;
  isPickup: boolean;
  totalItemsCount: number;
  orderTotal: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientDni: string | null;
  clientInitials: string;
  whatsAppLink?: string;
  storeName?: string;
}

/**
 * Componente Ejecutivo de Gestión de Pedidos en Moorea Business.
 * Ofrece métricas en tiempo real, filtrado inteligente, optimización del DOM y acciones guiadas.
 */
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SolCurrencyPipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class OrdersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  orders: Order[] = [];
  viewModels: OrderViewModel[] = [];
  filteredOrders: OrderViewModel[] = [];
  isLoading = false;

  // ── Filtros y Búsqueda ────────────────────────────────────────────────────
  activeFilter: OrderStatus | 'all' = 'all';
  activeFulfillment: 'all' | 'pickup' | 'delivery' = 'all';
  searchQuery = '';
  sortBy: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' = 'newest';

  // ── Métricas y Contadores de Estado ───────────────────────────────────────
  kpiTotal = 0;
  kpiPaid = 0;
  kpiInProcess = 0;
  kpiDelivered = 0;
  kpiRevenue = 0;

  statusCounts: Record<OrderStatus | 'all', number> = {
    all: 0,
    paid: 0,
    preparing: 0,
    ready_for_pickup: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  // Feedback de copiado al portapapeles
  copiedInvoiceId: string | null = null;
  copiedCodeId: string | null = null;

  currentUser: User | null = null;
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLOR;

  // ─── Modal de Verificación de Retiro en Tienda (Pickup) ────────────────────
  isPickupModalOpen = false;
  selectedPickupOrder: OrderViewModel | null = null;
  verificationCodeInput = '';
  isVerifyingPickup = false;
  pickupVerificationError = '';

  // ─── Modal de Confirmación de Entrega a Domicilio (Delivery) ───────────────
  isDeliveryModalOpen = false;
  selectedDeliveryOrder: OrderViewModel | null = null;
  isConfirmingDelivery = false;

  constructor(
    private readonly orderService: OrderService,
    private readonly authService: AuthService,
    private readonly toastService: ToastService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(u => {
        this.currentUser = u;
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isWorker(): boolean {
    return this.currentUser?.roles?.includes('worker') ?? false;
  }

  get isAdmin(): boolean {
    return this.currentUser?.roles?.includes('admin') ?? false;
  }

  get isSeller(): boolean {
    return this.currentUser?.roles?.includes('seller') ?? false;
  }

  // ─── Carga de Órdenes ─────────────────────────────────────────────────────
  /**
   * Carga la lista de órdenes desde la API y genera los ViewModels pre-calculados
   */
  loadOrders(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const filterParam = this.activeFilter !== 'all' ? this.activeFilter : undefined;
    const fulfillmentParam = this.activeFulfillment !== 'all' ? this.activeFulfillment : undefined;

    this.orderService.getAllOrders({
      ...(filterParam ? { status: filterParam } : {}),
      ...(fulfillmentParam ? { fulfillment: fulfillmentParam } : {}),
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.show(err?.error?.message || 'Error al cargar pedidos', 'error');
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(res => {
        this.orders = Array.isArray(res) ? res : (res?.orders ?? []);
        this.buildViewModels();
        this.computeKpiMetrics();
        this.applyFilterAndSearch();
      });
  }

  /**
   * Transforma las órdenes raw en modelos de vista con propiedades $O(1)$
   */
  private buildViewModels(): void {
    this.viewModels = this.orders.map(order => {
      const clientObj = this.getClientObj(order);
      const clientName = clientObj?.displayName || clientObj?.name || (order?.shippingAddress?.alias ? `Cliente (${order.shippingAddress.alias})` : 'Cliente Moorea');
      const clientEmail = clientObj?.email || '';
      const dni = clientObj?.dni || (clientObj as any)?.documentNumber;
      const clientDni = dni && dni.trim() !== '' ? dni.trim() : null;
      const phone = clientObj?.phone || order?.pickupStore?.phone;
      const clientPhone = phone && phone.trim() !== '' ? phone.trim() : null;

      // Calcular iniciales del cliente
      const initials = clientName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0]?.toUpperCase() || '')
        .join('') || 'U';

      // Enlace de WhatsApp directo
      let whatsAppLink: string | undefined = undefined;
      if (clientPhone) {
        const cleanNumber = clientPhone.replace(/\D/g, '');
        if (cleanNumber.length >= 9) {
          const fullNumber = cleanNumber.startsWith('51') ? cleanNumber : `51${cleanNumber}`;
          whatsAppLink = `https://wa.me/${fullNumber}?text=${encodeURIComponent(`Hola ${clientName}, te escribimos de Moorea respecto a tu pedido ${order.invoiceNumber}.`)}`;
        }
      }

      const totalItemsCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
      const orderTotal = Number(order?.pricing?.total ?? (order as any)?.totalAmount ?? 0);
      const isPickup = order.fulfillmentType === 'pickup' || (order as any).fulfillment === 'pickup';

      return {
        raw: order,
        _id: order._id,
        invoiceNumber: order.invoiceNumber || 'ORD-SIN-ID',
        createdAt: order.createdAt,
        status: order.status,
        statusLabel: this.statusLabels[order.status] || order.status,
        statusColorClass: this.statusColors[order.status] || 'bg-slate-100 text-slate-800 border-slate-200',
        pickupCode: order.pickupCode,
        pickupUsedAt: order.pickupUsedAt,
        cancelReason: order.cancelReason,
        paymentStatus: order.paymentStatus,
        isPickup,
        totalItemsCount,
        orderTotal,
        clientName,
        clientEmail,
        clientPhone,
        clientDni,
        clientInitials: initials,
        whatsAppLink,
        storeName: order.pickupStore?.name || order.store?.name || 'Tienda Principal',
      };
    });
  }

  /**
   * Calcula los contadores de métricas (KPIs) y distribución de estados
   */
  private computeKpiMetrics(): void {
    const counts: Record<OrderStatus | 'all', number> = {
      all: this.viewModels.length,
      paid: 0,
      preparing: 0,
      ready_for_pickup: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    let paid = 0;
    let inProcess = 0;
    let delivered = 0;
    let totalRevenue = 0;

    for (const vm of this.viewModels) {
      if (counts[vm.status] !== undefined) {
        counts[vm.status]++;
      }

      if (vm.status === 'paid') paid++;
      if (['preparing', 'ready_for_pickup', 'shipped'].includes(vm.status)) inProcess++;
      if (vm.status === 'delivered') {
        delivered++;
        totalRevenue += vm.orderTotal;
      }
    }

    this.statusCounts = counts;
    this.kpiTotal = this.viewModels.length;
    this.kpiPaid = paid;
    this.kpiInProcess = inProcess;
    this.kpiDelivered = delivered;
    this.kpiRevenue = totalRevenue;
  }

  /**
   * Cambia el filtro por estado de pedido
   */
  setFilter(filter: OrderStatus | 'all'): void {
    this.activeFilter = filter;
    this.loadOrders();
  }

  /**
   * Cambia el filtro por modalidad de entrega (retiro vs delivery)
   */
  setFulfillmentFilter(fulfillment: 'all' | 'pickup' | 'delivery'): void {
    this.activeFulfillment = fulfillment;
    this.applyFilterAndSearch();
  }

  /**
   * Cambia el ordenamiento de la lista
   */
  setSortBy(sort: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'): void {
    this.sortBy = sort;
    this.applyFilterAndSearch();
  }

  /**
   * Aplica filtros de texto, modalidad y criterio de ordenamiento
   */
  applyFilterAndSearch(): void {
    const q = this.searchQuery.trim().toLowerCase();

    let list = this.viewModels;

    // Filtro por modalidad en memoria
    if (this.activeFulfillment === 'pickup') {
      list = list.filter(o => o.isPickup);
    } else if (this.activeFulfillment === 'delivery') {
      list = list.filter(o => !o.isPickup);
    }

    // Filtro por texto de búsqueda
    if (q) {
      list = list.filter(vm => {
        const invoice = vm.invoiceNumber.toLowerCase();
        const code = (vm.pickupCode || '').toLowerCase();
        const clientName = vm.clientName.toLowerCase();
        const clientEmail = vm.clientEmail.toLowerCase();
        const clientDni = (vm.clientDni || '').toLowerCase();
        const clientPhone = (vm.clientPhone || '').toLowerCase();
        return (
          invoice.includes(q) ||
          code.includes(q) ||
          clientName.includes(q) ||
          clientEmail.includes(q) ||
          clientDni.includes(q) ||
          clientPhone.includes(q)
        );
      });
    }

    // Ordenamiento
    list = [...list].sort((a, b) => {
      switch (this.sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'amount_desc':
          return b.orderTotal - a.orderTotal;
        case 'amount_asc':
          return a.orderTotal - b.orderTotal;
        default:
          return 0;
      }
    });

    this.filteredOrders = list;
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilterAndSearch();
  }

  /**
   * Copia texto al portapapeles con micro-feedback visual
   */
  copyToClipboard(text: string, type: 'invoice' | 'code', id: string): void {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'invoice') {
        this.copiedInvoiceId = id;
        setTimeout(() => {
          this.copiedInvoiceId = null;
          this.cdr.markForCheck();
        }, 1500);
      } else {
        this.copiedCodeId = id;
        setTimeout(() => {
          this.copiedCodeId = null;
          this.cdr.markForCheck();
        }, 1500);
      }
      this.toastService.show(`Copiado: ${text}`, 'info');
      this.cdr.markForCheck();
    });
  }

  // ─── Transición Básica de Estados ─────────────────────────────────────────
  /**
   * Navega a la vista de preparación y detalle de la orden (/business/orders/:id)
   * No auto-confirma el estado: el trabajador debe revisar el pedido y
   * confirmar el inicio de preparación explícitamente en el modal de detalle.
   * @param order Orden o ViewModel seleccionado
   */
  goToPrepareOrder(order: OrderViewModel | Order): void {
    const raw = (order as any).raw || order;
    this.router.navigate(['/business/orders', raw._id]);
  }

  /**
   * Actualiza el estado de una orden directamente
   */
  updateStatus(order: OrderViewModel | Order, status: OrderStatus): void {
    const raw = (order as any).raw || order;
    this.orderService.updateOrderStatus(raw._id, status)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.show(err?.error?.message || 'Error al actualizar estado', 'error');
          return of(null);
        })
      )
      .subscribe(res => {
        if (!res) return;
        const updated = res?.order ?? res;
        const idx = this.orders.findIndex(o => o._id === raw._id);
        if (idx !== -1 && updated) {
          this.orders[idx] = updated;
          this.buildViewModels();
          this.computeKpiMetrics();
          this.applyFilterAndSearch();
        }
        this.toastService.show(`Estado actualizado: ${this.statusLabels[status]}`, 'success');
      });
  }

  // ─── Modal de Retiro en Tienda (Pickup) ───────────────────────────────────
  openPickupModal(order: OrderViewModel): void {
    this.selectedPickupOrder = order;
    this.verificationCodeInput = '';
    this.pickupVerificationError = '';
    this.isVerifyingPickup = false;
    this.isPickupModalOpen = true;
    this.cdr.markForCheck();
  }

  closePickupModal(): void {
    this.isPickupModalOpen = false;
    this.selectedPickupOrder = null;
    this.verificationCodeInput = '';
    this.pickupVerificationError = '';
    this.isVerifyingPickup = false;
    this.cdr.markForCheck();
  }

  confirmPickupByCode(): void {
    const code = this.verificationCodeInput.trim().toUpperCase();
    if (!code) {
      this.pickupVerificationError = 'Por favor ingresa el código de retiro del cliente.';
      return;
    }

    if (this.selectedPickupOrder?.pickupCode && this.selectedPickupOrder.pickupCode.toUpperCase() !== code) {
      this.pickupVerificationError = 'El código ingresado no coincide con el código de esta orden.';
      return;
    }

    this.isVerifyingPickup = true;
    this.pickupVerificationError = '';

    this.orderService.confirmPickup(code)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.pickupVerificationError = err?.error?.message || 'Código de retiro no encontrado o inválido.';
          this.isVerifyingPickup = false;
          this.cdr.markForCheck();
          return of(null);
        })
      )
      .subscribe(res => {
        this.isVerifyingPickup = false;
        if (!res) return;

        this.toastService.show(`¡Retiro verificado y completado! — Orden ${this.selectedPickupOrder?.invoiceNumber}`, 'success');

        // Actualizar estado localmente
        if (this.selectedPickupOrder) {
          const idx = this.orders.findIndex(o => o._id === this.selectedPickupOrder?._id);
          if (idx !== -1) {
            this.orders[idx].status = 'delivered';
            this.orders[idx].pickupUsedAt = new Date().toISOString();
            this.buildViewModels();
            this.computeKpiMetrics();
          }
        }
        this.closePickupModal();
        this.applyFilterAndSearch();
      });
  }

  goToScanner(): void {
    this.closePickupModal();
    this.router.navigate(['/business/pickup-scanner']);
  }

  // ─── Modal de Confirmación de Delivery ────────────────────────────────────
  openDeliveryModal(order: OrderViewModel): void {
    this.selectedDeliveryOrder = order;
    this.isConfirmingDelivery = false;
    this.isDeliveryModalOpen = true;
    this.cdr.markForCheck();
  }

  closeDeliveryModal(): void {
    this.isDeliveryModalOpen = false;
    this.selectedDeliveryOrder = null;
    this.isConfirmingDelivery = false;
    this.cdr.markForCheck();
  }

  confirmDelivery(): void {
    if (!this.selectedDeliveryOrder?._id) return;

    this.isConfirmingDelivery = true;
    this.orderService.updateOrderStatus(this.selectedDeliveryOrder._id, 'delivered')
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.show(err?.error?.message || 'Error al confirmar entrega', 'error');
          this.isConfirmingDelivery = false;
          this.cdr.markForCheck();
          return of(null);
        })
      )
      .subscribe(res => {
        this.isConfirmingDelivery = false;
        if (!res) return;

        this.toastService.show(`Pedido ${this.selectedDeliveryOrder?.invoiceNumber} marcado como entregado.`, 'success');
        const idx = this.orders.findIndex(o => o._id === this.selectedDeliveryOrder?._id);
        if (idx !== -1) {
          this.orders[idx].status = 'delivered';
          this.buildViewModels();
          this.computeKpiMetrics();
        }
        this.closeDeliveryModal();
        this.applyFilterAndSearch();
      });
  }

  private getClientObj(order: Order | null): any {
    if (!order) return null;
    if (order.user && typeof order.user === 'object') return order.user;
    if (order.userId && typeof order.userId === 'object') return order.userId;
    return null;
  }
}
