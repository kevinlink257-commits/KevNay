import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Cashier, Product, CartItem, PaymentMethod, SaleTicket, AuditEvent, OperatingHoursConfig } from '../types/pos';
import { formatCOP, formatNumberCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { ThermalReceipt } from './ThermalReceipt';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { PosShortcutsGuideModal } from './PosShortcutsGuideModal';
import { checkIsWithinOperatingHours, DEFAULT_OPERATING_HOURS } from '../utils/operatingHours';

interface PosRegisterProps {
  cashier: Cashier;
  products: Product[];
  onLockTerminal: () => void;
  onLogout?: () => void;
  onCompleteSale: (ticket: SaleTicket, updatedCashier: Cashier) => void;
  onLogAudit: (type: AuditEvent['type'], details: string) => void;
  operatingHours?: OperatingHoursConfig;
  onOpenScheduleSettings?: () => void;
}

export const PosRegister: React.FC<PosRegisterProps> = ({
  cashier,
  products,
  onLockTerminal,
  onLogout,
  onCompleteSale,
  onLogAudit,
  operatingHours = DEFAULT_OPERATING_HOURS,
  onOpenScheduleSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Consumidor Final');
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  
  // Keyboard Shortcuts & Floating Help Dock state
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [shortcutsDockMinimized, setShortcutsDockMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pos_shortcuts_dock_min') === 'true';
    } catch {
      return false;
    }
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Payment state
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [latestTicket, setLatestTicket] = useState<SaleTicket | null>(null);

  // Operating Hours Notice & Warning Modal state
  const [showOutOfHoursWarningModal, setShowOutOfHoursWarningModal] = useState<boolean>(false);
  const [supervisorPinInput, setSupervisorPinInput] = useState<string>('');
  const [pinErrorNotice, setPinErrorNotice] = useState<boolean>(false);

  // Real-time evaluation of operating hours
  const operatingStatus = useMemo(() => {
    return checkIsWithinOperatingHours(operatingHours);
  }, [operatingHours]);

  const categories = React.useMemo(() => {
    const defaultOrder = [
      'Joyería & Aretes',
      'Collares & Cadenas',
      'Pulseras & Brazaletes',
      'Anillos & Alianzas',
      'Relojes & Smartwatches',
      'Gafas de Sol & Óptica',
      'Bolsos & Billeteras',
      'Accesorios para Cabello',
      'Bebidas',
      'Snacks & Golosinas',
      'Despensa & Abarrotes',
      'Lácteos & Huevos',
      'Licores & Cervezas',
      'Panadería',
      'Cuidado & Aseo',
    ];
    const fromProducts = Array.from(new Set(products.map((p) => p.category)));
    const sorted = fromProducts.sort((a, b) => {
      const idxA = defaultOrder.indexOf(a);
      const idxB = defaultOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return ['Todos', ...sorted];
  }, [products]);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      posAudio.playErrorBuzz();
      return;
    }
    posAudio.playKeyClick();
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          posAudio.playErrorBuzz();
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, discountPercent: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    posAudio.playKeyClick();
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.stock) return item;
            return { ...item, quantity: Math.max(0, nextQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    posAudio.playKeyClick();
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    posAudio.playKeyClick();
    setCart([]);
  };

  // Calculations
  const rawSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discountTotal = cart.reduce(
    (acc, item) => acc + (item.product.price * item.quantity * item.discountPercent) / 100,
    0
  );
  const total = Math.max(0, rawSubtotal - discountTotal);
  const taxTotal = Math.round(
    cart.reduce((acc, item) => {
      const itemNet = (item.product.price * item.quantity * (100 - item.discountPercent)) / 100;
      return acc + (itemNet * item.product.taxRate) / (1 + item.product.taxRate);
    }, 0)
  );
  const subtotalBase = total - taxTotal;

  // Barcode scanner trigger
  const handleBarcodeScan = (scannedCode: string) => {
    const found = products.find(
      (p) =>
        p.barcode === scannedCode.trim() ||
        p.sku.toLowerCase() === scannedCode.trim().toLowerCase()
    );
    if (found) {
      posAudio.playScanBeep();
      addToCart(found);
      setShowScannerModal(false);
    } else {
      posAudio.playErrorBuzz();
      alert(`Código o guía "${scannedCode}" no encontrado en catálogo.`);
    }
  };

  const openCheckout = () => {
    if (cart.length === 0) return;

    // Check operating hours: if enabled and currently outside operating hours, prompt notice modal
    if (operatingHours.enabled && !operatingStatus.isWithinHours) {
      posAudio.playErrorBuzz();
      setShowOutOfHoursWarningModal(true);
      return;
    }

    posAudio.playKeyClick();
    setCashReceived(total); // Default to exact total
    setShowCheckoutModal(true);
  };

  const handleProceedOutsideHours = () => {
    // If strictMode is enabled, require supervisor PIN
    if (operatingHours.strictMode) {
      const isValidPin =
        supervisorPinInput === '1234' ||
        supervisorPinInput === cashier.pin ||
        Boolean(cashier.isMaster);

      if (!isValidPin) {
        posAudio.playErrorBuzz();
        setPinErrorNotice(true);
        return;
      }
    }

    posAudio.playKeyClick();
    setShowOutOfHoursWarningModal(false);
    setSupervisorPinInput('');
    setPinErrorNotice(false);
    setCashReceived(total);
    setShowCheckoutModal(true);
  };

  const completePayment = () => {
    if (paymentMethod === 'efectivo' && cashReceived < total) {
      posAudio.playErrorBuzz();
      return;
    }

    const change = paymentMethod === 'efectivo' ? Math.max(0, cashReceived - total) : 0;
    const ticketId = `t-${Date.now().toString().slice(-4)}`;
    const ticketNumber = `#T-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `Hoy, ${hours}:${minutes}:${seconds} COT`;
    const isOutsideHours = Boolean(operatingHours.enabled && !operatingStatus.isWithinHours);

    const newTicket: SaleTicket = {
      id: ticketId,
      ticketNumber,
      timestamp,
      date: now.toISOString().split('T')[0],
      cashierId: cashier.id,
      cashierName: cashier.name,
      customerName,
      items: [...cart],
      subtotal: subtotalBase,
      taxTotal,
      discountTotal,
      total,
      paymentMethod,
      amountPaid: paymentMethod === 'efectivo' ? cashReceived : total,
      changeReturned: change,
      outsideOperatingHours: isOutsideHours,
      status: 'completada',
    };

    const updatedCashier: Cashier = {
      ...cashier,
      drawerCash: paymentMethod === 'efectivo' ? cashier.drawerCash + total : cashier.drawerCash,
      completedTickets: cashier.completedTickets + 1,
    };

    posAudio.playCashRegisterChime();

    if (isOutsideHours) {
      onLogAudit(
        'sale_completed',
        `⚠️ VENTA FUERA DE HORARIO: Ticket ${ticketNumber} por ${formatCOP(total)} (${paymentMethod}). Hora: ${operatingStatus.currentTimeStr} COT. Horario hoy: ${operatingStatus.openTimeFormatted} - ${operatingStatus.closeTimeFormatted}`
      );
    } else {
      onLogAudit('sale_completed', `Venta ${ticketNumber} completada por ${formatCOP(total)} (${paymentMethod})`);
    }

    onCompleteSale(newTicket, updatedCashier);

    setLatestTicket(newTicket);
    setShowCheckoutModal(false);
    setCart([]);
  };

  // Global Keyboard Shortcuts for POS operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isInput =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.isContentEditable;

      // F1: Cobrar venta o confirmar pago
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        if (showCheckoutModal) {
          if (!(paymentMethod === 'efectivo' && cashReceived < total)) {
            completePayment();
          } else {
            posAudio.playErrorBuzz();
          }
        } else if (cart.length > 0) {
          openCheckout();
        } else {
          posAudio.playErrorBuzz();
        }
        return;
      }

      // F2: Enfocar buscador de productos
      if (e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        return;
      }

      // F3: Vaciar carrito actual
      if (e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        if (cart.length > 0) {
          clearCart();
        }
        return;
      }

      // F4: Abrir / cerrar lector de código de barras
      if (e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        setShowScannerModal((prev) => !prev);
        return;
      }

      // F7: Bloqueo rápido de terminal
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        onLockTerminal();
        return;
      }

      // F8: Alternar guía de atajos flotante
      if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // '?' para abrir ayuda cuando no esté escribiendo texto en un campo de entrada
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // Escape: Cancelar / cerrar ventanas modales en orden de prioridad
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showOutOfHoursWarningModal) {
          setShowOutOfHoursWarningModal(false);
          setSupervisorPinInput('');
          setPinErrorNotice(false);
        } else if (showCheckoutModal) {
          setShowCheckoutModal(false);
        } else if (showScannerModal) {
          setShowScannerModal(false);
        } else if (latestTicket) {
          setLatestTicket(null);
        } else if (searchQuery) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // Enter cuando el modal de cobro está abierto para finalizar venta
      if (e.key === 'Enter' && showCheckoutModal) {
        if (!(paymentMethod === 'efectivo' && cashReceived < total)) {
          e.preventDefault();
          completePayment();
        }
        return;
      }

      // Métodos de pago rápidos (1: Efectivo, 2: Datáfono, 3: QR) cuando no se escribe en un input
      if (showCheckoutModal && !isInput) {
        if (e.key === '1') {
          e.preventDefault();
          setPaymentMethod('efectivo');
          posAudio.playKeyClick();
        } else if (e.key === '2') {
          e.preventDefault();
          setPaymentMethod('tarjeta');
          posAudio.playKeyClick();
        } else if (e.key === '3') {
          e.preventDefault();
          setPaymentMethod('qr_transfer');
          posAudio.playKeyClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showCheckoutModal,
    showShortcutsModal,
    showOutOfHoursWarningModal,
    showScannerModal,
    latestTicket,
    cart,
    total,
    paymentMethod,
    cashReceived,
    searchQuery,
  ]);

  return (
    <div className="w-full flex flex-col flex-1 pb-16">
      {/* Top POS Action Toolbar */}
      <div className="bg-[#191f2f] border-b border-[#374151]/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#10b981]/20 text-[#10b981] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#dce2f7]">POS-01</span>
              <span className="px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] font-mono text-[11px] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                EN LÍNEA
              </span>
              {operatingHours.enabled && (
                operatingStatus.isWithinHours ? (
                  <span
                    className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-semibold items-center gap-1 border border-emerald-500/30"
                    title={`Horario hoy: ${operatingStatus.openTimeFormatted} - ${operatingStatus.closeTimeFormatted}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>HORARIO: HASTA {operatingStatus.closeTimeFormatted}</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono text-[10px] font-bold items-center gap-1 border border-rose-500/40 animate-pulse"
                    title={operatingStatus.reason}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>FUERA DE HORARIO</span>
                  </span>
                )
              )}
            </div>
            <span className="text-[11px] text-[#e6bdb8]">Caja Registradora Principal</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Drawer Cash Indicator */}
          <div className="hidden sm:flex flex-col items-end px-3 py-1 bg-[#141b2b] rounded-lg border border-[#374151]/30 font-mono text-xs">
            <span className="text-[10px] text-[#e6bdb8]">Gaveta</span>
            <span className="text-[#10b981] font-bold">{formatCOP(cashier.drawerCash)}</span>
          </div>

          {/* Barcode Scanner Button */}
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowScannerModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/40 text-xs font-semibold transition-colors"
            title="Escanear código de barras (F4)"
          >
            <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
            <span className="hidden sm:inline">Escanear</span>
            <kbd className="hidden md:inline px-1 py-0.2 rounded bg-[#141b2b] border border-[#374151]/60 font-mono text-[9px] text-amber-300">
              F4
            </kbd>
          </button>

          {/* Quick Shortcuts Guide Button */}
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowShortcutsModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors shadow-sm"
            title="Guía de atajos de teclado POS (F8 o ?)"
          >
            <span className="material-symbols-outlined text-[17px]">keyboard</span>
            <span className="hidden sm:inline">Atajos</span>
            <kbd className="hidden md:inline px-1 py-0.2 rounded bg-[#070e1d] border border-amber-500/40 font-mono text-[9px] text-amber-300 font-bold">
              F8
            </kbd>
          </button>

          {/* Quick Lock Terminal button */}
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              onLockTerminal();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white border border-[#374151]/40 text-xs font-semibold transition-colors shadow-sm"
            title="Bloquear Terminal (F7)"
          >
            <span className="material-symbols-outlined text-[17px]">lock</span>
            <span className="hidden sm:inline">Bloquear</span>
            <kbd className="hidden lg:inline px-1 py-0.2 rounded bg-[#141b2b] border border-[#374151]/60 font-mono text-[9px] text-gray-400">
              F7
            </kbd>
          </button>

          {/* Cerrar Sesión button */}
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#dc2626]/20 hover:bg-[#dc2626] text-[#ef4444] hover:text-white border border-[#dc2626]/40 text-xs font-semibold transition-colors shadow-sm"
              title="Cerrar Sesión del Cajero"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
              <span className="hidden xs:inline">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner when operating outside allowed hours */}
      {operatingHours.enabled && !operatingStatus.isWithinHours && (
        <div className="bg-rose-950/70 border-b border-rose-500/40 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-200 text-xs shadow-inner animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-rose-400 shrink-0 animate-pulse">
              alarm_off
            </span>
            <div>
              <span className="font-bold text-white">Aviso de Operación Fuera de Horario:</span>
              <span className="ml-1 text-rose-200/90">
                {operatingStatus.reason} Hoy ({operatingStatus.currentDayName}) el horario programado es {operatingStatus.todaySchedule.isOpen ? `${operatingStatus.openTimeFormatted} - ${operatingStatus.closeTimeFormatted}` : 'Cerrado'}. Las transacciones registrarán aviso en auditoría.
              </span>
            </div>
          </div>
          {onOpenScheduleSettings && (
            <button
              type="button"
              onClick={onOpenScheduleSettings}
              className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-100 font-bold text-[11px] border border-rose-500/50 shrink-0 transition-colors self-start sm:self-auto"
            >
              Ver Horario
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Catalog + Order Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 max-w-7xl mx-auto w-full">
        {/* Catalog Section (8 cols on desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-3.5">
          {/* Search bar & Category filter */}
          <div className="flex flex-col space-y-2.5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#e6bdb8] text-[20px]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    addToCart(filteredProducts[0]);
                  }
                }}
                placeholder="Buscar por nombre, SKU o código de barras (Enter para agregar)..."
                className="w-full pl-11 pr-14 py-2.5 rounded-xl bg-[#191f2f] border border-[#374151]/40 text-sm text-[#dce2f7] placeholder-[#e6bdb8]/60 focus:outline-none focus:border-[#dc2626] transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[#e6bdb8] hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[#232a3a] border border-[#374151]/70 font-mono text-[10px] text-amber-300 font-bold shadow-sm">
                    F2
                  </kbd>
                )}
              </div>
            </div>

            {/* Horizontal Category Scroller */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    posAudio.playKeyClick();
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#dc2626] text-[#fff6f5] shadow-sm'
                      : 'bg-[#191f2f] text-[#e6bdb8] hover:bg-[#232a3a] border border-[#374151]/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find((i) => i.product.id === product.id);
              const isOutOfStock = product.stock <= 0;
              const isLowStock = !isOutOfStock && product.stock <= (product.minStock ?? 5);

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => addToCart(product)}
                  className={`group relative text-left p-3 rounded-xl bg-[#191f2f] border transition-all flex flex-col justify-between shadow-sm active:scale-[0.98] ${
                    isOutOfStock
                      ? 'border-red-500/30 bg-red-950/20 opacity-45 cursor-not-allowed'
                      : isLowStock
                      ? 'border-amber-500/40 bg-amber-950/10 hover:border-amber-500/70 hover:bg-[#232a3a]'
                      : 'border-[#374151]/30 hover:border-[#dc2626]/50 hover:bg-[#232a3a]'
                  }`}
                >
                  {/* Top info */}
                  <div className="flex flex-col space-y-1 w-full">
                    <div className="flex items-center justify-between text-[10px] text-[#e6bdb8]">
                      <span className="font-mono text-[#90cdff]">{product.sku}</span>
                      <span
                        className={`font-mono font-bold flex items-center gap-0.5 ${
                          isOutOfStock ? 'text-[#ef4444]' : isLowStock ? 'text-[#f59e0b]' : 'text-[#10b981]'
                        }`}
                      >
                        {isOutOfStock ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                            AGOTADO
                          </>
                        ) : isLowStock ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                            BAJO: {product.stock} disp.
                          </>
                        ) : (
                          `${product.stock} disp.`
                        )}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-[#dce2f7] line-clamp-2 leading-snug group-hover:text-white">
                      {product.name}
                    </h4>
                  </div>

                  {/* Price & In-Cart badge */}
                  <div className="mt-3 pt-2 border-t border-[#374151]/30 flex items-center justify-between w-full">
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#10b981]">
                      {formatCOP(product.price)}
                    </span>
                    {inCartItem && (
                      <span className="w-6 h-6 rounded-full bg-[#dc2626] text-white flex items-center justify-center font-bold text-xs shadow-md">
                        {inCartItem.quantity}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 bg-[#191f2f]/40 rounded-xl border border-dashed border-[#374151]">
              <span className="material-symbols-outlined text-[36px] text-[#e6bdb8]/50">inventory_2</span>
              <p className="text-xs text-[#e6bdb8] mt-2">No se encontraron productos con ese criterio.</p>
            </div>
          )}
        </div>

        {/* Sales Ticket / Cart Sidebar (5 cols on desktop) */}
        <div id="pos-ticket-sidebar" className="lg:col-span-5 xl:col-span-4 flex flex-col bg-[#191f2f] rounded-2xl border border-[#374151]/50 p-4 shadow-xl">
          {/* Ticket Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#374151]/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#dc2626] text-[20px]">shopping_basket</span>
              <div>
                <span className="font-bold text-sm text-[#dce2f7]">Ticket Actual</span>
                <span className="text-[11px] text-[#e6bdb8] ml-1.5 font-mono">#T-1025</span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] text-[#e6bdb8] hover:text-[#ef4444] transition-colors flex items-center gap-1.5"
                title="Vaciar carrito (F3)"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                <span>Limpiar</span>
                <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151]/80 font-mono text-[9px] text-amber-300 font-bold">
                  F3
                </kbd>
              </button>
            )}
          </div>

          {/* Customer Input */}
          <div className="py-2.5 border-b border-[#374151]/30 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#e6bdb8] text-[18px]">person</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre del Cliente o NIT"
              className="bg-transparent border-none text-xs text-[#dce2f7] placeholder-[#e6bdb8]/60 focus:outline-none flex-1 font-medium"
            />
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-2 space-y-2 min-h-[220px] max-h-[360px]">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 text-[#e6bdb8]/60 space-y-2">
                <span className="material-symbols-outlined text-[40px]">point_of_sale</span>
                <p className="text-xs">El ticket está vacío.</p>
                <p className="text-[11px]">Toca productos en el catálogo o escanea código de barras.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded-xl bg-[#141b2b] border border-[#374151]/30 flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-medium text-[#dce2f7] truncate">{item.product.name}</span>
                    <span className="text-[11px] font-mono text-[#10b981]">
                      {formatCOP(item.product.price)} c/u
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-lg bg-[#232a3a] hover:bg-[#323949] flex items-center justify-center text-xs font-bold text-[#dce2f7]"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-6 h-6 rounded-lg bg-[#232a3a] hover:bg-[#323949] disabled:opacity-40 flex items-center justify-center text-xs font-bold text-[#dce2f7]"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-6 h-6 rounded-lg text-[#e6bdb8] hover:text-[#ef4444] flex items-center justify-center ml-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals Summary */}
          <div className="pt-3 border-t border-[#374151]/40 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Subtotal (sin IVA):</span>
              <span>{formatCOP(subtotalBase)}</span>
            </div>
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">IVA discriminado:</span>
              <span>{formatCOP(taxTotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-[#ef4444]">
                <span className="font-sans">Descuento aplicado:</span>
                <span>-{formatCOP(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-[#dce2f7] pt-2 border-t border-[#374151]/30">
              <span className="font-sans">TOTAL A COBRAR:</span>
              <span className="text-[#10b981] text-lg">{formatCOP(total)}</span>
            </div>
          </div>

          {/* Checkout CTA Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={openCheckout}
            className="w-full mt-3 py-3 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-40 disabled:hover:bg-[#dc2626] text-[#fff6f5] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#dc2626]/20 active:scale-[0.99]"
            title="Cobrar venta (F1)"
          >
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>Cobrar {total > 0 ? formatCOP(total) : ''}</span>
            <kbd className="ml-1.5 px-2 py-0.5 rounded bg-black/30 border border-white/20 font-mono text-[11px] font-bold text-amber-300">
              F1
            </kbd>
          </button>
        </div>
      </div>

      {/* Real Barcode Camera Scanner Modal */}
      <BarcodeCameraScanner
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScan={handleBarcodeScan}
        title="Lector Óptico de Cámara POS"
        description="Apunta la cámara al código de barras del producto"
        sampleCodes={products.slice(0, 4).map((p) => ({
          label: p.name.split(' ')[0],
          code: p.barcode,
        }))}
      />

      {/* Checkout / Payment Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-md flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[#10b981]">point_of_sale</span>
                <span className="text-base font-bold text-[#dce2f7]">Completar Cobro & Factura</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Total Highlight */}
            <div className="bg-[#070e1d] p-3 rounded-xl border border-[#374151]/50 flex items-center justify-between font-mono">
              <span className="text-xs text-[#e6bdb8] font-sans">Total de la Transacción:</span>
              <span className="text-xl font-extrabold text-[#10b981]">{formatCOP(total)}</span>
            </div>

            {/* Operating hours notice if checkout is outside hours */}
            {operatingHours.enabled && !operatingStatus.isWithinHours && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                <span className="material-symbols-outlined text-[18px] text-rose-400 shrink-0">alarm_off</span>
                <span className="text-[11px]">
                  <strong>Aviso:</strong> Venta procesada fuera de la jornada habitual ({operatingStatus.currentTimeStr} COT).
                </span>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'efectivo', label: 'Efectivo', icon: 'payments', shortcut: '1' },
                { id: 'tarjeta', label: 'Datáfono', icon: 'credit_card', shortcut: '2' },
                { id: 'qr_transfer', label: 'Nequi / QR', icon: 'qr_code_2', shortcut: '3' },
              ].map(({ id, label, icon, shortcut }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    posAudio.playKeyClick();
                    setPaymentMethod(id as PaymentMethod);
                  }}
                  className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border relative ${
                    paymentMethod === id
                      ? 'bg-[#dc2626] border-[#ef4444] text-[#fff6f5] shadow-md'
                      : 'bg-[#141b2b] border-[#374151]/30 text-[#e6bdb8] hover:bg-[#232a3a]'
                  }`}
                  title={`Seleccionar ${label} (tecla ${shortcut})`}
                >
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold">{label}</span>
                    <kbd className={`px-1 py-0.2 rounded font-mono text-[9px] ${
                      paymentMethod === id
                        ? 'bg-black/30 text-white'
                        : 'bg-[#232a3a] text-gray-400 border border-[#374151]/60'
                    }`}>
                      {shortcut}
                    </kbd>
                  </div>
                </button>
              ))}
            </div>

            {/* Cash input & Change calculation */}
            {paymentMethod === 'efectivo' && (
              <div className="flex flex-col space-y-2.5 bg-[#141b2b] p-3 rounded-xl border border-[#374151]/40">
                <span className="text-xs text-[#e6bdb8] font-semibold">Efectivo Recibido:</span>

                {/* Quick Bills buttons */}
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                  {[total, 20000, 50000, 100000].map((val, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        posAudio.playKeyClick();
                        setCashReceived(val);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] font-bold text-center border border-[#374151]/30"
                    >
                      {idx === 0 ? 'Exacto' : `$${formatNumberCOP(val)}`}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#e6bdb8]">$</span>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-[#070e1d] border border-[#374151]/60 text-sm font-mono text-white font-bold"
                  />
                </div>

                {/* Change calculation */}
                <div className="pt-2 border-t border-[#374151]/30 flex justify-between items-center font-mono text-xs">
                  <span className="text-[#e6bdb8] font-sans">Cambio / Vueltas:</span>
                  <span
                    className={`font-bold text-base ${
                      cashReceived < total ? 'text-[#ef4444]' : 'text-[#10b981]'
                    }`}
                  >
                    {cashReceived < total
                      ? `Faltan ${formatCOP(total - cashReceived)}`
                      : formatCOP(cashReceived - total)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'tarjeta' && (
              <div className="p-3 bg-[#141b2b] rounded-xl border border-[#374151]/30 text-xs text-[#e6bdb8] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[24px] text-[#90cdff]">contactless</span>
                <p>Inserta o acerca la tarjeta en el terminal Datáfono Redeban / Credibanco.</p>
              </div>
            )}

            {paymentMethod === 'qr_transfer' && (
              <div className="p-3 bg-[#141b2b] rounded-xl border border-[#374151]/30 text-xs text-[#e6bdb8] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[24px] text-[#10b981]">qr_code</span>
                <p>Presenta el código QR Nequi / Bancolombia en la pantalla de cliente.</p>
              </div>
            )}

            {/* Confirm CTA */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7] hover:bg-[#323949] flex items-center justify-center gap-1.5 transition-colors"
                title="Cancelar (Esc)"
              >
                <span>Cancelar</span>
                <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151] font-mono text-[9px] text-gray-400">
                  Esc
                </kbd>
              </button>
              <button
                type="button"
                disabled={paymentMethod === 'efectivo' && cashReceived < total}
                onClick={completePayment}
                className="flex-1 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 disabled:opacity-40 text-black text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                title="Finalizar Venta (Enter o F1)"
              >
                <span>Finalizar Venta</span>
                <kbd className="px-1.5 py-0.2 rounded bg-black/20 font-mono text-[9px] text-gray-900 font-extrabold">
                  Enter / F1
                </kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Mobile Cart Bar (visible on mobile screens when cart has items) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-16 inset-x-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              const el = document.getElementById('pos-ticket-sidebar');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full bg-[#dc2626] hover:bg-[#ef4444] text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-[#ef4444]/40 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-full bg-white text-[#dc2626] flex items-center justify-center text-xs">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
              <span>Ver Ticket / Pagar</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-sm font-bold">
              <span>{formatCOP(total)}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            </div>
          </button>
        </div>
      )}

      {/* Generated Thermal Receipt Modal */}
      {latestTicket && (
        <ThermalReceipt
          ticket={latestTicket}
          onClose={() => setLatestTicket(null)}
          onPrint={() => {
            onLogAudit('sale_completed', `Impresión de ticket térmico ${latestTicket.ticketNumber}`);
          }}
        />
      )}

      {/* Out of Hours Warning Modal */}
      {showOutOfHoursWarningModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#191f2f] border-2 border-amber-500/60 rounded-2xl p-6 w-full max-w-md flex flex-col space-y-4 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">
                Venta Fuera del Horario Operativo
              </h3>
              <p className="text-xs text-amber-300 font-medium">
                {operatingStatus.reason}
              </p>
            </div>

            <div className="bg-[#141b2b] p-3.5 rounded-xl border border-[#374151]/40 text-xs space-y-2 text-gray-300 font-sans">
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Día de la semana:</span>
                <span className="text-white font-bold">{operatingStatus.currentDayName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Horario permitido hoy:</span>
                <span className="text-amber-300 font-bold">
                  {operatingStatus.todaySchedule.isOpen
                    ? `${operatingStatus.openTimeFormatted} - ${operatingStatus.closeTimeFormatted}`
                    : 'Cerrado todo el día'}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Hora del intento:</span>
                <span className="text-white font-bold">{operatingStatus.currentTimeStr} COT</span>
              </div>
              <div className="flex justify-between font-mono pt-2 border-t border-[#374151]/30">
                <span className="text-gray-400">Cajero en turno:</span>
                <span className="text-white font-bold">{cashier.name} ({cashier.code})</span>
              </div>
            </div>

            {operatingHours.strictMode ? (
              <div className="space-y-2">
                <p className="text-xs text-[#e6bdb8]">
                  🔒 <strong className="text-white">Modo Estricto Activo:</strong> Ingresa el PIN maestro o de supervisor para autorizar esta transacción fuera de horas.
                </p>
                <input
                  type="password"
                  maxLength={6}
                  value={supervisorPinInput}
                  onChange={(e) => {
                    setSupervisorPinInput(e.target.value);
                    setPinErrorNotice(false);
                  }}
                  placeholder="PIN de autorización (ej. 1234)"
                  className="w-full px-3 py-2 rounded-xl bg-[#070e1d] border border-amber-500/40 text-center font-mono text-base tracking-widest text-white focus:outline-none"
                />
                {pinErrorNotice && (
                  <p className="text-[11px] text-rose-400 font-semibold text-center">
                    PIN incorrecto o no autorizado.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs">
                <p>
                  ℹ️ Esta transacción quedará registrada con aviso de advertencia en la bitácora de auditoría del administrador.
                </p>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setShowOutOfHoursWarningModal(false);
                  setSupervisorPinInput('');
                  setPinErrorNotice(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancelar Venta
              </button>
              <button
                type="button"
                onClick={handleProceedOutsideHours}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition-all shadow-md active:scale-95"
              >
                {operatingHours.strictMode ? 'Autorizar & Continuar' : 'Continuar Bajo Advertencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Keyboard Shortcuts Quick-Bar & Help Dock */}
      <aside aria-label="Atajos de teclado POS" className="fixed bottom-3 right-3 sm:right-5 z-30 flex items-center gap-2 select-none animate-fadeIn">
        {shortcutsDockMinimized ? (
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShortcutsDockMinimized(false);
              try {
                localStorage.setItem('pos_shortcuts_dock_min', 'false');
              } catch {}
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#191f2f]/95 hover:bg-[#232a3a] text-white border border-[#374151]/80 shadow-2xl backdrop-blur-md text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            title="Expandir barra de atajos rápidos (F8 o ?)"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-400">keyboard</span>
            <span className="hidden xs:inline">Atajos POS</span>
            <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151] font-mono text-[10px] text-amber-300 font-bold">
              F8
            </kbd>
          </button>
        ) : (
          <div className="bg-[#141b2b]/95 backdrop-blur-md border border-[#374151]/80 rounded-2xl p-1.5 sm:p-2 shadow-2xl flex items-center gap-1.5 sm:gap-2 text-xs">
            <div className="hidden md:flex items-center gap-1 px-1.5 text-gray-400 text-[11px] font-medium border-r border-[#374151]/50 mr-0.5">
              <span className="material-symbols-outlined text-[16px] text-amber-400">keyboard</span>
              <span>Atajos:</span>
            </div>

            {/* F1 Cobrar */}
            <button
              type="button"
              onClick={() => {
                if (cart.length > 0) openCheckout();
              }}
              disabled={cart.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#232a3a]/80 hover:bg-[#323949] disabled:opacity-40 text-white transition-colors"
              title="F1: Cobrar venta actual"
            >
              <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151] font-mono text-[10px] font-bold text-amber-300">
                F1
              </kbd>
              <span className="text-[11px] font-semibold text-emerald-400">Cobrar</span>
            </button>

            {/* F2 Buscar */}
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#232a3a]/80 hover:bg-[#323949] text-white transition-colors"
              title="F2: Enfocar buscador de catálogo"
            >
              <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151] font-mono text-[10px] font-bold text-amber-300">
                F2
              </kbd>
              <span className="text-[11px] font-semibold text-sky-400">Buscar</span>
            </button>

            {/* F3 Vaciar */}
            <button
              type="button"
              onClick={() => {
                if (cart.length > 0) clearCart();
              }}
              disabled={cart.length === 0}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-[#232a3a]/80 hover:bg-[#323949] disabled:opacity-40 text-white transition-colors"
              title="F3: Vaciar carrito actual"
            >
              <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151] font-mono text-[10px] font-bold text-amber-300">
                F3
              </kbd>
              <span className="text-[11px] font-semibold text-rose-400">Vaciar</span>
            </button>

            {/* Esc Salir */}
            <span
              className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-[#232a3a]/40 text-gray-300"
              title="Esc: Cancelar o cerrar modal"
            >
              <kbd className="px-1.5 py-0.2 rounded bg-[#070e1d] border border-[#374151] font-mono text-[10px] font-bold text-gray-300">
                Esc
              </kbd>
              <span className="text-[11px]">Cerrar</span>
            </span>

            {/* Open Full Help Modal */}
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowShortcutsModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors"
              title="Ver guía completa interactiva de atajos (F8 o ?)"
            >
              <span className="material-symbols-outlined text-[15px]">help</span>
              <span className="hidden xs:inline">Guía (F8)</span>
            </button>

            {/* Minimize Dock Button */}
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShortcutsDockMinimized(true);
                try {
                  localStorage.setItem('pos_shortcuts_dock_min', 'true');
                } catch {}
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#232a3a] transition-colors"
              title="Minimizar barra de atajos"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        )}
      </aside>

      {/* POS Shortcuts Guide Modal */}
      <PosShortcutsGuideModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};
