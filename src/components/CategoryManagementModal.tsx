import React, { useState } from 'react';
import { Product } from '../types/pos';
import { posAudio } from '../utils/audio';
import {
  CategoryInfo,
  AVAILABLE_CATEGORY_ICONS,
  createCategory,
  removeCategory,
} from '../utils/categoriesManager';

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryInfo[];
  products: Product[];
  onCategoriesChanged: () => void;
  onUpdateProduct: (product: Product) => void;
  onSelectCategory?: (categoryName: string) => void;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  onCategoriesChanged,
  onUpdateProduct,
  onSelectCategory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('sell');
  const [newCatIsAccessory, setNewCatIsAccessory] = useState(true);
  const [newCatMinStock, setNewCatMinStock] = useState<number>(6);
  const [createError, setCreateError] = useState('');

  // Delete handling
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryInfo | null>(null);
  const [reassignTargetCategory, setReassignTargetCategory] = useState<string>('General');

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const trimmed = newCatName.trim();
    if (!trimmed) {
      setCreateError('Ingresa un nombre para la categoría.');
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setCreateError('Ya existe una categoría con este nombre.');
      return;
    }

    createCategory({
      name: trimmed,
      icon: newCatIcon || 'sell',
      isAccessory: newCatIsAccessory,
      defaultMinStock: Math.max(0, Number(newCatMinStock) || 5),
    });

    posAudio.playSuccessChime();
    setNewCatName('');
    setNewCatIcon('sell');
    setNewCatIsAccessory(true);
    setNewCatMinStock(6);
    onCategoriesChanged();
    if (onSelectCategory) {
      onSelectCategory(trimmed);
    }
  };

  const handleConfirmDelete = () => {
    if (!categoryToDelete) return;

    const matchingProducts = products.filter(
      (p) => p.category.toLowerCase().trim() === categoryToDelete.name.toLowerCase().trim()
    );

    // Reassign products if any exist
    if (matchingProducts.length > 0) {
      const target = reassignTargetCategory.trim() || 'General';
      matchingProducts.forEach((p) => {
        onUpdateProduct({
          ...p,
          category: target,
        });
      });
    }

    removeCategory(categoryToDelete.name);
    posAudio.playKeyClick();
    setCategoryToDelete(null);
    onCategoriesChanged();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#191f2f] border border-[#374151]/70 rounded-2xl p-4 sm:p-6 w-full max-w-2xl shadow-2xl flex flex-col space-y-4 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#374151]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-[24px]">category</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Gestionar Categorías del Inventario</h3>
              <p className="text-[11px] text-[#e6bdb8]">
                Crea nuevas categorías con icono personalizado o elimina las que ya no utilices.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 1. Form to Create Category */}
        <div className="bg-[#141b2b] border border-amber-500/30 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              <span>Crear Nueva Categoría</span>
            </h4>
            <span className="text-[10px] text-[#e6bdb8] font-mono">
              Total disponibles: {categories.length}
            </span>
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Nombre de la Categoría *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="ej. Gafas de Sol, Perfumes, Mochilas..."
                  className="w-full bg-[#0c1322] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#e6bdb8] block mb-1">Umbral Stock Mínimo Sugerido</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={newCatMinStock}
                    onChange={(e) => setNewCatMinStock(Math.max(0, Number(e.target.value)))}
                    className="w-24 bg-[#0c1322] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-[#e6bdb8]">unidades para alerta</span>
                </div>
              </div>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-3 bg-[#0c1322] p-2.5 rounded-xl border border-[#374151]/40 text-xs">
              <span className="text-[#e6bdb8] text-[11px]">Tipo de ítem:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-white">
                <input
                  type="radio"
                  name="catType"
                  checked={newCatIsAccessory}
                  onChange={() => setNewCatIsAccessory(true)}
                  className="accent-amber-400"
                />
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <span className="material-symbols-outlined text-[15px]">diamond</span>
                  Accesorio / Boutique
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-white">
                <input
                  type="radio"
                  name="catType"
                  checked={!newCatIsAccessory}
                  onChange={() => setNewCatIsAccessory(false)}
                  className="accent-amber-400"
                />
                <span className="flex items-center gap-1 text-[#adc6ff]">
                  <span className="material-symbols-outlined text-[15px]">inventory_2</span>
                  General / Otro
                </span>
              </label>
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-[11px] text-[#e6bdb8] block mb-1.5 flex items-center justify-between">
                <span>Seleccionar Icono:</span>
                <span className="text-amber-400 font-mono text-[10px] flex items-center gap-1">
                  Seleccionado: <span className="material-symbols-outlined text-[15px]">{newCatIcon}</span>
                </span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 bg-[#0c1322] p-2 rounded-xl border border-[#374151]/40 max-h-28 overflow-y-auto">
                {AVAILABLE_CATEGORY_ICONS.map((item) => (
                  <button
                    key={item.icon}
                    type="button"
                    onClick={() => setNewCatIcon(item.icon)}
                    title={item.label}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                      newCatIcon === item.icon
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
                        : 'border-transparent hover:bg-[#232a3a] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span className="text-[9px] truncate w-full text-center mt-0.5">{item.icon}</span>
                  </button>
                ))}
              </div>
            </div>

            {createError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 px-3 py-1.5 rounded-lg">
                {createError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Guardar Nueva Categoría</span>
            </button>
          </form>
        </div>

        {/* 2. List of existing categories with Delete option */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Categorías Existentes ({filteredCategories.length})
            </h4>

            <div className="relative">
              <span className="material-symbols-outlined text-[#e6bdb8] text-[15px] absolute left-2.5 top-2">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar categoría..."
                className="bg-[#141b2b] border border-[#374151]/50 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-amber-400 w-44"
              />
            </div>
          </div>

          <div className="divide-y divide-[#374151]/30 max-h-64 overflow-y-auto bg-[#141b2b] border border-[#374151]/50 rounded-xl">
            {filteredCategories.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#e6bdb8]">
                No se encontraron categorías que coincidan.
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const productCount = products.filter(
                  (p) => p.category.toLowerCase().trim() === cat.name.toLowerCase().trim()
                ).length;

                return (
                  <div
                    key={cat.name}
                    className="p-2.5 sm:p-3 flex items-center justify-between gap-3 hover:bg-[#1a2337] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#232a3a] border border-[#374151]/50 flex items-center justify-center text-amber-400 shrink-0">
                        <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{cat.name}</span>
                          {cat.isAccessory && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Accesorio
                            </span>
                          )}
                          {cat.isCustom && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Personalizada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#e6bdb8] mt-0.5 font-mono">
                          <span>{productCount} producto(s) en catálogo</span>
                          <span>•</span>
                          <span>Umbral: {cat.defaultMinStock} u.</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onSelectCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            posAudio.playKeyClick();
                            onSelectCategory(cat.name);
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Filtrar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          setCategoryToDelete(cat);
                          setReassignTargetCategory(
                            categories.find((c) => c.name !== cat.name)?.name || 'General'
                          );
                        }}
                        title={`Eliminar categoría "${cat.name}"`}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {categoryToDelete && (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#191f2f] border border-red-500/60 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <span className="material-symbols-outlined text-[24px]">warning</span>
                <span>¿Eliminar Categoría "{categoryToDelete.name}"?</span>
              </div>

              {(() => {
                const count = products.filter(
                  (p) => p.category.toLowerCase().trim() === categoryToDelete.name.toLowerCase().trim()
                ).length;

                return (
                  <>
                    <p className="text-xs text-[#e6bdb8] leading-relaxed">
                      Esta categoría será eliminada permanentemente del sistema.
                    </p>

                    {count > 0 && (
                      <div className="bg-[#0c1322] border border-amber-500/40 rounded-xl p-3 space-y-2 text-xs">
                        <span className="text-amber-300 font-bold block">
                          ⚠️ Hay {count} producto(s) asignados a esta categoría.
                        </span>
                        <label className="text-[11px] text-[#e6bdb8] block">
                          Reasignar estos {count} producto(s) a:
                        </label>
                        <select
                          value={reassignTargetCategory}
                          onChange={(e) => setReassignTargetCategory(e.target.value)}
                          className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          {categories
                            .filter((c) => c.name !== categoryToDelete.name)
                            .map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          <option value="General">General</option>
                        </select>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md transition-colors cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
