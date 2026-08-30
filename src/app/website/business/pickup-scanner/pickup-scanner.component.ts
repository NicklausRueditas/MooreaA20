import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';

import { OrderService } from '../../../core/services/commerce/order.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import {
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
} from '../../../core/interfaces/order.interface';

type ScannerState = 'idle' | 'scanning' | 'found' | 'error';

@Component({
  selector: 'app-pickup-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pickup-scanner.component.html',
})
export class PickupScannerComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ─── Scanner manual ───────────────────────────────────────────────────────
  pickupCodeInput = '';
  scannerState = signal<ScannerState>('idle');
  foundOrder: Order | null = null;
  errorMessage = '';
  isConfirming = false;

  // ─── Lista de pendientes ──────────────────────────────────────────────────
  pendingOrders: Order[] = [];
  isLoadingPending = false;

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLOR;

  constructor(
    private readonly orderService: OrderService,
    private readonly toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadPendingPickups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de pendientes ──────────────────────────────────────────────────

  loadPendingPickups(): void {
    this.isLoadingPending = true;
    this.orderService.getAllOrders({ fulfillment: 'pickup', status: 'ready_for_pickup' })
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
        finalize(() => { this.isLoadingPending = false; }),
      )
      .subscribe(res => {
        this.pendingOrders = res?.orders ?? [];
      });
  }

  // ─── Scanner por código manual ────────────────────────────────────────────

  searchByCode(): void {
    const code = this.pickupCodeInput.trim().toUpperCase();
    if (!code) return;
    this.scannerState.set('scanning');
    this.foundOrder = null;
    this.errorMessage = '';

    // Buscamos en la lista de pendientes (sin llamada extra al backend)
    const found = this.pendingOrders.find(o =>
      o.pickupCode?.toUpperCase() === code
    );

    if (found) {
      this.foundOrder = found;
      this.scannerState.set('found');
    } else {
      // Si no está en la lista local, intentar confirmar directamente
      this.scannerState.set('error');
      this.errorMessage = `No se encontró ninguna orden con código "${code}" entre los retiros pendientes.`;
    }
  }

  onCodeInput(value: string): void {
    this.pickupCodeInput = value.toUpperCase();
    // Auto-buscar cuando el código tiene el formato PKP-XXXXXX (10 chars)
    if (this.pickupCodeInput.length >= 10 && this.scannerState() !== 'found') {
      this.searchByCode();
    }
  }

  reset(): void {
    this.pickupCodeInput = '';
    this.foundOrder = null;
    this.errorMessage = '';
    this.scannerState.set('idle');
  }

  // ─── Confirmación de retiro ───────────────────────────────────────────────

  confirmPickup(order?: Order): void {
    const target = order ?? this.foundOrder;
    if (!target?.pickupCode) return;
    this.isConfirming = true;

    this.orderService.confirmPickup(target.pickupCode)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.showError(err?.error?.message ?? 'Error al confirmar el retiro');
          this.isConfirming = false;
          return of(null);
        })
      )
      .subscribe(res => {
        this.isConfirming = false;
        if (!res) return;
        this.toastService.showSuccess(`✅ Retiro confirmado — Orden ${target.invoiceNumber}`);
        // Quitar de la lista local
        this.pendingOrders = this.pendingOrders.filter(o => o._id !== target._id);
        if (this.foundOrder?._id === target._id) this.reset();
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  totalItems(order: Order): number {
    return order.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getOrderTotal(order: Order | null): number {
    if (!order) return 0;
    return Number(order?.pricing?.total ?? (order as any)?.totalAmount ?? 0);
  }
}
