export interface LockScreenImage {
  id: string;
  url: string;
  title: string;
  category: string;
  isDefault?: boolean;
  addedAt?: number;
}

export const DEFAULT_ACCESSORY_STORE_IMAGES: LockScreenImage[] = [
  {
    id: 'acc-store-1',
    title: 'Vitrina Principal de Joyería y Alta Gama',
    category: 'Joyería Fina',
    url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1600&auto=format&fit=crop&q=80',
    isDefault: true,
  },
  {
    id: 'acc-store-2',
    title: 'Boutique Central & Estantes de Accesorios',
    category: 'Tienda & Exhibición',
    url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&auto=format&fit=crop&q=80',
    isDefault: true,
  },
  {
    id: 'acc-store-3',
    title: 'Exhibidor de Gafas de Sol y Moda',
    category: 'Gafas & Óptica',
    url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1600&auto=format&fit=crop&q=80',
    isDefault: true,
  },
  {
    id: 'acc-store-4',
    title: 'Colección de Relojería y Pulseras',
    category: 'Relojes & Pulseras',
    url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1600&auto=format&fit=crop&q=80',
    isDefault: true,
  },
  {
    id: 'acc-store-5',
    title: 'Mostrador de Accesorios, Carteras y Calzado',
    category: 'Marroquinería & Bolsos',
    url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1600&auto=format&fit=crop&q=80',
    isDefault: true,
  },
  {
    id: 'acc-store-6',
    title: 'Bandeja de Anillos y Bisutería Fina',
    category: 'Anillos & Bisutería',
    url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1600&auto=format&fit=crop&q=80',
    isDefault: true,
  },
];

const STORAGE_KEY = 'pos_lockscreen_images';
const DIMMER_STORAGE_KEY = 'pos_lockscreen_dimmer';
const INTERVAL_STORAGE_KEY = 'pos_lockscreen_interval';

/**
 * Retrieves the stored lock screen images, falling back to defaults if empty.
 */
export function getStoredLockScreenImages(): LockScreenImage[] {
  if (typeof window === 'undefined') return DEFAULT_ACCESSORY_STORE_IMAGES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESSORY_STORE_IMAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Error reading pos_lockscreen_images:', err);
  }
  return DEFAULT_ACCESSORY_STORE_IMAGES;
}

/**
 * Persists the list of lockscreen images to localStorage.
 */
export function saveStoredLockScreenImages(images: LockScreenImage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  } catch (err) {
    console.error('Error saving pos_lockscreen_images:', err);
  }
}

/**
 * Resets the stored images back to the default curated accessories store gallery.
 */
export function resetLockScreenImagesToDefault(): LockScreenImage[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  return DEFAULT_ACCESSORY_STORE_IMAGES;
}

/**
 * Gets the dark overlay dimmer level for the lock screen background.
 */
export function getStoredDimmerLevel(): 'low' | 'medium' | 'high' {
  if (typeof window === 'undefined') return 'medium';
  try {
    const val = localStorage.getItem(DIMMER_STORAGE_KEY);
    if (val === 'low' || val === 'medium' || val === 'high') return val;
  } catch {}
  return 'medium';
}

export function saveStoredDimmerLevel(level: 'low' | 'medium' | 'high'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DIMMER_STORAGE_KEY, level);
  } catch {}
}

/**
 * Gets the slideshow interval in seconds (default: 8s, 0 = paused).
 */
export function getStoredSlideInterval(): number {
  if (typeof window === 'undefined') return 8;
  try {
    const val = localStorage.getItem(INTERVAL_STORAGE_KEY);
    if (val !== null) {
      const num = parseInt(val, 10);
      if (!isNaN(num)) return num;
    }
  } catch {}
  return 8;
}

export function saveStoredSlideInterval(seconds: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INTERVAL_STORAGE_KEY, String(seconds));
  } catch {}
}

/**
 * Safely compresses and converts an uploaded user photo into a base64 data URL
 * so it fits comfortably within browser localStorage quotas.
 */
export function compressAndReadFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1000,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'));
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Archivo de imagen vacío'));
        return;
      }

      // Check if already an SVG or tiny image
      if (file.type === 'image/svg+xml' || file.size < 150 * 1024) {
        resolve(result);
        return;
      }

      // Canvas resize & compression
      const img = new Image();
      img.onerror = () => resolve(result); // Fallback to raw if canvas fails
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
