import React, { useRef, useState } from 'react';
import { SaleTicket } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { printThermalReceipt } from '../utils/printReceipt';

interface ThermalReceiptProps {
  ticket: SaleTicket;
  onClose: () => void;
  onPrint?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ ticket, onClose, onPrint }) => {
  const printableRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Persistent Paper Format state (58mm vs 80mm)
  const [paperFormat, setPaperFormat] = useState<'58mm' | '80mm'>(() => {
    try {
      const saved = localStorage.getItem('pos_paper_format');
      return saved === '80mm' ? '80mm' : '58mm';
    } catch {
      return '58mm';
    }
  });

  const handleSelectPaperFormat = (fmt: '58mm' | '80mm') => {
    posAudio.playKeyClick();
    setPaperFormat(fmt);
    try {
      localStorage.setItem('pos_paper_format', fmt);
    } catch {}
    setPrintStatus(`Formato cambiado a papel térmico de ${fmt}`);
    setTimeout(() => setPrintStatus(null), 2500);
  };

  /**
   * Real Hardware / Browser Printing:
   * Invokes window.print() directly with dedicated @media print CSS injection,
   * guaranteeing that the native browser print dialog opens without being silenced by browser security.
   */
  const handlePrint = () => {
    setIsPrinting(true);
    setPrintStatus(`Abriendo diálogo de impresión térmica (${paperFormat})...`);
    posAudio.playKeyClick();

    if (onPrint) {
      try {
        onPrint();
      } catch (err) {
        console.warn('External onPrint error:', err);
      }
    }

    // Direct invocation of browser print API
    setTimeout(() => {
      try {
        window.print();
        posAudio.playCashRegisterChime();
        setPrintStatus(`✓ Ticket enviado a la cola de impresión (${paperFormat})`);
      } catch (err) {
        console.warn('Direct window.print() failed, trying offscreen iframe engine:', err);
        printThermalReceipt(ticket, {
          paperWidth: paperFormat,
          onSuccess: () => {
            posAudio.playCashRegisterChime();
            setPrintStatus(`✓ Ticket enviado a impresora térmica (${paperFormat})`);
          },
        });
      } finally {
        setIsPrinting(false);
        setTimeout(() => setPrintStatus(null), 4500);
      }
    }, 150);
  };

  const handleCopyText = () => {
    try {
      posAudio.playKeyClick();
      const lines = [
        '=== KEV NAY RETAIL HUB ===',
        'NIT: 901.845.293-4 • RÉGIMEN COMÚN',
        'Cra. 15 # 85-32, Bogotá D.C.',
        `Factura: ${ticket.ticketNumber}`,
        `Fecha: ${ticket.timestamp}`,
        `Cajero: ${ticket.cashierName}`,
        `Cliente: ${ticket.customerName || 'Consumidor Final'}`,
        `Formato: ${paperFormat}`,
        '--------------------------',
        ...ticket.items.map(
          (i) => `${i.quantity}x ${i.product.name} = ${formatCOP(i.product.price * i.quantity)}`
        ),
        '--------------------------',
        `Subtotal: ${formatCOP(ticket.subtotal)}`,
        `IVA: ${formatCOP(ticket.taxTotal)}`,
        `TOTAL: ${formatCOP(ticket.total)}`,
        `Pago (${ticket.paymentMethod}): ${formatCOP(ticket.amountPaid)}`,
        `Cambio: ${formatCOP(ticket.changeReturned)}`,
        '==========================',
      ];
      navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const is80mm = paperFormat === '80mm';

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      {/* Real print stylesheet targeting ONLY #thermal-receipt-printable with the exact width */}
      <style>{`
        @media print {
          @page {
            size: ${is80mm ? '80mm' : '58mm'} auto;
            margin: 0mm !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-printable, #thermal-receipt-printable * {
            visibility: visible !important;
          }
          #thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is80mm ? '80mm' : '58mm'} !important;
            max-width: ${is80mm ? '80mm' : '58mm'} !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: ${is80mm ? '12px' : '11px'} !important;
          }
        }
      `}</style>

      <div
        className={`bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-4 w-full flex flex-col space-y-3.5 shadow-2xl text-[#dce2f7] transition-all duration-300 ${
          is80mm ? 'max-w-md sm:max-w-lg' : 'max-w-sm'
        }`}
      >
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 text-[#10b981] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">receipt_long</span>
            </div>
            <div>
              <span className="text-sm font-bold text-[#dce2f7] block leading-tight">Comprobante POS</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#e6bdb8] font-mono">{ticket.ticketNumber}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#0284c7]/20 text-[#38bdf8] border border-[#38bdf8]/30">
                  {paperFormat}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper format selector (58mm vs 80mm) */}
            <div className="flex items-center bg-[#141b2b] p-0.5 rounded-lg border border-[#374151]/60 text-[11px] font-mono shadow-inner">
              <button
                type="button"
                onClick={() => handleSelectPaperFormat('58mm')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                  paperFormat === '58mm'
                    ? 'bg-[#dc2626] text-white shadow-sm'
                    : 'text-[#e6bdb8] hover:text-white hover:bg-[#232a3a]'
                }`}
                title="Cambiar a formato térmico estrecho 58mm"
              >
                <span className="material-symbols-outlined text-[13px]">view_column</span>
                <span>58mm</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaperFormat('80mm')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                  paperFormat === '80mm'
                    ? 'bg-[#dc2626] text-white shadow-sm'
                    : 'text-[#e6bdb8] hover:text-white hover:bg-[#232a3a]'
                }`}
                title="Cambiar a formato térmico estándar amplio 80mm"
              >
                <span className="material-symbols-outlined text-[13px]">table_rows</span>
                <span>80mm</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors"
              title="Cerrar vista previa"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Paper Receipt Visual with Real Dynamic Width & Layout Switching */}
        <div className="flex justify-center bg-[#0d1320] p-2 sm:p-3 rounded-xl border border-[#374151]/40 overflow-hidden">
          <div
            ref={printableRef}
            id="thermal-receipt-printable"
            className={`bg-white text-black font-mono leading-tight p-3 sm:p-4 rounded-lg shadow-xl border border-gray-300 select-text max-h-[55vh] overflow-y-auto transition-all duration-300 ${
              is80mm ? 'w-full max-w-[420px] text-[12px]' : 'w-full max-w-[245px] text-[11px]'
            }`}
          >
            {/* Header */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-gray-400">
              <p className={`font-black tracking-wider ${is80mm ? 'text-base' : 'text-sm'}`}>KEV NAY RETAIL HUB</p>
              <p className="text-[10px] font-bold text-gray-800">BOUTIQUE & ACCESORIOS</p>
              <p className="text-[9px] text-gray-600">NIT: 901.845.293-4 • RÉGIMEN COMÚN</p>
              <p className="text-[9px] text-gray-600">Cra. 15 # 85-32, Bogotá D.C. • Tel: (+57) 314 892 0104</p>
              <p className="text-[9px] text-gray-600">Res. DIAN #18764032 de 2026</p>
              <div className="pt-1 flex items-center justify-center gap-1.5">
                <span className="text-[8px] font-bold bg-gray-100 border border-gray-300 py-0.5 px-2 rounded">
                  SISTEMA POS POS-01
                </span>
                <span className="text-[8px] font-bold bg-sky-100 text-sky-800 border border-sky-300 py-0.5 px-1.5 rounded">
                  PAPEL {paperFormat}
                </span>
              </div>
            </div>

            {/* Ticket Info */}
            <div className={`py-2 border-b border-dashed border-gray-400 space-y-0.5 ${is80mm ? 'text-[11px]' : 'text-[10px]'}`}>
              <div className="flex justify-between">
                <span>FACTURA VENTA:</span>
                <span className="font-bold">{ticket.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA / HORA:</span>
                <span>{ticket.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>CAJERO:</span>
                <span className="font-semibold">{ticket.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span>{ticket.customerName || 'Consumidor Final'}</span>
              </div>
            </div>

            {/* Items Table - Responsive to 58mm vs 80mm format */}
            {is80mm ? (
              /* 80mm: Full 4-column structured table */
              <div className="py-2 border-b border-dashed border-gray-400">
                <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-gray-400 text-gray-800">
                  <span className="col-span-2 text-left">CANT</span>
                  <span className="col-span-5 text-left">DESCRIPCIÓN</span>
                  <span className="col-span-2 text-right">P. UNIT</span>
                  <span className="col-span-3 text-right">TOTAL</span>
                </div>
                <div className="space-y-1.5 pt-1.5 text-[11px]">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-start border-b border-dashed border-gray-200 pb-1">
                      <span className="col-span-2 font-bold text-gray-900">{item.quantity}</span>
                      <div className="col-span-5 pr-1 flex flex-col">
                        <span className="font-semibold leading-tight text-gray-900">{item.product.name}</span>
                        <span className="text-[8px] text-gray-500">
                          SKU: {item.product.sku || 'N/A'} • {item.product.taxRate > 0 ? `IVA ${(item.product.taxRate * 100).toFixed(0)}%` : 'EXENTO'}
                        </span>
                      </div>
                      <span className="col-span-2 text-right text-gray-700 text-[10px]">{formatCOP(item.product.price)}</span>
                      <span className="col-span-3 text-right font-bold text-gray-900">
                        {formatCOP(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* 58mm: Compact 2-line layout */
              <div className="py-2 border-b border-dashed border-gray-400">
                <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-gray-300 text-gray-800">
                  <span>CANT / ARTÍCULO</span>
                  <span>TOTAL</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[10px]">
                      <div className="flex flex-col pr-1 max-w-[70%]">
                        <span className="font-semibold leading-tight text-gray-900">{item.quantity}x {item.product.name}</span>
                        <span className="text-[8px] text-gray-500">
                          @ {formatCOP(item.product.price)} {item.product.taxRate > 0 ? `(IVA ${(item.product.taxRate * 100).toFixed(0)}%)` : '(EXENTO)'}
                        </span>
                      </div>
                      <span className="font-bold whitespace-nowrap text-gray-900">
                        {formatCOP(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className={`py-2 space-y-1 border-b border-dashed border-gray-400 ${is80mm ? 'text-[11px]' : 'text-[10px]'}`}>
              <div className="flex justify-between">
                <span>SUBTOTAL BASE:</span>
                <span>{formatCOP(ticket.subtotal)}</span>
              </div>
              {ticket.discountTotal > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>DESCUENTO:</span>
                  <span>-{formatCOP(ticket.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>IVA DISCRIMINADO:</span>
                <span>{formatCOP(ticket.taxTotal)}</span>
              </div>
              <div className={`flex justify-between font-black pt-1 border-t border-gray-400 ${is80mm ? 'text-sm' : 'text-xs'}`}>
                <span>TOTAL FACTURA:</span>
                <span>{formatCOP(ticket.total)}</span>
              </div>
            </div>

            {/* Payment breakdown */}
            <div className={`py-2 space-y-0.5 border-b border-dashed border-gray-400 ${is80mm ? 'text-[11px]' : 'text-[10px]'}`}>
              <div className="flex justify-between">
                <span className="uppercase">FORMA DE PAGO:</span>
                <span className="font-bold uppercase">{ticket.paymentMethod}</span>
              </div>
              {ticket.paymentMethod === 'efectivo' ? (
                <>
                  <div className="flex justify-between">
                    <span>EFECTIVO RECIBIDO:</span>
                    <span>{formatCOP(ticket.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>CAMBIO ENTREGADO:</span>
                    <span>{formatCOP(ticket.changeReturned)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>VALOR APROBADO:</span>
                  <span>{formatCOP(ticket.amountPaid)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-2 space-y-1">
              <p className="font-extrabold tracking-widest text-xs">||| | |||| | ||| |||| |</p>
              <p className="text-[9px] text-gray-500">CUFE: e4a7-891b-602c-499f</p>
              <p className="text-[10px] font-bold mt-1">¡GRACIAS POR SU COMPRA!</p>
              <p className="text-[8px] text-gray-400">Software Kev Nay POS Engine v4.3 • {paperFormat}</p>
            </div>
          </div>
        </div>

        {/* Print Feedback Status */}
        {printStatus && (
          <div className="p-2.5 rounded-xl bg-sky-950/70 border border-sky-500/40 text-sky-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[17px] text-[#38bdf8]">
              {isPrinting ? 'hourglass_top' : 'check_circle'}
            </span>
            <span>{printStatus}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 pt-1">
          <div className="flex items-center gap-2">
            {/* Real Hardware Print Button */}
            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-950/40"
              title={`Mandar a imprimir ticket en formato ${paperFormat}`}
            >
              <span className="material-symbols-outlined text-[19px]">
                {isPrinting ? 'hourglass_top' : 'print'}
              </span>
              <span>{isPrinting ? 'Abriendo impresora...' : `Imprimir Ticket (${paperFormat})`}</span>
            </button>

            {/* Copy ticket text */}
            <button
              type="button"
              onClick={handleCopyText}
              title="Copiar texto del comprobante"
              className="p-3 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-xs font-semibold flex items-center justify-center transition-colors border border-[#374151]/50 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>

            {/* Done / Close button */}
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#dce2f7] text-xs font-semibold transition-colors active:scale-95 border border-[#374151]/40"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
