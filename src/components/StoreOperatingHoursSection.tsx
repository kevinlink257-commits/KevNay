import React, { useState, useEffect } from 'react';
import { OperatingHoursConfig, DaySchedule, DayOfWeekKey } from '../types/pos';
import {
  checkIsWithinOperatingHours,
  formatTime12h,
  timeToMinutes,
  DEFAULT_SCHEDULE,
  DEFAULT_OPERATING_HOURS,
} from '../utils/operatingHours';
import { posAudio } from '../utils/audio';

interface StoreOperatingHoursSectionProps {
  config: OperatingHoursConfig;
  onUpdateConfig: (newConfig: OperatingHoursConfig) => void;
  onOpenPos?: () => void;
}

export const StoreOperatingHoursSection: React.FC<StoreOperatingHoursSectionProps> = ({
  config,
  onUpdateConfig,
  onOpenPos,
}) => {
  const [localConfig, setLocalConfig] = useState<OperatingHoursConfig>(config);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testTime, setTestTime] = useState<string>('22:30');
  const [testDay, setTestDay] = useState<DayOfWeekKey>('wednesday');
  const [showSimModal, setShowSimModal] = useState<boolean>(false);

  // Keep localConfig synced if prop changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Live timer tick every 10 seconds for real-time status
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const liveStatus = checkIsWithinOperatingHours(localConfig, currentTime);

  const handleToggleEnabled = () => {
    posAudio.playKeyClick();
    const updated = { ...localConfig, enabled: !localConfig.enabled };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    showSaveNotice();
  };

  const handleToggleStrictMode = () => {
    posAudio.playKeyClick();
    const updated = { ...localConfig, strictMode: !localConfig.strictMode };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    showSaveNotice();
  };

  const handleDayChange = (dayKey: DayOfWeekKey, field: keyof DaySchedule, value: any) => {
    const updatedSchedule = localConfig.schedule.map((day) => {
      if (day.day === dayKey) {
        return { ...day, [field]: value };
      }
      return day;
    });
    const updated = { ...localConfig, schedule: updatedSchedule };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    showSaveNotice();
  };

  const handleCopyMondayToWeekdays = () => {
    posAudio.playScanBeep();
    const monday = localConfig.schedule.find((s) => s.day === 'monday') || DEFAULT_SCHEDULE[0];
    const weekdays: DayOfWeekKey[] = ['tuesday', 'wednesday', 'thursday', 'friday'];
    const updatedSchedule = localConfig.schedule.map((day) => {
      if (weekdays.includes(day.day)) {
        return {
          ...day,
          isOpen: monday.isOpen,
          openTime: monday.openTime,
          closeTime: monday.closeTime,
        };
      }
      return day;
    });
    const updated = { ...localConfig, schedule: updatedSchedule };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    showSaveNotice();
  };

  const handleApplyPreset = (preset: 'standard' | 'mall' | 'all247' | 'default') => {
    posAudio.playCashRegisterChime();
    let newSchedule: DaySchedule[] = [];

    if (preset === 'standard') {
      newSchedule = [
        { day: 'monday', dayName: 'Lunes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { day: 'tuesday', dayName: 'Martes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { day: 'wednesday', dayName: 'Miércoles', isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { day: 'thursday', dayName: 'Jueves', isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { day: 'friday', dayName: 'Viernes', isOpen: true, openTime: '08:00', closeTime: '21:00' },
        { day: 'saturday', dayName: 'Sábado', isOpen: true, openTime: '09:00', closeTime: '21:00' },
        { day: 'sunday', dayName: 'Domingo', isOpen: true, openTime: '10:00', closeTime: '18:00' },
      ];
    } else if (preset === 'mall') {
      newSchedule = localConfig.schedule.map((d) => ({
        ...d,
        isOpen: true,
        openTime: '10:00',
        closeTime: '21:00',
      }));
    } else if (preset === 'all247') {
      newSchedule = localConfig.schedule.map((d) => ({
        ...d,
        isOpen: true,
        openTime: '00:00',
        closeTime: '23:59',
      }));
    } else {
      newSchedule = DEFAULT_SCHEDULE;
    }

    const updated = {
      ...localConfig,
      enabled: true,
      schedule: newSchedule,
    };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    showSaveNotice();
  };

  const showSaveNotice = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Test simulation helper
  const simulatedResult = (() => {
    const dummyDate = new Date();
    const dayMap: Record<DayOfWeekKey, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const targetDayIndex = dayMap[testDay];
    dummyDate.setDate(dummyDate.getDate() + ((targetDayIndex + 7 - dummyDate.getDay()) % 7));
    const [h, m] = testTime.split(':').map((v) => parseInt(v, 10) || 0);
    dummyDate.setHours(h, m, 0, 0);

    return checkIsWithinOperatingHours(localConfig, dummyDate);
  })();

  const currentDayIndex = currentTime.getDay();
  const dayKeyOrder: DayOfWeekKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayIndexToKey: Record<number, DayOfWeekKey> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  const todayKey = dayIndexToKey[currentDayIndex];

  return (
    <div className="flex flex-col space-y-6">
      {/* Live Operational Status Banner */}
      <div className="bg-[#191f2f] rounded-2xl border border-[#374151]/40 p-5 shadow-xl relative overflow-hidden">
        {/* Background glow based on status */}
        <div
          className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 ${
            !localConfig.enabled
              ? 'bg-blue-500'
              : liveStatus.isWithinHours
              ? 'bg-emerald-500'
              : 'bg-rose-500'
          }`}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                !localConfig.enabled
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : liveStatus.isWithinHours
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
              }`}
            >
              <span className="material-symbols-outlined text-[28px]">
                {!localConfig.enabled ? 'schedule' : liveStatus.isWithinHours ? 'storefront' : 'alarm_off'}
              </span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Horario Operativo de la Tienda
                </h3>
                {localConfig.enabled ? (
                  liveStatus.isWithinHours ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      ABIERTO • EN HORARIO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 font-mono">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      FUERA DE HORARIO
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                    CONTROL DESACTIVADO (24/7)
                  </span>
                )}
              </div>

              <p className="text-xs text-[#e6bdb8] mt-1">
                {liveStatus.reason} · {liveStatus.nextChangeNote}
              </p>

              <div className="flex items-center gap-3 mt-2 text-xs font-mono text-gray-300">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-[#90cdff]">schedule</span>
                  Hora Local: <strong className="text-white">{liveStatus.currentTimeStr}</strong> ({liveStatus.currentDayName})
                </span>
                <span className="text-[#374151]">|</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-[#f59e0b]">timelapse</span>
                  Horario Hoy: <strong className="text-white">{liveStatus.openTimeFormatted} - {liveStatus.closeTimeFormatted}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Master Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Master Toggle */}
            <button
              type="button"
              onClick={handleToggleEnabled}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 border ${
                localConfig.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50'
                  : 'bg-[#232a3a] hover:bg-[#323949] text-gray-300 border-[#374151]/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {localConfig.enabled ? 'toggle_on' : 'toggle_off'}
              </span>
              <span>{localConfig.enabled ? 'Control POS Activado' : 'Control POS Desactivado'}</span>
            </button>

            {onOpenPos && (
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  onOpenPos();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                <span>Probar en POS</span>
              </button>
            )}
          </div>
        </div>

        {/* Save notice badge */}
        {savedSuccess && (
          <div className="mt-4 p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Horario operativo guardado y sincronizado en tiempo real con la caja POS.</span>
          </div>
        )}
      </div>

      {/* Enforcement & Notification Policy Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Política de Bloqueo vs Advertencia */}
        <div className="bg-[#191f2f] p-4.5 rounded-2xl border border-[#374151]/40 shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-[#f59e0b]">security</span>
              <div>
                <h4 className="text-sm font-bold text-white">Comportamiento en Caja POS</h4>
                <p className="text-[11px] text-[#e6bdb8]">Cómo debe responder el POS al intentar vender fuera de horario</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleStrictMode}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors border ${
                localConfig.strictMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#232a3a] text-gray-300 border-[#374151]/40'
              }`}
            >
              {localConfig.strictMode ? 'Modo Estricto (PIN Requerido)' : 'Modo Advertencia'}
            </button>
          </div>

          <div className="text-xs text-gray-300 bg-[#141b2b] p-3 rounded-xl border border-[#374151]/30">
            {localConfig.strictMode ? (
              <p>
                🔒 <strong className="text-white">Modo Estricto:</strong> Se desplegará un bloqueo de seguridad en la caja y el cajero requerirá la autorización con PIN del administrador para desbloquear la venta fuera de horas.
              </p>
            ) : (
              <p>
                ⚠️ <strong className="text-white">Modo Advertencia (Recomendado):</strong> El cajero verá un aviso preventivo destacado en pantalla informando que la tienda está fuera de horario, solicitando confirmación expresa antes de emitir el ticket.
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Plantillas Rápidas de Horario */}
        <div className="bg-[#191f2f] p-4.5 rounded-2xl border border-[#374151]/40 shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-[#38bdf8]">auto_mode</span>
              <div>
                <h4 className="text-sm font-bold text-white">Plantillas Predefinidas</h4>
                <p className="text-[11px] text-[#e6bdb8]">Aplica configuraciones comerciales típicas en 1 clic</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('standard')}
              className="p-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] border border-[#374151]/40 text-[11px] text-left text-gray-200 transition-colors flex flex-col"
              title="Lun-Vie 8am-8pm, Sáb 9am-9pm, Dom 10am-6pm"
            >
              <strong className="text-white text-xs">Comercio</strong>
              <span className="text-[10px] text-[#e6bdb8] mt-0.5">8am - 8pm</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('mall')}
              className="p-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] border border-[#374151]/40 text-[11px] text-left text-gray-200 transition-colors flex flex-col"
              title="Todos los días de 10:00 a 21:00"
            >
              <strong className="text-white text-xs">C. Comercial</strong>
              <span className="text-[10px] text-[#e6bdb8] mt-0.5">10am - 9pm</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('all247')}
              className="p-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] border border-[#374151]/40 text-[11px] text-left text-gray-200 transition-colors flex flex-col"
              title="Todos los días 24 horas continuas"
            >
              <strong className="text-white text-xs">Jornada 24/7</strong>
              <span className="text-[10px] text-[#e6bdb8] mt-0.5">Sin interrupción</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('default')}
              className="p-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] border border-[#374151]/40 text-[11px] text-left text-gray-200 transition-colors flex flex-col"
              title="Restablecer a valores iniciales recomendados"
            >
              <strong className="text-white text-xs">Reiniciar</strong>
              <span className="text-[10px] text-[#e6bdb8] mt-0.5">Por defecto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Weekly Schedule Configuration Table */}
      <div className="bg-[#191f2f] rounded-2xl border border-[#374151]/40 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#374151]/30">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#f59e0b]">calendar_month</span>
              <span>Definición de Horario Semanal (Lunes a Domingo)</span>
            </h4>
            <p className="text-xs text-[#e6bdb8] mt-0.5">
              Configura los límites de apertura y cierre para cada día de la semana.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMondayToWeekdays}
              className="px-3 py-1.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#90cdff] border border-[#374151]/40 text-xs font-semibold transition-colors flex items-center gap-1.5"
              title="Copia el horario del Lunes a Martes, Miércoles, Jueves y Viernes"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              <span>Copiar Lunes a Lun-Vie</span>
            </button>
          </div>
        </div>

        {/* Schedule List */}
        <div className="space-y-2.5">
          {localConfig.schedule.map((dayItem) => {
            const isToday = dayItem.day === todayKey;
            const openM = timeToMinutes(dayItem.openTime);
            const closeM = timeToMinutes(dayItem.closeTime);
            const durationMins = closeM >= openM ? closeM - openM : 24 * 60 - openM + closeM;
            const durationHours = (durationMins / 60).toFixed(1);

            return (
              <div
                key={dayItem.day}
                className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isToday
                    ? 'bg-[#1b253b] border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                    : 'bg-[#141b2b] border-[#374151]/30 hover:border-[#374151]/60'
                }`}
              >
                {/* Day Name & Today Badge */}
                <div className="flex items-center gap-3 w-44 shrink-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                      dayItem.isOpen
                        ? isToday
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-[#232a3a] text-white'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {dayItem.dayName.slice(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{dayItem.dayName}</span>
                      {isToday && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase font-mono">
                          Hoy
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#e6bdb8]">
                      {dayItem.isOpen ? `${durationHours} hrs de atención` : 'Cerrado todo el día'}
                    </span>
                  </div>
                </div>

                {/* Open/Closed Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDayChange(dayItem.day, 'isOpen', !dayItem.isOpen)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border ${
                      dayItem.isOpen
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {dayItem.isOpen ? 'door_open' : 'door_back'}
                    </span>
                    <span>{dayItem.isOpen ? 'Abierto' : 'Cerrado'}</span>
                  </button>
                </div>

                {/* Time Pickers */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">Desde:</span>
                    <input
                      type="time"
                      disabled={!dayItem.isOpen}
                      value={dayItem.openTime}
                      onChange={(e) => handleDayChange(dayItem.day, 'openTime', e.target.value)}
                      className={`px-2.5 py-1.5 rounded-lg bg-[#191f2f] border border-[#374151]/50 text-white font-mono text-xs focus:outline-none focus:border-amber-400 ${
                        !dayItem.isOpen ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className="text-[11px] font-mono text-gray-400">
                      ({formatTime12h(dayItem.openTime)})
                    </span>
                  </div>

                  <span className="text-gray-500 font-bold">—</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">Hasta:</span>
                    <input
                      type="time"
                      disabled={!dayItem.isOpen}
                      value={dayItem.closeTime}
                      onChange={(e) => handleDayChange(dayItem.day, 'closeTime', e.target.value)}
                      className={`px-2.5 py-1.5 rounded-lg bg-[#191f2f] border border-[#374151]/50 text-white font-mono text-xs focus:outline-none focus:border-amber-400 ${
                        !dayItem.isOpen ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className="text-[11px] font-mono text-gray-400">
                      ({formatTime12h(dayItem.closeTime)})
                    </span>
                  </div>
                </div>

                {/* Visual mini-bar of 24 hours */}
                <div className="w-full md:w-36 flex flex-col justify-center">
                  <div className="w-full h-2.5 bg-[#0f141f] rounded-full overflow-hidden flex relative border border-[#374151]/40">
                    {dayItem.isOpen ? (
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full"
                        style={{
                          marginLeft: `${(openM / (24 * 60)) * 100}%`,
                          width: `${Math.min(100 - (openM / (24 * 60)) * 100, (durationMins / (24 * 60)) * 100)}%`,
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-rose-950/60" />
                    )}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-gray-500 mt-0.5">
                    <span>12am</span>
                    <span>12pm</span>
                    <span>11pm</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulator: Interactive Test of the POS Warning */}
      <div className="bg-[#191f2f] rounded-2xl border border-[#374151]/40 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#374151]/30">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#38bdf8]">science</span>
            <div>
              <h4 className="text-base font-bold text-white">Simulador de Advertencia en Caja POS</h4>
              <p className="text-xs text-[#e6bdb8]">
                Comprueba cómo reaccionará el sistema POS cuando un cajero intente vender a cualquier hora programada
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-[#141b2b] p-4 rounded-xl border border-[#374151]/30">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Día a Simular:</label>
            <select
              value={testDay}
              onChange={(e) => setTestDay(e.target.value as DayOfWeekKey)}
              className="w-full px-3 py-2 rounded-xl bg-[#191f2f] border border-[#374151]/50 text-white text-xs font-semibold focus:outline-none"
            >
              {localConfig.schedule.map((d) => (
                <option key={d.day} value={d.day}>
                  {d.dayName} ({d.isOpen ? `${d.openTime} - ${d.closeTime}` : 'Cerrado'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Hora de la Venta:</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#191f2f] border border-[#374151]/50 text-white font-mono text-xs focus:outline-none"
              />
              <span className="text-xs font-mono text-[#90cdff] shrink-0 font-bold">
                {formatTime12h(testTime)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Resultado Esperado en POS:</label>
            <div
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                simulatedResult.isWithinHours
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {simulatedResult.isWithinHours ? 'check_circle' : 'warning'}
              </span>
              <span>
                {simulatedResult.isWithinHours
                  ? 'Venta Normal Permitida'
                  : 'Se activará Alerta / Bloqueo en Caja'}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Mock of the POS Warning Box */}
        <div className="p-4 rounded-xl bg-[#121824] border border-[#374151]/40 space-y-2">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">
            Vista Previa del Aviso en Pantalla del Cajero:
          </span>

          {!simulatedResult.isWithinHours ? (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/60 rounded-xl text-rose-200 text-xs flex items-start gap-3 shadow-inner">
              <span className="material-symbols-outlined text-rose-400 text-[24px] shrink-0">
                warning
              </span>
              <div className="space-y-1">
                <p className="font-bold text-white text-sm">
                  ⚠️ Atención: Intento de Venta Fuera del Horario Operativo
                </p>
                <p className="text-xs text-rose-200">
                  {simulatedResult.reason} Hora simulada: {formatTime12h(testTime)}.
                </p>
                <p className="text-[11px] text-gray-300 mt-1 font-mono">
                  {localConfig.strictMode
                    ? '🔒 Requiere PIN de Supervisor / Administrador para autorizar el ticket.'
                    : 'ℹ️ El sistema registrará una advertencia en la bitácora de auditoría si se procede con el cobro.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-400 text-[22px] shrink-0">
                check_circle
              </span>
              <div>
                <p className="font-bold text-white">Horario Válido para Venta</p>
                <p className="text-xs text-emerald-300">
                  La transacción se procesará normalmente sin interrupciones.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
