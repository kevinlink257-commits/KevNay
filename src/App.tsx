import { useState, useEffect, useCallback } from 'react';
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
import { AuditLogModal } from './components/AuditLogModal';

export default function App() {
  // App state
  const [isLocked, setIsLocked] = useState<boolean>(true); // Starts locked to match user screenshot
  const [cashiers, setCashiers] = useState<Cashier[]>(INITIAL_CASHIERS);
  const [currentCashier, setCurrentCashier] = useState<Cashier>(INITIAL_CASHIERS[0]); // Kevin N.
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [tickets, setTickets] = useState<SaleTicket[]>(INITIAL_TICKETS);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_LOGS);

  // Active view inside POS
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'shift' | 'tickets'>('pos');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'responsive' | 'mobile_device'>('responsive');

  // Emergency shift close state
  const [emergencyCloseNotice, setEmergencyCloseNotice] = useState<boolean>(false);

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

  // Lock terminal (preserves active cashier session in memory)
  const handleLockTerminal = () => {
    setIsLocked(true);
    posAudio.playKeyClick();
    logAudit('lock', `Bloqueo manual de terminal POS-01 por ${currentCashier.name}`);
  };

  // Cerrar Sesión (Logs out the current cashier and resets to lock screen)
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
    // Reset tickets count and notify
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
          // If cash, deduct from drawer
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

  // Manage auto-lock on inactivity
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
                  {/* Left Brand & POS badge */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-bold shadow-md">
                      <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap">
                          KEV NAY POS
                        </span>
                        <span className="font-mono text-[9px] sm:text-[10px] text-[#10b981] px-1 rounded bg-[#10b981]/20 font-semibold">
                          EN LÍNEA
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-[#e6bdb8] truncate">
                        POS-01 • {currentCashier.name}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Navigation Tabs (Hidden in Mobile Layout or Small Screens) */}
                  {!isMobileLayout && (
                    <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setActiveTab('pos');
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'pos'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                        <span>Caja POS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setActiveTab('inventory');
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'inventory'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                        <span>Inventario</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setActiveTab('shift');
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeTab === 'shift'
                            ? 'bg-[#dc2626] text-white shadow-sm'
                            : 'text-[#e6bdb8] hover:bg-[#232a3a] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">calculate</span>
                        <span>Cierre de Turno</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setActiveTab('tickets');
                        }}
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
                <div className="grid grid-cols-4 h-15 items-center px-2">
                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setActiveTab('pos');
                    }}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'pos' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
                    <span className="text-[10px] font-semibold tracking-tight mt-0.5">Caja POS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setActiveTab('inventory');
                    }}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'inventory' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                    <span className="text-[10px] font-semibold tracking-tight mt-0.5">Inventario</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setActiveTab('shift');
                    }}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'shift' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">calculate</span>
                    <span className="text-[10px] font-semibold tracking-tight mt-0.5">Cierre</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setActiveTab('tickets');
                    }}
                    className={`flex flex-col items-center justify-center py-1 transition-colors ${
                      activeTab === 'tickets' ? 'text-[#ef4444]' : 'text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                    <span className="text-[10px] font-semibold tracking-tight mt-0.5">Tickets</span>
                  </button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Shift Close Modal Confirmation */}
      {emergencyCloseNotice && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-sm flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#f59e0b]">
              <span className="material-symbols-outlined text-[24px]">event_busy</span>
              <span className="font-bold text-sm text-white">Cierre de Emergencia</span>
            </div>

            <p className="text-xs text-[#e6bdb8] leading-relaxed">
              ¿Deseas generar el corte Z preliminar y cerrar turno de emergencia para{' '}
              <strong className="text-white">{currentCashier.name}</strong>? Se emitirá el ticket en la
              impresora térmica POS-58.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEmergencyCloseNotice(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmEmergencyClose}
                className="flex-1 py-2.5 rounded-xl bg-[#dc2626] text-xs font-semibold text-white shadow-md"
              >
                Confirmar Cierre Z
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditModal && (
        <AuditLogModal logs={auditLogs} onClose={() => setShowAuditModal(false)} />
      )}
    </div>
  );
}
