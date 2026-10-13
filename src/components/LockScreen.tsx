import React, { useState, useEffect, useCallback } from 'react';
import { Cashier, AuditEvent } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';

interface LockScreenProps {
  currentCashier: Cashier;
  cashiers: Cashier[];
  onUnlock: (cashier: Cashier) => void;
  onSwitchCashier: (cashier: Cashier) => void;
  onEmergencyShiftClose: () => void;
  onLogAudit: (type: AuditEvent['type'], details: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  currentCashier,
  cashiers,
  onUnlock,
  onSwitchCashier,
  onEmergencyShiftClose,
  onLogAudit,
  soundEnabled,
  onToggleSound,
}) => {
  const [pin, setPin] = useState<string>('741'); // Start with 3 prefilled digits like in reference screenshot
  const [feedback, setFeedback] = useState<string>('Esperando último dígito...');
  const [feedbackStatus, setFeedbackStatus] = useState<'normal' | 'verifying' | 'success' | 'error'>('normal');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [showSwitchPanel, setShowSwitchPanel] = useState<boolean>(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState<boolean>(false);
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [supervisorError, setSupervisorError] = useState<string>('');
  
  // NFC states
  const [showNfcModal, setShowNfcModal] = useState<boolean>(false);
  const [nfcFeedback, setNfcFeedback] = useState<string | null>(null);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [detectedOtherCashier, setDetectedOtherCashier] = useState<Cashier | null>(null);
  const [manualNfcInput, setManualNfcInput] = useState<string>('');
  const [webNfcSupported, setWebNfcSupported] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Live COT clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds} COT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect Web NFC hardware support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setWebNfcSupported(true);
    }
  }, []);

  // Strict NFC Authentication Handler
  const handleNfcCard = useCallback(
    (cardId: string) => {
      const cleanId = cardId.trim();
      setNfcError(null);
      setDetectedOtherCashier(null);

      if (!cleanId) return;

      // Check 1: Card belongs to active cashier
      if (
        currentCashier.nfcCardId &&
        cleanId.toUpperCase() === currentCashier.nfcCardId.toUpperCase()
      ) {
        posAudio.playScanBeep();
        setNfcFeedback(`✓ Tarjeta autorizada (${currentCashier.name} - ${currentCashier.code}). Acceso concedido.`);
        posAudio.playSuccessChime();
        onLogAudit('unlock_nfc', `Desbloqueo exitoso con tarjeta NFC ${cleanId} para ${currentCashier.name}`);
        setTimeout(() => {
          setShowNfcModal(false);
          setNfcFeedback(null);
          setManualNfcInput('');
          onUnlock(currentCashier);
        }, 700);
        return;
      }

      // Check 2: Master Supervisor Card (e.g. NFC-MASTER-0001)
      if (cleanId.toUpperCase() === 'NFC-MASTER-0001' || cleanId.toUpperCase() === 'MASTER-0001') {
        const adminCashier = cashiers.find((c) => c.isMaster) || currentCashier;
        posAudio.playScanBeep();
        setNfcFeedback(`✓ Llave Maestra NFC detectada (${adminCashier.name}). Acceso de supervisor autorizado.`);
        posAudio.playSuccessChime();
        onLogAudit('unlock_supervisor', `Desbloqueo maestro por tarjeta NFC ${cleanId}`);
        setTimeout(() => {
          setShowNfcModal(false);
          setNfcFeedback(null);
          setManualNfcInput('');
          onUnlock(adminCashier);
        }, 700);
        return;
      }

      // Check 3: Card belongs to another registered cashier
      const otherCashier = cashiers.find(
        (c) => c.nfcCardId && c.nfcCardId.toUpperCase() === cleanId.toUpperCase()
      );
      if (otherCashier && otherCashier.id !== currentCashier.id) {
        posAudio.playScanBeep();
        setDetectedOtherCashier(otherCashier);
        setNfcFeedback(`Tarjeta identificada: ${otherCashier.name} (${otherCashier.code}). Turno no iniciado.`);
        return;
      }

      // Check 4: Unknown / Unauthorized card -> Strictly refuse, NO bypass
      posAudio.playErrorBuzz();
      setNfcError(`❌ Tarjeta NFC "${cleanId}" no registrada o sin permisos de acceso.`);
      onLogAudit('failed_pin', `Intento de acceso denegado con tarjeta NFC no autorizada ${cleanId}`);
    },
    [currentCashier, cashiers, onUnlock, onLogAudit]
  );

  // Web NFC hardware listener (when supported by browser e.g. Android Chrome)
  useEffect(() => {
    let ndefController: AbortController | null = null;
    const windowWithNfc = window as unknown as {
      NDEFReader?: new () => {
        scan: (options?: { signal: AbortSignal }) => Promise<void>;
        onreading: (event: { serialNumber?: string }) => void;
        onerror: (err: unknown) => void;
      };
    };

    if (showNfcModal && windowWithNfc.NDEFReader) {
      try {
        ndefController = new AbortController();
        const ndef = new windowWithNfc.NDEFReader();
        ndef.scan({ signal: ndefController.signal }).catch(() => {
          // NFC scan error or permission dismissed
        });
        ndef.onreading = (event) => {
          if (event.serialNumber) {
            handleNfcCard(event.serialNumber);
          }
        };
      } catch {}
    }

    return () => {
      if (ndefController) {
        ndefController.abort();
      }
    };
  }, [showNfcModal, handleNfcCard]);

  // Open NFC modal
  const handleOpenNfcModal = () => {
    posAudio.playKeyClick();
    setNfcFeedback(null);
    setNfcError(null);
    setDetectedOtherCashier(null);
    setManualNfcInput('');
    setShowNfcModal(true);
  };

  // PIN verification
  const verifyPin = useCallback(
    (inputPin: string) => {
      setFeedbackStatus('verifying');
      setFeedback('Verificando PIN...');

      const adminUser = cashiers.find((c) => c.isMaster);
      const adminPin = adminUser ? adminUser.pin : '9999';

      setTimeout(() => {
        // Valid if matches cashier's pin or admin's pin
        const isValid =
          inputPin === currentCashier.pin ||
          inputPin === adminPin;

        if (isValid) {
          setFeedbackStatus('success');
          setFeedback('Acceso Concedido. Reanudando terminal...');
          posAudio.playSuccessChime();
          onLogAudit('unlock_pin', `Desbloqueo exitoso por PIN cajero ${currentCashier.name}`);
          setTimeout(() => {
            onUnlock(currentCashier);
          }, 450);
        } else {
          setFeedbackStatus('error');
          setFeedback('PIN Incorrecto. Intenta de nuevo.');
          setIsShaking(true);
          posAudio.playErrorBuzz();
          onLogAudit('failed_pin', `Intento fallido de PIN en terminal para ${currentCashier.name}`);
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
            setFeedbackStatus('normal');
            setFeedback('Ingresa tu PIN de 4 dígitos para reanudar');
          }, 800);
        }
      }, 350);
    },
    [currentCashier, cashiers, onUnlock, onLogAudit]
  );

  const handleKey = (digit: string) => {
    if (feedbackStatus === 'verifying' || feedbackStatus === 'success') return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      posAudio.playKeyClick();
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      } else {
        setFeedbackStatus('normal');
        setFeedback(nextPin.length === 3 ? 'Esperando último dígito...' : `${nextPin.length} de 4 dígitos`);
      }
    }
  };

  const handleBackspace = () => {
    if (feedbackStatus === 'verifying' || feedbackStatus === 'success') return;
    if (pin.length > 0) {
      posAudio.playKeyClick();
      const nextPin = pin.slice(0, -1);
      setPin(nextPin);
      setFeedbackStatus('normal');
      setFeedback(
        nextPin.length === 3
          ? 'Esperando último dígito...'
          : nextPin.length === 0
          ? 'Ingresa tu PIN de 4 dígitos para reanudar'
          : `${nextPin.length} de 4 dígitos`
      );
    }
  };

  // Keyboard navigation for physical POS keypads
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSupervisorModal || showNfcModal) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Supervisor Master Unlock
  const handleSupervisorAuthorize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const adminUser = cashiers.find((c) => c.isMaster) || currentCashier;
    const adminPin = adminUser.pin;

    if (
      supervisorPin === adminPin ||
      (adminPin === '9999' && supervisorPin === '9999')
    ) {
      posAudio.playSuccessChime();
      setShowSupervisorModal(false);
      onLogAudit('unlock_supervisor', `Desbloqueo maestro autorizado por supervisor`);
      onUnlock(adminUser);
    } else {
      setSupervisorError(`Credencial no válida. (PIN del Administrador ${adminUser.name})`);
      posAudio.playErrorBuzz();
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0c1322] text-[#dce2f7] flex flex-col items-center justify-start pb-8">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-40 bg-[#191f2f]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.4)] border-b border-[#374151]/30">
        <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#232a3a] text-[#dce2f7]">
              <span className="material-symbols-outlined text-[20px] text-[#dc2626]">lock</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs uppercase tracking-wider font-semibold text-[#dce2f7]">POS-01</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#dc2626]/20 text-[#ef4444] font-mono text-[11px] font-semibold">
                  BLOQUEADO
                </span>
              </div>
              <span className="text-[11px] text-[#e6bdb8] font-medium">Bloqueo Terminal & Pin</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSound}
              title={soundEnabled ? 'Silenciar sonidos POS' : 'Activar sonidos POS'}
              className="p-1.5 rounded-lg bg-[#232a3a]/80 text-[#dce2f7]/70 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {soundEnabled ? 'volume_up' : 'volume_off'}
              </span>
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#232a3a]/80">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span className="font-mono text-[11px] text-[#e6bdb8]">SUPABASE OK</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#ffb4ab] flex items-center justify-center text-[#690005]">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md px-4 pt-20 flex flex-col relative z-10 space-y-3.5">
        {/* Ambient Security Glow Mesh */}
        <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#dc2626]/12 rounded-full blur-3xl"></div>

        {/* 1. Security Status & Telemetry */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dc2626]/20 text-[#ef4444] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span>
              </span>
              <span className="text-[11px] tracking-wide uppercase font-semibold">Terminal POS-01 Bloqueada</span>
            </div>
            <div className="flex items-center gap-1 text-[#e6bdb8] font-mono text-[12px]">
              <span className="material-symbols-outlined text-[15px] text-[#90cdff]">lock_clock</span>
              <span>{currentTime || '18:16:21 COT'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[#e6bdb8] bg-[#141b2b] px-2.5 py-1.5 rounded-lg border border-[#374151]/20">
            <div className="flex items-center gap-1.5 font-mono text-[12px]">
              <span className="material-symbols-outlined text-[15px] text-[#10b981]" style={{ fontVariationSettings: "'FILL' 1" }}>
                cloud_done
              </span>
              <span>Supabase SSL 256-bit</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
              <span>Térmica 58mm en reposo</span>
            </div>
          </div>

          {/* Contextual Notice */}
          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-[#191f2f] text-[#e6bdb8] border border-[#374151]/20">
            <span className="material-symbols-outlined text-[16px] text-[#ffdad6] mt-0.5">timer_pause</span>
            <p className="text-[12px] leading-tight text-[#e6bdb8]">
              Bloqueo por inactividad (3 min). Las transacciones en curso se mantuvieron en memoria segura.
            </p>
          </div>
        </div>

        {/* 2. Cashier Active Card + Quick Operator Switch */}
        <div className="relative bg-[#191f2f] p-3 rounded-xl shadow-md border border-[#374151]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Avatar with indicator */}
              <div className="relative w-12 h-12 rounded-xl bg-[#232a3a] overflow-hidden shadow-inner flex items-center justify-center border border-[#374151]/50">
                <img
                  src={currentCashier.avatar}
                  alt={currentCashier.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#10b981] ring-2 ring-[#191f2f]"></span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[17px] font-bold text-[#dce2f7] truncate">{currentCashier.name}</span>
                  <span className="font-mono text-[11px] text-[#90cdff] font-semibold px-1.5 py-0.5 rounded bg-[#0078b2]/25">
                    {currentCashier.code}
                  </span>
                </div>
                <span className="text-[11px] text-[#e6bdb8] truncate">{currentCashier.role}</span>
              </div>
            </div>

            {/* Operator switch button */}
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowSwitchPanel(!showSwitchPanel);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#232a3a] active:bg-[#323949] text-[#adc6ff] hover:text-[#e6ecff] transition-colors shadow-sm border border-[#374151]/30"
            >
              <span className="material-symbols-outlined text-[18px]">sync_alt</span>
              <span className="text-[11px] font-semibold">Cambiar</span>
            </button>
          </div>

          {/* Shift Metrics */}
          <div className="mt-2.5 pt-1.5 grid grid-cols-2 gap-2 bg-[#141b2b] p-2.5 rounded-lg font-mono text-[12px] border border-[#374151]/30">
            <div className="flex flex-col">
              <span className="text-[#e6bdb8] text-[11px] font-sans">Efectivo en Gaveta</span>
              <span className="text-[#10b981] font-semibold tracking-tight text-[13px]">
                {formatCOP(currentCashier.drawerCash)}
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[#e6bdb8] text-[11px] font-sans">Tickets de Turno</span>
              <span className="text-[#dce2f7] font-semibold text-[13px]">
                {currentCashier.completedTickets} completados
              </span>
            </div>
          </div>

          {/* Drawer to switch cashier */}
          {showSwitchPanel && (
            <div className="mt-2.5 pt-2 flex flex-col space-y-1.5 bg-[#070e1d] p-2.5 rounded-lg border border-[#374151]/50 animate-fadeIn">
              <span className="text-[11px] text-[#e6bdb8] uppercase tracking-wider font-semibold">
                Selecciona el operador de relevo:
              </span>
              {cashiers.map((cashier) => {
                const isActive = cashier.id === currentCashier.id;
                return (
                  <button
                    key={cashier.id}
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      onSwitchCashier(cashier);
                      setShowSwitchPanel(false);
                      setPin('');
                      setFeedbackStatus('normal');
                      setFeedback(`Operador cambiado a ${cashier.name}. Ingresa PIN.`);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-[#232a3a] border border-[#dc2626]/40'
                        : 'bg-[#191f2f] hover:bg-[#232a3a] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                          isActive
                            ? 'bg-[#ef4444]/20 text-[#ef4444]'
                            : cashier.isMaster
                            ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                            : 'bg-[#adc6ff]/20 text-[#adc6ff]'
                        }`}
                      >
                        {cashier.initials}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#dce2f7]">
                          {cashier.name} {isActive && '(Activo)'}
                        </span>
                        <span className="text-[11px] text-[#e6bdb8]">{cashier.role}</span>
                      </div>
                    </div>
                    {isActive ? (
                      <span className="material-symbols-outlined text-[#10b981] text-[18px]">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#e6bdb8] text-[18px]">
                        {cashier.isMaster ? 'shield_person' : 'lock'}
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setPin('');
                  setFeedbackStatus('normal');
                  setFeedback('Sesión de operador restablecida. Ingresa nuevo PIN.');
                  setShowSwitchPanel(false);
                }}
                className="w-full mt-1.5 py-1.5 px-2 rounded-lg bg-[#dc2626]/20 hover:bg-[#dc2626]/30 text-[#ef4444] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[#dc2626]/30"
              >
                <span className="material-symbols-outlined text-[15px]">logout</span>
                <span>Restablecer Entrada de PIN</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Secure PIN Indicator */}
        <div className="flex flex-col items-center justify-center py-1 space-y-1 text-center">
          <div className="flex items-center gap-1.5 text-[#e6bdb8]">
            <span className="material-symbols-outlined text-[18px] text-[#dc2626]">pin</span>
            <span className="text-[13px] font-medium">Ingresa tu PIN de 4 dígitos para reanudar</span>
          </div>

          {/* 4 PIN Dots */}
          <div className={`flex items-center gap-4 py-2 ${isShaking ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = idx < pin.length;
              const isSuccess = feedbackStatus === 'success';
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isSuccess
                      ? 'bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-110'
                      : isFilled
                      ? 'bg-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.7)] scale-110 pin-active-pulse'
                      : 'bg-[#2e3545]'
                  }`}
                />
              );
            })}
          </div>

          <p
            className={`text-[12px] font-mono transition-colors ${
              feedbackStatus === 'success'
                ? 'text-[#10b981] font-semibold'
                : feedbackStatus === 'error'
                ? 'text-[#ef4444] font-semibold'
                : feedbackStatus === 'verifying'
                ? 'text-[#90cdff]'
                : 'text-[#e6bdb8]'
            }`}
          >
            {feedback}
          </p>
        </div>

        {/* 4. POS Ergonomic Numeric Keypad (3x4) */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-sm mx-auto select-none">
          {[
            { num: '1', letters: '_' },
            { num: '2', letters: 'ABC' },
            { num: '3', letters: 'DEF' },
            { num: '4', letters: 'GHI' },
            { num: '5', letters: 'JKL' },
            { num: '6', letters: 'MNO' },
            { num: '7', letters: 'PQRS' },
            { num: '8', letters: 'TUV' },
            { num: '9', letters: 'WXYZ' },
          ].map(({ num, letters }) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKey(num)}
              className="h-14 rounded-xl bg-[#191f2f] hover:bg-[#232a3a] active:bg-[#dc2626] active:text-[#fff6f5] transition-colors flex flex-col items-center justify-center shadow-sm border border-[#374151]/40"
            >
              <span className="font-mono-display text-[26px] leading-none text-[#dce2f7]">{num}</span>
              <span className="text-[10px] text-[#e6bdb8] tracking-widest mt-0.5">{letters}</span>
            </button>
          ))}

          {/* NFC Quick Button replacing former fingerprint button */}
          <button
            type="button"
            onClick={handleOpenNfcModal}
            title="Lector de Tarjeta NFC"
            className="h-14 rounded-xl bg-[#232a3a] hover:bg-[#323949] active:bg-[#0078b2] active:text-[#e6ecff] transition-colors flex flex-col items-center justify-center text-[#90cdff] shadow-sm border border-[#374151]/40"
          >
            <span className="material-symbols-outlined text-[24px] text-[#90cdff]">contactless</span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-[#adc6ff]">NFC</span>
          </button>

          {/* 0 */}
          <button
            type="button"
            onClick={() => handleKey('0')}
            className="h-14 rounded-xl bg-[#191f2f] hover:bg-[#232a3a] active:bg-[#dc2626] active:text-[#fff6f5] transition-colors flex flex-col items-center justify-center shadow-sm border border-[#374151]/40"
          >
            <span className="font-mono-display text-[26px] leading-none text-[#dce2f7]">0</span>
            <span className="text-[10px] text-[#e6bdb8] tracking-widest mt-0.5">+</span>
          </button>

          {/* Backspace */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-[#232a3a] hover:bg-[#323949] active:bg-[#dc2626] active:text-[#fff6f5] transition-colors flex flex-col items-center justify-center text-[#e6bdb8] hover:text-[#dce2f7] shadow-sm border border-[#374151]/40"
          >
            <span className="material-symbols-outlined text-[24px]">backspace</span>
            <span className="text-[9px] uppercase tracking-wider text-[#e6bdb8]">Borrar</span>
          </button>
        </div>

        {/* 5. Alternative Unlock Options & Privileges */}
        <div className="flex flex-col space-y-2 pt-1">
          {/* Acceso Supervisor / Desbloqueo Maestro */}
          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowSupervisorModal(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#dc2626] text-[#fff6f5] hover:bg-[#ef4444] active:scale-[0.99] text-[13px] font-semibold tracking-wide uppercase transition-all shadow-md shadow-[#dc2626]/20"
          >
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
            <span>Acceso Supervisor / Desbloqueo Maestro</span>
          </button>

          {/* Secondary row: Pure NFC card authentication & emergency close */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenNfcModal}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#191f2f] text-[#dce2f7] hover:bg-[#232a3a] border border-[#374151]/30 transition-colors text-center group"
            >
              <span className="material-symbols-outlined text-[#10b981] group-hover:scale-110 transition-transform text-[18px]">
                contactless
              </span>
              <span className="text-[12px] font-medium">Lector Tarjeta NFC</span>
            </button>

            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onEmergencyShiftClose();
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#232a3a] text-[#e6bdb8] hover:text-[#ef4444] border border-[#374151]/30 transition-colors text-center"
            >
              <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">event_busy</span>
              <span className="text-[12px] font-medium">Cierre Urgente</span>
            </button>
          </div>
        </div>

        {/* Terminal Telemetry Footer */}
        <div className="flex items-center justify-between pt-1 text-[#e6bdb8] text-[11px] font-mono">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
            <span>Kev Nay Engine v4.2.1-prod</span>
          </div>
          <span>ID Caja: KNY-BOG-0104</span>
        </div>
      </main>

      {/* NFC Card Scanning & Authentication Modal */}
      {showNfcModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#191f2f] w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 border border-[#374151]/60">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#374151]/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0078b2]/20 flex items-center justify-center text-[#90cdff]">
                  <span className="material-symbols-outlined text-[22px]">contactless</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#dce2f7] leading-tight">Lector de Proximidad NFC</h3>
                  <span className="text-[11px] font-mono text-[#adc6ff]">ISO/IEC 14443 Type A • Mifare POS</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNfcModal(false);
                  setNfcFeedback(null);
                  setNfcError(null);
                  setDetectedOtherCashier(null);
                }}
                className="w-8 h-8 rounded-full bg-[#232a3a] flex items-center justify-center text-[#e6bdb8] hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Visual NFC Contactless Field Radar */}
            <div className="flex flex-col items-center justify-center py-3 bg-[#141b2b] rounded-xl border border-[#374151]/40 relative overflow-hidden">
              <div className="relative w-28 h-28 flex items-center justify-center my-1">
                {/* Rippling radio waves */}
                <span className="absolute inset-0 rounded-full border-2 border-[#10b981] animate-ping opacity-40"></span>
                <span className="absolute inset-2 rounded-full border border-[#90cdff]/60 animate-pulse"></span>
                <span className="absolute inset-6 rounded-full bg-[#0078b2]/15"></span>
                <div className="relative z-10 w-14 h-14 rounded-full bg-[#232a3a] flex items-center justify-center shadow-lg border border-[#374151]">
                  <span className="material-symbols-outlined text-[32px] text-[#10b981]">contactless</span>
                </div>
              </div>

              <span className="text-xs font-semibold text-[#dce2f7] mt-1">
                Acerca la tarjeta o credencial NFC al sensor
              </span>
              <span className="text-[11px] font-mono text-[#e6bdb8] mt-0.5">
                {webNfcSupported
                  ? '📡 Web NFC de hardware activo en este dispositivo'
                  : '💻 En escucha de lector USB/Bluetooth o emulación directa'}
              </span>
            </div>

            {/* Detected Other Cashier Prompt */}
            {detectedOtherCashier && (
              <div className="p-3 bg-[#232a3a] rounded-xl border border-[#adc6ff]/40 flex flex-col space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">person_outline</span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">Tarjeta de otro operador:</span>
                    <span className="text-[#adc6ff] block">{detectedOtherCashier.name} ({detectedOtherCashier.role})</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      onSwitchCashier(detectedOtherCashier);
                      setShowNfcModal(false);
                      setNfcFeedback(null);
                      setDetectedOtherCashier(null);
                      onUnlock(detectedOtherCashier);
                    }}
                    className="flex-1 py-2 px-2.5 rounded-lg bg-[#0078b2] hover:bg-[#0566d9] text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">login</span>
                    <span>Relevar a {detectedOtherCashier.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedOtherCashier(null);
                      setNfcFeedback(null);
                    }}
                    className="py-2 px-3 rounded-lg bg-[#141b2b] text-[#e6bdb8] hover:text-white text-xs"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Status alerts */}
            {nfcFeedback && !detectedOtherCashier && (
              <div className="p-2.5 rounded-lg bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] text-xs font-medium flex items-center gap-2 animate-fadeIn">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>{nfcFeedback}</span>
              </div>
            )}

            {nfcError && (
              <div className="p-2.5 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-xs font-medium flex items-center gap-2 animate-fadeIn">
                <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
                <span>{nfcError}</span>
              </div>
            )}

            {/* Quick Test Badges for instant demo and verification */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[11px] font-semibold text-[#e6bdb8] uppercase tracking-wider">
                Tarjetas registradas en el sistema (toca para simular pase):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {/* Active cashier card */}
                <button
                  type="button"
                  onClick={() => handleNfcCard(currentCashier.nfcCardId || 'NFC-KN-8842')}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#141b2b] hover:bg-[#232a3a] border border-[#10b981]/40 text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-[#10b981] text-[18px]">credit_card</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[#dce2f7] truncate">
                      {currentCashier.name} (Activo)
                    </span>
                    <span className="font-mono text-[9px] text-[#10b981]">
                      {currentCashier.nfcCardId || 'NFC-KN-8842'}
                    </span>
                  </div>
                </button>

                {/* Master card */}
                <button
                  type="button"
                  onClick={() => handleNfcCard('NFC-MASTER-0001')}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#141b2b] hover:bg-[#232a3a] border border-[#f59e0b]/40 text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">key</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[#dce2f7] truncate">
                      Llave Maestra Admin
                    </span>
                    <span className="font-mono text-[9px] text-[#f59e0b]">NFC-MASTER-0001</span>
                  </div>
                </button>

                {/* Other cashier card */}
                <button
                  type="button"
                  onClick={() => handleNfcCard('NFC-LG-5519')}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#141b2b] hover:bg-[#232a3a] border border-[#374151]/40 text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-[#90cdff] text-[18px]">badge</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-semibold text-[#dce2f7] truncate">Laura G. (Relevo)</span>
                    <span className="font-mono text-[9px] text-[#90cdff]">NFC-LG-5519</span>
                  </div>
                </button>

                {/* Unauthorized test card to prove security restriction */}
                <button
                  type="button"
                  onClick={() => handleNfcCard('NFC-DESCONOCIDA-99')}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#141b2b] hover:bg-[#232a3a] border border-[#dc2626]/40 text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-[#ef4444] text-[18px]">block</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-semibold text-[#ef4444] truncate">Tarjeta No Autorizada</span>
                    <span className="font-mono text-[9px] text-[#ef4444]/80">NFC-DESCONOCIDA</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Manual Card UID or USB Scanner Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleNfcCard(manualNfcInput);
              }}
              className="flex items-center gap-2 pt-1"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualNfcInput}
                  onChange={(e) => setManualNfcInput(e.target.value)}
                  placeholder="Escanear o ingresar UID (ej: NFC-KN-8842)"
                  className="w-full bg-[#141b2b] border border-[#374151] rounded-xl px-3 py-2 text-xs font-mono text-[#dce2f7] placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#90cdff]"
                />
              </div>
              <button
                type="submit"
                className="py-2 px-3 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#adc6ff] transition-colors border border-[#374151]/40"
              >
                Validar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Master Unlock Modal */}
      {showSupervisorModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#191f2f] w-full max-w-sm rounded-2xl p-4 shadow-2xl flex flex-col space-y-4 border border-[#374151]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[#ef4444]">shield</span>
                <span className="text-lg font-bold text-[#dce2f7]">Llave Maestra</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSupervisorModal(false);
                  setSupervisorError('');
                }}
                className="w-8 h-8 rounded-full bg-[#232a3a] flex items-center justify-center text-[#e6bdb8] hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#e6bdb8] leading-relaxed">
              Ingresa la credencial maestra de supervisor o administrador para desbloquear la terminal sin el PIN del cajero actual.
            </p>

            <form onSubmit={handleSupervisorAuthorize} className="flex flex-col space-y-2.5">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#070e1d] text-[#dce2f7] font-mono border border-[#374151]/50">
                <span className="material-symbols-outlined text-[#90cdff] text-[20px]">badge</span>
                <input
                  type="password"
                  value={supervisorPin}
                  onChange={(e) => {
                    setSupervisorPin(e.target.value);
                    setSupervisorError('');
                  }}
                  autoFocus
                  placeholder="PIN de Supervisor (ej: 9999 o 0000)"
                  className="bg-transparent border-none outline-none w-full text-[#dce2f7] placeholder-[#e6bdb8]/60 text-sm"
                />
              </div>

              {supervisorError && (
                <span className="text-[11px] text-[#ef4444] font-medium">{supervisorError}</span>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupervisorModal(false);
                    setSupervisorError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] text-[#dce2f7] text-xs font-semibold hover:bg-[#323949] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#dc2626] text-[#fff6f5] text-xs font-semibold hover:bg-[#ef4444] transition-colors"
                >
                  Autorizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
