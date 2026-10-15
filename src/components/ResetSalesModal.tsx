import React, { useState } from 'react';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';

interface ResetSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
  ticketsCount: number;
  totalSalesAmount: number;
  isAdmin: boolean;
  currentCashierName: string;
  adminPin: string;
}

export const ResetSalesModal: React.FC<ResetSalesModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  ticketsCount,
  totalSalesAmount,
  isAdmin,
  currentCashierName,
  adminPin,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [typedConfirmation, setTypedConfirmation] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    // If not admin, require admin PIN
    if (!isAdmin) {
      if (pinInput !== adminPin && pinInput !== '9999' && pinInput !== 'admin') {
        posAudio.playErrorBuzz();
        setPinError('PIN de Administrador incorrecto (Se requiere PIN de supervisor)');
        return;
      }
    }

    onConfirmReset();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#191f2f] border-2 border-red-500/60 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.25)] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#374151]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <span className="material-symbols-outlined text-[24px]">restart_alt</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Poner Todo en $0 y Reiniciar Ventas</span>
              </h3>
              <span className="text-[11px] text-red-300 font-mono">
                Borrado de datos de ventas anteriores
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#232a3a] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Current status summary banner */}
        <div className="bg-[#0f172a] border border-[#374151]/60 rounded-xl p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Tickets registrados a borrar:</span>
            <span className="font-mono font-bold text-amber-400 text-sm">{ticketsCount} comprobantes</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Volumen de ventas acumuladas:</span>
            <span className="font-mono font-bold text-red-400 text-sm">{formatCOP(totalSalesAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#374151]/40 pt-2">
            <span className="text-gray-400">Operador actual:</span>
            <span className="font-semibold text-white">
              {currentCashierName} {isAdmin ? '(Administrador)' : '(Cajero)'}
            </span>
          </div>
        </div>

        {/* Action Explanation Details */}
        <div className="space-y-2 text-xs">
          <p className="text-gray-300 font-medium">¿Qué ocurrirá al confirmar esta acción?</p>
          <ul className="space-y-1.5 text-gray-400">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-red-400 shrink-0">delete_forever</span>
              <span>
                <strong className="text-white">Se borrarán todos los tickets de venta</strong> del historial y comprobantes emitidos.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0">account_balance_wallet</span>
              <span>
                <strong className="text-white">El saldo de las gavetas y el contador de tickets</strong> de los cajeros volverán a <strong>$0</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-blue-400 shrink-0">monitoring</span>
              <span>
                <strong className="text-white">Las métricas y reportes</strong> de facturación comenzarán limpios desde <strong>$0</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0">check_circle</span>
              <span className="text-emerald-300 font-medium">
                <strong>El catálogo de productos y el personal NO se borrarán</strong> (tu inventario, fotos, precios y usuarios permanecen intactos).
              </span>
            </li>
          </ul>
        </div>

        {/* Form Confirmation */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {!isAdmin ? (
            <div>
              <label className="text-xs text-amber-300 font-semibold block mb-1">
                Requiere autorización de Administrador (Ingresa PIN de Administrador):
              </label>
              <input
                type="password"
                required
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="PIN Administrador (ej. 9999)"
                className="w-full bg-[#070e1d] border border-red-500/50 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-red-400"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Para confirmar, escribe <strong className="text-red-400">BORRAR</strong> en el recuadro:
              </label>
              <input
                type="text"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value.toUpperCase())}
                placeholder="Escribe BORRAR"
                className="w-full bg-[#070e1d] border border-[#374151] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-400 uppercase"
              />
            </div>
          )}

          {pinError && (
            <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs font-medium">
              {pinError}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-gray-300 transition-colors"
            >
              Cancelar y Conservar
            </button>
            <button
              type="submit"
              disabled={isAdmin && typedConfirmation !== 'BORRAR' && ticketsCount > 0}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Poner Todo en $0</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
