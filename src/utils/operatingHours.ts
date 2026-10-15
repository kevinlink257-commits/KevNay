import { DaySchedule, OperatingHoursConfig, DayOfWeekKey } from '../types/pos';

export const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 'monday', dayName: 'Lunes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
  { day: 'tuesday', dayName: 'Martes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
  { day: 'wednesday', dayName: 'Miércoles', isOpen: true, openTime: '08:00', closeTime: '20:00' },
  { day: 'thursday', dayName: 'Jueves', isOpen: true, openTime: '08:00', closeTime: '20:00' },
  { day: 'friday', dayName: 'Viernes', isOpen: true, openTime: '08:00', closeTime: '21:00' },
  { day: 'saturday', dayName: 'Sábado', isOpen: true, openTime: '09:00', closeTime: '21:00' },
  { day: 'sunday', dayName: 'Domingo', isOpen: true, openTime: '10:00', closeTime: '18:00' },
];

export const DEFAULT_OPERATING_HOURS: OperatingHoursConfig = {
  enabled: true,
  strictMode: false, // If true, requires confirmation/PIN. If false, shows alert banner and confirmation.
  requirePinToOverride: false,
  noticeMessage: 'Atención: Operación fuera de la jornada comercial programada.',
  schedule: DEFAULT_SCHEDULE,
};

const STORAGE_KEY = 'pos_operating_hours_config';

/**
 * Loads the operating hours config from localStorage or returns default
 */
export function loadOperatingHours(): OperatingHoursConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPERATING_HOURS;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.schedule) && parsed.schedule.length === 7) {
      return {
        ...DEFAULT_OPERATING_HOURS,
        ...parsed,
      };
    }
    return DEFAULT_OPERATING_HOURS;
  } catch (e) {
    console.warn('Error loading operating hours from localStorage:', e);
    return DEFAULT_OPERATING_HOURS;
  }
}

/**
 * Saves operating hours to localStorage
 */
export function saveOperatingHours(config: OperatingHoursConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving operating hours to localStorage:', e);
  }
}

const JS_DAY_TO_KEY: Record<number, DayOfWeekKey> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export interface OperatingStatusResult {
  isWithinHours: boolean;
  status: 'open' | 'closed' | 'disabled';
  reason: string;
  todaySchedule: DaySchedule;
  currentTimeStr: string;
  currentDayName: string;
  openTimeFormatted: string;
  closeTimeFormatted: string;
  nextChangeNote: string;
}

/**
 * Converts 24h "HH:MM" string to minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

/**
 * Formats 24h "HH:MM" into readable 12h "8:00 AM" format
 */
export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Checks whether the current or specified date/time is within the store's operating hours
 */
export function checkIsWithinOperatingHours(
  config: OperatingHoursConfig,
  checkDate: Date = new Date()
): OperatingStatusResult {
  const dayKey = JS_DAY_TO_KEY[checkDate.getDay()] || 'monday';
  const todaySchedule =
    config.schedule.find((s) => s.day === dayKey) ||
    DEFAULT_SCHEDULE.find((s) => s.day === dayKey)!;

  const currentHours = String(checkDate.getHours()).padStart(2, '0');
  const currentMinutes = String(checkDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const nowTotalMinutes = checkDate.getHours() * 60 + checkDate.getMinutes();

  const openTimeFormatted = formatTime12h(todaySchedule.openTime);
  const closeTimeFormatted = formatTime12h(todaySchedule.closeTime);

  // If operating hours control is disabled globally
  if (!config.enabled) {
    return {
      isWithinHours: true,
      status: 'disabled',
      reason: 'El control de horario operativo está desactivado (operación continua sin restricciones).',
      todaySchedule,
      currentTimeStr,
      currentDayName: todaySchedule.dayName,
      openTimeFormatted,
      closeTimeFormatted,
      nextChangeNote: 'Sin límite de horario',
    };
  }

  // If the store is marked closed for today
  if (!todaySchedule.isOpen) {
    return {
      isWithinHours: false,
      status: 'closed',
      reason: `La tienda está configurada como CERRADA hoy (${todaySchedule.dayName}).`,
      todaySchedule,
      currentTimeStr,
      currentDayName: todaySchedule.dayName,
      openTimeFormatted,
      closeTimeFormatted,
      nextChangeNote: 'Cerrado todo el día',
    };
  }

  const openMins = timeToMinutes(todaySchedule.openTime);
  const closeMins = timeToMinutes(todaySchedule.closeTime);

  // Normal daytime schedule (e.g. 08:00 to 20:00)
  if (closeMins >= openMins) {
    if (nowTotalMinutes >= openMins && nowTotalMinutes < closeMins) {
      const minutesRemaining = closeMins - nowTotalMinutes;
      const hoursRemaining = Math.floor(minutesRemaining / 60);
      const minsOnly = minutesRemaining % 60;
      const remainingText =
        hoursRemaining > 0
          ? `${hoursRemaining}h ${minsOnly}m para cerrar`
          : `${minsOnly}m para cerrar`;

      return {
        isWithinHours: true,
        status: 'open',
        reason: `Dentro del horario permitido (${openTimeFormatted} - ${closeTimeFormatted}).`,
        todaySchedule,
        currentTimeStr,
        currentDayName: todaySchedule.dayName,
        openTimeFormatted,
        closeTimeFormatted,
        nextChangeNote: remainingText,
      };
    } else if (nowTotalMinutes < openMins) {
      const minsUntilOpen = openMins - nowTotalMinutes;
      const hrsUntilOpen = Math.floor(minsUntilOpen / 60);
      const minsOnly = minsUntilOpen % 60;
      const note =
        hrsUntilOpen > 0
          ? `Abre en ${hrsUntilOpen}h ${minsOnly}m (${openTimeFormatted})`
          : `Abre en ${minsOnly}m (${openTimeFormatted})`;

      return {
        isWithinHours: false,
        status: 'closed',
        reason: `Aún no inicia el horario comercial de hoy. Abre a las ${openTimeFormatted}.`,
        todaySchedule,
        currentTimeStr,
        currentDayName: todaySchedule.dayName,
        openTimeFormatted,
        closeTimeFormatted,
        nextChangeNote: note,
      };
    } else {
      return {
        isWithinHours: false,
        status: 'closed',
        reason: `La tienda finalizó su jornada a las ${closeTimeFormatted}.`,
        todaySchedule,
        currentTimeStr,
        currentDayName: todaySchedule.dayName,
        openTimeFormatted,
        closeTimeFormatted,
        nextChangeNote: 'Jornada cerrada',
      };
    }
  } else {
    // Overnight schedule (e.g. 20:00 to 02:00)
    const isOvernightOpen = nowTotalMinutes >= openMins || nowTotalMinutes < closeMins;
    if (isOvernightOpen) {
      return {
        isWithinHours: true,
        status: 'open',
        reason: `Turno nocturno activo (${openTimeFormatted} - ${closeTimeFormatted}).`,
        todaySchedule,
        currentTimeStr,
        currentDayName: todaySchedule.dayName,
        openTimeFormatted,
        closeTimeFormatted,
        nextChangeNote: `Cierra a las ${closeTimeFormatted}`,
      };
    } else {
      return {
        isWithinHours: false,
        status: 'closed',
        reason: `Fuera del horario nocturno establecido (${openTimeFormatted} - ${closeTimeFormatted}).`,
        todaySchedule,
        currentTimeStr,
        currentDayName: todaySchedule.dayName,
        openTimeFormatted,
        closeTimeFormatted,
        nextChangeNote: `Abre a las ${openTimeFormatted}`,
      };
    }
  }
}
