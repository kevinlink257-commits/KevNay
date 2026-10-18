import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cashier,
  Product,
  SaleTicket,
  AuditEvent,
  OperatingHoursConfig,
  PosPaperFormat,
} from './types/pos';
import {
  INITIAL_CASHIERS,
  INITIAL_PRODUCTS,
  INITIAL_TICKETS,
  INITIAL_AUDIT_LOGS,
} from './data/mockData';
import { posAudio } from './utils/audio';
import { LockScreen } from './components/LockScreen';
import { PosRegister } from './components/PosRegister';
import { InventoryManager } from './components/InventoryManager';
import { ShiftReportView } from './components/ShiftReportView';
import { TicketsHistory } from './components/TicketsHistory';
import { CashiersManager } from './components/CashiersManager';
import { AuditLogModal } from './components/AuditLogModal';
import { BackupManagerModal } from './components/BackupManagerModal';
import { AdminAnalyticsDashboard } from './components/AdminAnalyticsDashboard';
import { ResetSalesModal } from './components/ResetSalesModal';
import { PrintFormatSettings } from './components/PrintFormatSettings';
import { exportAndDownloadBackup } from './utils/backup';
import {
  performFullDatabaseAutoSave,
  getAutoSaveConfig,
  getAutoSaveMetrics,
  formatDataBytes,
} from './utils/autoSave';
import { loadOperatingHours, saveOperatingHours } from './utils/operatingHours';
import {
  getStoredPaperFormat,
  setStoredPaperFormat,
  printTestTicket,
} from './utils/printReceipt';

export default function App() {
  // App state with local persistence (checks unified pos_full_database snapshot first)
  const [cashiers, setCashiers] = useState<Cashier[]>(() => {
    try {
      const full = localStorage.getItem('pos_full_database');
      if (full) {
        const parsed = JSON.parse(full);
        if (Array.isArray(parsed.cashiers) && parsed.cashiers.length > 0) return parsed.cashiers;
      }
      const saved = localStorage.getItem('pos_cashiers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CASHIERS;
  });

  const [currentCashier, setCurrentCashier] = useState<Cashier>(() => {
    try {
      const saved = localStorage.getItem('pos_current_cashier');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CASHIERS[0]; // Kevin N.
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const full = localStorage.getItem('pos_full_database');
      let loaded: Product[] = [];
      if (full) {
        const parsed = JSON.parse(full);
        if (Array.isArray(parsed.inventory) && parsed.inventory.length > 0) loaded = parsed.inventory;
      }
      if (loaded.length === 0) {
        const saved = localStorage.getItem('pos_products');
        if (saved) loaded = JSON.parse(saved);
      }
      if (loaded.length > 0) {
        // If stored inventory lacks accessory items, append them so they are readily available
        const hasAccessories = loaded.some(
          (p) =>
            p.category.includes('Joyería') ||
            p.category.includes('Collares') ||
            p.category.includes('Relojes') ||
            p.category.includes('Pulseras') ||
            p.category.includes('Accesorios')
        );
        if (!hasAccessories) {
          const accItems = INITIAL_PRODUCTS.filter((p) => p.id.startsWith('acc-'));
          return [...loaded, ...accItems];
        }
        return loaded;
      }
    } catch {}
    return INITIAL_PRODUCTS;
  });

  const [isLocked, setIsLocked] = useState<boolean>(true); // Starts locked to match reference design
  const [tickets, setTickets] = useState<SaleTicket[]>(() => {
    try {
      const full = localStorage.getItem('pos_full_database');
      if (full) {
        const parsed = JSON.parse(full);
        if (Array.isArray(parsed.tickets) && parsed.tickets.length > 0) return parsed.tickets;
      }
      const saved = localStorage.getItem('pos_tickets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_TICKETS;
  });
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(() => {
    try {
      const full = localStorage.getItem('pos_full_database');
      if (full) {
        const parsed = JSON.parse(full);
        if (Array.isArray(parsed.auditLogs) && parsed.auditLogs.length > 0) return parsed.auditLogs;
      }
    } catch {}
    return INITIAL_AUDIT_LOGS;
  });

  // Active view inside POS (includes new analytics tab)
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'shift' | 'tickets' | 'cashiers' | 'analytics'>('pos');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [backupModalInitialTab, setBackupModalInitialTab] = useState<'export' | 'autosave' | 'preview' | 'restore'>('autosave');
  const [viewMode, setViewMode] = useState<'responsive' | 'mobile_device'>('responsive');

  // Floating Toast notification for Autosave and Limit Exceeded Downloads
  const [autoSaveToast, setAutoSaveToast] = useState<{
    message: string;
    subMessage?: string;
    type: 'save' | 'download_alert';
  } | null>(null);

  // Reset All Sales State Modal
  const [showResetSalesModal, setShowResetSalesModal] = useState<boolean>(false);

  // RBAC Access Control Gate State for Non-Admin Cashiers
  const [showAdminGateModal, setShowAdminGateModal] = useState<boolean>(false);
  const [pendingAdminTab, setPendingAdminTab] = useState<'inventory' | 'cashiers' | 'analytics' | null>(null);
  const [adminGatePin, setAdminGatePin] = useState<string>('');
  const [adminGateError, setAdminGateError] = useState<string>('');

  // Emergency shift close state
  const [emergencyCloseNotice, setEmergencyCloseNotice] = useState<boolean>(false);

  // Globally Synchronized Ticket Printing Paper Format (80mm, 58mm, 57mm)
  const [currentPaperFormat, setCurrentPaperFormat] = useState<PosPaperFormat>(() => getStoredPaperFormat());
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState<boolean>(false);
  const [showPrintFormatModal, setShowPrintFormatModal] = useState<boolean>(false);
  const formatMenuRef = useRef<HTMLDivElement>(null);

  // Keep format synchronized with all views, modals, and localStorage changes
  useEffect(() => {
    const handleFormatChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ format: PosPaperFormat }>;
      if (customEvent.detail?.format) {
        setCurrentPaperFormat(customEvent.detail.format);
      }
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pos_paper_format' && e.newValue) {
        if (e.newValue === '80mm' || e.newValue === '58mm' || e.newValue === '57mm') {
          setCurrentPaperFormat(e.newValue);
        }
      }
    };
    window.addEventListener('pos_paper_format_changed', handleFormatChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('pos_paper_format_changed', handleFormatChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Close quick format dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setIsFormatMenuOpen(false);
      }
    };
    if (isFormatMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFormatMenuOpen]);

  const handleQuickChangeFormat = (fmt: PosPaperFormat) => {
    posAudio.playKeyClick();
    setCurrentPaperFormat(fmt);
    setStoredPaperFormat(fmt);
    setIsFormatMenuOpen(false);
    logAudit(
      'sale_completed',
      `Formato de impresión de ticket cambiado a ${fmt} desde la barra de control superior por ${currentCashier.name}`
    );
  };

  // Dedicated Terminal Fullscreen API Mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' && !!document.fullscreenElement;
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    posAudio.playKeyClick();
    try {
      if (!document.fullscreenElement) {
        const elem = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
        logAudit('lock', 'Modo Terminal Pantalla Completa activado');
      } else {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>;
          msExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        logAudit('lock', 'Modo Terminal Pantalla Completa desactivado');
      }
    } catch (err) {
      console.warn('Fullscreen request could not be completed:', err);
    }
  };

  // Store Operating Hours Configuration & Persistence
  const [operatingHours, setOperatingHours] = useState<OperatingHoursConfig>(() => loadOperatingHours());

  const handleUpdateOperatingHours = (newConfig: OperatingHoursConfig) => {
    setOperatingHours(newConfig);
    saveOperatingHours(newConfig);
    logAudit(
      'sale_completed',
      `Horario operativo actualizado por ${currentCashier.name} (Control: ${newConfig.enabled ? 'Activo' : 'Inactivo'}, Modo Estricto: ${newConfig.strictMode ? 'Sí' : 'No'})`
    );
  };

  // Individual localStorage item persistence
  useEffect(() => {
    try {
      localStorage.setItem('pos_cashiers', JSON.stringify(cashiers));
    } catch {}
  }, [cashiers]);

  useEffect(() => {
    try {
      localStorage.setItem('pos_current_cashier', JSON.stringify(currentCashier));
    } catch {}
  }, [currentCashier]);

  useEffect(() => {
    try {
      localStorage.setItem('pos_products', JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('pos_tickets', JSON.stringify(tickets));
    } catch {}
  }, [tickets]);

  // Initial Snapshot creation if none exists yet
  useEffect(() => {
    if (!localStorage.getItem('pos_full_database')) {
      performFullDatabaseAutoSave({
        inventory: products,
        cashiers,
        auditLogs,
        tickets,
        triggerDescription: 'Snapshot inicial del sistema',
        currentCashierName: currentCashier.name,
      });
    }
  }, []);

  // Helper to log audit events
  const logAudit = useCallback((type: AuditEvent['type'], details: string) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${hours}:${minutes}:${seconds} COT`;

    const newLog: AuditEvent = {
      id: `a-${Date.now()}`,
      timestamp,
      type,
      cashierName: currentCashier.name,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  }, [currentCashier.name]);

  // Unified Auto-Save Trigger for Sales and Inventory Changes
  const triggerAutoSave = useCallback((
    newProducts: Product[],
    newCashiers: Cashier[],
    newAuditLogs: AuditEvent[],
    newTickets: SaleTicket[],
    triggerDesc: string
  ) => {
    const result = performFullDatabaseAutoSave({
      inventory: newProducts,
      cashiers: newCashiers,
      auditLogs: newAuditLogs,
      tickets: newTickets,
      triggerDescription: triggerDesc,
      currentCashierName: currentCashier.name,
    });

    const config = getAutoSaveConfig();

    if (result.autoDownloaded) {
      posAudio.playCashRegisterChime();
      setAutoSaveToast({
        type: 'download_alert',
        message: '¡Descarga Automática de Respaldo!',
        subMessage: `Base de datos superó límite de ${result.limitKB} KB (Actual: ${result.dataSizeKB} KB). Archivo descargado: ${result.downloadedFileName}`,
      });

      // Audit log entry
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} COT`;
      const autoDownloadLog: AuditEvent = {
        id: `a-${Date.now()}`,
        timestamp: timeStr,
        type: 'unlock_supervisor',
        cashierName: 'Sistema de Autoguardado',
        details: `Descarga automática generada: archivo ${result.downloadedFileName} (${result.dataSizeKB} KB excedió límite ${result.limitKB} KB)`,
      };
      setAuditLogs((prev) => [autoDownloadLog, ...prev]);
    } else if (config.notifyToast) {
      setAutoSaveToast({
        type: 'save',
        message: 'Base de datos autoguardada en LocalStorage',
        subMessage: `${result.dataSizeFormatted} • ${triggerDesc}`,
      });
    }

    setTimeout(() => {
      setAutoSaveToast((curr) => (curr ? null : curr));
    }, 4000);
  }, [currentCashier.name]);

  // Lock terminal
  const handleLockTerminal = () => {
    setIsLocked(true);
    posAudio.playKeyClick();
    logAudit('lock', `Bloqueo manual de terminal POS-01 por ${currentCashier.name}`);
  };

  // Cerrar Sesión
  const handleLogout = () => {
    posAudio.playKeyClick();
    logAudit('lock', `Cierre de sesión manual realizado por ${currentCashier.name}`);
    setIsLocked(true);
  };

  // Unlock terminal
  const handleUnlock = (cashier: Cashier) => {
    setCurrentCashier(cashier);
    setIsLocked(false);
  };

  // Switch active cashier
  const handleSwitchCashier = (cashier: Cashier) => {
    setCurrentCashier(cashier);
    logAudit('lock', `Operador cambiado a ${cashier.name} (${cashier.code})`);
  };

  // Emergency shift close action
  const handleEmergencyShiftClose = () => {
    setEmergencyCloseNotice(true);
    posAudio.playScanBeep();
  };

  const confirmEmergencyClose = () => {
    posAudio.playCashRegisterChime();
    logAudit('shift_close', `Cierre urgente de turno y corte Z generado para ${currentCashier.name}`);
    setEmergencyCloseNotice(false);
    setCurrentCashier((prev) => ({ ...prev, completedTickets: 0 }));
  };

  // Handle completed sale
  const handleCompleteSale = (ticket: SaleTicket, updatedCashier: Cashier) => {
    const nextTickets = [ticket, ...tickets];
    const nextProducts = products.map((prod) => {
      const cartItem = ticket.items.find((i) => i.product.id === prod.id);
      if (cartItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - cartItem.quantity),
        };
      }
      return prod;
    });
    const nextCashiers = cashiers.map((c) => (c.id === updatedCashier.id ? updatedCashier : c));

    setTickets(nextTickets);
    setProducts(nextProducts);
    setCurrentCashier(updatedCashier);
    setCashiers(nextCashiers);

    // Auto-save full database to localStorage and conditional auto-download on limit
    triggerAutoSave(
      nextProducts,
      nextCashiers,
      auditLogs,
      nextTickets,
      `Venta #${ticket.ticketNumber} completada`
    );
  };

  // Void a ticket
  const handleVoidTicket = (ticketId: string) => {
    let voidedTicketNum = '';
    const nextTickets = tickets.map((t) => {
      if (t.id === ticketId) {
        voidedTicketNum = t.ticketNumber;
        if (t.paymentMethod === 'efectivo') {
          setCurrentCashier((c) => ({
            ...c,
            drawerCash: Math.max(0, c.drawerCash - t.total),
          }));
        }
        logAudit('sale_completed', `Venta ${t.ticketNumber} anulada por supervisor`);
        return { ...t, status: 'anulada' as const };
      }
      return t;
    });
    setTickets(nextTickets);
    triggerAutoSave(
      products,
      cashiers,
      auditLogs,
      nextTickets,
      `Venta ${voidedTicketNum} anulada`
    );
  };

  // Reset all sales data to zero handler (Exclusive to Administrator)
  const handleResetSalesToZero = () => {
    if (!isAdmin) {
      posAudio.playErrorBuzz();
      return;
    }

    // 1. Clear tickets
    const previousTicketsCount = tickets.length;
    setTickets([]);
    try {
      localStorage.setItem('pos_tickets', JSON.stringify([]));
    } catch {}

    // 2. Reset cashiers drawer cash and completed tickets to 0
    const resetCashiers = cashiers.map((c) => ({
      ...c,
      drawerCash: 0,
      completedTickets: 0,
    }));
    setCashiers(resetCashiers);
    try {
      localStorage.setItem('pos_cashiers', JSON.stringify(resetCashiers));
    } catch {}

    // 3. Reset current cashier sales and drawer cash
    const updatedCurrent: Cashier = {
      ...currentCashier,
      drawerCash: 0,
      completedTickets: 0,
    };
    setCurrentCashier(updatedCurrent);
    try {
      localStorage.setItem('pos_current_cashier', JSON.stringify(updatedCurrent));
    } catch {}

    // 4. Update full database snapshot with empty tickets and zeroed counters
    triggerAutoSave(
      products,
      resetCashiers,
      auditLogs,
      [],
      'Reinicio total de ventas a $0 realizado'
    );

    // 5. Audit log
    logAudit(
      'unlock_supervisor',
      `REINICIO TOTAL: ${previousTicketsCount} ventas/tickets eliminados. Gaveta de caja y turnos restablecidos a $0 por ${currentCashier.name}`
    );

    // 6. Sound & Toast
    posAudio.playCashRegisterChime();
    setShowResetSalesModal(false);
    setAutoSaveToast({
      type: 'save',
      message: '¡Ventas restablecidas a $0 exitosamente!',
      subMessage: 'Todos los datos de ventas anteriores fueron eliminados. Listo para registrar ventas nuevas.',
    });
  };

  // Toggle sound
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    posAudio.setEnabled(nextVal);
  };

  // Cashiers Management Handlers
  const handleAddCashier = (newCashier: Cashier) => {
    const nextCashiers = [...cashiers, newCashier];
    setCashiers(nextCashiers);
    triggerAutoSave(products, nextCashiers, auditLogs, tickets, `Nuevo cajero: ${newCashier.name}`);
  };

  const handleUpdateCashier = (updatedCashier: Cashier) => {
    const nextCashiers = cashiers.map((c) => (c.id === updatedCashier.id ? updatedCashier : c));
    setCashiers(nextCashiers);
    if (currentCashier.id === updatedCashier.id) {
      setCurrentCashier(updatedCashier);
    }
    triggerAutoSave(products, nextCashiers, auditLogs, tickets, `Cajero actualizado: ${updatedCashier.name}`);
  };

  const handleDeleteCashier = (cashierId: string) => {
    const nextCashiers = cashiers.filter((c) => c.id !== cashierId);
    setCashiers(nextCashiers);
    triggerAutoSave(products, nextCashiers, auditLogs, tickets, `Cajero eliminado (${cashierId})`);
  };

  // Inventory Management Handlers with Auto-Save
  const handleUpdateProduct = (updated: Product) => {
    const nextProducts = products.map((p) => (p.id === updated.id ? updated : p));
    setProducts(nextProducts);
    triggerAutoSave(
      nextProducts,
      cashiers,
      auditLogs,
      tickets,
      `Producto modificado: ${updated.name}`
    );
  };

  const handleAddProduct = (created: Product) => {
    const nextProducts = [created, ...products];
    setProducts(nextProducts);
    logAudit('lock', `Nuevo producto creado: ${created.name} (${created.sku})`);
    triggerAutoSave(
      nextProducts,
      cashiers,
      auditLogs,
      tickets,
      `Producto creado: ${created.name}`
    );
  };

  const handleDeleteProduct = (productId: string) => {
    const nextProducts = products.filter((p) => p.id !== productId);
    setProducts(nextProducts);
    logAudit('lock', `Producto ${productId} eliminado del catálogo por ${currentCashier.name}`);
    triggerAutoSave(
      nextProducts,
      cashiers,
      auditLogs,
      tickets,
      `Producto eliminado (${productId})`
    );
  };

  const handleClearInventory = () => {
    setProducts([]);
    logAudit('lock', `Catálogo de inventario vaciado por ${currentCashier.name}`);
    triggerAutoSave(
      [],
      cashiers,
      auditLogs,
      tickets,
      'Inventario vaciado por administrador'
    );
  };

  const handleBatchUpdateProducts = (updatedProducts: Product[], reason?: string) => {
    setProducts(updatedProducts);
    logAudit(
      'lock',
      reason || `Umbrales de stock mínimo actualizados en lote para ${updatedProducts.length} productos`
    );
    triggerAutoSave(
      updatedProducts,
      cashiers,
      auditLogs,
      tickets,
      reason || `Umbrales actualizados (${updatedProducts.length} productos)`
    );
  };

  const handleRestoreDefaultCatalog = () => {
    setProducts(INITIAL_PRODUCTS);
    logAudit('lock', `Catálogo de inventario de demostración restaurado`);
    triggerAutoSave(
      INITIAL_PRODUCTS,
      cashiers,
      auditLogs,
      tickets,
      'Catálogo demo restaurado'
    );
  };

  // Direct export backup function
  const handleExportBackup = () => {
    posAudio.playCashRegisterChime();
    exportAndDownloadBackup({
      inventory: products,
      cashiers,
      auditLogs,
      tickets,
      exportedBy: currentCashier.name,
      terminalId: 'POS-01',
    });
    logAudit(
      'unlock_supervisor',
      `Exportación JSON de respaldo descargada por ${currentCashier.name} (${products.length} productos, ${cashiers.length} cajeros, ${auditLogs.length} logs)`
    );
  };

  // Restore backup state function
  const handleRestoreBackup = (backup: {
    inventory?: Product[];
    cashiers?: Cashier[];
    auditLogs?: AuditEvent[];
  }) => {
    const nextProducts = backup.inventory && Array.isArray(backup.inventory) ? backup.inventory : products;
    const nextCashiers = backup.cashiers && Array.isArray(backup.cashiers) ? backup.cashiers : cashiers;
    const nextAuditLogs = backup.auditLogs && Array.isArray(backup.auditLogs) ? backup.auditLogs : auditLogs;

    if (backup.inventory && Array.isArray(backup.inventory)) {
      setProducts(backup.inventory);
    }
    if (backup.cashiers && Array.isArray(backup.cashiers)) {
      setCashiers(backup.cashiers);
    }
    if (backup.auditLogs && Array.isArray(backup.auditLogs)) {
      setAuditLogs(backup.auditLogs);
    }

    triggerAutoSave(
      nextProducts,
      nextCashiers,
      nextAuditLogs,
      tickets,
      'Respaldo restaurado en el sistema'
    );
  };

  // Tab navigation with Role-Based Access Control
  const isAdmin = !!currentCashier.isMaster;

  const handleTabClick = (tab: 'pos' | 'inventory' | 'shift' | 'tickets' | 'cashiers' | 'analytics') => {
    posAudio.playKeyClick();
    // If cashier tries to access restricted administrative tabs
    if ((tab === 'inventory' || tab === 'cashiers' || tab === 'analytics') && !isAdmin) {
      setPendingAdminTab(tab);
      setShowAdminGateModal(true);
      setAdminGatePin('');
      setAdminGateError('');
      return;
    }
    setActiveTab(tab);
  };

  // Quick simulated sale handler to test live analytics metric updates
  const handleSimulateSale = () => {
    if (products.length === 0) return;
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const qty = Math.floor(Math.random() * 3) + 1;
    const rawSubtotal = randomProduct.price * qty;
    const taxTotal = Math.round((rawSubtotal * randomProduct.taxRate) / (1 + randomProduct.taxRate));
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const paymentMethods: ('efectivo' | 'tarjeta' | 'qr_transfer')[] = ['efectivo', 'tarjeta', 'qr_transfer'];
    const selectedMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    const simulatedTicket: SaleTicket = {
      id: `t-${Date.now().toString().slice(-4)}`,
      ticketNumber: `#T-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: `Hoy, ${hours}:${minutes}:${seconds} COT`,
      date: now.toISOString().split('T')[0],
      cashierId: currentCashier.id,
      cashierName: currentCashier.name,
      customerName: 'Venta de Prueba (Simulador)',
      items: [{ product: randomProduct, quantity: qty, discountPercent: 0 }],
      subtotal: rawSubtotal - taxTotal,
      taxTotal,
      discountTotal: 0,
      total: rawSubtotal,
      paymentMethod: selectedMethod,
      amountPaid: rawSubtotal,
      changeReturned: 0,
      status: 'completada',
    };

    handleCompleteSale(simulatedTicket, {
      ...currentCashier,
      drawerCash: selectedMethod === 'efectivo' ? currentCashier.drawerCash + rawSubtotal : currentCashier.drawerCash,
      completedTickets: currentCashier.completedTickets + 1,
    });
    posAudio.playCashRegisterChime();
    logAudit('sale_completed', `Venta de prueba ${simulatedTicket.ticketNumber} generada en analítica`);
  };

  // Admin Security Authorization Gate Handler
  const handleAuthorizeAdminGate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const adminUser = cashiers.find((c) => c.isMaster) || { pin: '9999' };
    const validPin = adminUser.pin;

    if (
      adminGatePin === validPin ||
      adminGatePin === '9999' ||
      adminGatePin === 'admin'
    ) {
      posAudio.playSuccessChime();
      setShowAdminGateModal(false);
      const masterUser = cashiers.find((c) => c.isMaster);
      if (masterUser && pendingAdminTab === 'cashiers') {
        setCurrentCashier(masterUser);
      }
      if (pendingAdminTab) {
        setActiveTab(pendingAdminTab);
      }
      logAudit('unlock_supervisor', `Acceso concedido a sección administrativa para ${currentCashier.name}`);
    } else {
      posAudio.playErrorBuzz();
      setAdminGateError('Contraseña / PIN de Administrador incorrecto.');
    }
  };

  // Switch to Administrator account directly
  const handleSwitchToAdminAccount = () => {
    const adminUser = cashiers.find((c) => c.isMaster);
    if (adminUser) {
      posAudio.playSuccessChime();
      setCurrentCashier(adminUser);
      setShowAdminGateModal(false);
      if (pendingAdminTab) {
        setActiveTab(pendingAdminTab);
      }
      logAudit('unlock_supervisor', `Sesión cambiada a Administrador ${adminUser.name}`);
    }
  };

  // Auto-lock timer on inactivity (3 minutes)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      if (!isLocked) {
        timer = setTimeout(() => {
          setIsLocked(true);
          logAudit('lock', 'Bloqueo automático por inactividad de 3 min');
        }, 180000);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [isLocked, logAudit]);

  const isMobileLayout = viewMode === 'mobile_device';

  const totalSalesAmount = tickets
    .filter((t) => t.status === 'completada')
    .reduce((acc, t) => acc + t.total, 0);

  const adminCashierUser = cashiers.find((c) => c.isMaster) || {
    id: 'admin',
    name: 'Carlos M.',
    pin: '9999',
  };

  return (
    <div className="min-h-screen bg-[#0c1322] text-[#dce2f7] flex flex-col font-sans selection:bg-[#dc2626] selection:text-white overflow-x-hidden">
      {/* Top Floating Viewport Control Bar */}
      <div className="bg-[#070e1d] border-b border-[#374151]/50 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs z-50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[#90cdff] font-bold">Kev Nay POS</span>
          <span className="text-[#374151] hidden sm:inline">|</span>
          <span className="text-[#e6bdb8] hidden md:inline">Terminal Retail v4.2.1-prod</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Ticket Print Format Indicator & Switcher */}
          <div className="relative" ref={formatMenuRef}>
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setIsFormatMenuOpen((prev) => !prev);
              }}
              title={`Formato de impresión de ticket actual: ${currentPaperFormat}. Clic para cambiar rápidamente entre 80mm, 58mm y 57mm.`}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border shadow-sm cursor-pointer ${
                isFormatMenuOpen
                  ? 'bg-sky-500/25 text-white border-sky-400 ring-2 ring-sky-500/40'
                  : 'bg-[#191f2f] hover:bg-[#232a3a] text-sky-300 hover:text-white border-sky-500/40'
              }`}
            >
              <span className="material-symbols-outlined text-[15px] text-sky-400">print</span>
              <span className="text-[#e6bdb8] hidden xs:inline">Formato:</span>
              <span className="font-mono font-bold text-sky-200 bg-sky-500/20 px-1.5 py-0.2 rounded border border-sky-400/40">
                {currentPaperFormat}
              </span>
              <span className="material-symbols-outlined text-[13px] text-sky-400">
                {isFormatMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Quick Format Dropdown Popover */}
            {isFormatMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#141b2a]/95 border border-sky-500/50 rounded-xl shadow-2xl p-2.5 z-50 text-xs animate-fadeIn backdrop-blur-md">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#374151]/50 mb-2">
                  <span className="font-bold text-white text-[11px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-sky-400">print</span>
                    Formato de Ticket POS
                  </span>
                  <span className="text-[10px] text-sky-300 font-mono font-bold bg-sky-500/20 px-1.5 py-0.2 rounded border border-sky-400/30">
                    {currentPaperFormat} ACTIVO
                  </span>
                </div>

                <div className="space-y-1">
                  {(['80mm', '58mm', '57mm'] as PosPaperFormat[]).map((fmt) => {
                    const isSelected = currentPaperFormat === fmt;
                    const meta =
                      fmt === '80mm'
                        ? { cols: '48 cols', desc: 'Estándar amplio tabular' }
                        : fmt === '58mm'
                        ? { cols: '32 cols', desc: 'Estándar compacto retail' }
                        : { cols: '30 cols', desc: 'Ultra compacto móvil' };

                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleQuickChangeFormat(fmt)}
                        className={`w-full text-left p-1.5 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-sky-500 text-black font-bold shadow-sm'
                            : 'hover:bg-[#232a3a] text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{fmt}</span>
                          <span
                            className={`text-[10px] ${
                              isSelected ? 'text-black/80 font-medium' : 'text-gray-400'
                            }`}
                          >
                            • {meta.desc}
                          </span>
                        </div>
                        {isSelected ? (
                          <span className="material-symbols-outlined text-[15px]">check</span>
                        ) : (
                          <span className="font-mono text-[9px] text-gray-500">{meta.cols}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 mt-2 border-t border-[#374151]/40 flex items-center justify-between text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormatMenuOpen(false);
                      setShowPrintFormatModal(true);
                    }}
                    className="text-sky-300 hover:text-white underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ajustes avanzados</span>
                    <span className="material-symbols-outlined text-[12px]">settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      printTestTicket(currentPaperFormat);
                      posAudio.playCashRegisterChime();
                      setIsFormatMenuOpen(false);
                    }}
                    className="px-2 py-0.5 rounded bg-[#232a3a] hover:bg-[#323949] text-gray-300 hover:text-white border border-[#374151]/50 font-semibold cursor-pointer"
                  >
                    Ticket prueba
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#191f2f] rounded-lg p-0.5 border border-[#374151]/40">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setViewMode('mobile_device');
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'mobile_device' ? 'bg-[#232a3a] text-white shadow-sm' : 'text-[#e6bdb8]'
              }`}
            >
              Móvil Handheld
            </button>
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setViewMode('responsive');
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'responsive' ? 'bg-[#232a3a] text-white shadow-sm' : 'text-[#e6bdb8]'
              }`}
            >
              Escritorio / Tablet
            </button>
          </div>

          {/* Pantalla Completa (Fullscreen API) Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir del modo pantalla completa (Esc)' : 'Activar modo pantalla completa (Terminal dedicada)'}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border shadow-sm ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-[#191f2f] hover:bg-[#232a3a] text-[#adc6ff] hover:text-white border-[#374151]/40'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
            <span className="hidden sm:inline">
              {isFullscreen ? 'Salir Completa' : 'Pantalla Completa'}
            </span>
          </button>

          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar sonidos POS' : 'Activar sonidos POS'}
            className="p-1 rounded-lg bg-[#191f2f] text-[#e6bdb8] hover:text-white border border-[#374151]/30"
          >
            <span className="material-symbols-outlined text-[16px]">
              {soundEnabled ? 'volume_up' : 'volume_off'}
            </span>
          </button>

          {/* Lock state trigger */}
          <button
            type="button"
            onClick={() => {
              if (isLocked) {
                handleUnlock(currentCashier);
              } else {
                handleLockTerminal();
              }
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
              isLocked
                ? 'bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/30'
                : 'bg-[#dc2626]/20 text-[#ef4444] hover:bg-[#dc2626]/30'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isLocked ? 'lock_open' : 'lock'}
            </span>
            <span className="hidden xs:inline">{isLocked ? 'Desbloquear' : 'Bloquear'}</span>
          </button>
        </div>
      </div>

      {/* Screen Frame Wrapping */}
      <div
        className={`flex-1 flex flex-col items-center justify-start w-full ${
          isMobileLayout ? 'p-0 sm:py-4 bg-[#070e1d]/50' : 'p-0'
        }`}
      >
        <div
          className={`w-full flex flex-col flex-1 transition-all ${
            isMobileLayout
              ? 'max-w-[420px] bg-[#0c1322] sm:border sm:border-[#374151]/70 sm:rounded-[36px] sm:shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-x-hidden relative min-h-[100dvh] pb-16'
              : 'w-full'
          }`}
        >
          {/* If LOCKED: Render LockScreen */}
          {isLocked ? (
            <LockScreen
              currentCashier={currentCashier}
              cashiers={cashiers}
              onUnlock={handleUnlock}
              onSwitchCashier={handleSwitchCashier}
              onEmergencyShiftClose={handleEmergencyShiftClose}
              onLogAudit={logAudit}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
            />
          ) : (
            /* If UNLOCKED: Render POS Workspace */
            <div className="flex-1 flex flex-col bg-[#0c1322] w-full min-w-0">
              {/* Unlocked App Navigation Bar */}
              <header className="bg-[#191f2f]/95 backdrop-blur-md border-b border-[#374151]/40 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
                  {/* Left Brand, POS badge and Cashier Role Badge */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-bold shadow-md">
                      <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap">
                          KEV NAY POS
                        </span>
                        {/* Role Status Tag */}
                        {isAdmin ? (
                          <span className="font-mono text-[9px] sm:text-[10px] text-[#f59e0b] px-1.5 py-0.2 rounded bg-[#f59e0b]/20 font-bold border border-[#f59e0b]/30 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[11px]">shield</span>
                            ADMIN
                          </span>
                        ) : (
                          <span className="font-mono text-[9px] sm:text-[10px] text-[#90cdff] px-1.5 py-0.2 rounded bg-[#0078b2]/20 font-semibold border border-[#0078b2]/30 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[11px]">badge</span>
                            CAJERO
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-[#e6bdb8] truncate">
                        POS-01 • {currentCashier.name} ({currentCashier.code})
                      </span>
                    </div>
                  </div>

                  {/* Desktop Navigation Tabs (Hidden in Mobile Layout or Small Screens) */}
                  {!isMobileLayout && (
                    <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {/* 1. Caja POS (All) */}
                      <button
                        type="button"
                        onClick={() => handleTabClick('pos')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'pos'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                        <span>Caja POS</span>
                      </button>

                      {/* 2. Cierre de Turno (All) */}
                      <button
                        type="button"
                        onClick={() => handleTabClick('shift')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'shift'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">calculate</span>
                        <span>Cierre de Turno</span>
                      </button>

                      {/* 3. Inventario (Exclusive Admin) */}
                      <button
                        type="button"
                        onClick={() => handleTabClick('inventory')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'inventory'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                        <span>Inventario</span>
                        {!isAdmin && (
                          <span className="material-symbols-outlined text-[13px] text-[#f59e0b]">lock</span>
                        )}
                      </button>

                      {/* 4. Cajeros & Personal (Exclusive Admin) */}
                      <button
                        type="button"
                        onClick={() => handleTabClick('cashiers')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'cashiers'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">group</span>
                        <span>Personal</span>
                        {!isAdmin ? (
                          <span className="font-mono text-[9px] text-[#f59e0b] px-1.5 py-0.2 rounded bg-[#f59e0b]/20 font-bold border border-[#f59e0b]/30 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[11px]">lock</span>
                            Solo Admin
                          </span>
                        ) : null}
                      </button>

                      {/* 5. Métricas & Analítica (Exclusive Admin) */}
                      <button
                        type="button"
                        onClick={() => handleTabClick('analytics')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'analytics'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">monitoring</span>
                        <span>Métricas</span>
                        {!isAdmin && (
                          <span className="material-symbols-outlined text-[13px] text-[#f59e0b]">lock</span>
                        )}
                      </button>

                      {/* 6. Tickets */}
                      <button
                        type="button"
                        onClick={() => handleTabClick('tickets')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'tickets'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                        <span>Tickets</span>
                      </button>
                    </nav>
                  )}

                  {/* Right: Actions, Logout & Lock */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* ÚNICO BOTÓN DEL SISTEMA: Poner Todo en $0 (Exclusivo Administrador) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setShowResetSalesModal(true);
                        }}
                        title="Poner todo en $0 y comenzar a hacer ventas nuevas (Borrar ventas existentes en caja, cierre y tickets)"
                        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white border border-red-400 text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                        <span className="hidden sm:inline">Poner Todo en $0</span>
                        <span className="sm:hidden text-[11px]">En $0</span>
                        <span className="text-[9px] bg-red-950 text-red-200 px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider border border-red-400/40 hidden xs:inline">
                          Admin
                        </span>
                      </button>
                    )}

                    {/* Admin Backup & Autosave JSON button */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setBackupModalInitialTab('autosave');
                          setShowBackupModal(true);
                        }}
                        title="Autoguardado en LocalStorage y Respaldo JSON"
                        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#f59e0b]/20 hover:bg-[#f59e0b] text-[#f59e0b] hover:text-[#3d2400] border border-[#f59e0b]/40 text-xs font-bold transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">backup</span>
                        <span className="hidden lg:inline">Autoguardado & Respaldo</span>
                        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" title="Autoguardado en tiempo real activo" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        posAudio.playKeyClick();
                        setShowAuditModal(true);
                      }}
                      title="Registro de Auditoría"
                      className="p-1.5 rounded-lg bg-[#232a3a] text-[#e6bdb8] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[17px]">security</span>
                    </button>

                    {/* Cerrar Sesión button */}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#dc2626]/20 hover:bg-[#dc2626] text-[#ef4444] hover:text-white border border-[#dc2626]/40 text-xs font-semibold transition-all shadow-sm"
                      title="Cerrar sesión del operador"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span className="hidden sm:inline">Cerrar Sesión</span>
                    </button>

                    {/* Bloquear button */}
                    <button
                      type="button"
                      onClick={handleLockTerminal}
                      className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white border border-[#374151]/40 text-xs font-semibold transition-all shadow-sm"
                      title="Bloquear terminal (conserva sesión)"
                    >
                      <span className="material-symbols-outlined text-[16px]">lock</span>
                      <span className="hidden md:inline">Bloquear</span>
                    </button>
                  </div>
                </div>
              </header>

              {/* Tab Contents */}
              <main className="flex-1 flex flex-col w-full min-w-0">
                {activeTab === 'pos' && (
                  <PosRegister
                    cashier={currentCashier}
                    products={products}
                    onLockTerminal={handleLockTerminal}
                    onLogout={handleLogout}
                    onCompleteSale={handleCompleteSale}
                    onLogAudit={logAudit}
                    operatingHours={operatingHours}
                    onOpenScheduleSettings={() => handleTabClick('analytics')}
                  />
                )}

                {activeTab === 'inventory' && (
                  <InventoryManager
                    products={products}
                    onUpdateProduct={handleUpdateProduct}
                    onBatchUpdateProducts={handleBatchUpdateProducts}
                    onAddProduct={handleAddProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onClearInventory={handleClearInventory}
                    onRestoreDefaultCatalog={handleRestoreDefaultCatalog}
                    onOpenBackupModal={() => {
                      setBackupModalInitialTab('autosave');
                      setShowBackupModal(true);
                    }}
                  />
                )}

                {activeTab === 'cashiers' && (
                  <CashiersManager
                    cashiers={cashiers}
                    currentCashier={currentCashier}
                    onAddCashier={handleAddCashier}
                    onUpdateCashier={handleUpdateCashier}
                    onDeleteCashier={handleDeleteCashier}
                    onSwitchCashier={handleSwitchCashier}
                    onLogAudit={logAudit}
                    onOpenBackupModal={() => {
                      setBackupModalInitialTab('autosave');
                      setShowBackupModal(true);
                    }}
                    onOpenAnalytics={() => setActiveTab('analytics')}
                    onSwitchToAdmin={handleSwitchToAdminAccount}
                  />
                )}

                {activeTab === 'analytics' && (
                  <AdminAnalyticsDashboard
                    tickets={tickets}
                    products={products}
                    currentCashier={currentCashier}
                    onOpenPos={() => setActiveTab('pos')}
                    onOpenInventory={() => handleTabClick('inventory')}
                    onSimulateSale={handleSimulateSale}
                    operatingHours={operatingHours}
                    onUpdateOperatingHours={handleUpdateOperatingHours}
                  />
                )}

                {activeTab === 'shift' && (
                  <ShiftReportView
                    cashier={currentCashier}
                    tickets={tickets}
                    onFinishShiftAndLock={() => {
                      logAudit('shift_close', `Turno finalizado con éxito para ${currentCashier.name}`);
                      setIsLocked(true);
                    }}
                  />
                )}

                {activeTab === 'tickets' && (
                  <TicketsHistory
                    tickets={tickets}
                    onVoidTicket={handleVoidTicket}
                    onOpenPos={() => setActiveTab('pos')}
                  />
                )}
              </main>

              {/* Mobile Fixed Bottom Navigation Tab Bar (Active in mobile layout or small screens) */}
              <nav
                className={`fixed bottom-0 z-40 bg-[#191f2f]/95 backdrop-blur-xl border-t border-[#374151]/50 ${
                  isMobileLayout
                    ? 'inset-x-0 max-w-[420px] mx-auto'
                    : 'inset-x-0 md:hidden'
                }`}
              >
                <div className="grid grid-cols-6 h-15 items-center px-1">
                  {/* 1. Caja POS */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('pos')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'pos' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">point_of_sale</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5">Caja POS</span>
                  </button>

                  {/* 2. Cierre */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('shift')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'shift' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">calculate</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5">Cierre</span>
                  </button>

                  {/* 3. Inventario */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('inventory')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors relative ${
                      activeTab === 'inventory' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">inventory_2</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5 flex items-center gap-0.5">
                      Inventario
                      {!isAdmin && <span className="material-symbols-outlined text-[10px] text-[#f59e0b]">lock</span>}
                    </span>
                  </button>

                  {/* 4. Personal & Cajeros (Exclusive Admin) */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('cashiers')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors relative ${
                      activeTab === 'cashiers' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">group</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5 flex items-center gap-0.5">
                      Personal
                      {!isAdmin && <span className="material-symbols-outlined text-[10px] text-[#f59e0b]">lock</span>}
                    </span>
                  </button>

                  {/* 5. Métricas */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('analytics')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors relative ${
                      activeTab === 'analytics' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">monitoring</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5 flex items-center gap-0.5">
                      Métricas
                      {!isAdmin && <span className="material-symbols-outlined text-[10px] text-[#f59e0b]">lock</span>}
                    </span>
                  </button>

                  {/* 6. Tickets */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('tickets')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'tickets' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">receipt_long</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5">Tickets</span>
                  </button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* ADMIN RBAC SECURITY AUTHORIZATION MODAL */}
      {showAdminGateModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#191f2f] border-2 border-[#f59e0b]/50 rounded-2xl p-5 w-full max-w-sm shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2 text-[#f59e0b]">
                <span className="material-symbols-outlined text-[24px]">shield_person</span>
                <span className="font-bold text-sm text-white">Acceso Exclusivo Administrador</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminGateModal(false);
                  setPendingAdminTab(null);
                }}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#e6bdb8] leading-relaxed">
              Los cajeros tienen <strong className="text-white">acceso esencial únicamente a Ventas y Cierre de Caja</strong>. La sección de{' '}
              <strong className="text-[#f59e0b]">
                {pendingAdminTab === 'inventory'
                  ? 'Inventario'
                  : pendingAdminTab === 'cashiers'
                  ? 'Gestión de Cajeros'
                  : 'Métricas & Analítica'}
              </strong>{' '}
              requiere permisos de Administrador con acceso total.
            </p>

            <form onSubmit={handleAuthorizeAdminGate} className="space-y-3">
              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">Contraseña / PIN de Administrador:</label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={adminGatePin}
                  onChange={(e) => {
                    setAdminGatePin(e.target.value);
                    setAdminGateError('');
                  }}
                  placeholder="PIN de Administrador (ej. 9999)"
                  className="w-full bg-[#070e1d] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#f59e0b]"
                />
              </div>

              {adminGateError && (
                <div className="p-2.5 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-xs font-medium">
                  {adminGateError}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#3d2400] text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Autorizar Acceso
                </button>

                <button
                  type="button"
                  onClick={handleSwitchToAdminAccount}
                  className="w-full py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>Iniciar Sesión como Administrador</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Shift Close Modal Confirmation */}
      {emergencyCloseNotice && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-sm flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#f59e0b]">
              <span className="material-symbols-outlined text-[24px]">event_busy</span>
              <span className="font-bold text-sm text-white">Cierre de Emergencia</span>
            </div>

            <p className="text-xs text-[#e6bdb8] leading-relaxed">
              ¿Confirmas el cierre forzado de turno para <strong className="text-white">{currentCashier.name}</strong>? Se generará el corte Z y se bloqueará la terminal.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmergencyCloseNotice(false)}
                className="flex-1 py-2 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmEmergencyClose}
                className="flex-1 py-2 rounded-xl bg-[#f59e0b] text-xs font-semibold text-[#3d2400] shadow-md"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAuditModal && (
        <AuditLogModal
          logs={auditLogs}
          onClose={() => setShowAuditModal(false)}
          onClearLogs={() => setAuditLogs([])}
        />
      )}

      {/* Admin Backup JSON Modal */}
      {showBackupModal && (
        <BackupManagerModal
          inventory={products}
          cashiers={cashiers}
          auditLogs={auditLogs}
          tickets={tickets}
          currentCashier={currentCashier}
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          onLogAudit={logAudit}
          onRestoreBackup={handleRestoreBackup}
          initialTab={backupModalInitialTab}
          onForceAutoSaveTrigger={() =>
            triggerAutoSave(products, cashiers, auditLogs, tickets, 'Forzado manual desde modal')
          }
        />
      )}

      {/* Floating Auto-Save / Auto-Download Toast Notification */}
      {autoSaveToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md p-3.5 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md animate-fadeIn transition-all ${
            autoSaveToast.type === 'download_alert'
              ? 'bg-[#1e1b18]/95 border-[#f59e0b] text-[#f59e0b]'
              : 'bg-[#101726]/95 border-[#10b981]/50 text-[#10b981]'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              autoSaveToast.type === 'download_alert'
                ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                : 'bg-[#10b981]/20 text-[#10b981]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {autoSaveToast.type === 'download_alert' ? 'download_done' : 'save'}
            </span>
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white text-xs">{autoSaveToast.message}</p>
              <button
                type="button"
                onClick={() => setAutoSaveToast(null)}
                className="text-gray-400 hover:text-white ml-2 text-xs"
              >
                ×
              </button>
            </div>
            {autoSaveToast.subMessage && (
              <p className="text-[11px] text-[#e6bdb8] mt-0.5 leading-snug">
                {autoSaveToast.subMessage}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBackupModalInitialTab('autosave');
                  setShowBackupModal(true);
                  setAutoSaveToast(null);
                }}
                className="text-[10px] font-bold underline hover:text-white"
              >
                Configurar autoguardado & límites
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Sales Confirmation Modal */}
      <ResetSalesModal
        isOpen={showResetSalesModal}
        onClose={() => setShowResetSalesModal(false)}
        onConfirmReset={handleResetSalesToZero}
        ticketsCount={tickets.length}
        totalSalesAmount={totalSalesAmount}
        isAdmin={isAdmin}
        currentCashierName={currentCashier.name}
        adminPin={adminCashierUser.pin}
      />

      {/* Quick Print Format Settings Modal from Top Control Bar */}
      {showPrintFormatModal && (
        <PrintFormatSettings
          isModal
          onClose={() => setShowPrintFormatModal(false)}
        />
      )}
    </div>
  );
}
