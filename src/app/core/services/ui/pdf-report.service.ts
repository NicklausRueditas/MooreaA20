import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Order,
  ORDER_STATUS_LABELS,
  OrderStatus,
} from '../../interfaces/order.interface';

/**
 * Paleta monocromática oficial para reportes ejecutivos de Moorea Boutique.
 * Basada exclusivamente en escala de negros, blancos y grises de alta precisión y contraste.
 */
const COLOR_BLACK: [number, number, number] = [0, 0, 0];              // #000000 (Negro puro para jerarquía máxima)
const COLOR_DARK: [number, number, number] = [15, 23, 42];            // #0f172a (Slate 900 Ejecutivo)
const COLOR_BODY: [number, number, number] = [51, 65, 85];            // #334155 (Slate 700 para textos principales)
const COLOR_MUTED: [number, number, number] = [100, 116, 139];        // #64748b (Slate 500 para etiquetas secundarias)
const COLOR_BORDER: [number, number, number] = [203, 213, 225];       // #cbd5e1 (Slate 300 para recuadros nítidos)
const COLOR_BORDER_LIGHT: [number, number, number] = [226, 232, 240]; // #e2e8f0 (Slate 200)
const COLOR_BG_WHITE: [number, number, number] = [255, 255, 255];     // #ffffff (Blanco puro)
const COLOR_BG_SUBTLE: [number, number, number] = [248, 250, 252];    // #f8fafc (Slate 50 neutro ultra-claro)
const COLOR_BG_TINT: [number, number, number] = [241, 245, 249];      // #f1f5f9 (Slate 100 para recuadros destacados)

/**
 * Servicio transversal para la generación de reportes profesionales en formato PDF.
 * Diseñado con una estética estrictamente monocromática (blanco, negro y escala de grises),
 * tipografía corporativa y máxima legibilidad sin elementos de distracción.
 */
@Injectable({
  providedIn: 'root',
})
export class PdfReportService {
  constructor() {}

  /**
   * Formatea un valor numérico a la moneda oficial de Perú (PEN: S/ 0.00).
   * @param val Monto numérico opcional
   * @returns Cadena formateada en soles peruanos
   */
  private formatMoney(val: number | undefined | null): string {
    const num = Number(val) || 0;
    return `S/ ${num.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Normaliza y extrae los datos de contacto y facturación del cliente vinculado a una orden.
   * @param order Orden evaluada
   * @returns Objeto estructurado con nombre, email, DNI y teléfono
   */
  private getClientData(order: Order): {
    name: string;
    email: string;
    dni: string;
    phone: string;
  } {
    const userObj =
      (order as any).user && typeof (order as any).user === 'object'
        ? (order as any).user
        : order.userId && typeof order.userId === 'object'
        ? (order.userId as any)
        : null;

    const name =
      userObj?.displayName ||
      userObj?.name ||
      order.shippingAddress?.alias ||
      'Cliente Moorea';
    const email = userObj?.email || 'Sin correo registrado';
    const dni =
      userObj?.dni || userObj?.documentNumber || 'No especificado';
    const phone =
      userObj?.phone || order.pickupStore?.phone || 'No especificado';

    return { name, email, dni, phone };
  }

  /**
   * Obtiene la descripción legible del método de pago utilizado en la transacción.
   * @param method Identificador clave del método de pago
   * @returns Etiqueta amigable de lectura
   */
  private getPaymentLabel(method?: string): string {
    switch (method) {
      case 'card':
        return 'Tarjeta (Izipay / Visa / Mastercard)';
      case 'yape':
        return 'Billetera Digital Yape';
      case 'cash':
        return 'Pago contra entrega / Efectivo';
      default:
        return 'No especificado';
    }
  }

  /**
   * Extrae la denominación del color de una variante o producto.
   * @param color Objeto o string representativo del color
   * @returns Nombre del color limpio
   */
  private extractColor(color: any): string {
    if (!color) return '-';
    if (typeof color === 'string') return color;
    return color.colorName || color.name || color.code || '-';
  }

  /**
   * Extrae la denominación de la talla de una variante o producto.
   * @param size Objeto o string representativo de la talla
   * @returns Nombre de la talla limpio
   */
  private extractSize(size: any): string {
    if (!size) return '-';
    if (typeof size === 'string') return size;
    return size.size || size.value || '-';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. REPORTE CORPORATIVO DE ORDEN / HOJA DE PICKING Y DESPACHO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera y descarga o visualiza el documento formal en PDF para una orden individual.
   * Estilo monocromático 100% formal (Black & White):
   * - Sin colores rosé ni advertencias visuales que parezcan errores.
   * - Cabecera con franja negra sobria.
   * - Tipografía de alta precisión en contrastes de negros, blancos y grises.
   * - Recuadros de firma con fondo blanco y texto de máximo contraste garantizado.
   * @param order Datos de la orden a procesar
   * @param action 'save' para descarga directa o 'open' para apertura en nueva pestaña
   */
  generateOrderReport(order: Order, action: 'save' | 'open' = 'save'): void {
    if (!order) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const client = this.getClientData(order);
    const isPickup =
      order.fulfillment === 'pickup' || order.fulfillmentType === 'pickup';

    // ─── 1. Franja Superior y Cabecera Monocromática Ejecutiva ──────────────
    // Franja negra pura sólida de 3mm de espesor (sin rosé)
    doc.setFillColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    // Título Principal de la Marca: Negro puro editorial
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('MOOREA', 14, 16);

    // Etiqueta destacada BOUTIQUE en gris oscuro formal
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('·   BOUTIQUE', 58, 16);

    // Subtítulo institucional
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('HOJA DE PREPARACIÓN DE PEDIDO Y CONTROL LOGÍSTICO', 14, 21);

    // Línea de acento divisoria debajo del encabezado (negro a gris suave)
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.4);
    doc.line(14, 24, 45, 24);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(45, 24, pageWidth - 14, 24);

    // ── Caja Superior Derecha: Comprobante y Estado ──
    doc.setFillColor(COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(pageWidth - 75, 9, 61, 20.5, 1.5, 1.5, 'FD');

    // Número de Comprobante en negro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text(order.invoiceNumber || 'ORD-SIN-NUM', pageWidth - 70, 15);

    const statusLabel =
      ORDER_STATUS_LABELS[order.status as OrderStatus] ||
      (order.status || '').toUpperCase();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(`Estado: ${statusLabel}`, pageWidth - 70, 20);

    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('es-PE');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(`Fecha: ${formattedDate}`, pageWidth - 70, 25);

    // ─── 2. Cajas de Información (Cliente vs. Modalidad y Destino) ───────────
    const startY = 31;
    const boxWidth = (pageWidth - 28 - 6) / 2; // 2 columnas iguales con 6mm de separación
    const boxHeight = 38;

    // ── COLUMNA A: Datos del Cliente ──
    doc.setFillColor(COLOR_BG_WHITE[0], COLOR_BG_WHITE[1], COLOR_BG_WHITE[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(14, startY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    // Título de Columna A (Negro bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('DATOS DEL CLIENTE', 18, startY + 6.5);

    // Subrayado de sección en negro
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.4);
    doc.line(18, startY + 8.5, 42, startY + 8.5);
    doc.setDrawColor(COLOR_BORDER_LIGHT[0], COLOR_BORDER_LIGHT[1], COLOR_BORDER_LIGHT[2]);
    doc.setLineWidth(0.2);
    doc.line(42, startY + 8.5, 14 + boxWidth - 4, startY + 8.5);

    // Datos del cliente: Etiquetas en gris medio vs Valores en negro
    doc.setFontSize(8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Nombre:', 18, startY + 14.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(client.name.substring(0, 36), 36, startY + 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('DNI / Doc:', 18, startY + 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(client.dni, 36, startY + 20);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Email:', 18, startY + 25.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(client.email.substring(0, 34), 36, startY + 25.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Teléfono:', 18, startY + 31);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(client.phone, 36, startY + 31);

    // ── COLUMNA B: Modalidad de Entrega y Destino ──
    const col2X = 14 + boxWidth + 6;

    // Reset explícito de colores de relleno y trazo para garantizar contraste total
    doc.setFillColor(COLOR_BG_WHITE[0], COLOR_BG_WHITE[1], COLOR_BG_WHITE[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(col2X, startY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    // Título de Columna B (Negro bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('MODALIDAD Y DESTINO', col2X + 4, startY + 6.5);

    // Subrayado de sección en negro
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.4);
    doc.line(col2X + 4, startY + 8.5, col2X + 38, startY + 8.5);
    doc.setDrawColor(COLOR_BORDER_LIGHT[0], COLOR_BORDER_LIGHT[1], COLOR_BORDER_LIGHT[2]);
    doc.setLineWidth(0.2);
    doc.line(col2X + 38, startY + 8.5, col2X + boxWidth - 4, startY + 8.5);

    doc.setFontSize(8);

    // Modalidad destacada en negrita negro
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Modalidad:', col2X + 4, startY + 14.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text(isPickup ? 'Retiro en Tienda Física' : 'Envío a Domicilio', col2X + 24, startY + 14.5);

    if (isPickup) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text('Sucursal:', col2X + 4, startY + 20);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
      const storeName = order.pickupStore?.name || 'Tienda Principal';
      doc.text(storeName.substring(0, 36), col2X + 24, startY + 20);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text('Dirección:', col2X + 4, startY + 25.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
      const storeAddr = order.pickupStore?.address || 'Lima, Perú';
      const truncatedAddr = storeAddr.length > 38 ? storeAddr.substring(0, 36) + '...' : storeAddr;
      doc.text(truncatedAddr, col2X + 24, startY + 25.5);

      if (order.pickupCode) {
        // Recuadro formal monocromático para el código de retiro (sin rosé)
        doc.setFillColor(COLOR_BG_TINT[0], COLOR_BG_TINT[1], COLOR_BG_TINT[2]);
        doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
        doc.roundedRect(col2X + 4, startY + 28.5, boxWidth - 8, 7, 1.2, 1.2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2]);
        doc.text('CÓDIGO DE RETIRO:', col2X + 7, startY + 33.2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
        doc.text(order.pickupCode, col2X + 42, startY + 33.2);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text('Dirección:', col2X + 4, startY + 20);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
      const addr = `${order.shippingAddress?.street || ''} ${order.shippingAddress?.streetNumber || ''}, ${order.shippingAddress?.district || ''}`;
      doc.text(addr.substring(0, 38), col2X + 24, startY + 20);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text('Ciudad/Dpto:', col2X + 4, startY + 25.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
      doc.text(`${order.shippingAddress?.province || 'Lima'}, ${order.shippingAddress?.department || 'Lima'}`, col2X + 24, startY + 25.5);

      if (order.shippingAddress?.references) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
        doc.text('Referencia:', col2X + 4, startY + 31);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
        doc.text(order.shippingAddress.references.substring(0, 36), col2X + 24, startY + 31);
      }
    }

    // ── Barra de Método de Pago y Estado de Transacción ──
    const paymentY = startY + boxHeight + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('MÉTODO DE PAGO:', 14, paymentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(`${this.getPaymentLabel(order.paymentMethod)}   ·   ESTADO DE PAGO:`, 44, paymentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('PAGADO CONFORME', 134, paymentY);

    // ─── 3. Tabla de Productos (Picking List) Monocromática ───────────────────
    const tableBody = (order.items || []).map((item, idx) => [
      idx + 1,
      `${item.productName}\nSKU: ${item.sku || '-'}`,
      `${this.extractColor(item.color)} / ${this.extractSize(item.size)}`,
      item.quantity,
      this.formatMoney(item.unitPrice),
      item.discount > 0 ? `-${item.discount}%` : '-',
      this.formatMoney(item.subtotal),
      '[   ]', // Casilla de verificación manual para almacén
    ]);

    const tableStartY = paymentY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('LISTA DE PRODUCTOS Y VERIFICACIÓN DE PICKING', 14, tableStartY - 1);

    // Subrayado fino en negro
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.4);
    doc.line(14, tableStartY + 0.5, 45, tableStartY + 0.5);

    autoTable(doc, {
      startY: tableStartY + 2,
      head: [
        [
          '#',
          'PRODUCTO / DESCRIPCIÓN',
          'COLOR / TALLA',
          'CANT.',
          'P. UNIT.',
          'DESC.',
          'SUBTOTAL',
          'CHECK',
        ],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]], // Negro puro elegante
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 32 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 16 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        valign: 'middle',
        overflow: 'linebreak',
        textColor: [COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]],
        lineColor: [COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]],
        lineWidth: 0.15,
      },
      alternateRowStyles: {
        fillColor: [COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]],
      },
      margin: { left: 14, right: 14 },
    });

    // ─── 4. Totales Financieros Monocromáticos ────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY + 4;
    const totalsBoxWidth = 75;
    const totalsBoxX = pageWidth - 14 - totalsBoxWidth;

    doc.setFillColor(COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(totalsBoxX, finalY, totalsBoxWidth, 28, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);

    doc.text('Subtotal:', totalsBoxX + 4, finalY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(this.formatMoney(order.pricing?.subtotalBeforeDiscount), pageWidth - 18, finalY + 6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Descuento:', totalsBoxX + 4, finalY + 11);
    const discountStr = order.pricing?.discount ? `-${this.formatMoney(order.pricing.discount)}` : 'S/ 0.00';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(discountStr, pageWidth - 18, finalY + 11, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Costo de Envío:', totalsBoxX + 4, finalY + 16);
    const shippingStr = order.pricing?.shippingCost ? this.formatMoney(order.pricing.shippingCost) : 'S/ 0.00';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(shippingStr, pageWidth - 18, finalY + 16, { align: 'right' });

    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.line(totalsBoxX + 4, finalY + 19, pageWidth - 18, finalY + 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]); // Negro sólido
    doc.text('TOTAL GENERAL:', totalsBoxX + 4, finalY + 25);
    doc.text(this.formatMoney(order.pricing?.total), pageWidth - 18, finalY + 25, { align: 'right' });

    // ─── 5. Recuadros de Firma y Conformidad (Blanco y Negro Alto Contraste) ──
    const signY = Math.max(finalY + 34, 235);
    const signBoxWidth = (pageWidth - 28 - 10) / 2;

    // Caja 1: Almacén / Preparador (Izquierda)
    doc.setFillColor(COLOR_BG_WHITE[0], COLOR_BG_WHITE[1], COLOR_BG_WHITE[2]); // Blanco puro explícito
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(14, signY, signBoxWidth, 24, 1.5, 1.5, 'FD');

    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.line(18, signY + 16, 14 + signBoxWidth - 4, signY + 16);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]); // Texto oscuro #0f172a
    doc.text('PREPARADO Y REVISADO POR (ALMACÉN)', 14 + signBoxWidth / 2, signY + 20, { align: 'center' });

    // Caja 2: Recibido Conforme (Derecha)
    const sign2X = 14 + signBoxWidth + 10;
    doc.setFillColor(COLOR_BG_WHITE[0], COLOR_BG_WHITE[1], COLOR_BG_WHITE[2]); // Blanco puro explícito garantizado
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(sign2X, signY, signBoxWidth, 24, 1.5, 1.5, 'FD');

    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.line(sign2X + 4, signY + 16, sign2X + signBoxWidth - 4, signY + 16);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]); // Texto oscuro #0f172a
    doc.text('RECIBIDO CONFORME (CLIENTE / COURIER)', sign2X + signBoxWidth / 2, signY + 20, { align: 'center' });

    // ─── 6. Pie de Página Institucional ──────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text(
        'Moorea Boutique E-Commerce · Documento interno de control logístico y entrega de mercancía.',
        14,
        290
      );
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, 290, {
        align: 'right',
      });
    }

    // Descargar archivo o abrir en pestaña
    const filename = `Reporte-Orden-${order.invoiceNumber || order._id}.pdf`;
    if (action === 'save') {
      doc.save(filename);
    } else {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. REPORTE GENERAL DE USUARIOS (Listo para el módulo de usuarios)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera reporte estructurado de usuarios/clientes con diagramación monocromática formal.
   * @param users Lista de usuarios a listar
   * @param title Título del reporte
   */
  generateUsersReport(users: any[], title: string = 'Reporte General de Usuarios'): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabecera negra formal
    doc.setFillColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('MOOREA BOUTIQUE', 14, 15);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(title.toUpperCase(), 14, 20);

    // Subrayado
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.4);
    doc.line(14, 22.5, 40, 22.5);

    const body = (users || []).map((u, i) => [
      i + 1,
      u.displayName || u.name || '-',
      u.email || '-',
      u.dni || u.documentNumber || '-',
      u.phone || '-',
      Array.isArray(u.roles) ? u.roles.join(', ') : u.role || 'customer',
      u.isActive !== false ? 'Activo' : 'Inactivo',
    ]);

    autoTable(doc, {
      startY: 26,
      head: [['#', 'NOMBRE', 'EMAIL', 'DNI', 'TELÉFONO', 'ROL', 'ESTADO']],
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]],
        lineColor: [COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]],
      },
      alternateRowStyles: { fillColor: [COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]] },
      margin: { left: 14, right: 14 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, 290, { align: 'right' });
    }

    doc.save(`Reporte-Usuarios-${Date.now()}.pdf`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. REPORTE GENÉRICO EN TABLA (Para cualquier otro módulo de Moorea)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generador genérico de reportes en tabla exportable a PDF con estilo monocromático formal.
   * @param title Título principal del reporte
   * @param subtitle Subtítulo descriptivo
   * @param headers Arreglo de encabezados de columnas
   * @param rows Arreglo de filas de datos
   * @param filenamePrefix Prefijo para el archivo generado
   */
  generateGenericTableReport(
    title: string,
    subtitle: string,
    headers: string[],
    rows: any[][],
    filenamePrefix: string = 'Reporte'
  ): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabecera corporativa
    doc.setFillColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('MOOREA BOUTIQUE', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(title.toUpperCase(), 14, 20);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(subtitle, 14, 24);

    // Subrayado
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.4);
    doc.line(14, 26, 40, 26);

    autoTable(doc, {
      startY: 29,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]],
        lineColor: [COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]],
      },
      alternateRowStyles: { fillColor: [COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]] },
      margin: { left: 14, right: 14 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, 290, { align: 'right' });
    }

    doc.save(`${filenamePrefix}-${Date.now()}.pdf`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. COMPROBANTE DE PAGO PARA EL CLIENTE: BOLETA O FACTURA ELECTRÓNICA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera el comprobante electrónico para el cliente (Boleta de Venta o Factura Electrónica)
   * disponible en formato hoja A4 membretada o Ticket térmico para punto de venta (80mm).
   *
   * @param order Datos completos de la orden
   * @param format 'a4' para hoja completa formal o 'ticket80' para ticket térmico de 80mm
   * @param action 'save' para descarga automática o 'open' para previsualizar en pestaña
   */
  async generateCustomerInvoice(
    order: Order,
    format: 'a4' | 'ticket80' = 'a4',
    action: 'save' | 'open' = 'save',
  ): Promise<void> {
    if (!order) return;

    if (format === 'ticket80') {
      await this.generateCustomerInvoiceTicket(order, action);
    } else {
      await this.generateCustomerInvoiceA4(order, action);
    }
  }

  /**
   * Genera la Boleta o Factura Electrónica en formato A4 membretado oficial de Moorea.
   */
  private async generateCustomerInvoiceA4(
    order: Order,
    action: 'save' | 'open',
  ): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const isFactura = order.billing?.invoiceType === 'factura';
    const docTitle = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const docTypeSunat = isFactura ? '01' : '03';

    // Serie y correlativo (Si tiene sunatCorrelative asignado por admin o el invoiceNumber)
    const serie = isFactura ? 'F001' : 'B001';
    const rawNumber = (order.invoiceNumber || '00000001').replace(/^ORD-\d{4}-/, '');
    const officialNumber = order.billing?.sunatCorrelative || `${serie}-${rawNumber.padStart(6, '0')}`;

    const client = this.getClientData(order);
    const docTypeLabel = isFactura ? 'R.U.C.' : 'D.N.I.';
    const docNumber =
      (isFactura ? order.billing?.documentNumber : order.billing?.documentNumber || client.dni) ||
      'No especificado';
    const clientName = isFactura
      ? order.billing?.businessName || client.name
      : order.billing?.customerName || client.name;
    const clientAddress = isFactura
      ? order.billing?.fiscalAddress || 'Sin dirección fiscal registrada'
      : order.shippingAddress
      ? `${order.shippingAddress.street} ${order.shippingAddress.streetNumber || ''}, ${order.shippingAddress.district}, ${order.shippingAddress.province}`
      : order.pickupStore
      ? `Retiro en Tienda: ${order.pickupStore.name}`
      : 'Lima, Perú';
    const clientPhone = order.billing?.customerPhone || client.phone;

    // ── 1. Franja Superior Negra ──
    doc.setFillColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // ── 2. Datos de la Empresa (Izquierda) ──
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('MOOREA', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('·   BOUTIQUE DE MODA FEMENINA', 60, 18);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2]);
    doc.text('MOOREA BOUTIQUE S.A.C.', 14, 24);
    doc.text('Av. Mariscal Castilla 2450, El Tambo, Huancayo - Junín', 14, 28);
    doc.text('WhatsApp: +51 935 329 158 · contacto@moorea.pe', 14, 32);

    // ── 3. Recuadro RUC y Tipo de Comprobante (Derecha - Estándar SUNAT) ──
    const rucBoxX = pageWidth - 80;
    const rucBoxY = 10;
    const rucBoxW = 66;
    const rucBoxH = 26;

    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(rucBoxX, rucBoxY, rucBoxW, rucBoxH, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.text('R.U.C. 20608945123', rucBoxX + rucBoxW / 2, rucBoxY + 7, { align: 'center' });

    doc.setFillColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.rect(rucBoxX, rucBoxY + 9.5, rucBoxW, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(docTitle, rucBoxX + rucBoxW / 2, rucBoxY + 14.5, { align: 'center' });

    doc.setTextColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setFontSize(11);
    doc.text(officialNumber, rucBoxX + rucBoxW / 2, rucBoxY + 22, { align: 'center' });

    // ── 4. Recuadro Datos del Cliente y Emisión ──
    const clientBoxY = 40;
    doc.setFillColor(COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(14, clientBoxY, pageWidth - 28, 26, 2, 2, 'FD');

    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('es-PE');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text(isFactura ? 'SEÑOR(ES) / RAZÓN SOCIAL:' : 'CLIENTE / TITULAR:', 18, clientBoxY + 6);
    doc.text(`${docTypeLabel}:`, 18, clientBoxY + 12);
    doc.text('DIRECCIÓN:', 18, clientBoxY + 18);
    doc.text('TELÉFONO / WHATSAPP:', 18, clientBoxY + 24);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(String(clientName).toUpperCase(), 64, clientBoxY + 6);
    doc.text(String(docNumber), 64, clientBoxY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2]);
    doc.text(String(clientAddress).substring(0, 60), 64, clientBoxY + 18);
    doc.text(String(clientPhone), 64, clientBoxY + 24);

    // Columna derecha del recuadro de cliente
    const colRightX = pageWidth - 70;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('FECHA DE EMISIÓN:', colRightX, clientBoxY + 6);
    doc.text('MONEDA:', colRightX, clientBoxY + 12);
    doc.text('MÉTODO DE PAGO:', colRightX, clientBoxY + 18);
    doc.text('PEDIDO N°:', colRightX, clientBoxY + 24);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(formattedDate, colRightX + 28, clientBoxY + 6);
    doc.text('SOLES (PEN)', colRightX + 28, clientBoxY + 12);

    doc.setFont('helvetica', 'normal');
    doc.text(this.getPaymentLabel(order.paymentMethod).substring(0, 22), colRightX + 28, clientBoxY + 18);
    doc.text(order.invoiceNumber || '-', colRightX + 28, clientBoxY + 24);

    // ── 5. Tabla de Ítems / Prendas ──
    const tableBody = (order.items || []).map((item, index) => {
      const color = this.extractColor(item.color);
      const size = this.extractSize(item.size);
      const desc = `${item.productName}\nColor: ${color}  ·  Talla: ${size}  ·  SKU: ${item.sku}`;
      const qty = item.quantity || 1;
      const unit = item.unitPrice || 0;
      const sub = item.subtotal || unit * qty;

      return [
        String(index + 1),
        String(qty),
        'UND',
        desc,
        this.formatMoney(unit),
        this.formatMoney(sub),
      ];
    });

    autoTable(doc, {
      startY: clientBoxY + 30,
      head: [['ITEM', 'CANT.', 'UNIDAD', 'DESCRIPCIÓN DE LA PRENDA', 'P. UNIT.', 'TOTAL']],
      body: tableBody,
      theme: 'plain',
      headStyles: {
        fillColor: [COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'left' },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        textColor: [COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]],
        lineColor: [COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]],
        lineWidth: 0.15,
      },
      alternateRowStyles: {
        fillColor: [COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]],
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 140;

    // ── 6. Desglose Fiscal y Totales ──
    const totalAmount = order.pricing?.total || 0;
    const shipping = order.pricing?.shippingCost || 0;
    const discount = order.pricing?.discount || 0;
    const itemsTotal = Math.max(0, totalAmount - shipping);
    const opGravada = itemsTotal / 1.18;
    const igv = itemsTotal - opGravada;

    const summaryBoxW = 76;
    const summaryBoxX = pageWidth - 14 - summaryBoxW;
    let currSumY = finalY + 6;

    // Recuadro de Totales
    doc.setFillColor(COLOR_BG_SUBTLE[0], COLOR_BG_SUBTLE[1], COLOR_BG_SUBTLE[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(summaryBoxX, currSumY, summaryBoxW, 36, 1.5, 1.5, 'FD');

    const printSumLine = (label: string, value: string, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(isBold ? 9 : 7.5);
      doc.setTextColor(isBold ? COLOR_BLACK[0] : COLOR_MUTED[0], isBold ? COLOR_BLACK[1] : COLOR_MUTED[1], isBold ? COLOR_BLACK[2] : COLOR_MUTED[2]);
      doc.text(label, summaryBoxX + 4, currSumY + 6);
      doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
      doc.text(value, summaryBoxX + summaryBoxW - 4, currSumY + 6, { align: 'right' });
      currSumY += 6;
    };

    printSumLine('Op. Gravada:', this.formatMoney(opGravada));
    printSumLine('I.G.V. (18%):', this.formatMoney(igv));
    if (discount > 0) {
      printSumLine('Descuentos:', `-${this.formatMoney(discount)}`);
    }
    printSumLine('Costo de Envío:', shipping === 0 ? 'GRATIS (S/ 0.00)' : this.formatMoney(shipping));

    // Línea divisoria antes del total
    doc.setDrawColor(COLOR_BLACK[0], COLOR_BLACK[1], COLOR_BLACK[2]);
    doc.setLineWidth(0.3);
    doc.line(summaryBoxX + 3, currSumY + 2, summaryBoxX + summaryBoxW - 3, currSumY + 2);
    currSumY += 3;

    printSumLine('TOTAL A PAGAR:', this.formatMoney(totalAmount), true);

    // ── 7. Importe en Letras y Código QR SUNAT ──
    const leftBlockY = finalY + 6;
    const textLetters = this.numberToWords(totalAmount);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(textLetters, 14, leftBlockY + 5);

    // Intentar generar y colocar QR tributario
    try {
      const QRCode = await import('qrcode');
      const qrData = `20608945123|${docTypeSunat}|${serie}|${rawNumber}|${igv.toFixed(2)}|${totalAmount.toFixed(2)}|${formattedDate}|${isFactura ? '6' : '1'}|${docNumber}|`;
      const qrUrl = await QRCode.toDataURL(qrData, { width: 140, margin: 1 });
      doc.addImage(qrUrl, 'PNG', 14, leftBlockY + 9, 28, 28);
    } catch {
      // Si la carga falla, continuar sin QR
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Representación impresa del Comprobante de Pago Electrónico.', 46, leftBlockY + 16);
    doc.text('Consulte la validez de este comprobante en www.sunat.gob.pe', 46, leftBlockY + 21);
    doc.text('Autorizado mediante Resolución de Superintendencia de SUNAT.', 46, leftBlockY + 26);

    // ── 8. Políticas de Cambio y Garantía (Pie de Página) ──
    const legalBoxY = Math.max(currSumY + 12, leftBlockY + 42);
    doc.setFillColor(COLOR_BG_TINT[0], COLOR_BG_TINT[1], COLOR_BG_TINT[2]);
    doc.setDrawColor(COLOR_BORDER[0], COLOR_BORDER[1], COLOR_BORDER[2]);
    doc.roundedRect(14, legalBoxY, pageWidth - 28, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text('TÉRMINOS PARA CAMBIOS, DEVOLUCIONES O REEMBOLSOS:', 18, legalBoxY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2]);
    doc.text(
      'Para solicitar un cambio o reembolso, conserve este comprobante. Plazo máximo: 7 días calendario posteriores a la entrega. Las prendas deben estar sin uso y con etiquetas originales intactas.',
      18,
      legalBoxY + 9
    );

    // Descargar o abrir
    const filename = `${docTitle.replace(/\s+/g, '-')}-${officialNumber}.pdf`;
    if (action === 'save') {
      doc.save(filename);
    } else {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    }
  }

  /**
   * Genera la Boleta o Factura en formato Ticket Térmico estándar de 80mm para punto de venta.
   */
  private async generateCustomerInvoiceTicket(
    order: Order,
    action: 'save' | 'open',
  ): Promise<void> {
    const isFactura = order.billing?.invoiceType === 'factura';
    const docTitle = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA';
    const docTypeSunat = isFactura ? '01' : '03';

    const serie = isFactura ? 'F001' : 'B001';
    const rawNumber = (order.invoiceNumber || '00000001').replace(/^ORD-\d{4}-/, '');
    const officialNumber = order.billing?.sunatCorrelative || `${serie}-${rawNumber.padStart(6, '0')}`;

    const client = this.getClientData(order);
    const docTypeLabel = isFactura ? 'RUC' : 'DNI';
    const docNumber =
      (isFactura ? order.billing?.documentNumber : order.billing?.documentNumber || client.dni) ||
      'No especificado';
    const clientName = isFactura
      ? order.billing?.businessName || client.name
      : order.billing?.customerName || client.name;

    const itemCount = (order.items || []).length;
    const pageHeight = Math.max(180, 110 + itemCount * 12);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, pageHeight],
    });

    const pageWidth = 80;
    let y = 8;

    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('MOOREA BOUTIQUE', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('MOOREA BOUTIQUE S.A.C.', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('R.U.C. 20608945123', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('Av. M. Castilla 2450, El Tambo, Huancayo', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('WhatsApp: +51 935 329 158', pageWidth / 2, y, { align: 'center' });
    y += 6;

    // Línea divisoria
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(150, 150, 150);
    doc.line(4, y, pageWidth - 4, y);
    y += 5;

    // Comprobante
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(docTitle, pageWidth / 2, y, { align: 'center' });
    y += 4.5;
    doc.setFontSize(11);
    doc.text(officialNumber, pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.line(4, y, pageWidth - 4, y);
    y += 4.5;

    // Datos cliente
    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleString('es-PE');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Fecha: ${formattedDate}`, 5, y);
    y += 4;
    doc.text(`Cliente: ${String(clientName).substring(0, 30).toUpperCase()}`, 5, y);
    y += 4;
    doc.text(`${docTypeLabel}: ${docNumber}`, 5, y);
    y += 4;
    doc.text(`Pago: ${this.getPaymentLabel(order.paymentMethod).substring(0, 26)}`, 5, y);
    y += 5;

    doc.line(4, y, pageWidth - 4, y);
    y += 4.5;

    // Cabecera Ítems
    doc.setFont('helvetica', 'bold');
    doc.text('CANT.  DESCRIPCIÓN', 5, y);
    doc.text('TOTAL', pageWidth - 5, y, { align: 'right' });
    y += 4;

    doc.setFont('helvetica', 'normal');
    for (const item of order.items || []) {
      const color = this.extractColor(item.color);
      const size = this.extractSize(item.size);
      const qty = item.quantity || 1;
      const sub = item.subtotal || (item.unitPrice || 0) * qty;

      doc.text(`${qty}x   ${item.productName.substring(0, 24)}`, 5, y);
      doc.text(this.formatMoney(sub), pageWidth - 5, y, { align: 'right' });
      y += 3.5;
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`     Talla: ${size} · Color: ${color}`, 5, y);
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      y += 4;
    }

    doc.line(4, y, pageWidth - 4, y);
    y += 4.5;

    // Totales
    const totalAmount = order.pricing?.total || 0;
    const shipping = order.pricing?.shippingCost || 0;
    const itemsTotal = Math.max(0, totalAmount - shipping);
    const opGravada = itemsTotal / 1.18;
    const igv = itemsTotal - opGravada;

    doc.text('Op. Gravada:', 5, y);
    doc.text(this.formatMoney(opGravada), pageWidth - 5, y, { align: 'right' });
    y += 4;
    doc.text('I.G.V. (18%):', 5, y);
    doc.text(this.formatMoney(igv), pageWidth - 5, y, { align: 'right' });
    y += 4;
    if (shipping > 0) {
      doc.text('Envío:', 5, y);
      doc.text(this.formatMoney(shipping), pageWidth - 5, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', 5, y);
    doc.text(this.formatMoney(totalAmount), pageWidth - 5, y, { align: 'right' });
    y += 6;

    // QR Code centrado
    try {
      const QRCode = await import('qrcode');
      const qrData = `20608945123|${docTypeSunat}|${serie}|${rawNumber}|${igv.toFixed(2)}|${totalAmount.toFixed(2)}|${formattedDate}|${isFactura ? '6' : '1'}|${docNumber}|`;
      const qrUrl = await QRCode.toDataURL(qrData, { width: 100, margin: 1 });
      doc.addImage(qrUrl, 'PNG', (pageWidth - 24) / 2, y, 24, 24);
      y += 26;
    } catch {
      // omit QR
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('¡Gracias por su compra en Moorea!', pageWidth / 2, y, { align: 'center' });
    y += 3.5;
    doc.text('Cambios válidos hasta 7 días con este ticket.', pageWidth / 2, y, { align: 'center' });

    const filename = `Ticket-${officialNumber}.pdf`;
    if (action === 'save') {
      doc.save(filename);
    } else {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    }
  }

  /**
   * Convierte un monto numérico a su representación formal en letras según estándar SUNAT
   * @param amount Monto numérico en soles
   * @returns Cadena formal ej: "SON: CIENTO CINCUENTA CON 00/100 SOLES"
   */
  private numberToWords(amount: number): string {
    const fixed = Math.max(0, amount).toFixed(2);
    const [intPartStr, decPartStr] = fixed.split('.');
    const intPart = parseInt(intPartStr, 10);
    const cents = decPartStr || '00';

    if (intPart === 0) {
      return `SON: CERO CON ${cents}/100 SOLES`;
    }

    const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    const convertThreeDigits = (n: number): string => {
      if (n === 0) return '';
      if (n === 100) return 'CIEN';
      const c = Math.floor(n / 100);
      const rem = n % 100;
      const d = Math.floor(rem / 10);
      const u = rem % 10;

      let result = '';
      if (c > 0) result += hundreds[c] + ' ';

      if (rem >= 10 && rem < 20) {
        result += teens[rem - 10] + ' ';
      } else if (rem >= 20 && rem < 30) {
        result += (u === 0 ? 'VEINTE' : `VEINTI${units[u]}`) + ' ';
      } else {
        if (d > 0) {
          result += tens[d] + (u > 0 ? ' Y ' : ' ');
        }
        if (u > 0) {
          result += units[u] + ' ';
        }
      }
      return result.trim();
    };

    let text = '';
    const millions = Math.floor(intPart / 1000000);
    const thousands = Math.floor((intPart % 1000000) / 1000);
    const remainder = intPart % 1000;

    if (millions > 0) {
      text += millions === 1 ? 'UN MILLON ' : `${convertThreeDigits(millions)} MILLONES `;
    }
    if (thousands > 0) {
      text += thousands === 1 ? 'MIL ' : `${convertThreeDigits(thousands)} MIL `;
    }
    if (remainder > 0 || text === '') {
      text += `${convertThreeDigits(remainder)} `;
    }

    return `SON: ${text.trim()} CON ${cents}/100 SOLES`;
  }
}
