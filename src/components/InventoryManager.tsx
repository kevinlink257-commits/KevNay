import React, { useState } from 'react';
import { Product } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';

interface InventoryManagerProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  onUpdateProduct,
  onAddProduct,
}) => {
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [scannerMode, setScannerMode] = useState<'create_barcode' | 'search_filter'>('create_barcode');
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Compra / Reposición');

  // Form for new product
  const [newSku, setNewSku] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Snacks & Golosinas');
  const [newPrice, setNewPrice] = useState<number>(5000);
  const [newCost, setNewCost] = useState<number>(3200);
  const [newStock, setNewStock] = useState<number>(20);
  const [newMinStock, setNewMinStock] = useState<number>(5);
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<number>(0.19);

  // Metrics
  const totalItemsCount = products.reduce((acc, p) => acc + p.stock, 0);
  const totalCostValue = products.reduce((acc, p) => acc + p.costPrice * p.stock, 0);
  const totalRetailValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const estimatedProfit = totalRetailValue - totalCostValue;
  const avgGrossMargin = totalRetailValue > 0 ? ((estimatedProfit / totalRetailValue) * 100).toFixed(1) : '0';
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const categories = ['Todos', 'Bebidas', 'Snacks & Golosinas', 'Despensa & Abarrotes', 'Lácteos & Huevos', 'Licores & Cervezas', 'Panadería', 'Cuidado & Aseo'];

  const filtered = products.filter((p) => {
    const matchCat = categoryFilter === 'Todos' || p.category === categoryFilter;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    return matchCat && matchSearch;
  });

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;
    const nextStock = Math.max(0, selectedProductForAdjust.stock + adjustDelta);
    onUpdateProduct({ ...selectedProductForAdjust, stock: nextStock });
    posAudio.playKeyClick();
    setSelectedProductForAdjust(null);
    setAdjustDelta(0);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const generatedSku = newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`;
    const generatedBarcode = newBarcode.trim() || `770${Math.floor(100000000 + Math.random() * 900000000)}`;

    const created: Product = {
      id: `p-${Date.now()}`,
      sku: generatedSku,
      barcode: generatedBarcode,
      name: newName.trim(),
      category: newCategory,
      price: Number(newPrice) || 0,
      costPrice: Number(newCost) || 0,
      stock: Number(newStock) || 0,
      minStock: Number(newMinStock) || 0,
      taxRate: Number(newTaxRate) || 0,
    };

    onAddProduct(created);
    posAudio.playSuccessChime();
    setShowAddModal(false);
    // Reset form
    setNewName('');
    setNewSku('');
    setNewBarcode('');
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-4">
      {/* Top Banner KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-[#e6bdb8]">Total Referencias SKU</span>
          <span className="text-xl font-bold font-mono text-[#dce2f7] mt-0.5">{products.length}</span>
          <span className="text-[10px] text-[#e6bdb8]/80 font-mono">{totalItemsCount} unidades físicas</span>
        </div>

        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-[#e6bdb8]">Valor a Costo</span>
          <span className="text-xl font-bold font-mono text-[#90cdff] mt-0.5">{formatCOP(totalCostValue)}</span>
          <span className="text-[10px] text-[#e6bdb8]/80 font-mono">Inversión en almacén</span>
        </div>

        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-[#e6bdb8]">Valor Estimado Venta</span>
          <span className="text-xl font-bold font-mono text-[#10b981] mt-0.5">{formatCOP(totalRetailValue)}</span>
          <span className="text-[10px] text-[#e6bdb8]/80 font-mono">P.V.P Total</span>
        </div>

        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-[#e6bdb8]">Margen Bruto Estimado</span>
          <span className="text-xl font-bold font-mono text-[#f59e0b] mt-0.5">{avgGrossMargin}%</span>
          <span className="text-[10px] text-[#e6bdb8]/80 font-mono">Ganancia: {formatCOP(estimatedProfit)}</span>
        </div>

        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-col col-span-2 lg:col-span-1">
          <span className="text-[11px] text-[#e6bdb8]">Alertas de Stock Bajo</span>
          <span className={`text-xl font-bold font-mono mt-0.5 ${lowStockCount > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
            {lowStockCount} ítems
          </span>
          <span className="text-[10px] text-[#e6bdb8]/80">Requieren reabastecimiento</span>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <span className="material-symbols-outlined text-[#e6bdb8] text-[20px]">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, producto o código..."
            className="w-full bg-[#141b2b] border border-[#374151]/40 rounded-lg px-3 py-1.5 text-xs text-[#dce2f7] placeholder-[#e6bdb8]/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setScannerMode('search_filter');
              setScannerOpen(true);
            }}
            title="Escanear con cámara para buscar"
            className="px-2.5 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/40 flex items-center gap-1 text-xs transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[17px]">photo_camera</span>
            <span className="hidden sm:inline">Escanear</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#141b2b] border border-[#374151]/40 rounded-lg px-2.5 py-1.5 text-xs text-[#dce2f7] focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] text-[#fff6f5] text-xs font-semibold shadow-md transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141b2b] border-b border-[#374151]/40 text-[#e6bdb8] font-mono uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">SKU & Código</th>
                <th className="py-2.5 px-3">Producto & Categoría</th>
                <th className="py-2.5 px-3">Costo</th>
                <th className="py-2.5 px-3">P.V.P (Venta)</th>
                <th className="py-2.5 px-3">Margen %</th>
                <th className="py-2.5 px-3">Stock Actual</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#374151]/30">
              {filtered.map((product) => {
                const margin = product.price > 0 ? (((product.price - product.costPrice) / product.price) * 100).toFixed(0) : '0';
                const isLow = product.stock <= product.minStock;
                const isOut = product.stock <= 0;

                return (
                  <tr key={product.id} className="hover:bg-[#232a3a]/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono">
                      <span className="font-semibold text-[#90cdff] block">{product.sku}</span>
                      <span className="text-[10px] text-[#e6bdb8]/70">{product.barcode}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-[#dce2f7] block">{product.name}</span>
                      <span className="text-[10px] text-[#e6bdb8]">{product.category}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#e6bdb8]">
                      {formatCOP(product.costPrice)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#10b981]">
                      {formatCOP(product.price)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#f59e0b]">
                      {margin}%
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span className={isOut ? 'text-[#ef4444]' : isLow ? 'text-[#f59e0b]' : 'text-white'}>
                        {product.stock} u.
                      </span>
                      <span className="text-[10px] text-[#e6bdb8]/70 block font-normal">
                        Mín: {product.minStock}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isOut ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ef4444]/20 text-[#ef4444]">
                          Agotado
                        </span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f59e0b]/20 text-[#f59e0b]">
                          Stock Bajo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#10b981]/20 text-[#10b981]">
                          Óptimo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setSelectedProductForAdjust(product);
                          setAdjustDelta(0);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-[11px] font-semibold border border-[#374151]/30 transition-colors"
                      >
                        Ajustar Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {selectedProductForAdjust && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-sm flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <span className="font-bold text-sm text-white">Ajuste de Inventario</span>
              <button
                type="button"
                onClick={() => setSelectedProductForAdjust(null)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="bg-[#141b2b] p-3 rounded-xl border border-[#374151]/30 space-y-1">
              <p className="text-xs font-bold text-[#dce2f7]">{selectedProductForAdjust.name}</p>
              <div className="flex justify-between text-[11px] font-mono text-[#e6bdb8]">
                <span>Stock Actual:</span>
                <span className="font-bold text-white">{selectedProductForAdjust.stock} unidades</span>
              </div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Motivo del Ajuste:</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-[#dce2f7]"
                >
                  <option value="Compra / Reposición">Compra a Proveedor (+)</option>
                  <option value="Ajuste Conteo Físico">Ajuste por Conteo Físico</option>
                  <option value="Merma o Avería">Merma / Producto Averiado (-)</option>
                  <option value="Devolución">Devolución de Cliente (+)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Cantidad a Modificar (+ / -):</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((prev) => prev - 1)}
                    className="w-8 h-8 rounded-lg bg-[#232a3a] text-lg font-bold text-white hover:bg-[#323949]"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(Number(e.target.value))}
                    className="w-full p-2 rounded-lg bg-[#070e1d] border border-[#374151]/50 text-center font-mono text-sm text-white font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg bg-[#232a3a] text-lg font-bold text-white hover:bg-[#323949]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#070e1d] flex justify-between text-xs font-mono">
                <span className="text-[#e6bdb8]">Nuevo Stock Resultante:</span>
                <span className="font-bold text-[#10b981]">
                  {Math.max(0, selectedProductForAdjust.stock + adjustDelta)} unidades
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedProductForAdjust(null)}
                  className="flex-1 py-2 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#dc2626] text-xs font-semibold text-white"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-md flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <span className="font-bold text-sm text-white">Registrar Nuevo Producto</span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Nombre Comercial:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Jugo Hit Mango 500ml"
                  className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-[#dce2f7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">SKU:</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="Ej: BEB-0104"
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-[#dce2f7]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Categoría:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-[#dce2f7]"
                  >
                    {categories.filter((c) => c !== 'Todos').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Precio Costo (COP):</label>
                  <input
                    type="number"
                    value={newCost}
                    onChange={(e) => setNewCost(Number(e.target.value))}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-[#dce2f7]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Precio Venta P.V.P (COP):</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-[#10b981] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Stock Inicial:</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Stock Mínimo:</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value))}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Tasa IVA:</label>
                  <select
                    value={newTaxRate}
                    onChange={(e) => setNewTaxRate(Number(e.target.value))}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-[#dce2f7]"
                  >
                    <option value={0.19}>19% General</option>
                    <option value={0.05}>5% Reducido</option>
                    <option value={0}>0% Exento</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-[#e6bdb8]">Código de Barras / Guía de Envío:</label>
                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setScannerMode('create_barcode');
                      setScannerOpen(true);
                    }}
                    className="px-2 py-0.5 rounded bg-[#dc2626]/20 hover:bg-[#dc2626] text-[#ef4444] hover:text-white border border-[#dc2626]/40 text-[10px] font-semibold flex items-center gap-1 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    <span>Escanear con Cámara</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  placeholder="Escanea o escribe código/guía (ej: 770209001011 o GUIA-SRV-901)"
                  className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-[#dce2f7] focus:outline-none focus:border-[#dc2626]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#dc2626] text-xs font-semibold text-white shadow-md"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode / Shipping Label Camera Scanner Modal */}
      <BarcodeCameraScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          if (scannerMode === 'create_barcode') {
            setNewBarcode(code);
            if (!newSku) {
              const prefix = newCategory.slice(0, 3).toUpperCase();
              setNewSku(`${prefix}-${code.slice(-4)}`);
            }
          } else {
            setSearch(code);
          }
          setScannerOpen(false);
        }}
        title={
          scannerMode === 'create_barcode'
            ? 'Escanear Código / Guía para Nuevo Producto'
            : 'Escanear para Buscar en Inventario'
        }
        description="Apunta la cámara al código de barras o guía de paquetería"
        sampleCodes={[
          { label: 'EAN-13', code: '770209001011' },
          { label: 'Guía Coordinadora', code: 'GUIA-COO-748921' },
          { label: 'Guía Servientrega', code: 'GUIA-SRV-901842' },
          { label: 'Código Barras', code: '770200102045' },
        ]}
      />
    </div>
  );
};
