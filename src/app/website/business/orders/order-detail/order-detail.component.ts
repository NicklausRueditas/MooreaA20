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
  OrderHistoryEntry,
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

  // ─── Historial y Trazabilidad de Auditoría ──────────────────────────────
  /**
   * Obtiene la lista ordenada de eventos del historial, con retrocompatibilidad
   * para pedidos anteriores que no tengan eventos persistidos en la base de datos.
   */
  getOrderTimeline(): OrderHistoryEntry[] {
    if (this.order?.history && this.order.history.length > 0) {
      return [...this.order.history].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    // Fallback sintetizado para órdenes previas
    const syntheticEvents: OrderHistoryEntry[] = [];
    if (!this.order) return syntheticEvents;

    // 1. Creación
    syntheticEvents.push({
      action: 'order_created',
      actionLabel: 'Pedido registrado por el cliente',
      performedBy: {
        name: this.getClientName(),
        role: 'user',
        email: this.order.user?.email,
      },
      store: this.order.pickupStore ? {
        storeId: this.order.pickupStore.storeId,
        name: this.order.pickupStore.name,
      } : undefined,
      timestamp: this.order.createdAt || new Date(),
    });

    // 2. Pago
    if (this.order.paidAt || this.order.paymentStatus === 'paid' || this.order.status !== 'cancelled') {
      syntheticEvents.push({
        action: 'payment_confirmed',
        actionLabel: 'Pago verificado exitosamente',
        performedBy: {
          name: this.order.paymentMethod === 'card' ? 'Pasarela Izipay' : this.getClientName(),
          role: this.order.paymentMethod === 'card' ? 'system' : 'user',
        },
        timestamp: this.order.paidAt || this.order.createdAt || new Date(),
      });
    }

    // 3. Preparación
    if (['preparing', 'ready_for_pickup', 'shipped', 'delivered'].includes(this.order.status)) {
      syntheticEvents.push({
        action: 'preparing',
        actionLabel: 'En preparación y empaque (Picking)',
        performedBy: {
          name: 'Operario de Almacén',
          role: 'worker',
        },
        store: this.order.pickupStore ? {
          storeId: this.order.pickupStore.storeId,
          name: this.order.pickupStore.name,
        } : { name: 'Almacén Central / Despacho' },
        timestamp: this.order.updatedAt || new Date(),
      });
    }

    // 4. Listo para retiro o en camino
    if (['ready_for_pickup', 'delivered'].includes(this.order.status) && this.isPickup()) {
      syntheticEvents.push({
        action: 'ready_for_pickup',
        actionLabel: 'Listo para retiro en tienda',
        performedBy: {
          name: 'Personal de Tienda',
          role: 'worker',
        },
        store: this.order.pickupStore ? {
          storeId: this.order.pickupStore.storeId,
          name: this.order.pickupStore.name,
        } : undefined,
        timestamp: this.order.updatedAt || new Date(),
      });
    } else if (['shipped', 'delivered'].includes(this.order.status) && !this.isPickup()) {
      syntheticEvents.push({
        action: 'shipped',
        actionLabel: 'Despachado / En camino a domicilio',
        performedBy: {
          name: 'Despachador de Envíos',
          role: 'worker',
        },
        timestamp: this.order.updatedAt || new Date(),
      });
    }

    // 5. Entregado
    if (this.order.status === 'delivered') {
      syntheticEvents.push({
        action: 'delivered',
        actionLabel: this.isPickup() ? 'Retiro en tienda validado y entregado' : 'Entrega a domicilio confirmada',
        performedBy: {
          name: this.isPickup() ? 'Cajero de Sucursal' : (this.order.deliveryProof?.recipientName ? `Receptor: ${this.order.deliveryProof.recipientName}` : 'Repartidor'),
          role: 'worker',
        },
        store: this.order.pickupStore ? {
          storeId: this.order.pickupStore.storeId,
          name: this.order.pickupStore.name,
        } : undefined,
        timestamp: this.order.pickupUsedAt || this.order.deliveryProof?.deliveredAt || this.order.updatedAt || new Date(),
      });
    }

    // 6. Cancelado
    if (this.order.status === 'cancelled') {
      syntheticEvents.push({
        action: 'cancelled',
        actionLabel: 'Pedido cancelado',
        performedBy: {
          name: 'Administración',
          role: 'admin',
        },
        notes: this.order.cancelReason,
        timestamp: this.order.updatedAt || new Date(),
      });
    }

    return syntheticEvents;
  }

  /**
   * Obtiene la configuración de estilos e insignia del rol del operador
   */
  getRoleBadge(role?: string): { label: string; badgeClass: string; roleCode: string; roleType: string } {
    const cleanRole = (role || '').toLowerCase();
    switch (cleanRole) {
      case 'admin':
        return {
          label: 'Administrador Global',
          badgeClass: 'bg-purple-50 text-purple-800 border-purple-200/80',
          roleCode: 'ADMIN',
          roleType: 'admin',
        };
      case 'worker':
        return {
          label: 'Operario / Almacén',
          badgeClass: 'bg-blue-50 text-blue-800 border-blue-200/80',
          roleCode: 'OPERARIO',
          roleType: 'worker',
        };
      case 'seller':
        return {
          label: 'Tienda / Vendedor',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          roleCode: 'SUCURSAL',
          roleType: 'seller',
        };
      case 'user':
        return {
          label: 'Cliente',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200/80',
          roleCode: 'CLIENTE',
          roleType: 'user',
        };
      case 'system':
      default:
        return {
          label: 'Sistema Automatizado',
          badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
          roleCode: 'SISTEMA',
          roleType: 'system',
        };
    }
  }

  /**
   * Obtiene los colores y diseño del nodo en la línea de tiempo según la acción
   */
  getActionVisuals(action?: string): {
    actionType: string;
    gradientClass: string;
    iconBgClass: string;
    iconColorClass: string;
    ringColor: string;
    bgClass: string;
    borderClass: string;
    badgeText: string;
    badgeClass: string;
  } {
    switch (action) {
      case 'order_created':
        return {
          actionType: 'created',
          gradientClass: 'from-slate-800 to-slate-950',
          iconBgClass: 'bg-slate-900',
          iconColorClass: 'text-white',
          ringColor: 'ring-slate-300',
          bgClass: 'bg-slate-50/70',
          borderClass: 'border-slate-200/90',
          badgeText: 'Checkout Realizado',
          badgeClass: 'bg-slate-200/80 text-slate-800 border-slate-300',
        };
      case 'payment_confirmed':
      case 'paid':
        return {
          actionType: 'payment',
          gradientClass: 'from-emerald-600 to-teal-700',
          iconBgClass: 'bg-emerald-600',
          iconColorClass: 'text-white',
          ringColor: 'ring-emerald-200',
          bgClass: 'bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30',
          borderClass: 'border-emerald-200/90',
          badgeText: 'Pago Verificado',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'preparing':
        return {
          actionType: 'preparing',
          gradientClass: 'from-amber-500 to-orange-600',
          iconBgClass: 'bg-amber-500',
          iconColorClass: 'text-white',
          ringColor: 'ring-amber-200',
          bgClass: 'bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30',
          borderClass: 'border-amber-200/90',
          badgeText: 'Picking & Empaque',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      case 'ready_for_pickup':
        return {
          actionType: 'ready_pickup',
          gradientClass: 'from-purple-600 to-indigo-700',
          iconBgClass: 'bg-purple-600',
          iconColorClass: 'text-white',
          ringColor: 'ring-purple-200',
          bgClass: 'bg-gradient-to-br from-purple-50/40 via-white to-indigo-50/30',
          borderClass: 'border-purple-200/90',
          badgeText: 'Listo en Tienda',
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        };
      case 'shipped':
        return {
          actionType: 'shipped',
          gradientClass: 'from-blue-600 to-indigo-700',
          iconBgClass: 'bg-blue-600',
          iconColorClass: 'text-white',
          ringColor: 'ring-blue-200',
          bgClass: 'bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30',
          borderClass: 'border-blue-200/90',
          badgeText: 'Despachado / Courier',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'delivered':
      case 'pickup_delivered':
        return {
          actionType: 'delivered',
          gradientClass: 'from-green-600 to-emerald-700',
          iconBgClass: 'bg-green-600',
          iconColorClass: 'text-white',
          ringColor: 'ring-green-300',
          bgClass: 'bg-gradient-to-br from-green-50/50 via-white to-emerald-50/40',
          borderClass: 'border-green-300',
          badgeText: 'Entregado con Éxito',
          badgeClass: 'bg-green-100 text-green-900 border-green-300',
        };
      case 'cancelled':
        return {
          actionType: 'cancelled',
          gradientClass: 'from-rose-600 to-red-700',
          iconBgClass: 'bg-rose-600',
          iconColorClass: 'text-white',
          ringColor: 'ring-rose-200',
          bgClass: 'bg-gradient-to-br from-rose-50/50 via-white to-red-50/40',
          borderClass: 'border-rose-300',
          badgeText: 'Orden Cancelada',
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
        };
      case 'sunat_correlative_updated':
        return {
          actionType: 'sunat',
          gradientClass: 'from-sky-600 to-cyan-700',
          iconBgClass: 'bg-sky-600',
          iconColorClass: 'text-white',
          ringColor: 'ring-sky-200',
          bgClass: 'bg-gradient-to-br from-sky-50/40 via-white to-cyan-50/30',
          borderClass: 'border-sky-200/90',
          badgeText: 'SUNAT Facturación',
          badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        };
      default:
        return {
          actionType: 'default',
          gradientClass: 'from-slate-700 to-slate-900',
          iconBgClass: 'bg-slate-700',
          iconColorClass: 'text-white',
          ringColor: 'ring-slate-200',
          bgClass: 'bg-slate-50',
          borderClass: 'border-slate-200',
          badgeText: 'Movimiento Operativo',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
        };
    }
  }

  /**
   * Calcula el tiempo relativo amigable en español
   */
  getRelativeTime(timestamp: string | Date): string {
    if (!timestamp) return 'Reciente';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Hace un momento';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'min' : 'mins'}`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'h' : 'hrs'}`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }

  /**
   * Obtiene el nombre del punto operativo o sucursal asociado al evento
   */
  getEventStoreName(event: OrderHistoryEntry): string {
    if (event.store?.name) {
      return event.store.name;
    }
    if (this.order?.pickupStore?.name) {
      return this.order.pickupStore.name;
    }
    return 'Almacén Central / Despacho Moorea';
  }

  /**
   * Obtiene el código de la tienda asociado al evento si existe
   */
  getEventStoreCode(event: OrderHistoryEntry): string | null {
    return event.store?.code || null;
  }
}
