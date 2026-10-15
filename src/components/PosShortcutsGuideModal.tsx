import React, { useEffect, useState } from 'react';
import { posAudio } from '../utils/audio';

interface PosShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  category: 'Caja & Venta' | 'Navegación & Catálogo' | 'Seguridad & Sistema';
  description: string;
  detail: string;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    key: 'F1',
    category: 'Caja & Venta',
    description: 'Cobrar Venta / Confirmar Pago',
    detail: 'Abre el modal de cobro si el carrito tiene productos, o finaliza la transacción si ya estás en el modal.',
  },
  {
    key: 'F2',
    category: 'Navegación & Catálogo',
    description: 'Buscador de Productos',
    detail: 'Enfoca automáticamente la barra de búsqueda y selecciona el texto para escribir de inmediato.',
  },
  {
    key: 'F3',
    category: 'Caja & Venta',
    description: 'Vaciar Carrito',
    detail: 'Limpia todos los productos del ticket en curso con confirmación auditiva instantánea.',
  },
  {
    key: 'F4',
    category: 'Navegación & Catálogo',
    description: 'Lector de Código de Barras',
    detail: 'Abre la cámara para escanear códigos de barras físicos EAN-13, UPC o códigos SKU.',
  },
  {
    key: 'Enter',
    category: 'Caja & Venta',
    description: 'Añadir / Confirmar',
    detail: 'En el buscador añade el producto coincidente. En el modal de pago finaliza e imprime el ticket.',
  },
  {
    key: 'Esc',
    category: 'Caja & Venta',
    description: 'Cancelar / Cerrar Modales',
    detail: 'Cierra modales de cobro, escáner, recibo térmico, avisos y limpia la búsqueda activa.',
  },
  {
    key: '1 / 2 / 3',
    category: 'Caja & Venta',
    description: 'Método de Pago Rápido',
    detail: 'Dentro del modal de cobro: 1 = Efectivo, 2 = Datáfono, 3 = Transferencia QR (Nequi / Bancolombia).',
  },
  {
    key: 'F7',
    category: 'Seguridad & Sistema',
    description: 'Bloqueo Rápido de Terminal',
    detail: 'Bloquea la terminal inmediatamente conservando el estado y la sesión del cajero.',
  },
  {
    key: 'F8 / ?',
    category: 'Seguridad & Sistema',
    description: 'Abrir / Cerrar esta Guía',
    detail: 'Muestra o esconde esta ventana interactiva de consulta de atajos de teclado.',
  },
];

export const PosShortcutsGuideModal: React.FC<PosShortcutsGuideModalProps> = ({ isOpen, onClose }) => {
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Highlight pressed key
      let keyDisplay = e.key;
      if (e.key === 'Escape') keyDisplay = 'Esc';
      if (e.key === 'Enter') keyDisplay = 'Enter';
      setLastKeyPressed(keyDisplay);

      const timer = setTimeout(() => {
        setLastKeyPressed(null);
      }, 1500);

      return () => clearTimeout(timer);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = ['Caja & Venta', 'Navegación & Catálogo', 'Seguridad & Sistema'] as const;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          posAudio.playKeyClick();
          onClose();
        }
      }}
    >
      <div className="bg-[#191f2f] border border-[#374151]/70 rounded-2xl p-5 sm:p-6 w-full max-w-2xl flex flex-col space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#374151]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[24px]">keyboard</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Atajos de Teclado del POS
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Activos
                </span>
              </div>
              <p className="text-xs text-[#e6bdb8]">
                Opera la terminal a máxima velocidad sin depender del ratón o pantalla táctil
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors"
            title="Cerrar (Esc)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Live Key Tester Bar */}
        <div className="bg-[#070e1d] p-3 rounded-xl border border-[#374151]/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-400">touch_app</span>
            <span className="text-gray-300">
              Prueba un atajo en tu teclado físico:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#e6bdb8]">Última tecla detectada:</span>
            {lastKeyPressed ? (
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 animate-pulse">
                {lastKeyPressed}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-gray-500 italic">
                Presiona una tecla...
              </span>
            )}
          </div>
        </div>

        {/* Categorized Shortcuts */}
        <div className="space-y-4">
          {categories.map((category) => {
            const items = SHORTCUTS.filter((s) => s.category === category);
            return (
              <div key={category} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#90cdff] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"></span>
                  {category}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item) => {
                    const isHighlighted = lastKeyPressed && (
                      item.key.includes(lastKeyPressed) ||
                      (lastKeyPressed === 'Esc' && item.key === 'Esc')
                    );
                    return (
                      <div
                        key={item.key}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                          isHighlighted
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-lg scale-[1.02]'
                            : 'bg-[#141b2b] border-[#374151]/30 hover:border-[#374151]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{item.description}</span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-[#232a3a] border border-[#374151]/80 font-mono text-xs font-extrabold text-amber-300 shadow-sm shrink-0">
                            {item.key}
                          </kbd>
                        </div>
                        <p className="text-[11px] text-[#e6bdb8]/90 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info & close */}
        <div className="pt-3 border-t border-[#374151]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#e6bdb8]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-gray-400">info</span>
            <span>
              Presiona <kbd className="font-mono text-amber-300 bg-[#232a3a] px-1.5 py-0.2 rounded border border-[#374151]">Esc</kbd> o <kbd className="font-mono text-amber-300 bg-[#232a3a] px-1.5 py-0.2 rounded border border-[#374151]">F8</kbd> para cerrar esta guía.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              onClose();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-white font-semibold text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
