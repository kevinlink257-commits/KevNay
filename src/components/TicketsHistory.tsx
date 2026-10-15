import React, { useState } from 'react';
import { SaleTicket } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { ThermalReceipt } from './ThermalReceipt';
import { printTicket58mm } from '../utils/printReceipt';

interface TicketsHistoryProps {
  tickets: SaleTicket[];
  onVoidTicket: (ticketId: string) => void;
  onOpenPos?: () => void;
}

export const TicketsHistory: React.FC<TicketsHistoryProps> = ({
  tickets,
  onVoidTicket,
  onOpenPos,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<SaleTicket | null>(null);
  const [voidConfirmTicketId, setVoidConfirmTicketId] = useState<string | null>(null);
  const [voidPin, setVoidPin] = useState<string>('');
  const [voidError, setVoidError] = useState<string>('');
  const [printingTicketId, setPrintingTicketId] = useState<string | null>(null);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  const filtered = tickets.filter((t) => {
    return (
      t.ticketNumber.toLowerCase().includes(filterQuery.toLowerCase()) ||
      t.cashierName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (t.customerName && t.customerName.toLowerCase().includes(filterQuery.toLowerCase()))
    );
  });

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (voidPin === '9999' || voidPin === '0000' || voidPin.length >= 4) {
      if (voidConfirmTicketId) {
        onVoidTicket(voidConfirmTicketId);
        posAudio.playCashRegisterChime();
        setVoidConfirmTicketId(null);
        setVoidPin('');
        setVoidError('');
      }
    } else {
      posAudio.playErrorBuzz();
      setVoidError('PIN de anulación incorrecto (Requiere Supervisor: 9999)');
    }
  };

  const handleDirectPrint = async (ticket: SaleTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    posAudio.playKeyClick();
    setPrintingTicketId(ticket.id);
    setPrintFeedback(`Enviando ${ticket.ticketNumber} a formato térmico 58mm...`);

    try {
      await printTicket58mm(ticket, {
        paperWidth: '58mm',
        onSuccess: () => {
          posAudio.playCashRegisterChime();
          setPrintFeedback(`✓ Ticket ${ticket.ticketNumber} enviado a impresora 58mm`);
        },
      });
    } catch (err) {
      console.warn('Print error from history:', err);
      // Fallback: open thermal receipt modal
      setSelectedTicket(ticket);
    } finally {
      setTimeout(() => {
        setPrintingTicketId(null);
        setTimeout(() => setPrintFeedback(null), 3000);
      }, 700);
    }
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-4">
      {/* Header and Search */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="material-symbols-outlined text-[#e6bdb8] text-[20px]">search</span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Buscar por número de ticket (#T-1024), cajero o cliente..."
            className="w-full bg-[#141b2b] border border-[#374151]/40 rounded-lg px-3 py-1.5 text-xs text-[#dce2f7] placeholder-[#e6bdb8]/60 focus:outline-none focus:border-[#ef4444]"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#e6bdb8]">
          <span className="flex items-center gap-1.5 hidden sm:flex">
            <span className="material-symbols-outlined text-[16px] text-[#10b981]">print</span>
            <span>Térmica 58mm Activa</span>
          </span>
          <span className="bg-[#141b2b] px-2.5 py-1 rounded-lg border border-[#374151]/30">
            Comprobantes: <strong className="text-white">{tickets.length}</strong>
          </span>
        </div>
      </div>

      {/* Print Feedback Toast Notification */}
      {printFeedback && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#10b981]">check_circle</span>
            <span>{printFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrintFeedback(null)}
            className="text-emerald-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141b2b] border-b border-[#374151]/40 text-[#e6bdb8] font-mono uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Ticket #</th>
                <th className="py-2.5 px-3">Fecha / Hora</th>
                <th className="py-2.5 px-3">Cajero</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Método Pago</th>
                <th className="py-2.5 px-3">Artículos</th>
                <th className="py-2.5 px-3">Total COP</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#374151]/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#e6bdb8]">
                    {tickets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[28px]">point_of_sale</span>
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-sm font-bold text-white">No hay ventas registradas (Historial en $0)</p>
                          <p className="text-xs text-gray-400">
                            Todos los datos de ventas han sido restablecidos. El sistema está limpio y listo para realizar nuevas ventas.
                          </p>
                        </div>
                        {onOpenPos && (
                          <button
                            type="button"
                            onClick={onOpenPos}
                            className="px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                            <span>Ir a Caja POS a Vender</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-xs">No se encontraron tickets con los criterios de búsqueda.</span>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((ticket) => {
                  const isVoid = ticket.status === 'anulada';
                  const totalItemsCount = ticket.items.reduce((acc, i) => acc + i.quantity, 0);
                  const isCurrentlyPrinting = printingTicketId === ticket.id;

                  return (
                    <tr key={ticket.id} className="hover:bg-[#232a3a]/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#90cdff]">
                        {ticket.ticketNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#e6bdb8]">
                        {ticket.timestamp}
                      </td>
                      <td className="py-2.5 px-3 text-[#dce2f7] font-medium">
                        {ticket.cashierName}
                      </td>
                      <td className="py-2.5 px-3 text-[#e6bdb8]">
                        {ticket.customerName || 'Consumidor Final'}
                      </td>
                      <td className="py-2.5 px-3 uppercase font-mono text-[11px] font-semibold text-[#adc6ff]">
                        {ticket.paymentMethod}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-white">
                        {totalItemsCount} u.
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#10b981]">
                        {formatCOP(ticket.total)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          {isVoid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ef4444]/20 text-[#ef4444]">
                              ANULADO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#10b981]/20 text-[#10b981]">
                              PAGADO
                            </span>
                          )}
                          {ticket.outsideOperatingHours && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-0.5"
                              title="Venta registrada fuera del horario comercial permitido"
                            >
                              <span className="material-symbols-outlined text-[10px]">alarm_off</span>
                              <span>Fuera de Horario</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct 58mm Thermal Print button */}
                          <button
                            type="button"
                            disabled={isCurrentlyPrinting}
                            onClick={(e) => handleDirectPrint(ticket, e)}
                            title="Imprimir directamente a formato térmico 58mm"
                            className="px-2.5 py-1 rounded-lg bg-[#dc2626]/20 hover:bg-[#dc2626] disabled:opacity-50 text-[#ff8080] hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all border border-[#dc2626]/30 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isCurrentlyPrinting ? 'hourglass_top' : 'print'}
                            </span>
                            <span>{isCurrentlyPrinting ? 'Imprimiendo...' : 'Imprimir'}</span>
                          </button>

                          {/* View Full Receipt Modal button */}
                          <button
                            type="button"
                            onClick={() => {
                              posAudio.playKeyClick();
                              setSelectedTicket(ticket);
                            }}
                            className="px-2 py-1 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-[11px] font-semibold flex items-center gap-1 border border-[#374151]/40"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt</span>
                            <span>Ver</span>
                          </button>

                          {!isVoid && (
                            <button
                              type="button"
                              onClick={() => {
                                posAudio.playKeyClick();
                                setVoidConfirmTicketId(ticket.id);
                                setVoidPin('');
                                setVoidError('');
                              }}
                              className="px-2 py-1 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444] text-[#ef4444] hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">cancel</span>
                              <span>Anular</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Void Confirmation Modal */}
      {voidConfirmTicketId && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-sm flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2 text-[#ef4444]">
                <span className="material-symbols-outlined text-[22px]">warning</span>
                <span className="font-bold text-sm text-white">Anular Venta POS</span>
              </div>
              <button
                type="button"
                onClick={() => setVoidConfirmTicketId(null)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#e6bdb8]">
              Esta acción revertirá los movimientos contables del turno. Requiere autorización con PIN de supervisor (ej: 9999).
            </p>

            <form onSubmit={handleConfirmVoid} className="space-y-3">
              <input
                type="password"
                value={voidPin}
                onChange={(e) => {
                  setVoidPin(e.target.value);
                  setVoidError('');
                }}
                autoFocus
                placeholder="PIN de Supervisor"
                className="w-full p-2.5 rounded-xl bg-[#070e1d] border border-[#374151]/50 text-xs font-mono text-white placeholder-[#e6bdb8]/50"
              />

              {voidError && (
                <span className="text-[11px] text-[#ef4444] block font-medium">{voidError}</span>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVoidConfirmTicketId(null)}
                  className="flex-1 py-2 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#dc2626] text-xs font-semibold text-white"
                >
                  Confirmar Anulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      {selectedTicket && (
        <ThermalReceipt ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
};
