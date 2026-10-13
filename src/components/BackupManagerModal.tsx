import React, { useState } from 'react';
import { Product, Cashier, AuditEvent, SaleTicket } from '../types/pos';
import { exportAndDownloadBackup, PosBackupData } from '../utils/backup';
import { posAudio } from '../utils/audio';

interface BackupManagerModalProps {
  inventory: Product[];
  cashiers: Cashier[];
  auditLogs: AuditEvent[];
  tickets?: SaleTicket[];
  currentCashier: Cashier;
  isOpen: boolean;
  onClose: () => void;
  onLogAudit: (type: AuditEvent['type'], details: string) => void;
  onRestoreBackup?: (backup: {
    inventory?: Product[];
    cashiers?: Cashier[];
    auditLogs?: AuditEvent[];
  }) => void;
}

export const BackupManagerModal: React.FC<BackupManagerModalProps> = ({
  inventory,
  cashiers,
  auditLogs,
  tickets = [],
  currentCashier,
  isOpen,
  onClose,
  onLogAudit,
  onRestoreBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'preview' | 'restore'>('export');
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [lastExportName, setLastExportName] = useState<string>('');
  const [copiedToClipboard, setCopiedToClipboard] = useState<boolean>(false);

  // Restore states
  const [restoreJsonText, setRestoreJsonText] = useState<string>('');
  const [restoreError, setRestoreError] = useState<string>('');
  const [restoreSuccess, setRestoreSuccess] = useState<string>('');

  if (!isOpen) return null;

  const previewObject: PosBackupData = {
    version: '1.2.0',
    system: 'Kev Nay Retail POS - Admin Suite',
    terminalId: 'POS-01',
    exportedAt: new Date().toISOString(),
    metadata: {
      totalProducts: inventory.length,
      totalCashiers: cashiers.length,
      totalAuditLogs: auditLogs.length,
      totalTickets: tickets.length,
      exportedBy: currentCashier.name,
    },
    inventory,
    cashiers,
    auditLogs,
    tickets,
  };

  const previewString = JSON.stringify(previewObject, null, 2);

  const handleExport = () => {
    posAudio.playCashRegisterChime();
    const backup = exportAndDownloadBackup({
      inventory,
      cashiers,
      auditLogs,
      tickets,
      exportedBy: currentCashier.name,
      terminalId: 'POS-01',
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const fileName = `respaldo_pos_${dateStr}.json`;
    setLastExportName(fileName);
    setDownloadSuccess(true);

    onLogAudit(
      'unlock_supervisor',
      `Exportación de respaldo JSON completo descargada (${inventory.length} productos, ${cashiers.length} cajeros, ${auditLogs.length} logs) por ${currentCashier.name}`
    );

    setTimeout(() => {
      setDownloadSuccess(false);
    }, 4000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(previewString);
    setCopiedToClipboard(true);
    posAudio.playScanBeep();
    setTimeout(() => setCopiedToClipboard(false), 2500);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError('');
    setRestoreSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setRestoreJsonText(text);
        validateAndParseBackup(text);
      } catch (err) {
        setRestoreError('El archivo seleccionado no contiene un JSON válido.');
        posAudio.playErrorBuzz();
      }
    };
    reader.readAsText(file);
  };

  const validateAndParseBackup = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed.inventory && !parsed.cashiers) {
        throw new Error('El JSON no contiene las estructuras de inventario o cajeros esperadas.');
      }
      setRestoreError('');
      return parsed;
    } catch (err: any) {
      setRestoreError(err?.message || 'Error al procesar el archivo JSON de respaldo.');
      posAudio.playErrorBuzz();
      return null;
    }
  };

  const handleApplyRestore = () => {
    const parsed = validateAndParseBackup(restoreJsonText);
    if (!parsed) return;

    if (onRestoreBackup) {
      onRestoreBackup({
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : undefined,
        cashiers: Array.isArray(parsed.cashiers) ? parsed.cashiers : undefined,
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : undefined,
      });

      posAudio.playSuccessChime();
      setRestoreSuccess('¡Respaldo importado y restaurado exitosamente en el sistema!');
      onLogAudit(
        'unlock_supervisor',
        `Respaldo JSON restaurado en el sistema por ${currentCashier.name}`
      );
      setTimeout(() => {
        setRestoreSuccess('');
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#191f2f] border-2 border-[#f59e0b]/50 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#374151]/40 flex items-center justify-between bg-[#141b2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/40 flex items-center justify-center text-[#f59e0b]">
              <span className="material-symbols-outlined text-[24px]">backup</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Respaldo Local del Sistema</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                  ADMIN JSON
                </span>
              </div>
              <p className="text-xs text-[#e6bdb8] mt-0.5">
                Exporta y descarga el inventario completo, usuarios/cajeros y registros de auditoría en un archivo .json local.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="flex border-b border-[#374151]/40 bg-[#161c2b] px-4 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#e6bdb8] hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Descargar Respaldo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#e6bdb8] hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">data_object</span>
            <span>Vista Previa JSON</span>
          </button>

          {onRestoreBackup && (
            <button
              type="button"
              onClick={() => setActiveTab('restore')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'restore'
                  ? 'border-[#f59e0b] text-[#f59e0b]'
                  : 'border-transparent text-[#e6bdb8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">upload_file</span>
              <span>Restaurar Copia</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#141b2b] border border-[#374151]/40 rounded-xl p-3 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-[#ef4444] text-[22px] mb-1">
                    inventory_2
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{inventory.length}</span>
                  <span className="text-[11px] text-[#e6bdb8]">Productos Catálogo</span>
                </div>

                <div className="bg-[#141b2b] border border-[#374151]/40 rounded-xl p-3 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-[#3b82f6] text-[22px] mb-1">
                    group
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{cashiers.length}</span>
                  <span className="text-[11px] text-[#e6bdb8]">Cajeros & Admin</span>
                </div>

                <div className="bg-[#141b2b] border border-[#374151]/40 rounded-xl p-3 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-[#10b981] text-[22px] mb-1">
                    security
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{auditLogs.length}</span>
                  <span className="text-[11px] text-[#e6bdb8]">Logs Auditoría</span>
                </div>

                <div className="bg-[#141b2b] border border-[#374151]/40 rounded-xl p-3 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-[#f59e0b] text-[22px] mb-1">
                    receipt_long
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{tickets.length}</span>
                  <span className="text-[11px] text-[#e6bdb8]">Tickets Registrados</span>
                </div>
              </div>

              {/* Information box */}
              <div className="p-3.5 rounded-xl bg-[#232a3a]/60 border border-[#374151]/40 text-xs text-[#dce2f7] space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">info</span>
                  <span>¿Qué incluye este archivo de respaldo?</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[#e6bdb8] pl-1">
                  <li>
                    <strong className="text-white">Inventario:</strong> Nombres, códigos de barra (EAN/UPC), precios COP, stock y categorías de todos los productos.
                  </li>
                  <li>
                    <strong className="text-white">Cajeros & Usuarios:</strong> Identificadores, credenciales, PINs/contraseñas cifradas, tarjetas NFC vinculadas y saldo inicial en gaveta.
                  </li>
                  <li>
                    <strong className="text-white">Auditoría & Seguridad:</strong> Registro cronológico de aperturas, cierres de turno, intentos fallidos, autenticaciones NFC y modificaciones.
                  </li>
                  <li>
                    <strong className="text-white">Historial de Tickets:</strong> Todas las transacciones y ventas efectuadas en la terminal.
                  </li>
                </ul>
              </div>

              {/* Feedback Alert on Download */}
              {downloadSuccess && (
                <div className="p-3 rounded-xl bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] text-xs flex items-center gap-2 animate-fadeIn">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <div className="flex-1">
                    <p className="font-bold">¡Descarga Iniciada con Éxito!</p>
                    <p className="text-[11px] text-[#a7f3d0]">
                      Archivo guardado en tu carpeta de Descargas: <code className="font-mono">{lastExportName}</code>
                    </p>
                  </div>
                </div>
              )}

              {/* Main Call to Action */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#3d2400] text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[22px]">download</span>
                  <span>Exportar & Descargar JSON Ahora</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="py-3 px-4 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-white text-xs font-semibold flex items-center justify-center gap-2 border border-[#374151]/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiedToClipboard ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedToClipboard ? '¡Copiado!' : 'Copiar JSON'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#e6bdb8]">
                  Estructura JSON generada ({new Blob([previewString]).size} bytes):
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 text-xs text-[#90cdff] hover:underline"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {copiedToClipboard ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedToClipboard ? 'Copiado al portapapeles' : 'Copiar todo'}</span>
                </button>
              </div>

              <div className="relative bg-[#070e1d] border border-[#374151]/50 rounded-xl p-3.5 max-h-[350px] overflow-y-auto text-xs font-mono text-[#a5f3fc]">
                <pre className="whitespace-pre-wrap">{previewString}</pre>
              </div>
            </div>
          )}

          {activeTab === 'restore' && onRestoreBackup && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#dc2626]/15 border border-[#dc2626]/40 text-[#ef4444] text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <div>
                  <p className="font-bold">Precaución al Restaurar Datos</p>
                  <p className="text-[11px] text-[#fca5a5]">
                    Al cargar un archivo JSON de respaldo, los productos y cajeros actuales serán reemplazados por los datos contenidos en el archivo.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">
                  Seleccionar archivo .json local de respaldo:
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileImport}
                  className="w-full text-xs text-[#e6bdb8] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#232a3a] file:text-white hover:file:bg-[#323949] cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">
                  O pegar contenido JSON directamente:
                </label>
                <textarea
                  rows={6}
                  value={restoreJsonText}
                  onChange={(e) => {
                    setRestoreJsonText(e.target.value);
                    setRestoreError('');
                    setRestoreSuccess('');
                  }}
                  placeholder='{"version": "1.2.0", "inventory": [...], "cashiers": [...]}'
                  className="w-full bg-[#070e1d] border border-[#374151]/60 rounded-xl p-3 text-xs font-mono text-white placeholder-[#e6bdb8]/40 focus:outline-none focus:border-[#f59e0b]"
                />
              </div>

              {restoreError && (
                <div className="p-2.5 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-xs font-medium">
                  {restoreError}
                </div>
              )}

              {restoreSuccess && (
                <div className="p-2.5 rounded-lg bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] text-xs font-medium">
                  {restoreSuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleApplyRestore}
                  disabled={!restoreJsonText.trim()}
                  className="py-2.5 px-4 rounded-xl bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">restore</span>
                  <span>Aplicar y Restaurar Respaldo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#374151]/40 bg-[#141b2b] flex items-center justify-between">
          <span className="text-[11px] text-[#e6bdb8] flex items-center gap-1 font-mono">
            <span className="material-symbols-outlined text-[14px] text-[#10b981]">verified</span>
            <span>Descarga local sin conexión • Compatible con formato JSON POS</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
