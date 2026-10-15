import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { SaleTicket } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { printTicket58mm } from '../utils/printReceipt';

interface ThermalReceiptProps {
  ticket: SaleTicket;
  onClose: () => void;
  onPrint?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ ticket, onClose, onPrint }) => {
  const printableRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [paperFormat, setPaperFormat] = useState<'58mm' | '80mm'>('58mm');
  const [copied, setCopied] = useState<boolean>(false);

  // Configure react-to-print as secondary engine
  const handleReactToPrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `Ticket_${ticket.ticketNumber}`,
    pageStyle: `
      @page { size: ${paperFormat} auto; margin: 0; }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          width: ${paperFormat} !important;
        }
        #thermal-receipt-printable {
          width: ${paperFormat} !important;
          max-height: none !important;
          overflow: visible !important;
          box-shadow: none !important;
          border: none !important;
          padding: 2mm 3mm !important;
        }
      }
    `,
    onAfterPrint: () => {
      setIsPrinting(false);
      posAudio.playCashRegisterChime();
      setPrintStatus(`✓ Ticket impreso en formato ${paperFormat}`);
    },
    onPrintError: (location, err) => {
      console.warn('react-to-print warning:', location, err);
      // Fallback
      printTicket58mm(ticket, {
        paperWidth: paperFormat,
        onSuccess: () => {
          setIsPrinting(false);
          posAudio.playCashRegisterChime();
          setPrintStatus(`✓ Ticket enviado a impresora térmica (${paperFormat})`);
        },
      });
    },
  });

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintStatus(null);
    posAudio.playKeyClick();

    if (onPrint) {
      try {
        onPrint();
      } catch (err) {
        console.warn('External onPrint error:', err);
      }
    }

    try {
      // First attempt: direct isolated 58mm POS thermal print engine
      const success = await printTicket58mm(ticket, {
        paperWidth: paperFormat,
        onSuccess: () => {
          posAudio.playCashRegisterChime();
          setPrintStatus(`✓ Ticket enviado a impresora térmica (${paperFormat})`);
        },
      });

      if (!success) {
        // Fallback to react-to-print
        handleReactToPrint();
      }
    } catch (err) {
      console.warn('Direct print engine exception, invoking react-to-print:', err);
      try {
        handleReactToPrint();
      } catch (e2) {
        console.warn('Both printers caught error:', e2);
        setPrintStatus('Vista de comprobante lista para captura');
      }
    } finally {
      setTimeout(() => setIsPrinting(false), 800);
    }
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

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-4 w-full max-w-sm flex flex-col space-y-3.5 shadow-2xl text-[#dce2f7]">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 text-[#10b981] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">receipt_long</span>
            </div>
            <div>
              <span className="text-sm font-bold text-[#dce2f7] block leading-tight">Comprobante POS</span>
              <span className="text-[10px] text-[#e6bdb8] font-mono">{ticket.ticketNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Paper format selector */}
            <div className="flex items-center bg-[#141b2b] p-0.5 rounded-lg border border-[#374151]/40 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setPaperFormat('58mm')}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                  paperFormat === '58mm' ? 'bg-[#dc2626] text-white' : 'text-[#e6bdb8] hover:text-white'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('80mm')}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                  paperFormat === '80mm' ? 'bg-[#dc2626] text-white' : 'text-[#e6bdb8] hover:text-white'
                }`}
              >
                80mm
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Paper Receipt Visual */}
        <div
          ref={printableRef}
          id="thermal-receipt-printable"
          className="bg-white text-black font-mono text-[11px] leading-tight p-3 sm:p-4 rounded-xl shadow-inner border border-gray-200 select-text max-h-[55vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-gray-400">
            <p className="font-extrabold text-sm tracking-wider">KEV NAY RETAIL HUB</p>
            <p className="text-[10px] font-bold text-gray-800">BOUTIQUE & ACCESORIOS</p>
            <p className="text-[9px] text-gray-600">NIT: 901.845.293-4 • RÉGIMEN COMÚN</p>
            <p className="text-[9px] text-gray-600">Cra. 15 # 85-32, Bogotá D.C.</p>
            <p className="text-[9px] text-gray-600">Tel: (+57) 314 892 0104</p>
            <p className="text-[9px] text-gray-600">Res. DIAN #18764032 de 2026</p>
            <p className="text-[9px] font-bold mt-1 bg-gray-100 py-0.5 px-2 inline-block rounded">
              SISTEMA POS POS-01
            </p>
          </div>

          {/* Ticket Info */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
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

          {/* Items Table */}
          <div className="py-2 border-b border-dashed border-gray-400">
            <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-gray-200">
              <span>CANT / ARTÍCULO</span>
              <span>TOTAL</span>
            </div>
            <div className="space-y-1.5 pt-1">
              {ticket.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-[10px]">
                  <div className="flex flex-col pr-1 max-w-[70%]">
                    <span className="font-semibold leading-tight">{item.quantity}x {item.product.name}</span>
                    <span className="text-[9px] text-gray-500">
                      @ {formatCOP(item.product.price)} {item.product.taxRate > 0 ? `(IVA ${(item.product.taxRate * 100).toFixed(0)}%)` : '(EXENTO)'}
                    </span>
                  </div>
                  <span className="font-bold whitespace-nowrap">
                    {formatCOP(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="py-2 space-y-1 border-b border-dashed border-gray-400 text-[10px]">
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
              <span>IVA TOTAL:</span>
              <span>{formatCOP(ticket.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-black pt-1 border-t border-gray-300">
              <span>TOTAL PAGADO:</span>
              <span>{formatCOP(ticket.total)}</span>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="py-2 space-y-0.5 text-[10px] border-b border-dashed border-gray-400">
            <div className="flex justify-between">
              <span className="uppercase">FORMA DE PAGO:</span>
              <span className="font-semibold uppercase">{ticket.paymentMethod}</span>
            </div>
            {ticket.paymentMethod === 'efectivo' && (
              <>
                <div className="flex justify-between">
                  <span>EFECTIVO RECIBIDO:</span>
                  <span>{formatCOP(ticket.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>CAMBIO / VUELTAS:</span>
                  <span>{formatCOP(ticket.changeReturned)}</span>
                </div>
              </>
            )}
          </div>

          {/* Barcode & Footer */}
          <div className="text-center pt-2 space-y-1">
            <p className="font-extrabold tracking-widest text-xs">||| | |||| | ||| |||| |</p>
            <p className="text-[9px] text-gray-500">CUFE: e4a7-891b-602c-499f</p>
            <p className="text-[10px] font-bold mt-1">¡GRACIAS POR SU COMPRA!</p>
            <p className="text-[8px] text-gray-400">Software Kev Nay POS Engine v4.3</p>
          </div>
        </div>

        {/* Print Feedback Status */}
        {printStatus && (
          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{printStatus}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-950/40"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPrinting ? 'hourglass_top' : 'print'}
              </span>
              <span>{isPrinting ? 'Enviando a impresora...' : `Imprimir Ticket (${paperFormat})`}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              title="Copiar texto del comprobante"
              className="p-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-xs font-semibold flex items-center justify-center transition-colors border border-[#374151]/50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#dce2f7] text-xs font-semibold transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
