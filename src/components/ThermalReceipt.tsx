import React from 'react';
import { SaleTicket } from '../types/pos';
import { formatCOP } from '../utils/format';

interface ThermalReceiptProps {
  ticket: SaleTicket;
  onClose: () => void;
  onPrint?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ ticket, onClose, onPrint }) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-4 w-full max-w-sm flex flex-col space-y-4 shadow-2xl">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#10b981]">receipt_long</span>
            <span className="text-sm font-bold text-[#dce2f7]">Ticket Térmico POS-58</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Paper Receipt Visual */}
        <div
          id="thermal-receipt-printable"
          className="bg-white text-black font-mono text-[11px] leading-tight p-4 rounded shadow-inner border border-gray-200 select-text max-h-[60vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-gray-400">
            <p className="font-extrabold text-sm tracking-wider">KEV NAY RETAIL HUB</p>
            <p className="text-[10px]">NIT: 901.845.293-4 • RÉGIMEN COMÚN</p>
            <p className="text-[10px]">Cra. 15 # 85-32, Bogotá D.C.</p>
            <p className="text-[10px]">Tel: (+57) 314 892 0104</p>
            <p className="text-[10px]">Res. DIAN #18764032 de 2026</p>
            <p className="text-[10px] font-bold mt-1">SISTEMA POS POS-01</p>
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
            <div className="flex justify-between font-bold text-[10px] pb-1">
              <span>CANT / ARTÍCULO</span>
              <span>TOTAL</span>
            </div>
            <div className="space-y-1.5">
              {ticket.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-[10px]">
                  <div className="flex flex-col pr-1">
                    <span className="font-semibold">{item.quantity}x {item.product.name}</span>
                    <span className="text-[9px] text-gray-600">
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
            <p className="text-[9px] text-gray-600">CUFE: e4a7-891b-602c-499f</p>
            <p className="text-[10px] font-semibold mt-1">¡GRACIAS POR SU COMPRA!</p>
            <p className="text-[9px] text-gray-500">Software Kev Nay Engine v4.2.1-prod</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-[#fff6f5] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Imprimir Ticket</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#dce2f7] text-xs font-semibold transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
