import React from 'react';
import { AuditEvent } from '../types/pos';

interface AuditLogModalProps {
  logs: AuditEvent[];
  onClose: () => void;
  onClearLogs?: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ logs, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-lg flex flex-col space-y-4 shadow-2xl max-h-[85vh]">
        <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#10b981] text-[22px]">security</span>
            <span className="font-bold text-sm text-white">Auditoría de Seguridad & Telemetría POS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
          {logs.map((log) => {
            const isLock = log.type === 'lock';
            const isFailed = log.type === 'failed_pin';
            const isSupervisor = log.type === 'unlock_supervisor';

            return (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-[#141b2b] border border-[#374151]/30 flex items-start gap-2.5 text-xs"
              >
                <span
                  className={`material-symbols-outlined text-[18px] mt-0.5 ${
                    isFailed
                      ? 'text-[#ef4444]'
                      : isLock
                      ? 'text-[#f59e0b]'
                      : isSupervisor
                      ? 'text-[#90cdff]'
                      : 'text-[#10b981]'
                  }`}
                >
                  {isFailed
                    ? 'error'
                    : isLock
                    ? 'lock'
                    : isSupervisor
                    ? 'shield'
                    : 'verified_user'}
                </span>

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">{log.cashierName}</span>
                    <span className="text-[10px] font-mono text-[#e6bdb8]">{log.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-[#e6bdb8] mt-0.5">{log.details}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-[#374151]/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#232a3a] text-xs font-semibold text-white hover:bg-[#323949]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
