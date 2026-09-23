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
}
