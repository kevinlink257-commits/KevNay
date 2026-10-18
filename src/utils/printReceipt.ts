import { SaleTicket, PosPaperFormat } from '../types/pos';
import { formatCOP } from './format';

export type { PosPaperFormat };

export interface PrintReceiptOptions {
  paperWidth?: PosPaperFormat;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Reads persistent paper format from localStorage, defaulting to '58mm'.
 * Supports '80mm', '58mm', and '57mm'.
 */
export function getStoredPaperFormat(): PosPaperFormat {
  try {
    const saved = localStorage.getItem('pos_paper_format');
    if (saved === '80mm' || saved === '58mm' || saved === '57mm') {
      return saved;
    }
  } catch {}
  return '58mm';
}

/**
 * Saves persistent paper format to localStorage and dispatches a change event.
 */
export function setStoredPaperFormat(format: PosPaperFormat): void {
  try {
    localStorage.setItem('pos_paper_format', format);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_paper_format_changed', { detail: { format } }));
    }
  } catch {}
}

/**
 * Generates clean HTML markup for 80mm, 58mm or 57mm thermal receipts.
 */
export function generateThermalReceiptHtml(ticket: SaleTicket, paperWidth?: PosPaperFormat): string {
  const format: PosPaperFormat = paperWidth || getStoredPaperFormat();
  const widthMm = format;
  const is80mm = format === '80mm';
  const is57mm = format === '57mm';
  const widthPx = is80mm ? '320px' : is57mm ? '216px' : '220px';
  const baseFontSize = is80mm ? '12px' : is57mm ? '10.5px' : '11px';

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
    : is57mm
    ? ticket.items
        .map(
          (item) => `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; font-size: 10px; line-height: 1.2;">
        <div style="padding-right: 3px; max-width: 68%;">
          <div style="font-weight: bold; word-break: break-word;">${item.quantity}x ${escapeHtml(item.product.name)}</div>
          <div style="font-size: 8px; color: #555;">
            @ ${formatCOP(item.product.price)} ${item.product.taxRate > 0 ? `(IVA ${(item.product.taxRate * 100).toFixed(0)}%)` : '(EXENTO)'}
          </div>
        </div>
        <div style="font-weight: bold; white-space: nowrap; font-size: 10px;">
          ${formatCOP(item.product.price * item.quantity)}
        </div>
      </div>
    `
        )
        .join('')
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
      size: auto;
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
      font-size: ${baseFontSize};
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      max-width: ${widthPx};
      margin: 0 auto;
      padding: ${is80mm ? '4px 6px 8px 6px' : is57mm ? '1mm 1.5mm 3mm 1.5mm' : '2px 4px 6px 4px'};
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-before: avoid !important;
      break-before: avoid !important;
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
      <div style="font-size: 8.5px; font-weight: bold; margin-top: 2px; padding: 1px 4px; background: #eee; border: 1px solid #ccc; display: inline-block;">
        SISTEMA POS • ${widthMm}
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
      <div style="font-size: 8px; color: #777; margin-top: 2px;">Software Kev Nay POS Engine v4.3 • Formato ${widthMm}</div>
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
 * 1-Page Guaranteed POS Print Engine:
 * Injects a temporary print portal (#pos-print-portal) directly to document.body.
 * In @media print, strictly hides the entire application (#root, all modals, overlays)
 * from layout flow with display:none !important, guaranteeing that EXACTLY 1 single sheet
 * prints with ZERO blank pages and perfectly matches 80mm, 58mm, or 57mm roll width.
 */
function executePortalPrint(
  fullHtml: string,
  paperWidth?: PosPaperFormat,
  onDone?: () => void
): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      onDone?.();
      return;
    }

    // Clean up any existing portal
    const existing = document.getElementById('pos-print-portal');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const format: PosPaperFormat = paperWidth || getStoredPaperFormat();
    const is80mm = format === '80mm';
    const is57mm = format === '57mm';
    const widthMm = format;
    const widthPx = is80mm ? '320px' : is57mm ? '216px' : '220px';
    const baseFontSize = is80mm ? '12px' : is57mm ? '10.5px' : '11px';

    const portal = document.createElement('div');
    portal.id = 'pos-print-portal';
    portal.setAttribute('data-paper-format', format);
    portal.className = `pos-ticket-portal pos-portal-${format} pos-width-${format} paper-format-${format} receipt-container-${format}`;

    const innerBody = fullHtml.includes('<body>')
      ? fullHtml.split('<body>')[1].split('</body>')[0]
      : fullHtml;

    portal.innerHTML = `
      <style>
        @page {
          size: auto;
          margin: 0mm !important;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body.is-printing-ticket > *:not(#pos-print-portal),
          body:has(#pos-print-portal) > *:not(#pos-print-portal) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            top: -99999px !important;
            left: -99999px !important;
          }
          #pos-print-portal {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: ${widthMm} !important;
            max-width: ${widthMm} !important;
            margin: 0 auto !important;
            padding: ${is80mm ? '2mm 3mm' : is57mm ? '0.5mm 1mm 2mm 1mm' : '1mm 2mm 3mm 2mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace !important;
            font-size: ${baseFontSize} !important;
            line-height: 1.25 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: auto !important;
            overflow: visible !important;
          }
          #pos-print-portal .receipt-container {
            width: 100% !important;
            max-width: ${widthPx} !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: auto !important;
          }
          #pos-print-portal * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #pos-print-portal .text-center { text-align: center !important; }
          #pos-print-portal .text-right { text-align: right !important; }
          #pos-print-portal .bold { font-weight: bold !important; }
          #pos-print-portal .dashed-border {
            border-bottom: 1px dashed #666666 !important;
            padding-bottom: 5px !important;
            margin-bottom: 5px !important;
          }
          #pos-print-portal .flex-between {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin-bottom: 2px !important;
          }
        }
      </style>
      ${innerBody}
    `;

    document.body.appendChild(portal);
    document.body.classList.add(
      'is-printing-ticket',
      `is-printing-${format}`,
      `pos-width-${format}`,
      `paper-format-${format}`
    );
    document.documentElement.classList.add(
      'is-printing-ticket',
      `is-printing-${format}`,
      `pos-width-${format}`,
      `paper-format-${format}`
    );

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove(
        'is-printing-ticket',
        'is-printing-80mm',
        'is-printing-58mm',
        'is-printing-57mm',
        'pos-width-80mm',
        'pos-width-58mm',
        'pos-width-57mm',
        'paper-format-80mm',
        'paper-format-58mm',
        'paper-format-57mm'
      );
      document.documentElement.classList.remove(
        'is-printing-ticket',
        'is-printing-80mm',
        'is-printing-58mm',
        'is-printing-57mm',
        'pos-width-80mm',
        'pos-width-58mm',
        'pos-width-57mm',
        'paper-format-80mm',
        'paper-format-58mm',
        'paper-format-57mm'
      );
      try {
        if (portal && portal.parentNode) {
          portal.parentNode.removeChild(portal);
        }
      } catch {}
      window.removeEventListener('afterprint', cleanup);
      onDone?.();
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn('Window print error:', err);
      } finally {
        setTimeout(cleanup, 2500);
      }
    }, 70);
  } catch (err) {
    console.warn('executePortalPrint exception:', err);
    onDone?.();
  }
}

/**
 * Creates a standard sample test ticket for calibrating POS thermal printers
 * across 80mm, 58mm, or 57mm roll sizes.
 */
export function createSampleTestTicket(paperWidth?: PosPaperFormat): SaleTicket {
  const format: PosPaperFormat = paperWidth || getStoredPaperFormat();
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return {
    id: `test-${Date.now()}`,
    ticketNumber: `#TEST-${format.toUpperCase()}`,
    timestamp: `Hoy, ${hours}:${minutes}:${seconds} COT`,
    date: now.toISOString().split('T')[0],
    cashierId: 'c-admin',
    cashierName: 'Administrador POS',
    customerName: 'Prueba Calibración Impresora',
    customerDoc: '901.845.293-4',
    items: [
      {
        product: {
          id: 'p-test-1',
          name: `Prueba Rollo Térmico ${format}`,
          category: 'Configuración Sistema',
          price: 25000,
          costPrice: 12000,
          stock: 99,
          minStock: 5,
          sku: `ROLLO-${format}`,
          barcode: '7701234567890',
          taxRate: 0.19,
        },
        quantity: 1,
        discountPercent: 0,
      },
      {
        product: {
          id: 'p-test-2',
          name: 'Calibración Ancho de Página',
          category: 'Accesorios & Joyería',
          price: 15000,
          costPrice: 8000,
          stock: 50,
          minStock: 6,
          sku: 'CALIB-POS-01',
          barcode: '7709876543210',
          taxRate: 0.19,
        },
        quantity: 2,
        discountPercent: 0,
      },
    ],
    subtotal: 46218,
    taxTotal: 8782,
    discountTotal: 0,
    total: 55000,
    paymentMethod: 'efectivo',
    amountPaid: 60000,
    changeReturned: 5000,
    status: 'completada',
  };
}

/**
 * Fires a calibrated test ticket print matching the requested format (or stored default).
 */
export function printTestTicket(format?: PosPaperFormat, options?: PrintReceiptOptions): Promise<boolean> {
  const targetFmt = format || getStoredPaperFormat();
  const testTicket = createSampleTestTicket(targetFmt);
  return printThermalReceipt(testTicket, {
    paperWidth: targetFmt,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Robust Direct Thermal Print (80mm, 58mm, or 57mm):
 * Uses clean isolated portal printing directly in the DOM,
 * guaranteeing exactly 1 single sheet prints with zero blank pages.
 */
export function printTicket58mm(ticket: SaleTicket, options?: PrintReceiptOptions): Promise<boolean> {
  return printThermalReceipt(ticket, options);
}

export function printThermalReceipt(ticket: SaleTicket, options?: PrintReceiptOptions): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const paperWidth: PosPaperFormat = options?.paperWidth || getStoredPaperFormat();
      const receiptHtml = generateThermalReceiptHtml(ticket, paperWidth);
      executePortalPrint(receiptHtml, paperWidth, () => {
        options?.onSuccess?.();
        resolve(true);
      });
    } catch (err) {
      console.warn('printThermalReceipt failed:', err);
      options?.onError?.(err as Error);
      resolve(false);
    }
  });
}

/**
 * 1-Page Guaranteed Direct Portal Print:
 * Injects a temporary print portal attached directly to document.body,
 * hides the entire application (#root) from layout flow during print (display: none),
 * guaranteeing that exactly 1 single sheet prints with zero blank pages.
 */
export function printViaDirectPortal(
  ticket: SaleTicket,
  paperWidth?: PosPaperFormat,
  onDone?: () => void
): void {
  const format: PosPaperFormat = paperWidth || getStoredPaperFormat();
  const fullHtml = generateThermalReceiptHtml(ticket, format);
  executePortalPrint(fullHtml, format, onDone);
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
 * Generates the clean HTML markup of a Reporte X (80mm, 58mm, or 57mm) thermal receipt.
 */
export function generateReportXThermalHtml(data: ReportXData, paperWidth?: PosPaperFormat): string {
  const format: PosPaperFormat = paperWidth || getStoredPaperFormat();
  const is80mm = format === '80mm';
  const is57mm = format === '57mm';
  const widthMm = format;
  const widthPx = is80mm ? '300px' : is57mm ? '216px' : '220px';
  const baseFontSize = is80mm ? '12px' : is57mm ? '10px' : '10.5px';

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
      size: auto;
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
      font-size: ${baseFontSize};
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      max-width: ${widthPx};
      margin: 0 auto;
      padding: ${is80mm ? '4px 6px 8px 6px' : is57mm ? '1mm 1.5mm 3mm 1.5mm' : '2px 4px 6px 4px'};
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-before: avoid !important;
      break-before: avoid !important;
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
      <div style="font-size: 11px; font-weight: 900; margin-top: 4px; padding: 2px 4px; background: #eee; border: 1px solid #ccc; display: inline-block;">
        *** INFORME PARCIAL X (${widthMm}) ***
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
 * Robust Thermal Print for Reporte X (Partial Cash Drawer Audit) in 80mm, 58mm, or 57mm.
 * Guarantees exactly 1 single sheet prints with zero blank trailing pages.
 */
export function printReportX58mm(data: ReportXData, options?: PrintReceiptOptions): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const paperWidth: PosPaperFormat = options?.paperWidth || getStoredPaperFormat();
      const receiptHtml = generateReportXThermalHtml(data, paperWidth);
      executePortalPrint(receiptHtml, paperWidth, () => {
        options?.onSuccess?.();
        resolve(true);
      });
    } catch (err) {
      console.warn('printReportX58mm failed:', err);
      options?.onError?.(err as Error);
      resolve(false);
    }
  });
}

export function printReportXViaPortal(
  data: ReportXData,
  paperWidth?: PosPaperFormat,
  onDone?: () => void
): void {
  const format: PosPaperFormat = paperWidth || getStoredPaperFormat();
  const fullHtml = generateReportXThermalHtml(data, format);
  executePortalPrint(fullHtml, format, onDone);
}
