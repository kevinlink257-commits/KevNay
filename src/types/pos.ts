export interface Cashier {
  id: string;
  name: string;
  code: string; // e.g., 'T-04'
  role: string; // e.g., 'Cajero Principal • Turno Diurno'
  initials: string;
  pin: string;
  avatar: string;
  isMaster?: boolean;
  drawerCash: number;
  completedTickets: number;
  nfcCardId?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  image?: string;
  taxRate: number; // e.g. 0.19 for 19% IVA, or 0
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'qr_transfer' | 'mixto';

export interface SaleTicket {
  id: string;
  ticketNumber: string; // e.g. '#T-1025'
  timestamp: string;
  date?: string; // ISO date 'YYYY-MM-DD' for date-based analytics
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerDoc?: string;
  items: CartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeReturned: number;
  outsideOperatingHours?: boolean;
  status: 'completada' | 'anulada';
}

export interface CashCountDenominations {
  bills100k: number;
  bills50k: number;
  bills20k: number;
  bills10k: number;
  bills5k: number;
  bills2k: number;
  coins1000: number;
  coins500: number;
  coins200: number;
  coins100: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: 'lock' | 'unlock_pin' | 'unlock_nfc' | 'unlock_biometric' | 'unlock_supervisor' | 'failed_pin' | 'sale_completed' | 'shift_close';
  cashierName: string;
  details: string;
}

export type DayOfWeekKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DaySchedule {
  day: DayOfWeekKey;
  dayName: string; // e.g. "Lunes", "Martes", etc.
  isOpen: boolean;
  openTime: string; // '08:00'
  closeTime: string; // '20:00'
}

export interface OperatingHoursConfig {
  enabled: boolean;
  strictMode: boolean; // true = requiere autorización / PIN si está fuera de horario, false = advertencia informativa
  requirePinToOverride: boolean;
  noticeMessage: string;
  schedule: DaySchedule[];
}
