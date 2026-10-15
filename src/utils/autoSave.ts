import { Product, Cashier, AuditEvent, SaleTicket } from '../types/pos';
import { PosBackupData } from './backup';

export interface AutoSaveConfig {
  enabled: boolean;
  autoDownloadOnLimit: boolean;
  sizeLimitKB: number; // Limit in Kilobytes (e.g. 50, 100, 250, 500, 1000)
  cooldownSeconds: number; // Minimum seconds between automatic file downloads
  notifyToast: boolean;
}

export interface AutoSaveMetrics {
  lastSavedAt: string;
  lastTrigger: string;
  databaseSizeBytes: number;
  databaseSizeKB: number;
  databaseSizeFormatted: string;
  totalAutoSaves: number;
  totalAutoDownloads: number;
  lastAutoDownloadedAt?: string;
  lastAutoDownloadFile?: string;
}

export const DEFAULT_AUTOSAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  autoDownloadOnLimit: true,
  sizeLimitKB: 100, // 100 KB default threshold
  cooldownSeconds: 20, // 20s cooldown between downloads
  notifyToast: true,
};

const CONFIG_STORAGE_KEY = 'pos_autosave_config';
const METRICS_STORAGE_KEY = 'pos_autosave_metrics';
const FULL_DB_STORAGE_KEY = 'pos_full_database';
let lastDownloadTimestamp = 0;

/**
 * Retrieve saved autosave configuration from localStorage or default
 */
export function getAutoSaveConfig(): AutoSaveConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_AUTOSAVE_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // Ignore JSON parse errors
  }
  return { ...DEFAULT_AUTOSAVE_CONFIG };
}

/**
 * Persist updated autosave configuration
 */
export function saveAutoSaveConfig(config: AutoSaveConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Fallback if quota exceeded
  }
}

/**
 * Retrieve autosave telemetry metrics from localStorage
 */
export function getAutoSaveMetrics(): AutoSaveMetrics {
  try {
    const raw = localStorage.getItem(METRICS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore error
  }
  return {
    lastSavedAt: 'Nunca',
    lastTrigger: 'Inicio de sistema',
    databaseSizeBytes: 0,
    databaseSizeKB: 0,
    databaseSizeFormatted: '0 KB',
    totalAutoSaves: 0,
    totalAutoDownloads: 0,
  };
}

/**
 * Persist metrics
 */
export function saveAutoSaveMetrics(metrics: AutoSaveMetrics): void {
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore error
  }
}

/**
 * Format raw byte count into human readable KB / MB
 */
export function formatDataBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generates the unified snapshot of the entire database
 */
export function createDatabaseSnapshot(params: {
  inventory: Product[];
  cashiers: Cashier[];
  auditLogs: AuditEvent[];
  tickets: SaleTicket[];
  exportedBy?: string;
  terminalId?: string;
}): PosBackupData {
  const {
    inventory,
    cashiers,
    auditLogs,
    tickets,
    exportedBy = 'Admin Sistema',
    terminalId = 'POS-01',
  } = params;

  return {
    version: '1.2.0',
    system: 'Kev Nay Retail POS - Admin Suite',
    terminalId,
    exportedAt: new Date().toISOString(),
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
}

/**
 * Triggers an immediate browser download of the backup JSON
 */
export function triggerJsonDownload(data: PosBackupData, fileName: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = fileName;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();

  setTimeout(() => {
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  }, 400);
}

export interface AutoSaveResult {
  success: boolean;
  dataSizeBytes: number;
  dataSizeKB: number;
  dataSizeFormatted: string;
  autoDownloaded: boolean;
  downloadedFileName?: string;
  isExceedingLimit: boolean;
  limitKB: number;
  timestamp: string;
  trigger: string;
  error?: string;
}

/**
 * Performs full database auto-save in localStorage, calculates payload size,
 * and executes auto-download if the size surpasses the user-configured limit.
 */
export function performFullDatabaseAutoSave(params: {
  inventory: Product[];
  cashiers: Cashier[];
  auditLogs: AuditEvent[];
  tickets: SaleTicket[];
  triggerDescription: string;
  currentCashierName?: string;
  configOverride?: Partial<AutoSaveConfig>;
  forceDownload?: boolean;
}): AutoSaveResult {
  const config = {
    ...getAutoSaveConfig(),
    ...(params.configOverride || {}),
  };

  const prevMetrics = getAutoSaveMetrics();
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const snapshot = createDatabaseSnapshot({
    inventory: params.inventory,
    cashiers: params.cashiers,
    auditLogs: params.auditLogs,
    tickets: params.tickets,
    exportedBy: params.currentCashierName || 'Autoguardado Automático',
    terminalId: 'POS-01',
  });

  let jsonString = '';
  try {
    jsonString = JSON.stringify(snapshot, null, 2);
  } catch (err: any) {
    return {
      success: false,
      dataSizeBytes: 0,
      dataSizeKB: 0,
      dataSizeFormatted: '0 KB',
      autoDownloaded: false,
      isExceedingLimit: false,
      limitKB: config.sizeLimitKB,
      timestamp: timeFormatted,
      trigger: params.triggerDescription,
      error: err?.message || 'Error serializando JSON de la base de datos',
    };
  }

  // Calculate size in bytes using Blob
  const byteCount = new Blob([jsonString]).size;
  const sizeKB = +(byteCount / 1024).toFixed(2);
  const sizeFormatted = formatDataBytes(byteCount);

  // 1. Save complete database snapshot to localStorage if enabled
  let saveSuccess = true;
  let saveError: string | undefined = undefined;

  if (config.enabled) {
    try {
      localStorage.setItem(FULL_DB_STORAGE_KEY, jsonString);
      localStorage.setItem('pos_last_autosave_time', now.toISOString());
    } catch (e: any) {
      saveSuccess = false;
      saveError = 'Cuota de localStorage excedida por el navegador.';
    }
  }

  // 2. Check if size exceeds configured threshold
  const isExceeding = sizeKB >= config.sizeLimitKB;
  let didAutoDownload = false;
  let downloadedFileName: string | undefined = undefined;

  const nowMs = Date.now();
  const cooldownMs = (config.cooldownSeconds || 20) * 1000;
  const cooldownElapsed = nowMs - lastDownloadTimestamp >= cooldownMs;

  if (params.forceDownload || (config.autoDownloadOnLimit && isExceeding && cooldownElapsed)) {
    lastDownloadTimestamp = nowMs;
    didAutoDownload = true;
    const dateStr = now.toISOString().slice(0, 10);
    const timeFileStr = `${String(now.getHours()).padStart(2, '0')}-${String(
      now.getMinutes()
    ).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    downloadedFileName = `respaldo_autoguardado_${dateStr}_${timeFileStr}_${Math.round(sizeKB)}KB.json`;

    triggerJsonDownload(snapshot, downloadedFileName);
  }

  // 3. Update telemetry metrics
  const updatedMetrics: AutoSaveMetrics = {
    lastSavedAt: `Hoy, ${timeFormatted}`,
    lastTrigger: params.triggerDescription,
    databaseSizeBytes: byteCount,
    databaseSizeKB: sizeKB,
    databaseSizeFormatted: sizeFormatted,
    totalAutoSaves: prevMetrics.totalAutoSaves + 1,
    totalAutoDownloads: didAutoDownload
      ? prevMetrics.totalAutoDownloads + 1
      : prevMetrics.totalAutoDownloads,
    lastAutoDownloadedAt: didAutoDownload ? `Hoy, ${timeFormatted}` : prevMetrics.lastAutoDownloadedAt,
    lastAutoDownloadFile: didAutoDownload ? downloadedFileName : prevMetrics.lastAutoDownloadFile,
  };

  saveAutoSaveMetrics(updatedMetrics);

  return {
    success: saveSuccess,
    dataSizeBytes: byteCount,
    dataSizeKB: sizeKB,
    dataSizeFormatted: sizeFormatted,
    autoDownloaded: didAutoDownload,
    downloadedFileName,
    isExceedingLimit: isExceeding,
    limitKB: config.sizeLimitKB,
    timestamp: timeFormatted,
    trigger: params.triggerDescription,
    error: saveError,
  };
}
