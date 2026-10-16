import { SaleTicket } from '../types/pos';
import { formatCOP } from './format';

export interface PrintReceiptOptions {
  paperWidth?: '58mm' | '80mm';
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Generates the clean HTML markup of a 58mm (or 80mm) thermal receipt.
 */
export function generateThermalReceiptHtml(ticket: SaleTicket, paperWidth: '58mm' | '80mm' = '58mm'): string {
  const widthMm = paperWidth === '80mm' ? '80mm' : '58mm';
  const widthPx = paperWidth === '80mm' ? '320px' : '220px';
  const is80mm = paperWidth === '80mm';

  const itemsHtml = is80mm
    ? `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px;">
        <thead>
          <tr style="border-bottom: 1px solid #444; font-size: 10px; font-weight: bold;">
            <th style="text-align: left; padding: 2px 0; width: 12%;">CANT</th>
            <th style="text-align: left; padding: 2px 4px; width: 48%;">ARTÍCULO / DESCRIPCIÓN</th>
            <th style="text-align: right; padding: 2px 4px; width: 20%;">P. UNIT</th>
            <th style="text-align: right; padding: 2px 0; width: 20%;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${ticket.items
            .map(
              (item) => `
            <tr style="border-bottom: 1px dashed #ddd; vertical-align: top;">
              <td style="padding: 3px 0; font-weight: bold;">${item.quantity}</td>
              <td style="padding: 3px 4px;">
                <div style="font-weight: bold;">${escapeHtml(item.product.name)}</div>
                <div style="font-size: 9px; color: #555;">SKU: ${escapeHtml(item.product.sku || 'N/A')} • ${item.product.taxRate > 0 ? `IVA ${(item.product.taxRate * 100).toFixed(0)}%` : 'EXENTO'}</div>
              </td>
              <td style="padding: 3px 4px; text-align: right;">${formatCOP(item.product.price)}</td>
              <td style="padding: 3px 0; text-align: right; font-weight: bold;">${formatCOP(item.product.price * item.quantity)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
    : ticket.items
        .map(
          (item) => `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; font-size: 11px;">
        <div style="padding-right: 4px; max-width: 70%;">
          <div style="font-weight: bold;">${item.quantity}x ${escapeHtml(item.product.name)}</div>
          <div style="font-size: 9px; color: #555;">
            @ ${formatCOP(item.product.price)} ${item.product.taxRate > 0 ? `(IVA ${(item.product.taxRate * 100).toFixed(0)}%)` : '(EXENTO)'}
          </div>
        </div>
        <div style="font-weight: bold; white-space: nowrap;">
          ${formatCOP(item.product.price * item.quantity)}
        </div>
      </div>
    `
        )
        .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket ${ticket.ticketNumber}</title>
  <style>
    @page {
      size: ${widthMm} auto;
      margin: 0mm !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${widthMm};
      max-width: ${widthMm};
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
      font-size: ${is80mm ? '12px' : '11px'};
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      max-width: ${widthPx};
      margin: 0 auto;
      padding: ${is80mm ? '4px 6px 8px 6px' : '2px 4px 6px 4px'};
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      height: auto !important;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .dashed-border {
      border-bottom: 1px dashed #666666;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .flex-between {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="text-center dashed-border">
      <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px;">KEV NAY RETAIL HUB</div>
      <div style="font-size: 10px; font-weight: bold; margin-top: 1px;">BOUTIQUE & ACCESORIOS</div>
      <div style="font-size: 9px; margin-top: 2px;">NIT: 901.845.293-4 • RÉGIMEN COMÚN</div>
      <div style="font-size: 9px;">Cra. 15 # 85-32, Bogotá D.C.</div>
      <div style="font-size: 9px;">Tel: (+57) 314 892 0104</div>
      <div style="font-size: 9px; color: #444;">Res. DIAN #18764032 de 2026</div>
      <div style="font-size: 9px; font-weight: bold; margin-top: 2px; padding: 1px 3px; background: #eee; display: inline-block;">
        SISTEMA POS POS-01
      </div>
    </div>

    <!-- Metadata -->
    <div class="dashed-border" style="font-size: 10px;">
      <div class="flex-between">
        <span>FACTURA VENTA:</span>
        <span class="bold">${escapeHtml(ticket.ticketNumber)}</span>
      </div>
      <div class="flex-between">
        <span>FECHA / HORA:</span>
        <span>${escapeHtml(ticket.timestamp)}</span>
      </div>
      <div class="flex-between">
        <span>CAJERO:</span>
        <span class="bold">${escapeHtml(ticket.cashierName)}</span>
      </div>
      <div class="flex-between">
        <span>CLIENTE:</span>
        <span>${escapeHtml(ticket.customerName || 'Consumidor Final')}</span>
      </div>
    </div>

    <!-- Items Header & List -->
    <div class="dashed-border">
      <div class="flex-between bold" style="font-size: 10px; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
        <span>CANT / ARTÍCULO</span>
        <span>TOTAL</span>
      </div>
      ${itemsHtml}
    </div>

    <!-- Totals -->
    <div class="dashed-border" style="font-size: 10px;">
      <div class="flex-between">
        <span>SUBTOTAL BASE:</span>
        <span>${formatCOP(ticket.subtotal)}</span>
      </div>
      ${
        ticket.discountTotal > 0
          ? `<div class="flex-between" style="color: #c00;">
              <span>DESCUENTO:</span>
              <span>-${formatCOP(ticket.discountTotal)}</span>
            </div>`
          : ''
      }
      <div class="flex-between">
        <span>IVA TOTAL:</span>
        <span>${formatCOP(ticket.taxTotal)}</span>
      </div>
      <div class="flex-between" style="font-size: 12px; font-weight: 900; margin-top: 4px; padding-top: 3px; border-top: 1px solid #000;">
        <span>TOTAL PAGADO:</span>
        <span>${formatCOP(ticket.total)}</span>
      </div>
    </div>

    <!-- Payment info -->
    <div class="dashed-border" style="font-size: 10px;">
      <div class="flex-between">
        <span style="text-transform: uppercase;">FORMA DE PAGO:</span>
        <span class="bold" style="text-transform: uppercase;">${escapeHtml(ticket.paymentMethod)}</span>
      </div>
      ${
        ticket.paymentMethod === 'efectivo'
          ? `<div class="flex-between">
              <span>EFECTIVO RECIBIDO:</span>
              <span>${formatCOP(ticket.amountPaid)}</span>
            </div>
            <div class="flex-between bold">
              <span>CAMBIO / VUELTAS:</span>
              <span>${formatCOP(ticket.changeReturned)}</span>
            </div>`
          : ''
      }
    </div>

    <!-- Barcode & Footer -->
    <div class="text-center" style="margin-top: 6px;">
      <div style="font-weight: 900; letter-spacing: 2px; font-size: 12px; margin-bottom: 2px;">
        ||| | |||| | ||| |||| |
      </div>
      <div style="font-size: 8px; color: #555;">CUFE: e4a7-891b-602c-499f</div>
      <div style="font-size: 10px; font-weight: bold; margin-top: 4px;">¡GRACIAS POR SU COMPRA!</div>
      <div style="font-size: 8px; color: #777; margin-top: 2px;">Software Kev Nay POS Engine v4.3</div>
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Robust Direct Thermal Print (58mm or 80mm):
 * Uses an offscreen rendered iframe with non-zero dimensions and opacity: 0.01
 * so modern browser security engines do NOT block print().
 * Always triggers the real print dialog, with automatic fallback to window.print().
 */
export function printTicket58mm(ticket: SaleTicket, options?: PrintReceiptOptions): Promise<boolean> {
  return printThermalReceipt(ticket, options);
}

export function printThermalReceipt(ticket: SaleTicket, options?: PrintReceiptOptions): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const paperWidth = options?.paperWidth || '58mm';
      const receiptHtml = generateThermalReceiptHtml(ticket, paperWidth);

      // Create an offscreen rendered iframe with physical non-zero dimensions
      // NOTE: Modern browsers (Chrome, Edge, Safari, Firefox) silently discard print()
      // on elements with visibility:hidden or display:none or 0x0 dimensions.
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = paperWidth === '80mm' ? '450px' : '320px';
      iframe.style.height = '600px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.title = `Print Receipt ${ticket.ticketNumber}`;

      document.body.appendChild(iframe);

      let triggered = false;

      const finishAndClean = () => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        } catch {}
      };

      const executePrint = () => {
        if (triggered) return;
        triggered = true;
        try {
          const win = iframe.contentWindow;
          if (win) {
            win.focus();
            win.print();
            options?.onSuccess?.();
            resolve(true);
          } else {
            printViaDirectPortal(ticket, paperWidth);
            options?.onSuccess?.();
            resolve(true);
          }
        } catch (err) {
          console.warn('Iframe print error, falling back to clean portal print:', err);
          printViaDirectPortal(ticket, paperWidth);
          options?.onSuccess?.();
          resolve(true);
        } finally {
          setTimeout(finishAndClean, 3500);
        }
      };

      iframe.onload = () => {
        setTimeout(executePrint, 120);
      };

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(receiptHtml);
        iframeDoc.close();
        setTimeout(executePrint, 250);
      } else {
        iframe.srcdoc = receiptHtml;
      }
    } catch (err) {
      console.warn('Global print failed, attempting clean portal fallback:', err);
      printViaDirectPortal(ticket, options?.paperWidth || '58mm');
      options?.onSuccess?.();
      resolve(true);
    }
  });
}

/**
 * 1-Page Guaranteed Direct Portal Print:
 * Injects a temporary print portal attached directly to document.body,
 * hides the entire application (#root) from layout flow during print (display: none),
 * guaranteeing that exactly 1 single sheet prints with zero blank pages.
 */
export function printViaDirectPortal(ticket: SaleTicket, paperWidth: '58mm' | '80mm' = '58mm'): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let portal = document.getElementById('pos-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'pos-print-portal';
      document.body.appendChild(portal);
    }

    const is80mm = paperWidth === '80mm';
    const widthMm = is80mm ? '80mm' : '58mm';
    const fullHtml = generateThermalReceiptHtml(ticket, paperWidth);
    const bodyInner = fullHtml.includes('<body>')
      ? fullHtml.split('<body>')[1].split('</body>')[0]
      : fullHtml;

    portal.innerHTML = `
      <style>
        @page { size: ${widthMm} auto; margin: 0mm !important; }
        body.is-printing-ticket > *:not(#pos-print-portal) { display: none !important; height: 0 !important; overflow: hidden !important; }
        #pos-print-portal { display: block !important; width: ${widthMm} !important; max-width: ${widthMm} !important; margin: 0 auto !important; padding: 2mm 3mm !important; background: #ffffff !important; color: #000000 !important; }
        #pos-print-portal .receipt-container { width: 100% !important; margin: 0 auto !important; page-break-after: avoid !important; break-after: avoid !important; }
      </style>
      ${bodyInner}
    `;

    document.body.classList.add('is-printing-ticket');

    const cleanup = () => {
      document.body.classList.remove('is-printing-ticket');
      try {
        if (portal && portal.parentNode) {
          portal.parentNode.removeChild(portal);
        }
      } catch {}
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.warn('Window print error:', e);
      } finally {
        setTimeout(cleanup, 2500);
      }
    }, 80);
  } catch (err) {
    console.warn('printViaDirectPortal failed:', err);
  }
}

export interface ReportXData {
  cashierName: string;
  cashierCode: string;
  terminalId?: string;
  currentDate?: string;
  currentTime?: string;
  ticketsCount: number;
  initialBase: number;
  cashSales: number;
  cardSales: number;
  qrSales: number;
  electronicSales: number;
  totalSales: number;
  avgTicketValue: number;
  expectedCashInDrawer: number;
  countedCash: number;
  difference: number;
  denominations?: { label: string; count: number; subtotal: number }[];
  hourlySummary?: { hour: string; total: number; count: number }[];
}

/**
 * Generates the clean HTML markup of a 58mm Reporte X (partial cash audit) thermal receipt.
 */
export function generateReportXThermalHtml(data: ReportXData, paperWidth: '58mm' | '80mm' = '58mm'): string {
  const widthMm = paperWidth === '80mm' ? '80mm' : '58mm';
  const widthPx = paperWidth === '80mm' ? '300px' : '220px';

  const now = new Date();
  const dateStr = data.currentDate || now.toLocaleDateString('es-CO');
  const timeStr = data.currentTime || now.toLocaleTimeString('es-CO');

  const activeDenoms = (data.denominations || []).filter((d) => d.count > 0);
  const denomsHtml =
    activeDenoms.length > 0
      ? activeDenoms
          .map(
            (d) => `
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
          <span>${escapeHtml(d.label)} (${d.count}x):</span>
          <span style="font-weight: bold;">${formatCOP(d.subtotal)}</span>
        </div>
      `
          )
          .join('')
      : `<div style="font-size: 10px; color: #666; font-style: italic;">Sin conteo físico registrado ($0)</div>`;

  const activeHourly = (data.hourlySummary || []).filter((h) => h.total > 0 || h.count > 0);
  const hourlyHtml =
    activeHourly.length > 0
      ? `
      <div style="border-bottom: 1px dashed #666666; padding-bottom: 6px; margin-bottom: 6px; font-size: 10px;">
        <div style="font-weight: bold; margin-bottom: 3px;">DESGLOSE POR HORAS (VENTAS):</div>
        ${activeHourly
          .map(
            (h) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
            <span>${escapeHtml(h.hour)} (${h.count} tkts):</span>
            <span style="font-weight: bold;">${formatCOP(h.total)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  let diffText = '$0 (CUADRADO)';
  let diffColor = '#000000';
  if (data.difference < 0) {
    diffText = `-${formatCOP(Math.abs(data.difference))} (FALTANTE)`;
    diffColor = '#cc0000';
  } else if (data.difference > 0) {
    diffText = `+${formatCOP(data.difference)} (SOBRANTE)`;
    diffColor = '#008800';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reporte X - ${escapeHtml(data.cashierName)}</title>
  <style>
    @page {
      size: ${widthMm} auto;
      margin: 0mm !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${widthMm};
      max-width: ${widthMm};
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      max-width: ${widthPx};
      margin: 0 auto;
      padding: 4px 6px 8px 6px;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      height: auto !important;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .dashed-border {
      border-bottom: 1px dashed #666666;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .flex-between {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="text-center dashed-border">
      <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px;">KEV NAY RETAIL POS</div>
      <div style="font-size: 10px; font-weight: bold; margin-top: 1px;">BOUTIQUE & ACCESORIOS</div>
      <div style="font-size: 9px; margin-top: 2px;">NIT: 901.845.293-4 • RÉGIMEN COMÚN</div>
      <div style="font-size: 9px;">Cra. 15 # 85-32, Bogotá D.C.</div>
      <div style="font-size: 9px;">Tel: (+57) 314 892 0104</div>
      <div style="font-size: 12px; font-weight: 900; margin-top: 5px; padding: 2px 4px; background: #eee; display: inline-block;">
        *** INFORME PARCIAL X (58mm) ***
      </div>
      <div style="font-size: 9px; font-weight: bold; margin-top: 2px; color: #333;">
        ARQUEO DE CAJA EN VIVO (TURNO ACTIVO)
      </div>
    </div>

    <!-- Metadata -->
    <div class="dashed-border" style="font-size: 10px;">
      <div class="flex-between">
        <span>TERMINAL:</span>
        <span class="bold">${escapeHtml(data.terminalId || 'POS-01 (KNY-BOG-01)')}</span>
      </div>
      <div class="flex-between">
        <span>FECHA / HORA:</span>
        <span>${dateStr} ${timeStr}</span>
      </div>
      <div class="flex-between">
        <span>CAJERO:</span>
        <span class="bold">${escapeHtml(data.cashierName)} (${escapeHtml(data.cashierCode)})</span>
      </div>
      <div class="flex-between">
        <span>ESTADO TURNO:</span>
        <span class="bold" style="color: #0078b2;">ACTIVO / EN OPERACIÓN</span>
      </div>
      <div class="flex-between">
        <span>TRANSACCIONES:</span>
        <span class="bold">${data.ticketsCount} tickets emitidos</span>
      </div>
    </div>

    <!-- Sales Breakdown by Payment Method -->
    <div class="dashed-border" style="font-size: 10px;">
      <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
        RESUMEN DE VENTAS POR MEDIO DE PAGO:
      </div>
      <div class="flex-between">
        <span>(+) Efectivo:</span>
        <span class="bold">${formatCOP(data.cashSales)}</span>
      </div>
      <div class="flex-between">
        <span>(+) Tarjeta / Datáfono:</span>
        <span class="bold">${formatCOP(data.cardSales)}</span>
      </div>
      <div class="flex-between">
        <span>(+) QR / Nequi / Davi:</span>
        <span class="bold">${formatCOP(data.qrSales)}</span>
      </div>
      <div class="flex-between" style="font-size: 11px; font-weight: 900; margin-top: 3px; padding-top: 3px; border-top: 1px solid #000;">
        <span>TOTAL VENTAS:</span>
        <span>${formatCOP(data.totalSales)}</span>
      </div>
      <div class="flex-between" style="font-size: 9px; color: #555; margin-top: 2px;">
        <span>Ticket Promedio:</span>
        <span>${formatCOP(data.avgTicketValue)}</span>
      </div>
    </div>

    <!-- Cash Drawer Audit -->
    <div class="dashed-border" style="font-size: 10px;">
      <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
        ARQUEO Y CUADRE DE GAVETA:
      </div>
      <div class="flex-between">
        <span>Base Apertura Caja:</span>
        <span>${formatCOP(data.initialBase)}</span>
      </div>
      <div class="flex-between">
        <span>(+) Ventas en Efectivo:</span>
        <span>${formatCOP(data.cashSales)}</span>
      </div>
      <div class="flex-between" style="font-weight: bold; padding-top: 2px; border-top: 1px dashed #ddd;">
        <span>(=) Efectivo Esperado:</span>
        <span>${formatCOP(data.expectedCashInDrawer)}</span>
      </div>
      <div class="flex-between" style="font-weight: bold; margin-top: 2px;">
        <span>(✓) Efectivo Contado Físico:</span>
        <span>${formatCOP(data.countedCash)}</span>
      </div>
      <div class="flex-between" style="font-size: 11px; font-weight: 900; margin-top: 3px; padding-top: 3px; border-top: 1px solid #000; color: ${diffColor};">
        <span>DIFERENCIA:</span>
        <span>${diffText}</span>
      </div>
    </div>

    <!-- Denominations Breakdown -->
    <div class="dashed-border" style="font-size: 10px;">
      <div style="font-weight: bold; margin-bottom: 4px;">CONTEO DE DENOMINACIONES:</div>
      ${denomsHtml}
    </div>

    <!-- Hourly Summary (if any) -->
    ${hourlyHtml}

    <!-- Signatures & Disclaimer -->
    <div style="margin-top: 10px; font-size: 9px; text-align: center;">
      <div style="margin-bottom: 12px; padding-top: 14px; border-top: 1px solid #666;">
        <div>FIRMA DEL CAJERO: ${escapeHtml(data.cashierName)}</div>
        <div style="color: #666; font-size: 8px;">C.C. ___________________</div>
      </div>
      <div style="margin-bottom: 10px; padding-top: 14px; border-top: 1px solid #666;">
        <div>FIRMA SUPERVISOR / AUDITOR</div>
        <div style="color: #666; font-size: 8px;">Revisado y Verificado</div>
      </div>
      <div style="font-weight: bold; text-transform: uppercase; margin-top: 4px;">
        *** DOCUMENTO DE CONTROL INTERNO ***
      </div>
      <div style="color: #555; font-size: 8px;">
        No reemplaza la factura legal de venta ni el Cierre Z fiscal.
      </div>
      <div style="color: #777; font-size: 8px; margin-top: 3px;">
        Software Kev Nay POS Engine v4.2.1-prod
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Robust 58mm Thermal Print for Reporte X (Partial Cash Drawer Audit).
 */
export function printReportX58mm(data: ReportXData, options?: PrintReceiptOptions): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const paperWidth = options?.paperWidth || '58mm';
      const receiptHtml = generateReportXThermalHtml(data, paperWidth);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = paperWidth === '80mm' ? '450px' : '320px';
      iframe.style.height = '600px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.title = `Print Reporte X ${data.cashierCode}`;

      document.body.appendChild(iframe);

      let printed = false;

      const finishAndClean = () => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        } catch {}
      };

      const doPrint = () => {
        if (printed) return;
        printed = true;
        try {
          const win = iframe.contentWindow;
          if (win) {
            win.focus();
            win.print();
            options?.onSuccess?.();
            resolve(true);
          } else {
            printReportXViaPortal(data, paperWidth);
            options?.onSuccess?.();
            resolve(true);
          }
        } catch (err) {
          console.warn('Iframe Reporte X print blocked, falling back to direct portal:', err);
          printReportXViaPortal(data, paperWidth);
          options?.onSuccess?.();
          resolve(true);
        } finally {
          setTimeout(finishAndClean, 3500);
        }
      };

      iframe.onload = () => {
        setTimeout(doPrint, 120);
      };

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(receiptHtml);
        iframeDoc.close();
        setTimeout(doPrint, 250);
      } else {
        iframe.srcdoc = receiptHtml;
      }
    } catch (err) {
      console.warn('Global Reporte X print failed, attempting portal fallback:', err);
      printReportXViaPortal(data, options?.paperWidth || '58mm');
      options?.onSuccess?.();
      resolve(true);
    }
  });
}

export function printReportXViaPortal(data: ReportXData, paperWidth: '58mm' | '80mm' = '58mm'): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let portal = document.getElementById('pos-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'pos-print-portal';
      document.body.appendChild(portal);
    }

    const is80mm = paperWidth === '80mm';
    const widthMm = is80mm ? '80mm' : '58mm';
    const fullHtml = generateReportXThermalHtml(data, paperWidth);
    const bodyInner = fullHtml.includes('<body>')
      ? fullHtml.split('<body>')[1].split('</body>')[0]
      : fullHtml;

    portal.innerHTML = `
      <style>
        @page { size: ${widthMm} auto; margin: 0mm !important; }
        body.is-printing-ticket > *:not(#pos-print-portal) { display: none !important; height: 0 !important; overflow: hidden !important; }
        #pos-print-portal { display: block !important; width: ${widthMm} !important; max-width: ${widthMm} !important; margin: 0 auto !important; padding: 2mm 3mm !important; background: #ffffff !important; color: #000000 !important; }
        #pos-print-portal .receipt-container { width: 100% !important; margin: 0 auto !important; page-break-after: avoid !important; break-after: avoid !important; }
      </style>
      ${bodyInner}
    `;

    document.body.classList.add('is-printing-ticket');

    const cleanup = () => {
      document.body.classList.remove('is-printing-ticket');
      try {
        if (portal && portal.parentNode) {
          portal.parentNode.removeChild(portal);
        }
      } catch {}
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.warn('Window print error in Reporte X:', e);
      } finally {
        setTimeout(cleanup, 2500);
      }
    }, 80);
  } catch (err) {
    console.warn('printReportXViaPortal failed:', err);
  }
}
