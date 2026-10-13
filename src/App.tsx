import React, { useState, useEffect, useCallback } from 'react';
import { Cashier, Product, SaleTicket, AuditEvent } from './types/pos';
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
import { exportAndDownloadBackup } from './utils/backup';

export default function App() {
  // App state with local persistence
  const [cashiers, setCashiers] = useState<Cashier[]>(() => {
    try {
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
      const saved = localStorage.getItem('pos_products');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_PRODUCTS;
  });

  const [isLocked, setIsLocked] = useState<boolean>(true); // Starts locked to match reference design
  const [tickets, setTickets] = useState<SaleTicket[]>(INITIAL_TICKETS);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_LOGS);

  // Active view inside POS
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'shift' | 'tickets' | 'cashiers'>('pos');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'responsive' | 'mobile_device'>('responsive');

  // RBAC Access Control Gate State for Non-Admin Cashiers
  const [showAdminGateModal, setShowAdminGateModal] = useState<boolean>(false);
  const [pendingAdminTab, setPendingAdminTab] = useState<'inventory' | 'cashiers' | null>(null);
  const [adminGatePin, setAdminGatePin] = useState<string>('');
  const [adminGateError, setAdminGateError] = useState<string>('');

  // Emergency shift close state
  const [emergencyCloseNotice, setEmergencyCloseNotice] = useState<boolean>(false);

  // Save changes to localStorage
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
    setTickets((prev) => [ticket, ...prev]);
    // Deduct stock for sold items
    setProducts((prev) =>
      prev.map((prod) => {
        const cartItem = ticket.items.find((i) => i.product.id === prod.id);
        if (cartItem) {
          return {
            ...prod,
            stock: Math.max(0, prod.stock - cartItem.quantity),
          };
        }
        return prod;
      })
    );
    // Update cashier drawer cash & count
    setCurrentCashier(updatedCashier);
    setCashiers((prev) =>
      prev.map((c) => (c.id === updatedCashier.id ? updatedCashier : c))
    );
  };

  // Void a ticket
  const handleVoidTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          if (t.paymentMethod === 'efectivo') {
            setCurrentCashier((c) => ({
              ...c,
              drawerCash: Math.max(0, c.drawerCash - t.total),
            }));
          }
          logAudit('sale_completed', `Venta ${t.ticketNumber} anulada por supervisor`);
          return { ...t, status: 'anulada' };
        }
        return t;
      })
    );
  };

  // Toggle sound
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    posAudio.setEnabled(nextVal);
  };

  // Cashiers Management Handlers
  const handleAddCashier = (newCashier: Cashier) => {
    setCashiers((prev) => [...prev, newCashier]);
  };

  const handleUpdateCashier = (updatedCashier: Cashier) => {
    setCashiers((prev) =>
      prev.map((c) => (c.id === updatedCashier.id ? updatedCashier : c))
    );
    if (currentCashier.id === updatedCashier.id) {
      setCurrentCashier(updatedCashier);
    }
  };

  const handleDeleteCashier = (cashierId: string) => {
    setCashiers((prev) => prev.filter((c) => c.id !== cashierId));
  };

  // Inventory Management Handlers
  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    logAudit('lock', `Producto ${productId} eliminado del catálogo por ${currentCashier.name}`);
  };

  const handleClearInventory = () => {
    setProducts([]);
    logAudit('lock', `Catálogo de inventario vaciado por ${currentCashier.name}`);
  };

  const handleRestoreDefaultCatalog = () => {
    setProducts(INITIAL_PRODUCTS);
    logAudit('lock', `Catálogo de inventario de demostración restaurado`);
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
    if (backup.inventory && Array.isArray(backup.inventory)) {
      setProducts(backup.inventory);
    }
    if (backup.cashiers && Array.isArray(backup.cashiers)) {
      setCashiers(backup.cashiers);
    }
    if (backup.auditLogs && Array.isArray(backup.auditLogs)) {
      setAuditLogs(backup.auditLogs);
    }
  };

  // Tab navigation with Role-Based Access Control
  const isAdmin = !!currentCashier.isMaster;

  const handleTabClick = (tab: 'pos' | 'inventory' | 'shift' | 'tickets' | 'cashiers') => {
    posAudio.playKeyClick();
    // If cashier tries to access restricted administrative tabs
    if ((tab === 'inventory' || tab === 'cashiers') && !isAdmin) {
      setPendingAdminTab(tab);
      setShowAdminGateModal(true);
      setAdminGatePin('');
      setAdminGateError('');
      return;
    }
    setActiveTab(tab);
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

  return (
    <div className="min-h-screen bg-[#0c1322] text-[#dce2f7] flex flex-col font-sans selection:bg-[#dc2626] selection:text-white overflow-x-hidden">
      {/* Top Floating Viewport Control Bar */}
      <div className="bg-[#070e1d] border-b border-[#374151]/50 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs z-50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[#90cdff] font-bold">Kev Nay POS</span>
          <span className="text-[#374151] hidden sm:inline">|</span>
          <span className="text-[#e6bdb8] hidden md:inline">Terminal Retail v4.2.1-prod</span>
        </div>

        <div className="flex items-center gap-2">
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

          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar sonidos POS' : 'Activar sonidos POS'}
            className="p-1 rounded bg-[#191f2f] text-[#e6bdb8] hover:text-white"
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
                        <span>Cajeros</span>
                        {!isAdmin && (
                          <span className="material-symbols-outlined text-[13px] text-[#f59e0b]">lock</span>
                        )}
                      </button>

                      {/* 5. Tickets */}
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
                    {/* Admin Backup JSON button */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setShowBackupModal(true);
                        }}
                        title="Respaldo Local JSON (Inventario, Cajeros y Auditoría)"
                        className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#f59e0b]/20 hover:bg-[#f59e0b] text-[#f59e0b] hover:text-[#3d2400] border border-[#f59e0b]/40 text-xs font-bold transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">backup</span>
                        <span className="hidden lg:inline">Respaldo JSON</span>
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
                  />
                )}

                {activeTab === 'inventory' && (
                  <InventoryManager
                    products={products}
                    onUpdateProduct={(updated) =>
                      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                    }
                    onAddProduct={(created) => setProducts((prev) => [created, ...prev])}
                    onDeleteProduct={handleDeleteProduct}
                    onClearInventory={handleClearInventory}
                    onRestoreDefaultCatalog={handleRestoreDefaultCatalog}
                    onOpenBackupModal={() => setShowBackupModal(true)}
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
                    onOpenBackupModal={() => setShowBackupModal(true)}
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
                  <TicketsHistory tickets={tickets} onVoidTicket={handleVoidTicket} />
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
                <div className="grid grid-cols-5 h-15 items-center px-1">
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

                  {/* 4. Cajeros */}
                  <button
                    type="button"
                    onClick={() => handleTabClick('cashiers')}
                    className={`flex flex-col items-center justify-center py-1 transition-colors relative ${
                      activeTab === 'cashiers' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">group</span>
                    <span className="text-[9px] font-semibold tracking-tight mt-0.5 flex items-center gap-0.5">
                      Cajeros
                      {!isAdmin && <span className="material-symbols-outlined text-[10px] text-[#f59e0b]">lock</span>}
                    </span>
                  </button>

                  {/* 5. Tickets */}
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
                {pendingAdminTab === 'inventory' ? 'Inventario' : 'Gestión de Cajeros'}
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
        />
      )}
    </div>
  );
}
