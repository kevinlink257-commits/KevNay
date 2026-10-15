import React, { useState, useMemo } from 'react';
import { Product } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import {
  GlobalThresholdSettings,
  getStoredThresholdSettings,
  saveStoredThresholdSettings,
  resetThresholdSettingsToDefault,
  getCategoryThreshold,
  getCategoryIcon,
  isAccessoryCategoryName,
  applyThresholdsToProductsList,
  ACCESSORY_CATEGORIES_PRESETS,
  ALL_DEFAULT_CATEGORY_RULES,
} from '../utils/thresholdSettings';

interface InventoryManagerProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onBatchUpdateProducts?: (products: Product[], reason?: string) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onClearInventory: () => void;
  onRestoreDefaultCatalog?: () => void;
  onOpenBackupModal?: () => void;
}

type StockStatusFilter = 'all' | 'alerts' | 'out_of_stock' | 'low_stock' | 'optimal';

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  onUpdateProduct,
  onBatchUpdateProducts,
  onAddProduct,
  onDeleteProduct,
  onClearInventory,
  onRestoreDefaultCatalog,
  onOpenBackupModal,
}) => {
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [scannerMode, setScannerMode] = useState<'create_barcode' | 'search_filter'>('create_barcode');

  // Global & Category Threshold Settings
  const [thresholdSettings, setThresholdSettings] = useState<GlobalThresholdSettings>(() =>
    getStoredThresholdSettings()
  );
  const [showGlobalThresholdsModal, setShowGlobalThresholdsModal] = useState<boolean>(false);
  const [thresholdModalTab, setThresholdModalTab] = useState<'accessories' | 'all'>('accessories');
  const [thresholdCategorySearch, setThresholdCategorySearch] = useState<string>('');

  // In-Panel Mass Threshold Management Section state
  const [showMassThresholdSection, setShowMassThresholdSection] = useState<boolean>(true);
  const [sectionCategoryFilter, setSectionCategoryFilter] = useState<string>('all_accessories');
  const [sectionSearch, setSectionSearch] = useState<string>('');
  const [massThresholdInput, setMassThresholdInput] = useState<number>(6);
  const [expandedCategoryDetail, setExpandedCategoryDetail] = useState<string | null>(null);

  // Stock Adjustment modal state
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Compra / Reposición');

  // Edit Product & Threshold Modal state
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(5);
  const [editSku, setEditSku] = useState<string>('');
  const [editBarcode, setEditBarcode] = useState<string>('');
  const [editTaxRate, setEditTaxRate] = useState<number>(0.19);

  // Quick Threshold Modal for single product
  const [productForQuickThreshold, setProductForQuickThreshold] = useState<Product | null>(null);
  const [quickMinStockInput, setQuickMinStockInput] = useState<number>(5);

  // Toast feedback message
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);

  // Deletion modals state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [clearConfirmText, setClearConfirmText] = useState<string>('');

  // Form for new product
  const [newSku, setNewSku] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Joyería & Aretes');
  const [newPrice, setNewPrice] = useState<number>(35000);
  const [newCost, setNewCost] = useState<number>(16000);
  const [newStock, setNewStock] = useState<number>(10);
  const [newMinStock, setNewMinStock] = useState<number>(6);
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<number>(0.19);

  // Notification helper
  const showToast = (message: string, type: 'success' | 'warn' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => {
      setFeedbackToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Dynamically compile all categories from default rules and existing products
  const allKnownCategories = useMemo(() => {
    const fromRules = ALL_DEFAULT_CATEGORY_RULES.map((r) => r.category);
    const fromProducts = products.map((p) => p.category);
    const set = new Set([...fromRules, ...fromProducts]);
    return Array.from(set);
  }, [products]);

  // Accessory categories list
  const accessoryCategories = useMemo(() => {
    return allKnownCategories.filter((cat) => isAccessoryCategoryName(cat));
  }, [allKnownCategories]);

  // Categories list for dropdown
  const categoriesForFilter = useMemo(() => {
    return ['Todos', ...allKnownCategories];
  }, [allKnownCategories]);

  // Metrics
  const totalItemsCount = products.reduce((acc, p) => acc + p.stock, 0);
  const totalCostValue = products.reduce((acc, p) => acc + p.costPrice * p.stock, 0);
  const totalRetailValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const estimatedProfit = totalRetailValue - totalCostValue;
  const avgGrossMargin = totalRetailValue > 0 ? ((estimatedProfit / totalRetailValue) * 100).toFixed(1) : '0';

  // Warnings Breakdown
  const outOfStockProducts = products.filter((p) => p.stock <= 0);
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= (p.minStock ?? 5));
  const optimalProducts = products.filter((p) => p.stock > (p.minStock ?? 5));
  const totalAlertsCount = outOfStockProducts.length + lowStockProducts.length;

  // Filtering products
  const filtered = products.filter((p) => {
    const matchCat = categoryFilter === 'Todos' || p.category === categoryFilter;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);

    const min = p.minStock ?? 5;
    let matchStatus = true;
    if (stockStatusFilter === 'alerts') {
      matchStatus = p.stock <= min;
    } else if (stockStatusFilter === 'out_of_stock') {
      matchStatus = p.stock <= 0;
    } else if (stockStatusFilter === 'low_stock') {
      matchStatus = p.stock > 0 && p.stock <= min;
    } else if (stockStatusFilter === 'optimal') {
      matchStatus = p.stock > min;
    }

    return matchCat && matchSearch && matchStatus;
  });

  // Update a single Category Threshold in Global Settings
  const handleUpdateCategoryThreshold = (category: string, newThreshold: number, autoApplyNow = false) => {
    const updatedSettings: GlobalThresholdSettings = {
      ...thresholdSettings,
      categoryThresholds: {
        ...thresholdSettings.categoryThresholds,
        [category]: Math.max(0, newThreshold),
      },
    };

    setThresholdSettings(updatedSettings);
    saveStoredThresholdSettings(updatedSettings);

    // If autoSyncOnChange or autoApplyNow is true, automatically cascade to products of this category
    if (thresholdSettings.autoSyncOnChange || autoApplyNow) {
      applyThresholdToCategoryProducts(category, Math.max(0, newThreshold));
    } else {
      posAudio.playKeyClick();
      showToast(`Umbral de "${category}" guardado en ${newThreshold} u.`);
    }
  };

  // Apply threshold to products in a category
  const applyThresholdToCategoryProducts = (category: string, thresholdVal: number) => {
    const matchingCount = products.filter((p) => p.category === category).length;
    if (matchingCount === 0) {
      posAudio.playKeyClick();
      showToast(`Umbral de "${category}" actualizado a ${thresholdVal} u. (No hay productos registrados aún)`);
      return;
    }

    const updatedList = products.map((p) => {
      if (p.category === category) {
        return { ...p, minStock: thresholdVal };
      }
      return p;
    });

    if (onBatchUpdateProducts) {
      onBatchUpdateProducts(
        updatedList,
        `Umbral de categoría "${category}" actualizado a ${thresholdVal} u.`
      );
    } else {
      updatedList.forEach((p) => {
        if (p.category === category) onUpdateProduct(p);
      });
    }

    posAudio.playSuccessChime();
    showToast(
      `Umbral de "${category}" (${thresholdVal} u.) aplicado automáticamente a ${matchingCount} producto(s)`
    );
  };

  // Apply ALL Global and Category thresholds to the whole inventory
  const handleApplyAllThresholdsToInventory = () => {
    const updatedList = applyThresholdsToProductsList(products, thresholdSettings);

    if (onBatchUpdateProducts) {
      onBatchUpdateProducts(
        updatedList,
        `Umbrales globales y de categorías aplicados a todo el inventario (${updatedList.length} productos)`
      );
    } else {
      updatedList.forEach((p) => onUpdateProduct(p));
    }

    posAudio.playCashRegisterChime();
    showToast(
      `¡Umbrales globales y de categorías aplicados a los ${products.length} productos del inventario!`
    );
  };

  // Reset Thresholds to Recommended Defaults
  const handleResetThresholds = () => {
    const defaults = resetThresholdSettingsToDefault();
    setThresholdSettings(defaults);
    posAudio.playSuccessChime();
    showToast('Valores recomendados de umbrales para accesorios y tienda restablecidos');
  };

  // Mass apply threshold to multiple categories (filtered accessory categories)
  const handleApplyMassThresholdToCategories = (targetCategories: string[], thresholdVal: number) => {
    if (targetCategories.length === 0) {
      posAudio.playErrorBuzz();
      showToast('No hay categorías seleccionadas para aplicar umbrales', 'warn');
      return;
    }

    const safeThreshold = Math.max(0, thresholdVal);
    const updatedThresholds = { ...thresholdSettings.categoryThresholds };
    targetCategories.forEach((cat) => {
      updatedThresholds[cat] = safeThreshold;
    });

    const updatedSettings: GlobalThresholdSettings = {
      ...thresholdSettings,
      categoryThresholds: updatedThresholds,
    };

    setThresholdSettings(updatedSettings);
    saveStoredThresholdSettings(updatedSettings);

    const categoriesSet = new Set(targetCategories);
    let affectedCount = 0;
    const updatedProducts = products.map((p) => {
      if (categoriesSet.has(p.category)) {
        affectedCount++;
        return { ...p, minStock: safeThreshold };
      }
      return p;
    });

    if (onBatchUpdateProducts) {
      onBatchUpdateProducts(
        updatedProducts,
        `Umbral masivo de ${safeThreshold} u. aplicado a ${targetCategories.length} categorías (${affectedCount} productos)`
      );
    } else {
      updatedProducts.forEach((p) => {
        if (categoriesSet.has(p.category)) onUpdateProduct(p);
      });
    }

    posAudio.playCashRegisterChime();
    showToast(
      `¡Umbral de ${safeThreshold} u. asignado masivamente a ${targetCategories.length} categorías (${affectedCount} productos actualizados)!`
    );
  };

  // Categories visible in mass management section based on sectionCategoryFilter and sectionSearch
  const sectionFilteredCategories = useMemo(() => {
    let list: string[] = [];
    if (sectionCategoryFilter === 'all_accessories') {
      list = accessoryCategories;
    } else if (sectionCategoryFilter === 'all_store') {
      list = allKnownCategories;
    } else {
      list = allKnownCategories.filter((cat) => cat === sectionCategoryFilter);
    }

    if (sectionSearch.trim()) {
      const q = sectionSearch.toLowerCase();
      list = list.filter((cat) => cat.toLowerCase().includes(q));
    }

    return list;
  }, [accessoryCategories, allKnownCategories, sectionCategoryFilter, sectionSearch]);

  // Total products in visible filtered categories
  const totalFilteredCategoryProductsCount = useMemo(() => {
    const set = new Set(sectionFilteredCategories);
    return products.filter((p) => set.has(p.category)).length;
  }, [products, sectionFilteredCategories]);

  // Handle Quick Inline Threshold Step for single product
  const handleQuickThresholdStep = (product: Product, delta: number) => {
    const currentMin = product.minStock ?? 5;
    const nextMin = Math.max(0, currentMin + delta);
    onUpdateProduct({ ...product, minStock: nextMin });
    posAudio.playKeyClick();
    showToast(`Umbral mínimo de "${product.name}" actualizado a ${nextMin} u.`);
  };

  // Open Edit Product Modal
  const handleOpenEditProduct = (product: Product) => {
    posAudio.playKeyClick();
    setProductToEdit(product);
    setEditName(product.name);
    setEditCategory(product.category);
    setEditPrice(product.price);
    setEditCost(product.costPrice);
    setEditStock(product.stock);
    setEditMinStock(product.minStock ?? 5);
    setEditSku(product.sku);
    setEditBarcode(product.barcode);
    setEditTaxRate(product.taxRate ?? 0.19);
  };

  // Save Full Product Edit
  const handleSaveProductEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit) return;

    const updated: Product = {
      ...productToEdit,
      name: editName.trim() || productToEdit.name,
      category: editCategory || productToEdit.category,
      price: Number(editPrice) || 0,
      costPrice: Number(editCost) || 0,
      stock: Math.max(0, Number(editStock) || 0),
      minStock: Math.max(0, Number(editMinStock) || 0),
      sku: editSku.trim() || productToEdit.sku,
      barcode: editBarcode.trim() || productToEdit.barcode,
      taxRate: Number(editTaxRate) || 0,
    };

    onUpdateProduct(updated);
    posAudio.playSuccessChime();
    showToast(`Producto "${updated.name}" y umbral (${updated.minStock} u.) actualizados`);
    setProductToEdit(null);
  };

  // Open Quick Threshold Modal for a product
  const handleOpenQuickThresholdModal = (product: Product) => {
    posAudio.playKeyClick();
    setProductForQuickThreshold(product);
    setQuickMinStockInput(product.minStock ?? 5);
  };

  // Save Quick Threshold for a product
  const handleSaveQuickThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForQuickThreshold) return;

    const newMin = Math.max(0, Number(quickMinStockInput) || 0);
    onUpdateProduct({ ...productForQuickThreshold, minStock: newMin });
    posAudio.playSuccessChime();
    showToast(`Umbral mínimo de "${productForQuickThreshold.name}" configurado a ${newMin} unidades`);
    setProductForQuickThreshold(null);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;
    const nextStock = Math.max(0, selectedProductForAdjust.stock + adjustDelta);
    onUpdateProduct({ ...selectedProductForAdjust, stock: nextStock });
    posAudio.playKeyClick();
    showToast(`Stock de "${selectedProductForAdjust.name}" ajustado a ${nextStock} u.`);
    setSelectedProductForAdjust(null);
    setAdjustDelta(0);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const generatedSku = newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`;
    const generatedBarcode = newBarcode.trim() || `770${Math.floor(100000000 + Math.random() * 900000000)}`;

    // Use category threshold as default if available
    const catThreshold = getCategoryThreshold(newCategory, thresholdSettings);
    const finalMinStock = Number(newMinStock) >= 0 ? Number(newMinStock) : catThreshold;

    const created: Product = {
      id: `p-${Date.now()}`,
      sku: generatedSku,
      barcode: generatedBarcode,
      name: newName.trim(),
      category: newCategory,
      price: Number(newPrice) || 0,
      costPrice: Number(newCost) || 0,
      stock: Number(newStock) || 0,
      minStock: finalMinStock,
      taxRate: Number(newTaxRate) || 0,
    };

    onAddProduct(created);
    posAudio.playSuccessChime();
    showToast(`Nuevo producto "${created.name}" agregado con umbral de ${created.minStock} u.`);
    setShowAddModal(false);
    // Reset form
    setNewName('');
    setNewSku('');
    setNewBarcode('');
  };

  const handleConfirmDeleteProduct = () => {
    if (!productToDelete) return;
    onDeleteProduct(productToDelete.id);
    posAudio.playKeyClick();
    showToast(`Producto "${productToDelete.name}" eliminado`, 'warn');
    setProductToDelete(null);
  };

  const handleConfirmClearInventory = () => {
    onClearInventory();
    posAudio.playErrorBuzz();
    setShowClearConfirmModal(false);
    setClearConfirmText('');
    showToast('Todo el catálogo de inventario ha sido vaciado', 'warn');
  };

  // Helper to get active rule for a product's category
  const getProductCategoryThreshold = (category: string) => {
    return getCategoryThreshold(category, thresholdSettings);
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-4">
      {/* Toast Feedback Notification */}
      {feedbackToast && (
        <div className="fixed top-18 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2 text-xs font-semibold ${
              feedbackToast.type === 'warn'
                ? 'bg-[#291717] border-red-500/60 text-red-200'
                : 'bg-[#152a20] border-emerald-500/60 text-emerald-200'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {feedbackToast.type === 'warn' ? 'warning' : 'check_circle'}
            </span>
            <span>{feedbackToast.message}</span>
          </div>
        </div>
      )}

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

        {/* Interactive Stock Warnings KPI Card */}
        <button
          type="button"
          onClick={() => {
            posAudio.playKeyClick();
            setStockStatusFilter(stockStatusFilter === 'alerts' ? 'all' : 'alerts');
          }}
          title="Haz clic para filtrar productos con advertencia de stock bajo o agotado"
          className={`border rounded-xl p-3 flex flex-col col-span-2 lg:col-span-1 text-left transition-all relative overflow-hidden group cursor-pointer ${
            totalAlertsCount > 0
              ? stockStatusFilter === 'alerts'
                ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/30 ring-2 ring-amber-500/40'
                : 'bg-[#191f2f] border-amber-500/40 hover:border-amber-400 hover:bg-amber-950/20'
              : 'bg-[#191f2f] border-[#374151]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#e6bdb8] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-amber-400">warning</span>
              Alertas de Stock
            </span>
            <span className="text-[10px] text-amber-400/90 font-mono underline decoration-dotted">
              {stockStatusFilter === 'alerts' ? 'Viendo alertas' : 'Filtrar'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className={`text-xl font-black font-mono ${
                outOfStockProducts.length > 0
                  ? 'text-[#ef4444]'
                  : lowStockProducts.length > 0
                  ? 'text-[#f59e0b]'
                  : 'text-[#10b981]'
              }`}
            >
              {totalAlertsCount}
            </span>
            <span className="text-[10px] text-[#e6bdb8]">ítems ≤ umbral mín.</span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-[10px]">
            {outOfStockProducts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                🔴 {outOfStockProducts.length} agotados
              </span>
            )}
            {lowStockProducts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                🟡 {lowStockProducts.length} bajos
              </span>
            )}
            {totalAlertsCount === 0 && <span className="text-emerald-400">Todo el stock en nivel óptimo</span>}
          </div>
        </button>
      </div>

      {/* Visual Stock Warning Banner when alert items exist */}
      {totalAlertsCount > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-[#191f2f] to-red-950/40 border border-amber-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <span className="material-symbols-outlined text-[20px] animate-pulse">priority_high</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>Atención de Inventario: {totalAlertsCount} productos en umbral de advertencia</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Stock actual ≤ Stock Mínimo
                </span>
              </h4>
              <p className="text-[11px] text-[#e6bdb8]">
                Se resaltan en <strong className="text-red-400 font-bold">Rojo</strong> los productos sin existencias (0 u.) y
                en <strong className="text-amber-400 font-bold">Ámbar</strong> los productos que alcanzaron su umbral
                mínimo configurado por categoría de accesorio o producto.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowMassThresholdSection(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Gestionar Umbrales Masivos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setStockStatusFilter(stockStatusFilter === 'alerts' ? 'all' : 'alerts');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                stockStatusFilter === 'alerts'
                  ? 'bg-amber-500 text-[#291400] hover:bg-amber-400'
                  : 'bg-[#232a3a] hover:bg-[#323949] text-white border border-[#374151]/50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt</span>
              <span>{stockStatusFilter === 'alerts' ? 'Quitar Filtro' : 'Filtrar Alertas'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Control bar with Actions & Global Thresholds Button */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-[260px] max-w-md">
          <span className="material-symbols-outlined text-[#e6bdb8] text-[20px]">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, producto o código..."
            className="w-full bg-[#141b2b] border border-[#374151]/40 rounded-lg px-3 py-1.5 text-xs text-[#dce2f7] placeholder-[#e6bdb8]/60 focus:outline-none focus:border-[#adc6ff]"
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#141b2b] border border-[#374151]/40 rounded-lg px-2.5 py-1.5 text-xs text-[#dce2f7] focus:outline-none"
          >
            {categoriesForFilter.map((c) => (
              <option key={c} value={c}>
                {c === 'Todos'
                  ? 'Todas las Categorías'
                  : isAccessoryCategoryName(c)
                  ? `✨ ${c}`
                  : c}
              </option>
            ))}
          </select>

          {/* In-Panel Mass Thresholds Section Toggle Button */}
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowMassThresholdSection((prev) => !prev);
            }}
            title="Abrir o cerrar la sección dentro del panel para gestionar umbrales de stock mínimo de forma masiva"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
              showMassThresholdSection
                ? 'bg-amber-500 text-black border-amber-400 ring-2 ring-amber-500/30 shadow-amber-950/40'
                : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border-amber-500/40'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">
              {showMassThresholdSection ? 'keyboard_arrow_up' : 'tune'}
            </span>
            <span className="hidden sm:inline">
              {showMassThresholdSection ? 'Ocultar Gestión Masiva' : 'Gestión Masiva Umbrales'}
            </span>
            <span className="sm:hidden">
              {showMassThresholdSection ? 'Masivo ▲' : 'Masivo ▼'}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                showMassThresholdSection ? 'bg-black text-amber-300' : 'bg-amber-500/40 text-amber-200'
              }`}
            >
              {accessoryCategories.length} cat.
            </span>
          </button>

          {/* Export / Backup JSON Button */}
          {onOpenBackupModal && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onOpenBackupModal();
              }}
              title="Descargar respaldo JSON completo del inventario, cajeros y auditoría"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/40 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span className="hidden sm:inline">Respaldar JSON</span>
              <span className="sm:hidden">JSON</span>
            </button>
          )}

          {/* Delete All Inventory Button */}
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowClearConfirmModal(true);
              }}
              title="Eliminar todo el inventario de la tienda"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dc2626]/20 hover:bg-[#dc2626] text-[#ef4444] hover:text-white border border-[#dc2626]/40 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
              <span className="hidden sm:inline">Eliminar Todo</span>
              <span className="sm:hidden">Vaciar</span>
            </button>
          )}

          {/* Restore sample catalog if empty */}
          {products.length === 0 && onRestoreDefaultCatalog && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onRestoreDefaultCatalog();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078b2]/20 hover:bg-[#0078b2] text-[#90cdff] hover:text-white border border-[#0078b2]/40 text-xs font-semibold transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[17px]">history</span>
              <span>Restaurar Catálogo Base</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] text-[#fff6f5] text-xs font-semibold shadow-md transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN DENTRO DEL PANEL: Gestión Masiva de Umbrales de Stock Mínimo para Accesorios */}
      {showMassThresholdSection && (
        <section
          aria-label="Gestión Masiva de Umbrales de Stock Mínimo"
          className="bg-gradient-to-b from-[#182032] via-[#141b2a] to-[#101522] border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl relative overflow-hidden transition-all duration-300"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#374151]/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-[24px]">tune</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                    Gestión Masiva de Umbrales de Stock Mínimo
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Boutique de Accesorios & Joyería
                  </span>
                </div>
                <p className="text-[11px] text-[#e6bdb8] mt-0.5">
                  Filtra por categorías específicas de accesorios, ajusta niveles de alerta personalizada y aplica cambios en bloque para activar el resaltado visual (
                  <strong className="text-red-400 font-bold">Rojo</strong> = 0 u. agotado,{' '}
                  <strong className="text-amber-400 font-bold">Ámbar</strong> ≤ umbral mínimo) en toda la lista de inventario.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Preset Reset */}
              <button
                type="button"
                onClick={handleResetThresholds}
                title="Restablecer reglas de umbrales a los valores recomendados por defecto para accesorios"
                className="px-2.5 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                <span className="hidden sm:inline">Restablecer Recomendados</span>
              </button>

              {/* Apply All to Inventory */}
              <button
                type="button"
                onClick={handleApplyAllThresholdsToInventory}
                title="Aplica todos los umbrales configurados a cada producto del catálogo actual"
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">flash_on</span>
                <span>Aplicar a Todo el Inventario</span>
              </button>

              {/* Close Section Button */}
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setShowMassThresholdSection(false);
                }}
                title="Ocultar esta sección"
                className="w-8 h-8 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Subheader: Auto-Sync Toggle & KPI overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#0c1322] border border-[#374151]/40 rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2 text-[#dce2f7]">
              <span className="material-symbols-outlined text-amber-400 text-[18px]">diamond</span>
              <div>
                <span className="text-[10px] text-[#e6bdb8] block">Categorías de Accesorios</span>
                <span className="font-bold font-mono text-white text-xs">
                  {accessoryCategories.length} detectadas en catálogo
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#dce2f7]">
              <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
              <div>
                <span className="text-[10px] text-[#e6bdb8] block">Alertas Visuales Activas</span>
                <span className="font-bold font-mono text-amber-400 text-xs">
                  {totalAlertsCount} productos ({outOfStockProducts.length} agotados, {lowStockProducts.length} bajos)
                </span>
              </div>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:border-l sm:border-[#374151]/40 sm:pl-3">
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-[#e6bdb8] block">Sincronización Automática</span>
                <span className="text-[11px] font-semibold text-[#dce2f7]">
                  {thresholdSettings.autoSyncOnChange ? 'Activa (Actualiza al editar)' : 'Manual (Requiere botón aplicar)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = { ...thresholdSettings, autoSyncOnChange: !thresholdSettings.autoSyncOnChange };
                  setThresholdSettings(next);
                  saveStoredThresholdSettings(next);
                  posAudio.playKeyClick();
                  showToast(
                    next.autoSyncOnChange
                      ? 'Sincronización automática activada'
                      : 'Sincronización automática desactivada'
                  );
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  thresholdSettings.autoSyncOnChange ? 'bg-amber-500' : 'bg-[#232a3a]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    thresholdSettings.autoSyncOnChange ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ACCESSORY CATEGORY FILTER TABS & SEARCH */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">filter_list</span>
                <span>Filtrar por Categoría de Accesorios:</span>
              </span>

              {/* Category Search in Section */}
              <div className="relative">
                <span className="material-symbols-outlined text-[#e6bdb8] text-[15px] absolute left-2 top-1.5">
                  search
                </span>
                <input
                  type="text"
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  placeholder="Buscar categoría..."
                  className="bg-[#0c1322] border border-[#374151]/50 rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-amber-500 w-44"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* All Accessories Pill */}
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setSectionCategoryFilter('all_accessories');
                  setExpandedCategoryDetail(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  sectionCategoryFilter === 'all_accessories'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-950/40 ring-1 ring-amber-300'
                    : 'bg-[#141b2a] hover:bg-[#20293d] text-[#e6bdb8] border border-[#374151]/50'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">diamond</span>
                <span>Todos los Accesorios ({accessoryCategories.length})</span>
              </button>

              {/* Specific Accessory Categories */}
              {accessoryCategories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                const active = sectionCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setSectionCategoryFilter(cat);
                      setExpandedCategoryDetail(cat);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-black font-bold shadow-sm'
                        : 'bg-[#141b2a] hover:bg-[#20293d] text-[#dce2f7] border border-[#374151]/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {getCategoryIcon(cat)}
                    </span>
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        active ? 'bg-black/20 text-black' : 'bg-[#232a3a] text-[#adc6ff]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* View All Store Categories Pill */}
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setSectionCategoryFilter('all_store');
                  setExpandedCategoryDetail(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  sectionCategoryFilter === 'all_store'
                    ? 'bg-[#adc6ff] text-[#070e1d] font-bold shadow-md'
                    : 'bg-[#141b2a] hover:bg-[#20293d] text-[#e6bdb8] border border-[#374151]/50'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">storefront</span>
                <span>Todas las Categorías ({allKnownCategories.length})</span>
              </button>
            </div>
          </div>

          {/* MASS BULK ASSIGNMENT BAR */}
          <div className="bg-[#0c1322] border-2 border-amber-500/40 rounded-xl p-3 sm:p-4 space-y-2.5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-amber-400">bolt</span>
                  <span>Asignación Rápida Masiva para Categorías Visibles</span>
                </h4>
                <p className="text-[11px] text-[#e6bdb8]">
                  Define un umbral y aplícalo en un solo paso a las{' '}
                  <strong className="text-amber-300 font-bold">{sectionFilteredCategories.length}</strong>{' '}
                  categorías mostradas ({totalFilteredCategoryProductsCount} productos en catálogo).
                </p>
              </div>

              {/* Value Input & Stepper & Bulk Apply Button */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#141b2a] border border-amber-500/50 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setMassThresholdInput((prev) => Math.max(0, prev - 1))}
                    className="w-7 h-7 rounded bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={massThresholdInput}
                    onChange={(e) => setMassThresholdInput(Math.max(0, Number(e.target.value)))}
                    className="w-14 bg-[#070e1d] border border-amber-500/60 rounded px-1.5 py-0.5 text-center font-mono font-black text-amber-300 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMassThresholdInput((prev) => prev + 1)}
                    className="w-7 h-7 rounded bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-[#e6bdb8] font-mono px-1">u.</span>
                </div>

                {/* Presets */}
                <div className="hidden lg:flex items-center gap-1">
                  {[2, 4, 6, 8, 10, 15].map((presetVal) => (
                    <button
                      key={presetVal}
                      type="button"
                      onClick={() => setMassThresholdInput(presetVal)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        massThresholdInput === presetVal
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff]'
                      }`}
                    >
                      {presetVal}
                    </button>
                  ))}
                </div>

                {/* Submit Mass Apply */}
                <button
                  type="button"
                  onClick={() =>
                    handleApplyMassThresholdToCategories(sectionFilteredCategories, massThresholdInput)
                  }
                  disabled={sectionFilteredCategories.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black shadow-lg shadow-amber-950/40 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">flash_on</span>
                  <span>
                    Aplicar Umbral de {massThresholdInput} u. en Bloque ({sectionFilteredCategories.length} cat.)
                  </span>
                </button>
              </div>
            </div>

            {/* Visual Warning Trigger Explanation Indicator */}
            <div className="p-2 rounded-lg bg-[#141b2a] border border-[#374151]/40 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-[#e6bdb8]">
                Regla visual que se disparará en la lista de inventario con este umbral ({massThresholdInput} u.):
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                  🔴 Stock = 0 u. → Resaltado Rojo (Agotado)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                  🟡 Stock ≤ {massThresholdInput} u. → Resaltado Ámbar (Alerta Reabastecimiento)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  🟢 Stock &gt; {massThresholdInput} u. → Verde (Óptimo)
                </span>
              </div>
            </div>
          </div>

          {/* CATEGORY CARDS GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#e6bdb8] uppercase tracking-wider">
                Umbrales Individuales por Categoría ({sectionFilteredCategories.length} categorías):
              </span>
              <span className="text-[10px] text-[#e6bdb8]/80 font-mono">
                {thresholdSettings.autoSyncOnChange
                  ? '⚡ Auto-sincronización activa: los cambios actualizan el catálogo de inmediato'
                  : 'ℹ️ Usa "Aplicar" en cada tarjeta o el botón masivo para propagar cambios'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sectionFilteredCategories.map((category) => {
                const currentThreshold = getCategoryThreshold(category, thresholdSettings);
                const matchingProducts = products.filter((p) => p.category === category);
                const isAccessory = isAccessoryCategoryName(category);
                const categoryAlerts = matchingProducts.filter((p) => p.stock <= currentThreshold);
                const categoryOut = matchingProducts.filter((p) => p.stock <= 0);
                const isExpanded = expandedCategoryDetail === category;

                const preset = ALL_DEFAULT_CATEGORY_RULES.find(
                  (r) => r.category.toLowerCase() === category.toLowerCase()
                );

                return (
                  <div
                    key={category}
                    className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between space-y-3 ${
                      isAccessory
                        ? 'bg-gradient-to-br from-[#191f2f] to-[#1c1827] border-amber-500/40 hover:border-amber-400/80 shadow-md'
                        : 'bg-[#141b2b] border-[#374151]/50'
                    }`}
                  >
                    {/* Top: Category Title & Info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#232a3a] border border-[#374151]/50 flex items-center justify-center text-amber-400 shrink-0">
                          <span className="material-symbols-outlined text-[20px]">
                            {getCategoryIcon(category)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h5 className="font-bold text-xs text-white leading-tight">{category}</h5>
                            {isAccessory && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Accesorio
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#e6bdb8]/80 line-clamp-1 mt-0.5">
                            {preset?.description || 'Categoría de productos de tienda'}
                          </p>
                        </div>
                      </div>

                      {/* Count Chip */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono font-bold text-[#adc6ff] block">
                          {matchingProducts.length} SKU
                        </span>
                        {categoryAlerts.length > 0 && (
                          <span className="text-[9px] font-mono font-bold text-amber-400 block">
                            ⚠️ {categoryAlerts.length} en alerta ({categoryOut.length} agotados)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Stepper & Value Control */}
                    <div className="bg-[#0c1322] border border-[#374151]/50 rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-[#e6bdb8] block font-semibold">Umbral de Alerta:</span>
                        <span className="text-[9px] text-amber-400/90 font-mono">
                          Alerta si stock ≤ {currentThreshold} u.
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCategoryThreshold(category, Math.max(0, currentThreshold - 1))
                          }
                          disabled={currentThreshold <= 0}
                          className="w-7 h-7 rounded bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={currentThreshold}
                          onChange={(e) =>
                            handleUpdateCategoryThreshold(category, Math.max(0, Number(e.target.value)))
                          }
                          className="w-14 bg-[#141b2b] border border-amber-500/50 rounded p-1 text-center font-mono font-black text-amber-300 text-xs focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCategoryThreshold(category, currentThreshold + 1)
                          }
                          className="w-7 h-7 rounded bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                        >
                          +
                        </button>
                        <span className="text-[10px] text-[#e6bdb8] font-mono">u.</span>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#374151]/20">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-[#e6bdb8]/70 font-mono">Preajustes:</span>
                        {[2, 4, 6, 8, 10].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleUpdateCategoryThreshold(category, val)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              currentThreshold === val
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'bg-[#232a3a] text-[#adc6ff] hover:bg-[#323949]'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>

                      {/* Apply to Category Products Button */}
                      <button
                        type="button"
                        onClick={() => applyThresholdToCategoryProducts(category, currentThreshold)}
                        disabled={matchingProducts.length === 0}
                        title="Aplica este umbral a todos los productos actuales de esta categoría"
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">bolt</span>
                        <span>Aplicar a {matchingProducts.length}</span>
                      </button>
                    </div>

                    {/* Footer Actions: Toggle Live Product Preview & Filter main table */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setExpandedCategoryDetail(isExpanded ? null : category);
                        }}
                        className="text-[#adc6ff] hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isExpanded ? 'expand_less' : 'visibility'}
                        </span>
                        <span>{isExpanded ? 'Ocultar productos' : `Ver productos (${matchingProducts.length})`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setCategoryFilter(category);
                        }}
                        className="text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        title="Filtrar la tabla de inventario principal por esta categoría"
                      >
                        <span>Filtrar tabla abajo</span>
                        <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                      </button>
                    </div>

                    {/* EXPANDABLE PRODUCT LIST FOR THIS CATEGORY */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-[#374151]/40 space-y-1.5 bg-[#0c1322] p-2.5 rounded-lg max-h-56 overflow-y-auto">
                        <span className="text-[10px] font-bold text-white block mb-1">
                          Productos en {category} ({matchingProducts.length}):
                        </span>

                        {matchingProducts.length === 0 ? (
                          <p className="text-[10px] text-[#e6bdb8]">No hay productos en esta categoría.</p>
                        ) : (
                          matchingProducts.map((prod) => {
                            const minVal = prod.minStock ?? currentThreshold;
                            const isOut = prod.stock <= 0;
                            const isLow = !isOut && prod.stock <= minVal;

                            return (
                              <div
                                key={prod.id}
                                className={`p-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                                  isOut
                                    ? 'bg-red-950/30 border-red-500/50 text-red-200'
                                    : isLow
                                    ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                                    : 'bg-[#141b2a] border-[#374151]/40 text-[#dce2f7]'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold truncate text-[11px]">{prod.name}</p>
                                  <span className="text-[9px] font-mono text-[#e6bdb8]/80">{prod.sku}</span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono text-[10px]">
                                    Stock: <strong>{prod.stock}</strong> u.
                                  </span>

                                  {/* Visual Alert Badge */}
                                  {isOut ? (
                                    <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-bold text-[9px]">
                                      🔴 AGOTADO
                                    </span>
                                  ) : isLow ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500 text-black font-bold text-[9px]">
                                      🟡 BAJO
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold text-[9px]">
                                      🟢 ÓPTIMO
                                    </span>
                                  )}

                                  {/* Quick Individual Threshold Stepper */}
                                  <div className="flex items-center gap-0.5 bg-[#070e1d] rounded px-1 border border-[#374151]/50">
                                    <span className="text-[9px] text-amber-400 font-mono mr-0.5">Mín:</span>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickThresholdStep(prod, -1)}
                                      disabled={(prod.minStock ?? 5) <= 0}
                                      className="w-4 h-4 rounded text-white flex items-center justify-center font-bold text-[9px] hover:bg-[#232a3a] disabled:opacity-20 cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="font-mono font-bold text-[10px] text-amber-300 px-0.5">
                                      {prod.minStock ?? currentThreshold}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickThresholdStep(prod, 1)}
                                      className="w-4 h-4 rounded text-white flex items-center justify-center font-bold text-[9px] hover:bg-[#232a3a] cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Selected Category Notice Banner if a specific category is active */}
      {categoryFilter !== 'Todos' && (
        <div className="bg-[#141b2b] border border-[#374151]/50 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[18px]">
              {getCategoryIcon(categoryFilter)}
            </span>
            <span className="text-[#dce2f7]">
              Categoría seleccionada:{' '}
              <strong className="text-white font-bold">{categoryFilter}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
              Umbral activo: {getProductCategoryThreshold(categoryFilter)} unidades
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowGlobalThresholdsModal(true);
              }}
              className="text-amber-400 hover:text-amber-300 underline font-semibold text-[11px]"
            >
              Modificar umbral de esta categoría
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Todos')}
              className="text-[#e6bdb8] hover:text-white text-[11px]"
            >
              Ver todas
            </button>
          </div>
        </div>
      )}

      {/* Quick Status Filter Tabs & Visual Legend Strip */}
      <div className="bg-[#191f2f]/80 border border-[#374151]/40 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-[#e6bdb8] mr-1 uppercase">Filtro de Stock:</span>

          <button
            type="button"
            onClick={() => setStockStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              stockStatusFilter === 'all'
                ? 'bg-[#232a3a] text-white border border-[#adc6ff]/50 shadow-sm'
                : 'text-[#e6bdb8] hover:text-white hover:bg-[#232a3a]/50'
            }`}
          >
            Todos ({products.length})
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('alerts')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
              stockStatusFilter === 'alerts'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30'
            }`}
          >
            <span>⚠️ Alertas (≤ Mín)</span>
            <span className="font-mono">({totalAlertsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('out_of_stock')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
              stockStatusFilter === 'out_of_stock'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30'
            }`}
          >
            <span>🔴 Agotados (= 0)</span>
            <span className="font-mono">({outOfStockProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('low_stock')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
              stockStatusFilter === 'low_stock'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
            }`}
          >
            <span>🟡 Stock Bajo (≤ Mín)</span>
            <span className="font-mono">({lowStockProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('optimal')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
              stockStatusFilter === 'optimal'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
          >
            <span>🟢 Óptimo ({optimalProducts.length})</span>
          </button>
        </div>

        {/* Visual Guide / Legend */}
        <div className="flex items-center gap-3 text-[11px] text-[#e6bdb8] flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span>Rojo: Agotado (0 u.)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
            <span>Ámbar: Stock ≤ Umbral Mín.</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Verde: Óptimo</span>
          </div>
          <button
            type="button"
            onClick={() => setShowGlobalThresholdsModal(true)}
            className="text-[10px] text-[#adc6ff] hover:text-white font-mono flex items-center gap-1 bg-[#141b2b] hover:bg-[#232a3a] px-2 py-0.5 rounded border border-[#374151]/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px] text-amber-400">tune</span>
            <span>Reglas por categoría activas</span>
          </button>
        </div>
      </div>

      {/* Products Table or Empty State */}
      {products.length === 0 ? (
        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#232a3a] flex items-center justify-center text-[#e6bdb8]">
            <span className="material-symbols-outlined text-[36px]">inventory_2</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">El inventario está actualmente vacío</h3>
            <p className="text-xs text-[#e6bdb8] max-w-md mt-1">
              No hay productos registrados en el catálogo. Puedes agregar nuevos productos manualmente o restaurar el
              catálogo demo con referencias de accesorios.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-xs font-bold text-white shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">add_box</span>
              <span>Crear Primer Producto</span>
            </button>
            {onRestoreDefaultCatalog && (
              <button
                type="button"
                onClick={onRestoreDefaultCatalog}
                className="px-4 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#90cdff] border border-[#374151]/50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[17px]">refresh</span>
                <span>Restaurar Catálogo Demo (Accesorios)</span>
              </button>
            )}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-8 text-center text-xs text-[#e6bdb8]">
          <span className="material-symbols-outlined text-[32px] text-amber-400 block mb-2">filter_alt_off</span>
          <p className="font-semibold text-white">No se encontraron productos con los filtros aplicados</p>
          <p className="text-[11px] mt-1">
            Filtro de categoría: <strong className="font-mono text-amber-300">{categoryFilter}</strong> • Stock:{' '}
            <strong className="font-mono text-amber-300">{stockStatusFilter}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoryFilter('Todos');
              setStockStatusFilter('all');
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-[#232a3a] text-xs font-semibold text-[#adc6ff] hover:bg-[#323949]"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : (
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
                  <th className="py-2.5 px-3">Umbral Mínimo (Configurado)</th>
                  <th className="py-2.5 px-3">Estado de Alerta</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#374151]/30">
                {filtered.map((product) => {
                  const margin =
                    product.price > 0
                      ? (((product.price - product.costPrice) / product.price) * 100).toFixed(0)
                      : '0';
                  const min = product.minStock ?? 5;
                  const isOut = product.stock <= 0;
                  const isLow = !isOut && product.stock <= min;
                  const isOptimal = product.stock > min;

                  // Percentage of current stock vs configured minimum
                  const stockRatioPercent = min > 0 ? Math.min(100, Math.round((product.stock / min) * 100)) : 100;

                  // Category rule comparison
                  const categoryDefaultRule = getProductCategoryThreshold(product.category);
                  const isAccessory = isAccessoryCategoryName(product.category);

                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${
                        isOut
                          ? 'bg-red-950/30 hover:bg-red-900/40 border-l-4 border-l-red-500'
                          : isLow
                          ? 'bg-amber-950/25 hover:bg-amber-900/35 border-l-4 border-l-amber-500'
                          : 'hover:bg-[#232a3a]/40 border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* SKU & Barcode */}
                      <td className="py-2.5 px-3 font-mono">
                        <span className="font-semibold text-[#90cdff] block">{product.sku}</span>
                        <span className="text-[10px] text-[#e6bdb8]/70">{product.barcode}</span>
                      </td>

                      {/* Product Name & Category */}
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[#dce2f7] block">{product.name}</span>
                        <span className="text-[10px] text-[#e6bdb8] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-amber-400">
                            {getCategoryIcon(product.category)}
                          </span>
                          <span>{product.category}</span>
                          {isAccessory && (
                            <span className="px-1 py-0.1 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                              Accesorio
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Cost */}
                      <td className="py-2.5 px-3 font-mono text-[#e6bdb8]">{formatCOP(product.costPrice)}</td>

                      {/* Sale Price */}
                      <td className="py-2.5 px-3 font-mono font-bold text-[#10b981]">{formatCOP(product.price)}</td>

                      {/* Margin */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#f59e0b]">{margin}%</td>

                      {/* Current Stock with Warning Visual Indicator */}
                      <td className="py-2.5 px-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          {isOut ? (
                            <span className="text-red-400 font-black text-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-red-500">cancel</span>
                              0 u.
                            </span>
                          ) : isLow ? (
                            <span className="text-amber-400 font-black text-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-amber-500 animate-pulse">
                                warning
                              </span>
                              {product.stock} u.
                            </span>
                          ) : (
                            <span className="text-white font-bold text-xs">{product.stock} u.</span>
                          )}
                        </div>

                        {/* Visual stock vs min-stock health mini-bar */}
                        <div className="w-20 bg-[#141b2b] h-1.5 rounded-full overflow-hidden mt-1 border border-white/5">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isOut ? 'w-0 bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${isOut ? 0 : Math.max(10, stockRatioPercent)}%` }}
                          />
                        </div>
                      </td>

                      {/* Configurable Minimum Stock Threshold Column */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {/* Quick inline stepper down */}
                          <button
                            type="button"
                            onClick={() => handleQuickThresholdStep(product, -1)}
                            disabled={min <= 0}
                            title="Disminuir umbral mínimo en 1"
                            className="w-5 h-5 rounded bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white flex items-center justify-center font-bold text-[11px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            -
                          </button>

                          {/* Interactive threshold pill */}
                          <button
                            type="button"
                            onClick={() => handleOpenQuickThresholdModal(product)}
                            title="Haz clic para configurar el umbral de stock mínimo de este producto"
                            className="px-2 py-0.5 rounded-md bg-[#141b2b] hover:bg-[#232a3a] border border-[#374151]/60 hover:border-amber-500/50 text-[#dce2f7] hover:text-white font-mono text-[11px] font-bold flex items-center gap-1 transition-all group/btn"
                          >
                            <span>Mín: {min} u.</span>
                            <span className="material-symbols-outlined text-[13px] text-[#adc6ff] group-hover/btn:text-amber-400">
                              tune
                            </span>
                          </button>

                          {/* Quick inline stepper up */}
                          <button
                            type="button"
                            onClick={() => handleQuickThresholdStep(product, 1)}
                            title="Aumentar umbral mínimo en 1"
                            className="w-5 h-5 rounded bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white flex items-center justify-center font-bold text-[11px] transition-colors"
                          >
                            +
                          </button>
                        </div>

                        {/* Origin rule indicator */}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-[#e6bdb8]/60 font-mono">
                            {min === categoryDefaultRule ? (
                              <span className="text-amber-400/80">Regla cat: {min} u.</span>
                            ) : (
                              <span className="text-[#90cdff]/80">Personalizado (cat: {categoryDefaultRule})</span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Visual Alert Status Badge */}
                      <td className="py-2.5 px-3">
                        {isOut ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm animate-pulse">
                            <span className="material-symbols-outlined text-[14px] text-red-400">error</span>
                            <span>¡AGOTADO! (0 ≤ {min})</span>
                          </div>
                        ) : isLow ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm">
                            <span className="material-symbols-outlined text-[14px] text-amber-400">warning</span>
                            <span>STOCK BAJO ({product.stock} ≤ {min})</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                            <span>Óptimo ({product.stock} &gt; {min})</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Configure / Edit Product and Threshold Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            title="Editar producto y configurar umbral mínimo de stock"
                            className="px-2 py-1 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-[11px] font-semibold border border-[#374151]/40 flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            <span>Editar</span>
                          </button>

                          {/* Adjust Stock Button */}
                          <button
                            type="button"
                            onClick={() => {
                              posAudio.playKeyClick();
                              setSelectedProductForAdjust(product);
                              setAdjustDelta(0);
                            }}
                            title="Ajustar unidades físicas en stock"
                            className="px-2 py-1 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white text-[11px] font-semibold border border-[#374151]/30 transition-colors"
                          >
                            <span>Stock</span>
                          </button>

                          {/* Delete Single Product Button */}
                          <button
                            type="button"
                            onClick={() => {
                              posAudio.playKeyClick();
                              setProductToDelete(product);
                            }}
                            title="Eliminar este producto"
                            className="p-1 rounded-lg bg-[#dc2626]/20 hover:bg-[#dc2626] text-[#ef4444] hover:text-white border border-[#dc2626]/40 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Configuración Global de Umbrales de Stock Mínimo y por Categorías */}
      {/* ========================================================================= */}
      {showGlobalThresholdsModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#191f2f] border border-amber-500/50 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#374151]/40 flex items-center justify-between bg-[#141b2b]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <span className="material-symbols-outlined text-[24px]">tune</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>Configuración Global de Umbrales de Stock Mínimo</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Boutique de Accesorios
                    </span>
                  </h3>
                  <p className="text-xs text-[#e6bdb8]">
                    Ajusta los niveles de unidades a partir de los cuales se dispara automáticamente la alerta visual
                    (Ámbar y Rojo) para cada categoría de accesorios.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGlobalThresholdsModal(false)}
                className="w-8 h-8 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Global Default Fallback Threshold Panel */}
              <div className="bg-[#141b2b] border border-[#374151]/50 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">public</span>
                      <span>Umbral Global por Defecto (Fallback)</span>
                    </h4>
                    <p className="text-[11px] text-[#e6bdb8]">
                      Aplica a productos nuevos o categorías sin una regla específica asignada.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = Math.max(1, thresholdSettings.defaultGlobalMinStock - 1);
                        const next = { ...thresholdSettings, defaultGlobalMinStock: nextVal };
                        setThresholdSettings(next);
                        saveStoredThresholdSettings(next);
                      }}
                      className="w-7 h-7 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 rounded-lg bg-[#070e1d] border border-[#374151]/60 font-mono font-bold text-sm text-amber-300">
                      {thresholdSettings.defaultGlobalMinStock} unidades
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = thresholdSettings.defaultGlobalMinStock + 1;
                        const next = { ...thresholdSettings, defaultGlobalMinStock: nextVal };
                        setThresholdSettings(next);
                        saveStoredThresholdSettings(next);
                      }}
                      className="w-7 h-7 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Auto Sync Toggle */}
                <div className="pt-2 border-t border-[#374151]/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">sync</span>
                    <span className="text-[#dce2f7] text-[11px]">
                      Sincronización automática: Al modificar un umbral, actualizar de inmediato los productos existentes
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...thresholdSettings, autoSyncOnChange: !thresholdSettings.autoSyncOnChange };
                      setThresholdSettings(next);
                      saveStoredThresholdSettings(next);
                      posAudio.playKeyClick();
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      thresholdSettings.autoSyncOnChange ? 'bg-amber-500' : 'bg-[#232a3a]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        thresholdSettings.autoSyncOnChange ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Tabs for Category Selection */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#374151]/40 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setThresholdModalTab('accessories');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      thresholdModalTab === 'accessories'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-[#232a3a] text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">diamond</span>
                    <span>Categorías de Accesorios ({accessoryCategories.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setThresholdModalTab('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      thresholdModalTab === 'all'
                        ? 'bg-[#adc6ff] text-[#070e1d] font-bold shadow-md'
                        : 'bg-[#232a3a] text-[#e6bdb8] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">category</span>
                    <span>Todas las Categorías ({allKnownCategories.length})</span>
                  </button>
                </div>

                {/* Filter Search inside modal */}
                <div className="relative">
                  <span className="material-symbols-outlined text-[#e6bdb8] text-[16px] absolute left-2 top-1.5">
                    search
                  </span>
                  <input
                    type="text"
                    value={thresholdCategorySearch}
                    onChange={(e) => setThresholdCategorySearch(e.target.value)}
                    placeholder="Buscar categoría..."
                    className="bg-[#141b2b] border border-[#374151]/50 rounded-lg pl-7 pr-2 py-1 text-xs text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Categories Threshold Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allKnownCategories
                  .filter((cat) => {
                    if (thresholdModalTab === 'accessories' && !isAccessoryCategoryName(cat)) return false;
                    if (
                      thresholdCategorySearch &&
                      !cat.toLowerCase().includes(thresholdCategorySearch.toLowerCase())
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map((category) => {
                    const currentThreshold = getCategoryThreshold(category, thresholdSettings);
                    const matchingProducts = products.filter((p) => p.category === category);
                    const isAccessory = isAccessoryCategoryName(category);

                    // Breakdown of alerts in this category
                    const categoryAlerts = matchingProducts.filter((p) => p.stock <= currentThreshold);
                    const categoryOut = matchingProducts.filter((p) => p.stock <= 0);

                    // Find preset description if available
                    const preset = ALL_DEFAULT_CATEGORY_RULES.find(
                      (r) => r.category.toLowerCase() === category.toLowerCase()
                    );

                    return (
                      <div
                        key={category}
                        className={`rounded-xl p-3 border transition-all flex flex-col justify-between space-y-2.5 ${
                          isAccessory
                            ? 'bg-gradient-to-br from-[#191f2f] to-[#201c2a] border-amber-500/40 hover:border-amber-400'
                            : 'bg-[#141b2b] border-[#374151]/40'
                        }`}
                      >
                        {/* Top: Category Title & Info */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#232a3a] border border-[#374151]/50 flex items-center justify-center text-amber-400 shrink-0">
                              <span className="material-symbols-outlined text-[18px]">
                                {getCategoryIcon(category)}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-bold text-xs text-white leading-tight">{category}</h5>
                                {isAccessory && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Accesorio
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[#e6bdb8]/80 line-clamp-1 mt-0.5">
                                {preset?.description || 'Categoría de productos de tienda'}
                              </p>
                            </div>
                          </div>

                          {/* Inventory count chip */}
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono text-[#adc6ff] block">
                              {matchingProducts.length} productos
                            </span>
                            {categoryAlerts.length > 0 && (
                              <span className="text-[9px] font-mono font-bold text-amber-400 block">
                                ⚠️ {categoryAlerts.length} en alerta ({categoryOut.length} agotados)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Stepper & Value Control */}
                        <div className="bg-[#0c1322] border border-[#374151]/40 rounded-lg p-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[#e6bdb8]">Umbral de Alerta:</span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCategoryThreshold(category, Math.max(0, currentThreshold - 1))
                              }
                              disabled={currentThreshold <= 0}
                              className="w-6 h-6 rounded bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-xs disabled:opacity-30"
                            >
                              -
                            </button>

                            <input
                              type="number"
                              min="0"
                              value={currentThreshold}
                              onChange={(e) =>
                                handleUpdateCategoryThreshold(
                                  category,
                                  Math.max(0, Number(e.target.value))
                                )
                              }
                              className="w-14 bg-[#141b2b] border border-amber-500/50 rounded p-1 text-center font-mono font-black text-amber-300 text-xs focus:outline-none"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCategoryThreshold(category, currentThreshold + 1)
                              }
                              className="w-6 h-6 rounded bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-xs"
                            >
                              +
                            </button>
                            <span className="text-[10px] text-[#e6bdb8] font-mono">u.</span>
                          </div>
                        </div>

                        {/* Quick Presets & Apply Button */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#374151]/20">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-[#e6bdb8]/70 font-mono">Preajustes:</span>
                            {[2, 4, 6, 8, 10].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleUpdateCategoryThreshold(category, val)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                                  currentThreshold === val
                                    ? 'bg-amber-500 text-black shadow-sm'
                                    : 'bg-[#232a3a] text-[#adc6ff] hover:bg-[#323949]'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => applyThresholdToCategoryProducts(category, currentThreshold)}
                            disabled={matchingProducts.length === 0}
                            title="Aplica este umbral a todos los productos actuales de esta categoría"
                            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-[12px]">bolt</span>
                            <span>Aplicar a {matchingProducts.length}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 sm:p-5 border-t border-[#374151]/40 bg-[#141b2b] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetThresholds}
                  className="px-3 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#adc6ff] border border-[#374151]/50 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span>Restablecer Recomendados</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAllThresholdsToInventory}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold shadow-lg shadow-amber-950/40 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">flash_on</span>
                  <span>Aplicar Todos los Umbrales al Inventario ({products.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGlobalThresholdsModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-white transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quick Threshold Configuration for Single Product */}
      {productForQuickThreshold && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-amber-500/50 rounded-2xl p-5 w-full max-w-sm flex flex-col space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="material-symbols-outlined text-[20px]">tune</span>
                <span className="font-bold text-sm text-white">Configurar Umbral de Stock Mínimo</span>
              </div>
              <button
                type="button"
                onClick={() => setProductForQuickThreshold(null)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="bg-[#141b2b] p-3 rounded-xl border border-[#374151]/30 space-y-1">
              <p className="text-xs font-bold text-white">{productForQuickThreshold.name}</p>
              <div className="flex justify-between text-[11px] font-mono text-[#e6bdb8]">
                <span>SKU: {productForQuickThreshold.sku}</span>
                <span className="font-bold text-[#90cdff]">Stock Actual: {productForQuickThreshold.stock} u.</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-amber-400">
                <span>Categoría: {productForQuickThreshold.category}</span>
                <span>Regla de Cat: {getProductCategoryThreshold(productForQuickThreshold.category)} u.</span>
              </div>
            </div>

            <form onSubmit={handleSaveQuickThreshold} className="space-y-3">
              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">
                  Umbral Mínimo de Alerta para este Producto:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickMinStockInput((prev) => Math.max(0, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-base transition-colors"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quickMinStockInput}
                    onChange={(e) => setQuickMinStockInput(Math.max(0, Number(e.target.value)))}
                    className="flex-1 bg-[#070e1d] border border-amber-500/50 rounded-xl p-2.5 text-center text-lg font-mono font-black text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickMinStockInput((prev) => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-white flex items-center justify-center font-bold text-base transition-colors"
                  >
                    +1
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center justify-between gap-1.5 pt-1">
                <span className="text-[10px] text-[#e6bdb8]/80 font-mono">Valores Rápidos:</span>
                {[3, 5, 8, 10, 15, 20].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuickMinStockInput(val)}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                      quickMinStockInput === val
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-[#232a3a] text-[#adc6ff] hover:bg-[#323949]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              {/* Dynamic Warning Preview */}
              <div className="p-2.5 rounded-xl bg-[#0c1322] border border-[#374151]/40 text-xs space-y-1">
                <div className="text-[11px] text-[#e6bdb8]">Previsualización con este umbral:</div>
                {productForQuickThreshold.stock <= 0 ? (
                  <div className="text-red-400 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>Se resaltará en ROJO (Stock agotado: 0 ≤ {quickMinStockInput})</span>
                  </div>
                ) : productForQuickThreshold.stock <= quickMinStockInput ? (
                  <div className="text-amber-400 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">warning</span>
                    <span>
                      Se resaltará en ÁMBAR (Stock bajo: {productForQuickThreshold.stock} ≤ {quickMinStockInput})
                    </span>
                  </div>
                ) : (
                  <div className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    <span>
                      Se mostrará en VERDE / Óptimo ({productForQuickThreshold.stock} &gt; {quickMinStockInput})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductForQuickThreshold(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md transition-colors"
                >
                  Guardar Umbral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Edit Product & Threshold Configuration */}
      {productToEdit && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-lg flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#adc6ff]">tune</span>
                <span className="font-bold text-sm text-white">Editar Producto y Umbral de Stock</span>
              </div>
              <button
                type="button"
                onClick={() => setProductToEdit(null)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-3">
              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#dc2626]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Categoría:</label>
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      setEditCategory(nextCat);
                      // Suggest the category's threshold if user switches category
                      const catDef = getProductCategoryThreshold(nextCat);
                      setEditMinStock(catDef);
                    }}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-[#dce2f7]"
                  >
                    {allKnownCategories.map((c) => (
                      <option key={c} value={c}>
                        {isAccessoryCategoryName(c) ? `✨ ${c}` : c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Código SKU:</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Costo Compra (COP):</label>
                  <input
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(Number(e.target.value))}
                    step={100}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Precio Venta (COP):</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    step={100}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-[#10b981] font-bold"
                  />
                </div>
              </div>

              {/* Threshold Configuration Section */}
              <div className="p-3 rounded-xl bg-[#141b2b] border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    Configuración de Stock & Umbral Mínimo
                  </span>
                  <span className="text-[10px] text-[#e6bdb8]/80 font-mono">
                    Regla de cat ({editCategory}): {getProductCategoryThreshold(editCategory)} u.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#e6bdb8] block mb-1 font-semibold">Stock Físico Actual:</label>
                    <input
                      type="number"
                      min="0"
                      value={editStock}
                      onChange={(e) => setEditStock(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-[#070e1d] border border-[#374151]/60 rounded-lg p-2 text-xs font-mono font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-amber-400 block mb-1 font-semibold">
                      Stock Mínimo (Umbral de Alerta):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-[#070e1d] border border-amber-500/60 rounded-lg p-2 text-xs font-mono font-bold text-amber-300"
                    />
                  </div>
                </div>

                {/* Live Preview of Visual Alert */}
                <div className="mt-2 p-2 rounded-lg bg-[#070e1d] text-xs flex items-center gap-2">
                  <span className="text-[#e6bdb8] text-[11px]">Resultado visual:</span>
                  {editStock <= 0 ? (
                    <span className="text-red-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      Resaltado ROJO (Agotado total)
                    </span>
                  ) : editStock <= editMinStock ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      Resaltado ÁMBAR (Stock Bajo: {editStock} ≤ {editMinStock})
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Normal / Óptimo ({editStock} &gt; {editMinStock})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Código de Barras:</label>
                <input
                  type="text"
                  value={editBarcode}
                  onChange={(e) => setEditBarcode(e.target.value)}
                  className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-[#dce2f7]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToEdit(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-xs font-semibold text-white shadow-md transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div className="flex justify-between text-[11px] font-mono text-amber-400">
                <span>Umbral Mínimo:</span>
                <span>{selectedProductForAdjust.minStock ?? 5} unidades</span>
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
                  <option value="Compra / Reposición">Compra / Reposición</option>
                  <option value="Merma / Daño">Merma / Daño</option>
                  <option value="Conteo Físico">Conteo Físico / Corrección</option>
                  <option value="Devolución Cliente">Devolución Cliente</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Cantidad a Modificar (+ o -):</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((prev) => prev - 1)}
                    className="w-9 h-9 rounded-lg bg-[#232a3a] text-white flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(Number(e.target.value))}
                    className="flex-1 bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-center text-sm font-mono font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((prev) => prev + 1)}
                    className="w-9 h-9 rounded-lg bg-[#232a3a] text-white flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {(() => {
                const resultantStock = Math.max(0, selectedProductForAdjust.stock + adjustDelta);
                const min = selectedProductForAdjust.minStock ?? 5;
                const willBeOut = resultantStock <= 0;
                const willBeLow = !willBeOut && resultantStock <= min;

                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between p-2 rounded-lg bg-[#141b2b] text-xs font-mono">
                      <span className="text-[#e6bdb8]">Nuevo Stock Resultante:</span>
                      <span className="font-bold text-[#10b981]">{resultantStock} unidades</span>
                    </div>

                    <div className="text-[11px] px-2 py-1 rounded bg-[#070e1d]">
                      {willBeOut ? (
                        <span className="text-red-400 font-bold">⚠️ El producto quedará AGOTADO (resaltado rojo)</span>
                      ) : willBeLow ? (
                        <span className="text-amber-400 font-bold">
                          ⚠️ El producto quedará en STOCK BAJO (resaltado ámbar: {resultantStock} ≤ {min})
                        </span>
                      ) : (
                        <span className="text-emerald-400">✓ El producto quedará en nivel óptimo (&gt; {min})</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductForAdjust(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#dc2626] text-xs font-semibold text-white shadow-md"
                >
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Product Modal Confirmation */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#dc2626]/60 rounded-2xl p-5 w-full max-w-sm flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#ef4444]">
              <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              <span className="font-bold text-sm text-white">¿Eliminar Producto?</span>
            </div>

            <div className="bg-[#141b2b] p-3 rounded-xl border border-[#374151]/40 space-y-1">
              <span className="text-xs font-bold text-white block">{productToDelete.name}</span>
              <div className="flex justify-between text-[11px] font-mono text-[#e6bdb8]">
                <span>SKU: {productToDelete.sku}</span>
                <span>Stock: {productToDelete.stock} u.</span>
              </div>
              <div className="text-[11px] font-mono text-[#10b981] font-bold">
                P.V.P: {formatCOP(productToDelete.price)}
              </div>
            </div>

            <p className="text-xs text-[#e6bdb8] leading-relaxed">
              Esta acción eliminará el producto del catálogo de inventario y no podrá ser cobrado en caja registradora.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-xs font-bold text-white transition-colors shadow-md"
              >
                Sí, Eliminar Producto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Inventory Modal Confirmation */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border-2 border-[#dc2626] rounded-2xl p-6 w-full max-w-md flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#ef4444]">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <span className="font-bold text-base text-white">¿Eliminar TODO el Inventario?</span>
            </div>

            <div className="bg-[#dc2626]/15 border border-[#dc2626]/40 p-3.5 rounded-xl text-xs text-[#ffdad6] space-y-1.5 leading-relaxed">
              <p className="font-semibold text-white">⚠️ Atención: Acción destructiva irreversible.</p>
              <p>
                Se eliminarán permanentemente todas las{' '}
                <strong className="text-white font-mono">{products.length}</strong> referencias SKU ({totalItemsCount}{' '}
                unidades físicas) valoradas en {formatCOP(totalRetailValue)}.
              </p>
            </div>

            <div>
              <label className="text-xs text-[#e6bdb8] block mb-1">
                Escribe <strong className="text-white font-mono">BORRAR</strong> para confirmar:
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="Escribe BORRAR"
                className="w-full bg-[#141b2b] border border-[#dc2626]/50 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-[#ef4444]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  setClearConfirmText('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={clearConfirmText.trim().toUpperCase() !== 'BORRAR'}
                onClick={handleConfirmClearInventory}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                  clearConfirmText.trim().toUpperCase() === 'BORRAR'
                    ? 'bg-[#dc2626] hover:bg-[#ef4444] cursor-pointer'
                    : 'bg-[#dc2626]/30 opacity-50 cursor-not-allowed'
                }`}
              >
                Vaciar Catálogo Completo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-md flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <span className="font-bold text-sm text-white">Nuevo Producto de Inventario</span>
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
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej. Aretes Candongas Baño Oro 18k"
                  className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#dc2626]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Categoría:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => {
                      const sel = e.target.value;
                      setNewCategory(sel);
                      // Suggest the configured category threshold
                      const th = getProductCategoryThreshold(sel);
                      setNewMinStock(th);
                    }}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs text-[#dce2f7]"
                  >
                    {allKnownCategories.map((c) => (
                      <option key={c} value={c}>
                        {isAccessoryCategoryName(c) ? `✨ ${c}` : c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Código SKU:</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="Auto-generar"
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Costo Compra (COP):</label>
                  <input
                    type="number"
                    value={newCost}
                    onChange={(e) => setNewCost(Number(e.target.value))}
                    step={100}
                    className="w-full bg-[#070e1d] border border-[#374151]/50 rounded-lg p-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#e6bdb8] block mb-1">Precio Venta (COP):</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    step={100}
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
                  <label className="text-[11px] text-amber-400 block mb-1 font-semibold">
                    Stock Mínimo:
                  </label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value))}
                    className="w-full bg-[#070e1d] border border-amber-500/60 rounded-lg p-2 text-xs font-mono text-amber-300 font-bold"
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

              <p className="text-[10px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                💡 <strong>Umbral de advertencia:</strong> Si el stock baja a {newMinStock} o menos, se resaltará en ámbar
                como alerta de reabastecimiento en la lista. Si llega a 0, se resaltará en rojo. (Umbral de categoría {newCategory}: {getProductCategoryThreshold(newCategory)} u.)
              </p>

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
                  placeholder="Escanea o escribe código/guía (ej: 770800101015 o SKU-01)"
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
          { label: 'EAN-13', code: '770800101015' },
          { label: 'Guía Coordinadora', code: 'GUIA-COO-748921' },
          { label: 'Guía Servientrega', code: 'GUIA-SRV-901842' },
          { label: 'Código Barras', code: '770200102045' },
        ]}
      />
    </div>
  );
};
