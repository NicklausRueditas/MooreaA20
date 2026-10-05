import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, takeUntil, catchError, of, finalize } from 'rxjs';

import { OrderService } from '../../../../core/services/commerce/order.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { PdfReportService } from '../../../../core/services/ui/pdf-report.service';
import { ImageService } from '../../../../core/services/utils/image.service';
import { QrScannerDriverService } from '../../../../core/services/hardware/qr-scanner-driver.service';
import { SolCurrencyPipe } from '../../../../shared/pipes/sol-currency.pipe';
import { CloudinaryPipe } from '../../../../shared/pipes/cloudinary.pipe';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLOR,
  DeliveryProofSnapshot,
} from '../../../../core/interfaces/order.interface';

/**
 * Componente para ver el detalle integral, hoja de preparación,
 * picking y despacho de una orden individual en el portal de administración.
 * Todas las transiciones de estado requieren confirmación explícita mediante modales.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SolCurrencyPipe, CloudinaryPipe],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  orderId: string | null = null;
  order: Order | null = null;
  isLoading = true;
  isUpdatingStatus = false;
  loadError: string | null = null;

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLOR;

  // ─── Datos Pre-calculados del Cliente ─────────────────────────────────────
  clientInitials = 'U';
  whatsAppLink: string | null = null;
  copiedInvoice = false;
  copiedPickupCode = false;

  // ─── Checklist de Picking / Verificación de Prendas ───────────────────────
  checkedItems = new Set<string>();

  // ─── Control de Modales de Confirmación Rigurosa ──────────────────────────
  confirmModalType: 'preparing' | 'ready_for_pickup' | 'shipped' | 'pickup_deliver' | 'delivery_deliver' | null = null;
  isProcessingAction = false;

  // Campos para Retiro en Tienda (PIN / Código de verificación)
  verificationCodeInput = '';
  pickupVerificationError = '';

  // ─── Lector / Driver de Escáner Físico QR ─────────────────────────────────
  isScannerListening = false;
  isDriverConnected = false;
  activeDriverName = '';
  private scannerSubscription: Subscription | null = null;

  // Campos para Recepción en Domicilio (Delivery)
  deliveryRecipientName = '';
  deliveryRecipientDni = '';
  deliveryNotes = '';
  deliveryPhotos: string[] = [];
  isUploadingDeliveryPhoto = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: OrderService,
    private readonly toastService: ToastService,
    private readonly pdfReportService: PdfReportService,
    private readonly imageService: ImageService,
    private readonly qrScannerDriver: QrScannerDriverService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id');
    if (!this.orderId) {
      this.loadError = 'ID de pedido no especificado.';
      this.isLoading = false;
      return;
    }
    this.loadOrderDetail();
  }

  ngOnDestroy(): void {
    this.stopHardwareScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrderDetail(): void {
    if (!this.orderId) return;
    this.isLoading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.orderService.getAdminOrderDetail(this.orderId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.loadError = err?.error?.message || 'No se pudo cargar el detalle del pedido.';
          this.toastService.show(this.loadError ?? 'Error al cargar pedido', 'error');
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(order => {
        if (!order) return;
        this.order = order;
        // Normalizar objeto user si está en userId
        if (order.userId && typeof order.userId === 'object' && !order.user) {
          this.order.user = order.userId;
        }

        this.computeClientHelpers();
        this.cdr.markForCheck();
      });
  }

  private computeClientHelpers(): void {
    const name = this.getClientName();
    this.clientInitials = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() || '')
      .join('') || 'U';

    const phone = this.getClientPhone();
    if (phone) {
      const clean = phone.replace(/\D/g, '');
      if (clean.length >= 9) {
        const fullNumber = clean.startsWith('51') ? clean : `51${clean}`;
        this.whatsAppLink = `https://wa.me/${fullNumber}?text=${encodeURIComponent(`Hola ${name}, te escribimos de Moorea respecto a tu pedido ${this.order?.invoiceNumber}.`)}`;
      } else {
        this.whatsAppLink = null;
      }
    } else {
      this.whatsAppLink = null;
    }
  }

  // ─── Checklist de Picking ─────────────────────────────────────────────────
  /**
   * Alterna el estado de chequeo en picking para una variante específica de prenda
   * @param variantId Identificador único de la variante del producto
   */
  toggleItemCheck(variantId: string): void {
    if (this.order?.status !== 'preparing') return;
    if (this.checkedItems.has(variantId)) {
      this.checkedItems.delete(variantId);
    } else {
      this.checkedItems.add(variantId);
    }
    this.cdr.markForCheck();
  }

  /**
   * Marca o desmarca todas las prendas de la orden en el checklist de picking
   */
  toggleAllItemsCheck(): void {
    if (this.order?.status !== 'preparing' || !this.order?.items) return;
    if (this.areAllItemsChecked()) {
      this.checkedItems.clear();
    } else {
      this.order.items.forEach(i => this.checkedItems.add(i.variantId));
    }
    this.cdr.markForCheck();
  }

  /**
   * Determina si una prenda específica ha sido marcada en el picking
   * @param variantId Identificador de la variante
   * @returns true si el artículo está chequeado o la orden ya superó la preparación
   */
  isItemChecked(variantId: string): boolean {
    if (!this.order) return false;
    // Si la orden ya superó la preparación (está lista, despachada o entregada), el check está bloqueado como listo
    if (this.order.status !== 'preparing' && this.order.status !== 'paid') {
      return true;
    }
    return this.checkedItems.has(variantId);
  }

  /**
   * Valida si el 100% de los artículos del pedido han sido verificados en picking
   * @returns true si todos los artículos están chequeados o si no está en etapa de preparación
   */
  areAllItemsChecked(): boolean {
    if (!this.order?.items || this.order.items.length === 0) return true;
    if (this.order.status !== 'preparing') return true;
    return this.order.items.every(item => this.checkedItems.has(item.variantId));
  }

  /**
   * Retorna el número de artículos chequeados en el picking
   * @returns Cantidad de ítems verificados
   */
  checkedItemsCount(): number {
    if (!this.order?.items) return 0;
    if (this.order.status !== 'preparing' && this.order.status !== 'paid') {
      return this.order.items.length;
    }
    return this.order.items.filter(item => this.checkedItems.has(item.variantId)).length;
  }

  /**
   * Calcula el porcentaje de avance del picking (0 a 100%)
   * @returns Número entero representativo del progreso
   */
  get pickingProgressPercent(): number {
    const total = this.order?.items?.length || 0;
    if (total === 0) return 100;
    if (this.order?.status !== 'preparing' && this.order?.status !== 'paid') return 100;
    return Math.round((this.checkedItemsCount() / total) * 100);
  }

  // ─── Gestión de Modales de Confirmación ───────────────────────────────────
  /**
   * Abre el modal de confirmación correspondiente a la etapa de la orden
   * @param type Tipo de acción a confirmar ('preparing' | 'ready_for_pickup' | 'shipped' | 'pickup_deliver' | 'delivery_deliver')
   */
  openConfirmModal(type: 'preparing' | 'ready_for_pickup' | 'shipped' | 'pickup_deliver' | 'delivery_deliver'): void {
    this.confirmModalType = type;
    this.pickupVerificationError = '';
    this.verificationCodeInput = '';
    this.deliveryNotes = '';
    this.deliveryRecipientName = this.getClientName();
    this.deliveryRecipientDni = this.getClientDni() || '';
    this.deliveryPhotos = [];
    this.isUploadingDeliveryPhoto = false;
    this.cdr.markForCheck();
  }

  /**
   * Cierra cualquier modal de confirmación activo y restablece el estado
   */
  closeConfirmModal(): void {
    this.stopHardwareScanner();
    this.confirmModalType = null;
    this.pickupVerificationError = '';
    this.verificationCodeInput = '';
    this.deliveryPhotos = [];
    this.isUploadingDeliveryPhoto = false;
    this.isProcessingAction = false;
    this.cdr.markForCheck();
  }

  /**
   * Maneja la selección y subida de fotos de constancia de entrega (máx. 3 fotos)
   * @param event Evento de selección de archivos desde input type="file"
   */
  onDeliveryPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    if (this.deliveryPhotos.length >= 3) {
      this.toastService.show('Máximo 3 fotografías de constancia permitidas.', 'warning');
      input.value = '';
      return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.toastService.show('Solo se permiten archivos de imagen.', 'warning');
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.toastService.show('La imagen no debe superar los 10MB.', 'warning');
      input.value = '';
      return;
    }

    this.isUploadingDeliveryPhoto = true;
    this.cdr.markForCheck();

    this.imageService.uploadImage(file)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.show(err?.error?.message || 'Error al subir la fotografía', 'error');
          return of(null);
        }),
        finalize(() => {
          this.isUploadingDeliveryPhoto = false;
          input.value = '';
          this.cdr.markForCheck();
        })
      )
      .subscribe(res => {
        if (!res?.secureUrl) return;
        this.deliveryPhotos.push(res.secureUrl);
        this.toastService.show('Fotografía adjuntada a la constancia.', 'success');
      });
  }

  /**
   * Remueve una fotografía adjunta de la constancia de entrega
   * @param index Índice de la foto en el arreglo deliveryPhotos
   */
  removeDeliveryPhoto(index: number): void {
    if (index >= 0 && index < this.deliveryPhotos.length) {
      this.deliveryPhotos.splice(index, 1);
      this.cdr.markForCheck();
    }
  }

  /**
   * Ejecuta la acción confirmada por el operario
   */
  executeConfirmAction(): void {
    if (!this.order?._id || !this.confirmModalType) return;

    if (this.confirmModalType === 'preparing') {
      this.submitStatusChange('preparing', '¡Orden en preparación y empaque!');
    } else if (this.confirmModalType === 'ready_for_pickup') {
      if (!this.areAllItemsChecked()) {
        this.toastService.show('Los productos necesitan estar chequeados en el picking antes de confirmar.', 'warning');
        return;
      }
      this.submitStatusChange('ready_for_pickup', '¡Pedido marcado como listo para retiro en tienda!');
    } else if (this.confirmModalType === 'shipped') {
      if (!this.areAllItemsChecked()) {
        this.toastService.show('Los productos necesitan estar chequeados en el picking antes de confirmar despacho.', 'warning');
        return;
      }
      this.submitStatusChange('shipped', '¡Pedido marcado como despachado / en camino!');
    } else if (this.confirmModalType === 'pickup_deliver') {
      this.confirmPickupByCode();
    } else if (this.confirmModalType === 'delivery_deliver') {
      const deliveryProof: DeliveryProofSnapshot = {
        recipientName: this.deliveryRecipientName.trim() || this.getClientName(),
        recipientDni: this.deliveryRecipientDni.trim() || undefined,
        notes: this.deliveryNotes.trim() || undefined,
        photos: this.deliveryPhotos.length > 0 ? [...this.deliveryPhotos] : undefined,
        deliveredAt: new Date(),
      };
      this.submitStatusChange('delivered', '¡Entrega en domicilio confirmada exitosamente!', deliveryProof);
    }
  }

  /**
   * Envía la actualización de estado a la API
   * @param newStatus Nuevo estado de la orden
   * @param successMsg Mensaje amigable para la notificación toast
   * @param deliveryProof Snapshot opcional de constancia de entrega a domicilio (PoD)
   */
  private submitStatusChange(
    newStatus: OrderStatus,
    successMsg: string,
    deliveryProof?: DeliveryProofSnapshot
  ): void {
    if (!this.order?._id) return;
    this.isProcessingAction = true;
    this.isUpdatingStatus = true;
    this.cdr.markForCheck();

    this.orderService.updateOrderStatus(this.order._id, newStatus, undefined, deliveryProof)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.show(err?.error?.message || 'Error al actualizar estado', 'error');
          return of(null);
        }),
        finalize(() => {
          this.isProcessingAction = false;
          this.isUpdatingStatus = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(res => {
        if (!res) return;
        const updated = res?.order ?? res;
        this.order = { ...this.order, ...updated };
        this.toastService.show(successMsg, 'success');
        this.closeConfirmModal();
      });
  }

  /**
   * Valida el código de retiro en tienda con el backend
   */
  private confirmPickupByCode(): void {
    const code = this.verificationCodeInput.trim().toUpperCase();
    if (!code) {
      this.pickupVerificationError = 'Por favor ingresa el código de retiro del cliente.';
      return;
    }

    if (this.order?.pickupCode && this.order.pickupCode.toUpperCase() !== code) {
      this.pickupVerificationError = 'El código ingresado no coincide con el código de esta orden.';
      return;
    }

    this.isProcessingAction = true;
    this.pickupVerificationError = '';
    this.cdr.markForCheck();

    this.orderService.confirmPickup(code)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.pickupVerificationError = err?.error?.message || 'Código de retiro no encontrado o inválido.';
          return of(null);
        }),
        finalize(() => {
          this.isProcessingAction = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(res => {
        if (!res) return;
        this.toastService.show('¡Retiro verificado y completado con éxito!', 'success');
        if (this.order) {
          this.order.status = 'delivered';
          this.order.pickupUsedAt = new Date().toISOString();
        }
        this.closeConfirmModal();
      });
  }

  // ─── Gestión de Máquina / Lector de Códigos QR (Hardware Scanner) ──────────
  /**
   * Alterna el modo de escucha del lector físico o pistola de códigos QR
   */
  toggleHardwareScanner(): void {
    if (this.isScannerListening) {
      this.stopHardwareScanner();
    } else {
      this.startHardwareScanner();
    }
  }

  /**
   * Inicia la captura automática de códigos escaneados por la máquina lectora (HID / Driver)
   */
  startHardwareScanner(): void {
    this.isScannerListening = true;
    this.pickupVerificationError = '';
    this.isDriverConnected = this.qrScannerDriver.isDriverConnected();
    this.activeDriverName = this.qrScannerDriver.activeDevice()?.name || 'Lector USB / Bluetooth (HID)';
    this.cdr.markForCheck();

    this.scannerSubscription?.unsubscribe();
    this.scannerSubscription = this.qrScannerDriver
      .startHardwareListening()
      .pipe(takeUntil(this.destroy$))
      .subscribe(scannedCode => {
        if (!scannedCode) return;
        this.verificationCodeInput = scannedCode;
        this.toastService.show(`¡Código detectado por el lector: ${scannedCode}!`, 'success');
        this.cdr.markForCheck();
        // Validación inmediata del retiro
        this.confirmPickupByCode();
      });
  }

  /**
   * Detiene el modo de escucha del lector físico de códigos QR
   */
  stopHardwareScanner(): void {
    this.scannerSubscription?.unsubscribe();
    this.scannerSubscription = null;
    this.qrScannerDriver.stopHardwareListening();
    this.isScannerListening = false;
    this.cdr.markForCheck();
  }

  /**
   * Conecta con el driver USB WebHID para lectores que operan por protocolo USB directo
   */
  async connectUsbScannerDriver(): Promise<void> {
    const result = await this.qrScannerDriver.connectWebHidDriver();
    if (result.success) {
      this.isDriverConnected = true;
      this.activeDriverName = result.deviceName || 'Dispositivo USB Conectado';
      this.toastService.show(`Driver USB conectado: ${this.activeDriverName}`, 'success');
      this.startHardwareScanner();
    } else {
      this.toastService.show(result.error || 'No se pudo conectar el driver USB', 'warning');
    }
    this.cdr.markForCheck();
  }

  /**
   * Emula la lectura de la pistola QR para realizar pruebas sin la máquina física conectada
   */
  simulateScannerRead(): void {
    const code = this.order?.pickupCode || 'PKP-DEMO12';
    this.qrScannerDriver.simulateScan(code);
  }

  // ─── Control de Correlativo SUNAT ──────────────────────────────────────────
  isEditingCorrelative = false;
  newSunatCorrelative = '';
  isSavingCorrelative = false;

  /**
   * Abre el formulario modal o inline para registrar el correlativo oficial de SUNAT
   */
  openEditCorrelativeModal(): void {
    this.newSunatCorrelative = this.order?.billing?.sunatCorrelative || '';
    this.isEditingCorrelative = true;
    this.cdr.markForCheck();
  }

  /**
   * Cancela la edición del correlativo SUNAT
   */
  cancelEditCorrelative(): void {
    this.isEditingCorrelative = false;
    this.cdr.markForCheck();
  }

  /**
   * Guarda y valida el correlativo oficial SUNAT en la base de datos
   */
  saveSunatCorrelative(): void {
    if (!this.order?._id) return;
    const formatted = this.newSunatCorrelative.trim().toUpperCase();
    if (formatted && !/^[A-Z0-9]{4}-[0-9]{1,8}$/.test(formatted)) {
      this.toastService.show('Formato de correlativo inválido. Ejemplos válidos: B001-000123 o F001-000045', 'warning');
      return;
    }

    this.isSavingCorrelative = true;
    this.cdr.markForCheck();

    this.orderService.updateSunatCorrelative(this.order._id, formatted)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toastService.show(err?.error?.message || 'Error al actualizar correlativo SUNAT', 'error');
          return of(null);
        }),
        finalize(() => {
          this.isSavingCorrelative = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(res => {
        if (!res) return;
        if (this.order) {
          if (!this.order.billing) {
            this.order.billing = {
              invoiceType: 'boleta',
              documentType: 'dni',
              documentNumber: this.getClientDni() || '',
            };
          }
          this.order.billing.sunatCorrelative = formatted;
        }
        this.toastService.show('Correlativo SUNAT actualizado exitosamente.', 'success');
        this.isEditingCorrelative = false;
      });
  }

  /**
   * Genera y descarga el comprobante formal de cliente (Boleta / Factura) en el formato especificado
   * @param format 'a4' para formato hoja carta/A4 o 'ticket80' para impresora térmica de 80mm
   */
  downloadCustomerInvoice(format: 'a4' | 'ticket80' = 'a4'): void {
    if (!this.order) return;
    const tipo = this.order.billing?.invoiceType === 'factura' ? 'Factura Electrónica' : 'Boleta de Venta';
    const fmtLabel = format === 'ticket80' ? 'Ticket 80mm' : 'A4';
    this.toastService.show(`Generando ${tipo} (${fmtLabel})...`, 'info');
    this.pdfReportService.generateCustomerInvoice(this.order, format, 'save');
  }

  /**
   * Abre para previsualización e impresión directa el comprobante de cliente
   * @param format 'a4' o 'ticket80'
   */
  printCustomerInvoice(format: 'a4' | 'ticket80' = 'a4'): void {
    if (!this.order) return;
    const tipo = this.order.billing?.invoiceType === 'factura' ? 'Factura' : 'Boleta';
    this.toastService.show(`Abriendo ${tipo} para impresión directa...`, 'info');
    this.pdfReportService.generateCustomerInvoice(this.order, format, 'open');
  }

  /**
   * Imprime la hoja formal de preparación de almacén abriendo el reporte en PDF
   */
  printOrder(): void {
    if (!this.order) return;
    this.toastService.show('Abriendo hoja de almacén para impresión...', 'info');
    this.pdfReportService.generateOrderReport(this.order, 'open');
  }

  /**
   * Genera y descarga el reporte de picking/almacén en formato PDF
   */
  downloadPdf(): void {
    if (!this.order) return;
    this.toastService.show('Descargando hoja de preparación y almacén en PDF...', 'success');
    this.pdfReportService.generateOrderReport(this.order, 'save');
  }

  /**
   * Copia texto al portapapeles con micro-feedback visual
   */
  copyToClipboard(text: string, type: 'invoice' | 'code'): void {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'invoice') {
        this.copiedInvoice = true;
        setTimeout(() => {
          this.copiedInvoice = false;
          this.cdr.markForCheck();
        }, 1500);
      } else {
        this.copiedPickupCode = true;
        setTimeout(() => {
          this.copiedPickupCode = false;
          this.cdr.markForCheck();
        }, 1500);
      }
      this.toastService.show(`Copiado: ${text}`, 'info');
      this.cdr.markForCheck();
    });
  }

  // ─── Helpers de Información ───────────────────────────────────────────────
  /**
   * Obtiene el objeto con los datos del usuario comprador
   * @returns Objeto de usuario o null si no está disponible
   */
  getClientObj(): any {
    if (!this.order) return null;
    if (this.order.user && typeof this.order.user === 'object') return this.order.user;
    if (this.order.userId && typeof this.order.userId === 'object') return this.order.userId;
    return null;
  }

  /**
   * Obtiene el nombre completo o alias para mostrar del cliente
   * @returns Cadena con el nombre o etiqueta por defecto
   */
  getClientName(): string {
    const client = this.getClientObj();
    return client?.displayName || client?.name || (this.order?.shippingAddress?.alias ? `Cliente (${this.order.shippingAddress.alias})` : 'Cliente Moorea');
  }

  /**
   * Obtiene el correo electrónico del cliente
   * @returns Correo registrado o mensaje informativo
   */
  getClientEmail(): string {
    const client = this.getClientObj();
    return client?.email || 'Sin correo registrado';
  }

  /**
   * Obtiene el DNI o número de documento del cliente si existe
   * @returns Número de documento sanitizado o null
   */
  getClientDni(): string | null {
    const client = this.getClientObj();
    const dni = client?.dni || (client as any)?.documentNumber;
    return dni && dni.trim() !== '' ? dni.trim() : null;
  }

  /**
   * Obtiene el teléfono de contacto del cliente o de la sucursal de retiro
   * @returns Teléfono de contacto sanitizado o null
   */
  getClientPhone(): string | null {
    const client = this.getClientObj();
    const phone = client?.phone || (this.order?.shippingAddress as any)?.phone;
    return phone && phone.trim() !== '' ? phone.trim() : null;
  }

  /**
   * Determina si la orden tiene como modalidad de despacho el retiro en tienda física
   * @returns true si la modalidad es 'pickup', false si es delivery a domicilio
   */
  isPickup(): boolean {
    return this.order?.fulfillment === 'pickup' || this.order?.fulfillmentType === 'pickup';
  }

  /**
   * Calcula el total de unidades físicas de prendas en el pedido
   * @returns Suma total de unidades
   */
  totalItems(): number {
    return (this.order?.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  // ─── Modal de Previsualización / Zoom de Imagen de Prenda ─────────────────
  previewImageUrl: string | null = null;
  previewImageTitle = '';

  /**
   * Abre el modal para visualizar la foto de la prenda en alta resolución
   * @param url URL de la imagen a ampliar
   * @param title Nombre o descripción del producto
   */
  openImagePreview(url?: string, title?: string): void {
    if (!url) return;
    this.previewImageUrl = url;
    this.previewImageTitle = title || 'Fotografía de la Prenda';
  }

  /**
   * Cierra el modal de previsualización de imagen
   */
  closeImagePreview(): void {
    this.previewImageUrl = null;
    this.previewImageTitle = '';
  }
}
