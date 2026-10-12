import React, { useState } from 'react';
import { Cashier, Product, CartItem, PaymentMethod, SaleTicket, AuditEvent } from '../types/pos';
import { formatCOP, formatNumberCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { ThermalReceipt } from './ThermalReceipt';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';

interface PosRegisterProps {
  cashier: Cashier;
  products: Product[];
  onLockTerminal: () => void;
  onLogout?: () => void;
  onCompleteSale: (ticket: SaleTicket, updatedCashier: Cashier) => void;
  onLogAudit: (type: AuditEvent['type'], details: string) => void;
}

export const PosRegister: React.FC<PosRegisterProps> = ({
  cashier,
  products,
  onLockTerminal,
  onLogout,
  onCompleteSale,
  onLogAudit,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Consumidor Final');
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  
  // Payment state
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [latestTicket, setLatestTicket] = useState<SaleTicket | null>(null);

  const categories = ['Todos', 'Bebidas', 'Snacks & Golosinas', 'Despensa & Abarrotes', 'Lácteos & Huevos', 'Licores & Cervezas', 'Panadería', 'Cuidado & Aseo'];

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
    posAudio.playKeyClick();
    setCashReceived(total); // Default to exact total
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

    const newTicket: SaleTicket = {
      id: ticketId,
      ticketNumber,
      timestamp,
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
      status: 'completada',
    };

    const updatedCashier: Cashier = {
      ...cashier,
      drawerCash: paymentMethod === 'efectivo' ? cashier.drawerCash + total : cashier.drawerCash,
      completedTickets: cashier.completedTickets + 1,
    };

    posAudio.playCashRegisterChime();
    onLogAudit('sale_completed', `Venta ${ticketNumber} completada por ${formatCOP(total)} (${paymentMethod})`);
    onCompleteSale(newTicket, updatedCashier);

    setLatestTicket(newTicket);
    setShowCheckoutModal(false);
    setCart([]);
  };

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
          >
            <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
            <span className="hidden sm:inline">Escanear</span>
          </button>

          {/* Quick Lock Terminal button */}
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              onLockTerminal();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white border border-[#374151]/40 text-xs font-semibold transition-colors shadow-sm"
            title="Bloquear Terminal (conserva sesión)"
          >
            <span className="material-symbols-outlined text-[17px]">lock</span>
            <span className="hidden sm:inline">Bloquear</span>
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, SKU o código de barras..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-[#191f2f] border border-[#374151]/40 text-sm text-[#dce2f7] placeholder-[#e6bdb8]/60 focus:outline-none focus:border-[#dc2626] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#e6bdb8] hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
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

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => addToCart(product)}
                  className={`group relative text-left p-3 rounded-xl bg-[#191f2f] border border-[#374151]/30 hover:border-[#dc2626]/50 transition-all flex flex-col justify-between shadow-sm active:scale-[0.98] ${
                    isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#232a3a]'
                  }`}
                >
                  {/* Top info */}
                  <div className="flex flex-col space-y-1 w-full">
                    <div className="flex items-center justify-between text-[10px] text-[#e6bdb8]">
                      <span className="font-mono text-[#90cdff]">{product.sku}</span>
                      <span
                        className={`font-mono ${
                          product.stock <= product.minStock ? 'text-[#ef4444] font-bold' : 'text-[#10b981]'
                        }`}
                      >
                        {isOutOfStock ? 'AGOTADO' : `${product.stock} disp.`}
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
                className="text-[11px] text-[#e6bdb8] hover:text-[#ef4444] transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                <span>Limpiar</span>
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
          >
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>Cobrar {total > 0 ? formatCOP(total) : ''}</span>
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

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
                { id: 'tarjeta', label: 'Datáfono', icon: 'credit_card' },
                { id: 'qr_transfer', label: 'Nequi / QR', icon: 'qr_code_2' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    posAudio.playKeyClick();
                    setPaymentMethod(id as PaymentMethod);
                  }}
                  className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border ${
                    paymentMethod === id
                      ? 'bg-[#dc2626] border-[#ef4444] text-[#fff6f5] shadow-md'
                      : 'bg-[#141b2b] border-[#374151]/30 text-[#e6bdb8] hover:bg-[#232a3a]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  <span className="text-[11px] font-semibold">{label}</span>
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
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7] hover:bg-[#323949]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={paymentMethod === 'efectivo' && cashReceived < total}
                onClick={completePayment}
                className="flex-1 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 disabled:opacity-40 text-black text-xs font-bold transition-all shadow-md"
              >
                Finalizar Venta
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
        <ThermalReceipt ticket={latestTicket} onClose={() => setLatestTicket(null)} />
      )}
    </div>
  );
};
