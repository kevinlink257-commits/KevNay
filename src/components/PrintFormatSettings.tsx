import React, { useState, useEffect } from 'react';
import { PosPaperFormat } from '../types/pos';
import {
  getStoredPaperFormat,
  setStoredPaperFormat,
  printTestTicket,
} from '../utils/printReceipt';
import { posAudio } from '../utils/audio';

interface PrintFormatSettingsProps {
  onClose?: () => void;
  isModal?: boolean;
}

interface FormatOption {
  id: PosPaperFormat;
  name: string;
  tagline: string;
  cols: string;
  widthMm: string;
  widthPx: number;
  recommendedHardware: string;
  description: string;
  features: string[];
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: '80mm',
    name: 'Formato Amplio (80mm)',
    tagline: 'Estándar comercial amplio de alta capacidad',
    cols: '48 columnas',
    widthMm: '80mm',
    widthPx: 320,
    recommendedHardware: 'Epson TM-T20 / TM-T88, Bixolon SRP-350, Star TSP100, Xprinter XP-N160M / XP-Q800',
    description:
      'Diseño tabular completo de 4 columnas (CANT, ARTÍCULO, P. UNIT, TOTAL). Ideal para puntos de venta con alto volumen y facturación detallada.',
    features: [
      'Tabla de artículos de 4 columnas independientes',
      'Desglose ampliado de IVA y descuentos',
      'Excelente legibilidad para clientes finales',
      'Ajuste automático de márgenes a 0mm para 1 sola hoja',
    ],
  },
  {
    id: '58mm',
    name: 'Formato Estándar Compacto (58mm)',
    tagline: 'El formato térmico más popular en mostradores retail',
    cols: '32 columnas',
    widthMm: '58mm',
    widthPx: 220,
    recommendedHardware: 'Xprinter XP-58, POS-58, Goojprt 58mm, Netum, impresoras USB/LAN de 58mm',
    description:
      'Formato estándar de 2 líneas por producto para aprovechar al máximo el ancho del papel sin recortar nombres ni precios.',
    features: [
      'Disposición compacta de 2 líneas por ítem',
      'Ahorro significativo de papel en cada comprobante',
      'Compatible con el 95% de impresoras térmicas comerciales',
      '1 sola hoja garantizada sin páginas en blanco',
    ],
  },
  {
    id: '57mm',
    name: 'Formato Ultra Compacto / Portátil (57mm)',
    tagline: 'Para mini terminales portátiles y datáfonos móviles',
    cols: '30 columnas',
    widthMm: '57mm',
    widthPx: 216,
    recommendedHardware: 'Mini impresoras Bluetooth portátiles, Handhelds POS, MTP-II, PT-210, Datáfonos',
    description:
      'Densidad tipográfica ultra compacta optimizada para terminales móviles y rollos angostos de 57mm para evitar desbordamientos laterales.',
    features: [
      'Densidad optimizada para micro-márgenes (0.5mm)',
      'Máxima compatibilidad con terminales handheld Bluetooth',
      'Tipografía monoespaciada compacta de alta nitidez',
      'Cero desbordamiento lateral en rollos de 57mm',
    ],
  },
];

export const PrintFormatSettings: React.FC<PrintFormatSettingsProps> = ({
  onClose,
  isModal = false,
}) => {
  const [currentFormat, setCurrentFormat] = useState<PosPaperFormat>(() => getStoredPaperFormat());
  const [isTestingPrint, setIsTestingPrint] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Synchronize state if changed externally
  useEffect(() => {
    const handleFormatChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ format: PosPaperFormat }>;
      if (customEvent.detail?.format) {
        setCurrentFormat(customEvent.detail.format);
      }
    };
    window.addEventListener('pos_paper_format_changed', handleFormatChange);
    return () => window.removeEventListener('pos_paper_format_changed', handleFormatChange);
  }, []);

  const handleSelectFormat = (fmt: PosPaperFormat) => {
    posAudio.playKeyClick();
    setCurrentFormat(fmt);
    setStoredPaperFormat(fmt);
    setFeedback(`✓ Formato ${fmt} establecido permanentemente para todas las ventas y tickets`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleRunTestPrint = async (fmt: PosPaperFormat) => {
    setIsTestingPrint(true);
    posAudio.playKeyClick();
    setFeedback(`Enviando ticket de prueba en ${fmt} a la impresora...`);

    try {
      await printTestTicket(fmt, {
        onSuccess: () => {
          posAudio.playCashRegisterChime();
          setFeedback(`✓ Ticket de calibración ${fmt} impreso con éxito en 1 sola hoja`);
        },
      });
    } catch (err) {
      console.warn('Test print error:', err);
      setFeedback(`Hubo un aviso al imprimir. Comprueba la conexión de la impresora.`);
    } finally {
      setIsTestingPrint(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#374151]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">print</span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Configuración de Impresión de Tickets POS</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                {currentFormat} ACTIVO
              </span>
            </h3>
            <p className="text-xs text-[#e6bdb8] mt-0.5">
              Selecciona permanentemente el ancho de papel térmico para tickets de venta, facturas POS y reportes de caja.
            </p>
          </div>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors shrink-0"
            title="Cerrar configuración"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Visual Relative Width Comparison Bar */}
      <div className="bg-[#141b2b] p-3 rounded-xl border border-[#374151]/40 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-sky-400">straighten</span>
            <span>Comparativa de Ancho de Rollo:</span>
          </span>
          <span className="font-mono text-[11px] text-[#90cdff]">
            Seleccionado actualmente: <strong className="text-white font-bold">{currentFormat}</strong>
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          {FORMAT_OPTIONS.map((opt) => {
            const isSelected = currentFormat === opt.id;
            const percentage = opt.id === '80mm' ? 100 : opt.id === '58mm' ? 72.5 : 71.25;
            return (
              <div key={opt.id} className="space-y-0.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className={isSelected ? 'text-sky-300 font-bold' : 'text-gray-400'}>
                    {opt.id} ({opt.cols})
                  </span>
                  <span className={isSelected ? 'text-sky-300 font-bold' : 'text-gray-500'}>
                    {isSelected ? '✓ Activo en POS' : `${percentage.toFixed(1)}%`}
                  </span>
                </div>
                <div className="w-full bg-[#0d1320] h-2.5 rounded-full overflow-hidden border border-[#374151]/40">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-sm'
                        : 'bg-gray-600/40'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Format Selection Cards (3 options) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {FORMAT_OPTIONS.map((opt) => {
          const isSelected = currentFormat === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => handleSelectFormat(opt.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                isSelected
                  ? 'bg-gradient-to-b from-sky-950/50 via-[#191f2f] to-[#141b2b] border-sky-500 ring-2 ring-sky-500/40 shadow-xl shadow-sky-950/30'
                  : 'bg-[#191f2f] border-[#374151]/50 hover:border-gray-400 hover:bg-[#232a3a]/60'
              }`}
            >
              {/* Active Badge */}
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-sky-500 text-black text-[10px] font-bold font-mono shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">check</span>
                  <span>PREDETERMINADO</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                      isSelected
                        ? 'bg-sky-500 text-black shadow-sm'
                        : 'bg-[#141b2b] text-gray-300 border border-[#374151]/60'
                    }`}
                  >
                    {opt.id}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                      {opt.name}
                    </h4>
                    <span className="text-[10px] font-mono text-[#90cdff] block">
                      {opt.cols} • {opt.widthMm}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#e6bdb8] leading-snug">
                  {opt.description}
                </p>

                <div className="space-y-1 pt-1.5 border-t border-[#374151]/30">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                    Ventajas:
                  </span>
                  <ul className="space-y-0.5 text-[10px] text-gray-300">
                    {opt.features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-sky-400 leading-none">›</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-1.5 border-t border-[#374151]/30 text-[10px] text-gray-400">
                  <span className="font-semibold text-gray-300">Equipos típicos:</span>
                  <p className="text-[9.5px] text-[#e6bdb8] mt-0.5 line-clamp-2">
                    {opt.recommendedHardware}
                  </p>
                </div>
              </div>

              {/* Action Buttons for this card */}
              <div className="pt-3 mt-2 border-t border-[#374151]/30 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFormat(opt.id);
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-sky-500 text-black hover:bg-sky-400'
                      : 'bg-[#141b2b] hover:bg-sky-500/20 text-[#adc6ff] hover:text-white border border-[#374151]/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span>{isSelected ? 'Seleccionado' : 'Elegir'}</span>
                </button>

                <button
                  type="button"
                  disabled={isTestingPrint}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunTestPrint(opt.id);
                  }}
                  title={`Imprimir ticket de prueba en formato ${opt.id}`}
                  className="py-1.5 px-2.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white border border-[#374151]/50 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  <span className="hidden sm:inline">Probar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guaranteed 1-page & Zero Blank Pages Certification Box */}
      <div className="bg-[#141b2b] p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div>
            <span className="font-bold text-white block">
              Garantía de 1 Sola Hoja y 0 Páginas en Blanco
            </span>
            <span className="text-[11px] text-[#e6bdb8]">
              El motor de impresión ajusta automáticamente las clases CSS de contenedor (<code>pos-width-{currentFormat}</code>, <code>paper-format-{currentFormat}</code>) y resetea márgenes a 0mm antes de invocar la impresión física.
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isTestingPrint}
          onClick={() => handleRunTestPrint(currentFormat)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">print</span>
          <span>Probar {currentFormat}</span>
        </button>
      </div>

      {/* Feedback Alert Toast */}
      {feedback && (
        <div className="p-2.5 rounded-xl bg-sky-950/80 border border-sky-500/50 text-sky-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span className="material-symbols-outlined text-[17px] text-sky-400">info</span>
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
        <div className="bg-[#191f2f] border border-[#374151]/70 rounded-2xl p-5 w-full max-w-4xl shadow-2xl text-[#dce2f7] space-y-4 max-h-[90vh] overflow-y-auto">
          {content}
          <div className="pt-2 border-t border-[#374151]/40 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-white text-xs font-semibold transition-colors active:scale-95"
            >
              Listo / Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#191f2f] border border-[#374151]/40 rounded-2xl p-4 sm:p-5 shadow-xl text-[#dce2f7]">
      {content}
    </div>
  );
};
