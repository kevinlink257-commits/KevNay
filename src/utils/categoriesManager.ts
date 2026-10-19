import { ALL_DEFAULT_CATEGORY_RULES, CategoryThresholdRule } from './thresholdSettings';

export interface CategoryInfo {
  name: string;
  icon: string;
  isAccessory: boolean;
  defaultMinStock: number;
  isCustom?: boolean;
}

const STORAGE_KEY_CUSTOM = 'pos_custom_categories';
const STORAGE_KEY_DELETED = 'pos_deleted_categories';

// Common recommended icons for inventory categories
export const AVAILABLE_CATEGORY_ICONS = [
  { icon: 'diamond', label: 'Joyería / Diamante' },
  { icon: 'watch', label: 'Reloj / Smartwatch' },
  { icon: 'eyeglasses', label: 'Gafas / Óptica' },
  { icon: 'shopping_bag', label: 'Bolsos / Carteras' },
  { icon: 'styler', label: 'Accesorios Cabello' },
  { icon: 'checkroom', label: 'Ropa / Moda' },
  { icon: 'local_mall', label: 'Boutique / Tienda' },
  { icon: 'sell', label: 'Etiqueta / Descuento' },
  { icon: 'auto_awesome', label: 'Belleza / Cosméticos' },
  { icon: 'local_cafe', label: 'Bebidas / Café' },
  { icon: 'bakery_dining', label: 'Snacks / Panadería' },
  { icon: 'sanitizer', label: 'Cuidado / Aseo' },
  { icon: 'inventory_2', label: 'Caja / General' },
  { icon: 'devices', label: 'Tecnología' },
  { icon: 'sports_baseball', label: 'Deportes' },
  { icon: 'star', label: 'Destacados' },
];

/**
 * Gets custom user-created categories from localStorage
 */
export const getCustomCategories = (): CategoryInfo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Saves custom categories to localStorage
 */
export const saveCustomCategories = (categories: CategoryInfo[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(categories));
    window.dispatchEvent(new CustomEvent('pos_categories_changed'));
  } catch (err) {
    console.error('Failed to save custom categories:', err);
  }
};

/**
 * Gets list of deleted category names
 */
export const getDeletedCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Saves deleted category names blacklist to localStorage
 */
export const saveDeletedCategories = (deleted: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(deleted));
    window.dispatchEvent(new CustomEvent('pos_categories_changed'));
  } catch (err) {
    console.error('Failed to save deleted categories:', err);
  }
};

/**
 * Returns all active categories combining defaults, custom, and existing product categories,
 * while excluding deleted categories.
 */
export const getAllActiveCategories = (existingProductCategories: string[] = []): CategoryInfo[] => {
  const deletedSet = new Set(getDeletedCategories().map((c) => c.toLowerCase().trim()));
  const customList = getCustomCategories();
  const customMap = new Map<string, CategoryInfo>();

  customList.forEach((cat) => {
    if (!deletedSet.has(cat.name.toLowerCase().trim())) {
      customMap.set(cat.name.toLowerCase().trim(), cat);
    }
  });

  const result: CategoryInfo[] = [];
  const addedNames = new Set<string>();

  // 1. Add Default Rules that haven't been deleted
  ALL_DEFAULT_CATEGORY_RULES.forEach((rule: CategoryThresholdRule) => {
    const lower = rule.category.toLowerCase().trim();
    if (!deletedSet.has(lower) && !addedNames.has(lower)) {
      result.push({
        name: rule.category,
        icon: rule.icon,
        isAccessory: !!rule.isAccessory,
        defaultMinStock: rule.minStock,
        isCustom: false,
      });
      addedNames.add(lower);
    }
  });

  // 2. Add Custom categories
  customList.forEach((cat) => {
    const lower = cat.name.toLowerCase().trim();
    if (!deletedSet.has(lower) && !addedNames.has(lower)) {
      result.push({
        ...cat,
        isCustom: true,
      });
      addedNames.add(lower);
    }
  });

  // 3. Ensure any categories present on existing products are included
  existingProductCategories.forEach((catName) => {
    if (!catName || !catName.trim()) return;
    const lower = catName.toLowerCase().trim();
    if (!addedNames.has(lower)) {
      result.push({
        name: catName.trim(),
        icon: 'sell',
        isAccessory: false,
        defaultMinStock: 5,
        isCustom: true,
      });
      addedNames.add(lower);
    }
  });

  return result;
};

/**
 * Creates or updates a category
 */
export const createCategory = (info: CategoryInfo): CategoryInfo => {
  const custom = getCustomCategories();
  const deleted = getDeletedCategories();

  // If it was in deleted list, remove from deleted
  const newDeleted = deleted.filter((d) => d.toLowerCase().trim() !== info.name.toLowerCase().trim());
  if (newDeleted.length !== deleted.length) {
    saveDeletedCategories(newDeleted);
  }

  // Remove existing with same name if any
  const filtered = custom.filter((c) => c.name.toLowerCase().trim() !== info.name.toLowerCase().trim());
  const newCat: CategoryInfo = {
    ...info,
    name: info.name.trim(),
    isCustom: true,
  };
  filtered.push(newCat);
  saveCustomCategories(filtered);
  return newCat;
};

/**
 * Deletes a category by name
 */
export const removeCategory = (categoryName: string): void => {
  const trimmed = categoryName.trim();
  const lower = trimmed.toLowerCase();

  // Remove from custom categories
  const custom = getCustomCategories().filter((c) => c.name.toLowerCase().trim() !== lower);
  saveCustomCategories(custom);

  // Add to deleted categories blacklist
  const deleted = getDeletedCategories();
  if (!deleted.some((d) => d.toLowerCase().trim() === lower)) {
    deleted.push(trimmed);
    saveDeletedCategories(deleted);
  }
};

/**
 * Gets icon for a category name
 */
export const resolveCategoryIcon = (categoryName: string, knownCategories: CategoryInfo[] = []): string => {
  if (!categoryName) return 'category';
  const found = knownCategories.find((c) => c.name.toLowerCase().trim() === categoryName.toLowerCase().trim());
  if (found && found.icon) return found.icon;

  const defaultFound = ALL_DEFAULT_CATEGORY_RULES.find(
    (r) => r.category.toLowerCase().trim() === categoryName.toLowerCase().trim()
  );
  if (defaultFound && defaultFound.icon) return defaultFound.icon;

  const lower = categoryName.toLowerCase();
  if (lower.includes('joy') || lower.includes('arete') || lower.includes('collar') || lower.includes('anillo')) return 'diamond';
  if (lower.includes('reloj') || lower.includes('watch')) return 'watch';
  if (lower.includes('gafa') || lower.includes('lente') || lower.includes('sol')) return 'eyeglasses';
  if (lower.includes('bolso') || lower.includes('cartera') || lower.includes('billetera')) return 'shopping_bag';
  if (lower.includes('cabello') || lower.includes('pelo') || lower.includes('moña')) return 'styler';
  if (lower.includes('ropa') || lower.includes('vestir') || lower.includes('prenda')) return 'checkroom';
  if (lower.includes('bebida') || lower.includes('refresco') || lower.includes('jugo') || lower.includes('agua')) return 'local_cafe';
  if (lower.includes('pan') || lower.includes('snack') || lower.includes('dulce')) return 'bakery_dining';
  if (lower.includes('aseo') || lower.includes('limpieza') || lower.includes('jabon')) return 'sanitizer';

  return 'sell';
};
