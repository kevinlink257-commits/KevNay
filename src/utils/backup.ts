import { Product, Cashier, AuditEvent, SaleTicket } from '../types/pos';

export interface PosBackupData {
  version: string;
  exportedAt: string;
  system: string;
  terminalId: string;
  metadata: {
    totalProducts: number;
    totalCashiers: number;
    totalAuditLogs: number;
    totalTickets: number;
    exportedBy: string;
  };
  inventory: Product[];
  cashiers: Cashier[];
  auditLogs: AuditEvent[];
  tickets?: SaleTicket[];
}

/**
 * Creates and triggers the local file download of the system backup JSON
 */
export function exportAndDownloadBackup(params: {
  inventory: Product[];
  cashiers: Cashier[];
  auditLogs: AuditEvent[];
  tickets?: SaleTicket[];
  exportedBy: string;
  terminalId?: string;
}): PosBackupData {
  const {
    inventory,
    cashiers,
    auditLogs,
    tickets = [],
    exportedBy,
    terminalId = 'POS-01',
  } = params;

  const now = new Date();
  const isoDate = now.toISOString();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(
    now.getMinutes()
  ).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

  const backupData: PosBackupData = {
    version: '1.2.0',
    system: 'Kev Nay Retail POS - Admin Suite',
    terminalId,
    exportedAt: isoDate,
    metadata: {
      totalProducts: inventory.length,
      totalCashiers: cashiers.length,
      totalAuditLogs: auditLogs.length,
      totalTickets: tickets.length,
      exportedBy,
    },
    inventory,
    cashiers,
    auditLogs,
    tickets,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `respaldo_pos_${dateStr}_${timeStr}.json`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  }, 300);

  return backupData;
}
