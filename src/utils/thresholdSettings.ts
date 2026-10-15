import { Product } from '../types/pos';

export interface CategoryThresholdRule {
  category: string;
  minStock: number;
  isAccessory: boolean;
  icon: string;
  description: string;
  sampleItems?: string;
}

export interface GlobalThresholdSettings {
  defaultGlobalMinStock: number; // base fallback for any category without specific rule
  autoSyncOnChange: boolean; // if true, altering a threshold auto-applies to existing inventory items
  categoryThresholds: Record<string, number>; // category -> threshold number
  lastUpdated: number;
}

export const ACCESSORY_CATEGORIES_PRESETS: CategoryThresholdRule[] = [
  {
    category: 'Joyería & Aretes',
    minStock: 6,
    isAccessory: true,
    icon: 'diamond',
    description: 'Aretes, candongas, topos, earcuffs y joyería fina',
    sampleItems: 'Candongas 18k, topos plata, earcuffs',
  },
  {
    category: 'Collares & Cadenas',
    minStock: 4,
    isAccessory: true,
    icon: 'auto_fix',
    description: 'Gargantillas, cadenas de eslabones y dijes colgantes',
    sampleItems: 'Cadena veneciana, gargantilla perlas, dijes',
  },
  {
    category: 'Pulseras & Brazaletes',
    minStock: 5,
    isAccessory: true,
    icon: 'circle',
    description: 'Brazaletes rígidos, pulseras de eslabones e hilo macramé',
    sampleItems: 'Brazaletes dorados, pulseras ojo turco',
  },
  {
    category: 'Anillos & Alianzas',
    minStock: 8,
    isAccessory: true,
    icon: 'radio_button_checked',
    description: 'Solitarios, anillos ajustables, alianzas y sets de moda',
    sampleItems: 'Anillo solitario circonia, sets vintage',
  },
  {
    category: 'Relojes & Smartwatches',
    minStock: 3,
    isAccessory: true,
    icon: 'watch',
    description: 'Relojes de cuarzo, analógicos, cronógrafos y pulseras',
    sampleItems: 'Reloj malla metálica, cronógrafo cuero',
  },
  {
    category: 'Gafas de Sol & Óptica',
    minStock: 4,
    isAccessory: true,
    icon: 'visibility',
    description: 'Gafas polarizadas UV400, marcos carey y accesorios ópticos',
    sampleItems: 'Gafas aviador, cat-eye polarizadas',
  },
  {
    category: 'Bolsos & Billeteras',
    minStock: 3,
    isAccessory: true,
    icon: 'shopping_bag',
    description: 'Carteras crossbody, billeteras compactas y cosmetiqueras',
    sampleItems: 'Billetera nude, bolso crossbody, tarjeteros',
  },
  {
    category: 'Accesorios para Cabello',
    minStock: 10,
    isAccessory: true,
    icon: 'face_retouching_natural',
    description: 'Diademas, scrunchies, pinzas metálicas y pasadores',
    sampleItems: 'Diadema acolchada, pinzas doradas, scrunchies',
  },
];

export const GENERAL_STORE_CATEGORIES_PRESETS: CategoryThresholdRule[] = [
  {
    category: 'Bebidas',
    minStock: 12,
    isAccessory: false,
    icon: 'local_drink',
    description: 'Gaseosas, aguas, jugos y bebidas hidratantes',
  },
  {
    category: 'Snacks & Golosinas',
    minStock: 10,
    isAccessory: false,
    icon: 'cookie',
    description: 'Papas, galletas, chocolates y snacks empacados',
  },
  {
    category: 'Despensa & Abarrotes',
    minStock: 6,
    isAccessory: false,
    icon: 'storefront',
    description: 'Café, aceites, granos y víveres esenciales',
  },
  {
    category: 'Lácteos & Huevos',
    minStock: 8,
    isAccessory: false,
    icon: 'egg',
    description: 'Leches, quesos, yogures y huevos frescos',
  },
  {
    category: 'Licores & Cervezas',
    minStock: 12,
    isAccessory: false,
    icon: 'sports_bar',
    description: 'Cervezas artesanales, destilados y vinos',
  },
  {
    category: 'Panadería',
    minStock: 6,
    isAccessory: false,
    icon: 'bakery_dining',
    description: 'Pan empacado, tostadas y bollería fresca',
  },
  {
    category: 'Cuidado & Aseo',
    minStock: 6,
    isAccessory: false,
    icon: 'sanitizer',
    description: 'Jabones, desinfectantes y artículos de higiene',
  },
];

export const ALL_DEFAULT_CATEGORY_RULES: CategoryThresholdRule[] = [
  ...ACCESSORY_CATEGORIES_PRESETS,
  ...GENERAL_STORE_CATEGORIES_PRESETS,
];

const LOCAL_STORAGE_KEY = 'pos_threshold_settings';

/**
 * Generates the default configuration object
 */
export const getDefaultThresholdSettings = (): GlobalThresholdSettings => {
  const categoryThresholds: Record<string, number> = {};
  ALL_DEFAULT_CATEGORY_RULES.forEach((rule) => {
    categoryThresholds[rule.category] = rule.minStock;
  });

  return {
    defaultGlobalMinStock: 5,
    autoSyncOnChange: true,
    categoryThresholds,
    lastUpdated: Date.now(),
  };
};

/**
 * Retrieves the stored threshold settings from localStorage or defaults
 */
export const getStoredThresholdSettings = (): GlobalThresholdSettings => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return getDefaultThresholdSettings();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultThresholdSettings();

    return {
      defaultGlobalMinStock:
        typeof parsed.defaultGlobalMinStock === 'number'
          ? parsed.defaultGlobalMinStock
          : defaults.defaultGlobalMinStock,
      autoSyncOnChange:
        typeof parsed.autoSyncOnChange === 'boolean'
          ? parsed.autoSyncOnChange
          : defaults.autoSyncOnChange,
      categoryThresholds: {
        ...defaults.categoryThresholds,
        ...(parsed.categoryThresholds || {}),
      },
      lastUpdated: parsed.lastUpdated || Date.now(),
    };
  } catch (err) {
    console.error('Error reading threshold settings from localStorage:', err);
    return getDefaultThresholdSettings();
  }
};

/**
 * Saves threshold settings to localStorage
 */
export const saveStoredThresholdSettings = (settings: GlobalThresholdSettings): void => {
  try {
    const payload: GlobalThresholdSettings = {
      ...settings,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Error saving threshold settings to localStorage:', err);
  }
};

/**
 * Resets threshold settings back to factory defaults
 */
export const resetThresholdSettingsToDefault = (): GlobalThresholdSettings => {
  const defaults = getDefaultThresholdSettings();
  saveStoredThresholdSettings(defaults);
  return defaults;
};

/**
 * Returns the effective threshold for a given product or category
 */
export const getCategoryThreshold = (
  category: string,
  settings: GlobalThresholdSettings
): number => {
  if (settings.categoryThresholds && typeof settings.categoryThresholds[category] === 'number') {
    return settings.categoryThresholds[category];
  }
  return settings.defaultGlobalMinStock;
};

/**
 * Checks if a category belongs to accessories
 */
export const isAccessoryCategoryName = (categoryName: string): boolean => {
  const lower = categoryName.toLowerCase();
  return (
    lower.includes('accesorio') ||
    lower.includes('joyer') ||
    lower.includes('arete') ||
    lower.includes('collar') ||
    lower.includes('pulsera') ||
    lower.includes('brazalete') ||
    lower.includes('anillo') ||
    lower.includes('reloj') ||
    lower.includes('gafas') ||
    lower.includes('bolso') ||
    lower.includes('billetera') ||
    lower.includes('cabello')
  );
};

/**
 * Returns icon associated with a category
 */
export const getCategoryIcon = (categoryName: string): string => {
  const preset = ALL_DEFAULT_CATEGORY_RULES.find(
    (r) => r.category.toLowerCase() === categoryName.toLowerCase()
  );
  if (preset) return preset.icon;

  if (isAccessoryCategoryName(categoryName)) return 'diamond';
  return 'category';
};

/**
 * Applies the global and category threshold settings across products.
 * If targetCategory is specified, only updates products of that category.
 */
export const applyThresholdsToProductsList = (
  products: Product[],
  settings: GlobalThresholdSettings,
  targetCategory?: string
): Product[] => {
  return products.map((product) => {
    if (targetCategory && targetCategory !== 'Todos' && product.category !== targetCategory) {
      return product;
    }

    const categoryThreshold = getCategoryThreshold(product.category, settings);
    return {
      ...product,
      minStock: categoryThreshold,
    };
  });
};
