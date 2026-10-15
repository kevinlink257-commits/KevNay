import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cashier, AuditEvent } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';
import {
  LockScreenImage,
  getStoredLockScreenImages,
  saveStoredLockScreenImages,
  resetLockScreenImagesToDefault,
  getStoredDimmerLevel,
  saveStoredDimmerLevel,
  getStoredSlideInterval,
  saveStoredSlideInterval,
} from '../utils/lockScreenImages';
import { LockScreenGalleryModal } from './LockScreenGalleryModal';

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
  // PIN and terminal states
  const [pin, setPin] = useState<string>('741'); // Prefilled with 3 digits for quick unlocking demonstration
  const [feedback, setFeedback] = useState<string>('Esperando último dígito...');
  const [feedbackStatus, setFeedbackStatus] = useState<'normal' | 'verifying' | 'success' | 'error'>('normal');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [showSwitchPanel, setShowSwitchPanel] = useState<boolean>(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState<boolean>(false);
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [supervisorError, setSupervisorError] = useState<string>('');

  // Accessory store images gallery states
  const [images, setImages] = useState<LockScreenImage[]>(() => getStoredLockScreenImages());
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [dimmerLevel, setDimmerLevel] = useState<'low' | 'medium' | 'high'>(() => getStoredDimmerLevel());
  const [slideInterval, setSlideInterval] = useState<number>(() => getStoredSlideInterval());
  const [isSlidePlaying, setIsSlidePlaying] = useState<boolean>(true);
  const [showGalleryModal, setShowGalleryModal] = useState<boolean>(false);
  const [isVitrinaCleanMode, setIsVitrinaCleanMode] = useState<boolean>(false);
  const [lockToast, setLockToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // NFC states
  const [showNfcModal, setShowNfcModal] = useState<boolean>(false);
  const [nfcFeedback, setNfcFeedback] = useState<string | null>(null);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [detectedOtherCashier, setDetectedOtherCashier] = useState<Cashier | null>(null);
  const [manualNfcInput, setManualNfcInput] = useState<string>('');
  const [webNfcSupported, setWebNfcSupported] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Slideshow timer
  useEffect(() => {
    if (!isSlidePlaying || slideInterval <= 0 || images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, slideInterval * 1000);

    return () => clearInterval(timer);
  }, [isSlidePlaying, slideInterval, images.length]);

  // Live COT clock and formatted date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds} COT`);

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };
      const formattedDate = now.toLocaleDateString('es-ES', options);
      setCurrentDateStr(formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web NFC detector
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setWebNfcSupported(true);
    }
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (lockToast) {
      const timer = setTimeout(() => {
        setLockToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [lockToast]);

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'info') => {
    setLockToast({ message, type });
  }, []);

  // Slideshow navigation
  const handleNextImage = () => {
    posAudio.playKeyClick();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    posAudio.playKeyClick();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Direct reset to default images
  const handleQuickResetDefaults = () => {
    posAudio.playSuccessChime();
    const restored = resetLockScreenImagesToDefault();
    saveStoredLockScreenImages(restored);
    setImages(restored);
    setCurrentImageIndex(0);
    showToast('✨ Imágenes de vitrina y accesorios restablecidas por defecto', 'success');
  };

  // Strict NFC Card Authentication Handler
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

      // Check 4: Unknown / Unauthorized card
      posAudio.playErrorBuzz();
      setNfcError(`❌ Tarjeta NFC "${cleanId}" no registrada o sin permisos.`);
      onLogAudit('failed_pin', `Intento de acceso denegado con tarjeta NFC no autorizada ${cleanId}`);
    },
    [currentCashier, cashiers, onUnlock, onLogAudit]
  );

  // Web NFC hardware listener
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
        ndef.scan({ signal: ndefController.signal }).catch(() => {});
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
        const isValid = inputPin === currentCashier.pin || inputPin === adminPin;

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSupervisorModal || showNfcModal || showGalleryModal) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
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

    if (supervisorPin === adminPin || (adminPin === '9999' && supervisorPin === '9999')) {
      posAudio.playSuccessChime();
      setShowSupervisorModal(false);
      onLogAudit('unlock_supervisor', `Desbloqueo maestro autorizado por supervisor`);
      onUnlock(adminUser);
    } else {
      setSupervisorError(`Credencial no válida. (PIN del Administrador ${adminUser.name})`);
      posAudio.playErrorBuzz();
    }
  };

  const currentImage = images[currentImageIndex] || images[0];

  // Overlay opacity class based on dimmer level
  const dimmerOverlayClass =
    dimmerLevel === 'low'
      ? 'bg-black/45'
      : dimmerLevel === 'high'
      ? 'bg-black/78 backdrop-blur-[1px]'
      : 'bg-black/62';

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden flex flex-col justify-between select-none bg-[#070e1d]">
      {/* 1. DYNAMIC ACCESSORY STORE BACKGROUND IMAGE WITH SMOOTH TRANSITION */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {images.map((img, idx) => {
          const isVisible = idx === currentImageIndex;
          return (
            <div
              key={img.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}
              style={{
                backgroundImage: `url(${img.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transition: 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1), transform 8s ease-out',
              }}
            />
          );
        })}

        {/* Ambient Overlay to balance store scenery and POS readability */}
        <div className={`absolute inset-0 ${dimmerOverlayClass} transition-colors duration-500`} />
        {/* Subtle Vignette Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070e1d] via-transparent to-[#070e1d]/80 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* 2. TOP BAR: Store Branding, Gallery Controls & Clock */}
      <header className="relative z-20 w-full px-3 sm:px-6 pt-3 sm:pt-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 bg-[#121927]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-3 sm:px-5 py-2.5 shadow-2xl">
          {/* Left Store & Terminal Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#dc2626] to-[#f59e0b] flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-[20px]">diamond</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm tracking-tight text-white uppercase">
                  Kev Nay Accesorios
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#dc2626]/30 text-[#ff7171] border border-[#dc2626]/40 font-mono text-[10px] font-bold">
                  POS-01
                </span>
              </div>
              <span className="text-[10px] text-[#e6bdb8] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                <span>Boutique de Accesorios & Joyería</span>
              </span>
            </div>
          </div>

          {/* Center: Image Title & Carousel Quick Controls */}
          <div className="hidden md:flex items-center gap-2 bg-[#0c1322]/70 px-3 py-1.5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={handlePrevImage}
              title="Foto anterior"
              className="w-7 h-7 rounded-lg bg-[#232a3a]/80 hover:bg-[#323949] text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            <div className="flex flex-col items-center px-1 min-w-[200px] text-center">
              <span className="text-xs font-semibold text-white truncate max-w-[220px]">
                {currentImage?.title || 'Vitrina de Accesorios'}
              </span>
              <span className="text-[10px] text-[#adc6ff] font-mono">
                {currentImageIndex + 1} de {images.length} • {currentImage?.category || 'Tienda'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextImage}
              title="Siguiente foto"
              className="w-7 h-7 rounded-lg bg-[#232a3a]/80 hover:bg-[#323949] text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>

            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setIsSlidePlaying(!isSlidePlaying);
              }}
              title={isSlidePlaying ? 'Pausar carrusel automático' : 'Reanudar carrusel automático'}
              className="w-7 h-7 rounded-lg bg-[#232a3a]/80 hover:bg-[#323949] text-[#adc6ff] flex items-center justify-center transition-colors ml-1"
            >
              <span className="material-symbols-outlined text-[15px]">
                {isSlidePlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
          </div>

          {/* Right: Actions, Gallery Manager Modal, Reset Button, Sound & Clock */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Open Gallery Manager Button */}
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowGalleryModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#ef4444] hover:to-[#dc2626] text-white text-xs font-bold transition-all shadow-md shadow-red-950/40 border border-red-400/30"
              title="Subir imágenes desde mi galería o cambiar fondos"
            >
              <span className="material-symbols-outlined text-[17px]">photo_library</span>
              <span className="hidden sm:inline">Mi Galería / Fondos</span>
            </button>

            {/* Quick Reset Defaults Button */}
            <button
              type="button"
              onClick={handleQuickResetDefaults}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#232a3a]/90 hover:bg-[#323949] text-[#f59e0b] hover:text-amber-300 text-xs font-semibold transition-colors border border-[#f59e0b]/30"
              title="Restablecer imágenes por defecto del local de accesorios"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span className="hidden md:inline">Por Defecto</span>
            </button>

            {/* Clean Showcase Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setIsVitrinaCleanMode(!isVitrinaCleanMode);
              }}
              className={`p-1.5 rounded-xl transition-colors border ${
                isVitrinaCleanMode
                  ? 'bg-[#10b981] text-white border-emerald-400'
                  : 'bg-[#232a3a]/90 text-[#e6bdb8] hover:text-white border-white/10'
              }`}
              title={isVitrinaCleanMode ? 'Mostrar teclado PIN' : 'Modo vitrina limpia (ocultar teclado)'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isVitrinaCleanMode ? 'dialpad' : 'visibility'}
              </span>
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              title={soundEnabled ? 'Silenciar sonidos POS' : 'Activar sonidos POS'}
              className="p-1.5 rounded-xl bg-[#232a3a]/90 text-[#e6bdb8] hover:text-white transition-colors border border-white/10"
            >
              <span className="material-symbols-outlined text-[18px]">
                {soundEnabled ? 'volume_up' : 'volume_off'}
              </span>
            </button>

            {/* Time Badge */}
            <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0c1322]/80 border border-white/10 text-[#e6bdb8] font-mono text-[11px]">
              <span className="material-symbols-outlined text-[14px] text-[#90cdff]">schedule</span>
              <span>{currentTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 3. CENTER CONTENT: PIN Terminal Card OR Full Vitrina Mode */}
      <main className="relative z-10 w-full flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6">
        {isVitrinaCleanMode ? (
          /* Clean Showcase View: Maximizes view of the accessory store images */
          <div
            onClick={() => setIsVitrinaCleanMode(false)}
            className="flex flex-col items-center justify-center text-center p-6 sm:p-10 rounded-3xl bg-[#070e1d]/70 backdrop-blur-md border border-white/15 shadow-2xl cursor-pointer max-w-lg animate-fadeIn group hover:border-[#ef4444]/60 transition-all"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#dc2626]/20 text-[#ef4444] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner">
              <span className="material-symbols-outlined text-[36px]">storefront</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
              {currentImage?.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#e6bdb8] mb-4">
              {currentDateStr} • {currentTime}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#dc2626] text-white text-xs font-bold shadow-lg shadow-red-950/50">
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>Tocar para ingresar PIN de desbloqueo</span>
            </div>
            <span className="text-[11px] text-[#adc6ff] mt-3">
              Cajero en turno: <strong>{currentCashier.name}</strong> ({currentCashier.role})
            </span>
          </div>
        ) : (
          /* Sleek Glassmorphic PIN Unlock Card */
          <div className="w-full max-w-[410px] bg-[#121927]/90 backdrop-blur-2xl rounded-3xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/15 flex flex-col space-y-3 relative animate-fadeIn">
            {/* Ambient Red Glow Behind Pad */}
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#dc2626]/20 rounded-full blur-3xl" />

            {/* Lock Status Header */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dc2626]/25 text-[#ff8080] border border-[#dc2626]/40">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span>
                </span>
                <span className="text-[10px] tracking-wide uppercase font-bold">Terminal en Bloqueo</span>
              </div>

              <div className="flex items-center gap-1 text-[#e6bdb8] font-mono text-[11px]">
                <span className="material-symbols-outlined text-[14px] text-[#90cdff]">lock_clock</span>
                <span>{currentTime || 'COT'}</span>
              </div>
            </div>

            {/* Cashier Badge Card + Switch Operator */}
            <div className="relative bg-[#192235]/90 p-2.5 rounded-2xl border border-white/10 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-11 h-11 rounded-xl bg-[#232a3a] overflow-hidden shadow-inner flex items-center justify-center border border-white/10">
                    <img
                      src={currentCashier.avatar}
                      alt={currentCashier.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10b981] ring-2 ring-[#192235]"></span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold text-white truncate">{currentCashier.name}</span>
                      <span className="font-mono text-[10px] text-[#90cdff] font-semibold px-1.5 py-0.2 rounded bg-[#0078b2]/30 border border-[#0078b2]/40">
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
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] hover:text-white transition-colors border border-white/10 text-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                  <span>Cambiar</span>
                </button>
              </div>

              {/* Drawer Cash & Ticket Metrics */}
              <div className="mt-2 pt-1.5 grid grid-cols-2 gap-2 bg-[#0c1322]/80 p-2 rounded-xl font-mono text-[11px] border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[#e6bdb8] text-[10px] font-sans">Efectivo en Gaveta</span>
                  <span className="text-[#10b981] font-bold text-[12px]">
                    {formatCOP(currentCashier.drawerCash)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[#e6bdb8] text-[10px] font-sans">Turno Activo</span>
                  <span className="text-white font-semibold text-[12px]">
                    {currentCashier.completedTickets} tickets
                  </span>
                </div>
              </div>

              {/* Switch cashier drawer */}
              {showSwitchPanel && (
                <div className="mt-2 pt-2 flex flex-col space-y-1 bg-[#0c1322] p-2 rounded-xl border border-white/10 animate-fadeIn">
                  <span className="text-[10px] text-[#e6bdb8] uppercase tracking-wider font-bold mb-1">
                    Selecciona operador de relevo:
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
                        className={`flex items-center justify-between p-1.5 rounded-lg text-left transition-colors ${
                          isActive
                            ? 'bg-[#232a3a] border border-[#dc2626]/50'
                            : 'bg-[#192235]/60 hover:bg-[#232a3a] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                              isActive
                                ? 'bg-[#ef4444]/25 text-[#ef4444]'
                                : cashier.isMaster
                                ? 'bg-[#f59e0b]/25 text-[#f59e0b]'
                                : 'bg-[#adc6ff]/25 text-[#adc6ff]'
                            }`}
                          >
                            {cashier.initials}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {cashier.name} {isActive && '(Activo)'}
                          </span>
                        </div>
                        {isActive ? (
                          <span className="material-symbols-outlined text-[#10b981] text-[16px]">check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined text-[#e6bdb8] text-[16px]">lock</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PIN Indicator Dots */}
            <div className="flex flex-col items-center justify-center pt-0.5 space-y-1 text-center">
              <span className="text-xs font-medium text-[#e6bdb8]">
                Ingresa tu PIN de 4 dígitos para reanudar
              </span>

              {/* 4 PIN Dots */}
              <div className={`flex items-center gap-3.5 py-1.5 ${isShaking ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = idx < pin.length;
                  const isSuccess = feedbackStatus === 'success';
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                        isSuccess
                          ? 'bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.9)] scale-110'
                          : isFilled
                          ? 'bg-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-110 pin-active-pulse'
                          : 'bg-[#2e3545] border border-white/10'
                      }`}
                    />
                  );
                })}
              </div>

              <p
                className={`text-[11px] font-mono transition-colors ${
                  feedbackStatus === 'success'
                    ? 'text-[#10b981] font-bold'
                    : feedbackStatus === 'error'
                    ? 'text-[#ef4444] font-bold'
                    : feedbackStatus === 'verifying'
                    ? 'text-[#90cdff]'
                    : 'text-[#e6bdb8]'
                }`}
              >
                {feedback}
              </p>
            </div>

            {/* 3x4 POS Keypad */}
            <div className="grid grid-cols-3 gap-1.5 w-full select-none">
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
                  className="h-12 rounded-xl bg-[#192235]/90 hover:bg-[#232e45] active:bg-[#dc2626] active:text-white transition-colors flex flex-col items-center justify-center shadow-sm border border-white/10"
                >
                  <span className="font-mono-display text-[22px] leading-none text-white font-bold">{num}</span>
                  <span className="text-[9px] text-[#e6bdb8] tracking-widest mt-0.5">{letters}</span>
                </button>
              ))}

              {/* NFC Quick Button */}
              <button
                type="button"
                onClick={handleOpenNfcModal}
                title="Lector de Tarjeta NFC"
                className="h-12 rounded-xl bg-[#232a3a] hover:bg-[#323949] active:bg-[#0078b2] text-[#90cdff] transition-colors flex flex-col items-center justify-center shadow-sm border border-white/10"
              >
                <span className="material-symbols-outlined text-[20px] text-[#90cdff]">contactless</span>
                <span className="text-[8px] uppercase tracking-wider font-bold text-[#adc6ff]">NFC</span>
              </button>

              {/* 0 */}
              <button
                type="button"
                onClick={() => handleKey('0')}
                className="h-12 rounded-xl bg-[#192235]/90 hover:bg-[#232e45] active:bg-[#dc2626] active:text-white transition-colors flex flex-col items-center justify-center shadow-sm border border-white/10"
              >
                <span className="font-mono-display text-[22px] leading-none text-white font-bold">0</span>
                <span className="text-[9px] text-[#e6bdb8] tracking-widest mt-0.5">+</span>
              </button>

              {/* Backspace */}
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-[#232a3a] hover:bg-[#323949] active:bg-[#dc2626] text-[#e6bdb8] hover:text-white transition-colors flex flex-col items-center justify-center shadow-sm border border-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">backspace</span>
                <span className="text-[8px] uppercase tracking-wider text-[#e6bdb8]">Borrar</span>
              </button>
            </div>

            {/* Bottom Actions: Supervisor Master, NFC & Emergency Shift Close */}
            <div className="flex flex-col space-y-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setShowSupervisorModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-red-950/40"
              >
                <span className="material-symbols-outlined text-[17px]">admin_panel_settings</span>
                <span>Acceso Supervisor / Llave Maestra</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenNfcModal}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[#192235]/90 text-white hover:bg-[#232a3a] border border-white/10 transition-colors text-xs font-medium"
                >
                  <span className="material-symbols-outlined text-[#10b981] text-[16px]">contactless</span>
                  <span>Tarjeta NFC</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    posAudio.playKeyClick();
                    onEmergencyShiftClose();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[#232a3a] text-[#e6bdb8] hover:text-[#ef4444] border border-white/10 transition-colors text-xs font-medium"
                >
                  <span className="material-symbols-outlined text-[#f59e0b] text-[16px]">event_busy</span>
                  <span>Cierre Urgente</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. BOTTOM BAR: Gallery Thumbnail Dots & Store Indicator */}
      <footer className="relative z-20 w-full px-4 py-2 bg-gradient-to-t from-[#070e1d] via-[#070e1d]/80 to-transparent">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Image Dots & Title */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
            <span className="text-[11px] text-[#e6bdb8] font-medium hidden sm:inline">
              Galería Tienda:
            </span>
            <div className="flex items-center gap-1.5">
              {images.map((img, idx) => {
                const isActive = idx === currentImageIndex;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      posAudio.playKeyClick();
                      setCurrentImageIndex(idx);
                    }}
                    title={img.title}
                    className={`transition-all rounded-full flex items-center justify-center ${
                      isActive
                        ? 'w-7 h-3 bg-[#dc2626] ring-2 ring-red-400/50'
                        : 'w-3 h-3 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-[#adc6ff] font-medium truncate max-w-[200px]">
              {currentImage?.title}
            </span>
          </div>

          {/* Quick info and Gallery shortcut */}
          <div className="flex items-center gap-3 text-[11px] text-[#e6bdb8] font-mono">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setShowGalleryModal(true);
              }}
              className="text-[#adc6ff] hover:text-white underline flex items-center gap-1 font-sans font-semibold"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              <span>Cambiar Fotos del Local</span>
            </button>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Kev Nay Retail Engine v4.3</span>
          </div>
        </div>
      </footer>

      {/* 5. FLOATING LOCKSCREEN TOAST NOTIFICATION */}
      {lockToast && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold backdrop-blur-xl border ${
              lockToast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
                : 'bg-[#192235]/95 text-white border-white/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-[#10b981]">check_circle</span>
            <span>{lockToast.message}</span>
          </div>
        </div>
      )}

      {/* 6. GALLERY & CUSTOMIZATION MODAL */}
      <LockScreenGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        images={images}
        currentIndex={currentImageIndex}
        onImagesChange={(newImages, newIndex) => {
          setImages(newImages);
          if (typeof newIndex === 'number') {
            setCurrentImageIndex(newIndex);
          }
        }}
        dimmerLevel={dimmerLevel}
        onDimmerChange={(level) => setDimmerLevel(level)}
        slideInterval={slideInterval}
        onIntervalChange={(sec) => setSlideInterval(sec)}
        onShowToast={showToast}
      />

      {/* 7. NFC MODAL */}
      {showNfcModal && (
        <div className="fixed inset-0 z-50 bg-[#070e1d]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#141b2b] w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 border border-[#374151]/70 text-[#dce2f7]">
            <div className="flex items-center justify-between border-b border-[#374151]/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0078b2]/20 flex items-center justify-center text-[#90cdff]">
                  <span className="material-symbols-outlined text-[22px]">contactless</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Lector de Proximidad NFC</h3>
                  <span className="text-[11px] font-mono text-[#adc6ff]">ISO/IEC 14443 • Mifare POS Retail</span>
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

            <div className="flex flex-col items-center justify-center py-3 bg-[#0c1322] rounded-xl border border-[#374151]/40 relative overflow-hidden">
              <div className="relative w-24 h-24 flex items-center justify-center my-1">
                <span className="absolute inset-0 rounded-full border-2 border-[#10b981] animate-ping opacity-40"></span>
                <span className="absolute inset-2 rounded-full border border-[#90cdff]/60 animate-pulse"></span>
                <div className="relative z-10 w-12 h-12 rounded-full bg-[#232a3a] flex items-center justify-center shadow-lg border border-[#374151]">
                  <span className="material-symbols-outlined text-[28px] text-[#10b981]">contactless</span>
                </div>
              </div>

              <span className="text-xs font-semibold text-white mt-1">
                Acerca la tarjeta o credencial NFC al sensor
              </span>
              <span className="text-[10px] font-mono text-[#e6bdb8] mt-0.5">
                {webNfcSupported ? '📡 Web NFC de hardware activo' : '💻 En escucha de emulación o lector USB'}
              </span>
            </div>

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

            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-semibold text-[#e6bdb8] uppercase tracking-wider">
                Tarjetas registradas en el sistema (toca para simular):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNfcCard(currentCashier.nfcCardId || 'NFC-KN-8842')}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#0c1322] hover:bg-[#232a3a] border border-[#10b981]/40 text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-[#10b981] text-[18px]">credit_card</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-white truncate">
                      {currentCashier.name} (Activo)
                    </span>
                    <span className="font-mono text-[9px] text-[#10b981]">
                      {currentCashier.nfcCardId || 'NFC-KN-8842'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNfcCard('NFC-MASTER-0001')}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#0c1322] hover:bg-[#232a3a] border border-[#f59e0b]/40 text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">key</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-white truncate">Llave Maestra</span>
                    <span className="font-mono text-[9px] text-[#f59e0b]">NFC-MASTER-0001</span>
                  </div>
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleNfcCard(manualNfcInput);
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={manualNfcInput}
                onChange={(e) => setManualNfcInput(e.target.value)}
                placeholder="Escanear o ingresar UID (ej: NFC-KN-8842)"
                className="w-full bg-[#0c1322] border border-[#374151] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#90cdff]"
              />
              <button
                type="submit"
                className="py-2 px-3 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#adc6ff] transition-colors border border-[#374151]"
              >
                Validar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. SUPERVISOR MASTER UNLOCK MODAL */}
      {showSupervisorModal && (
        <div className="fixed inset-0 z-50 bg-[#070e1d]/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#141b2b] w-full max-w-sm rounded-2xl p-4 shadow-2xl flex flex-col space-y-3.5 border border-[#374151]/70 text-[#dce2f7]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[#ef4444]">shield</span>
                <span className="text-base font-bold text-white">Llave Maestra Admin</span>
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
              Ingresa el PIN de Administrador (por defecto 9999) para desbloquear la terminal sin el PIN del operador.
            </p>

            <form onSubmit={handleSupervisorAuthorize} className="flex flex-col space-y-2.5">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0c1322] text-white font-mono border border-[#374151]/60">
                <span className="material-symbols-outlined text-[#90cdff] text-[18px]">key</span>
                <input
                  type="password"
                  value={supervisorPin}
                  onChange={(e) => {
                    setSupervisorPin(e.target.value);
                    setSupervisorError('');
                  }}
                  autoFocus
                  placeholder="PIN Maestro (ej: 9999)"
                  className="bg-transparent border-none outline-none w-full text-white placeholder-[#e6bdb8]/50 text-sm"
                />
              </div>

              {supervisorError && (
                <span className="text-[11px] text-[#ef4444] font-medium">{supervisorError}</span>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupervisorModal(false);
                    setSupervisorError('');
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#232a3a] text-white text-xs font-semibold hover:bg-[#323949] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#dc2626] text-white text-xs font-semibold hover:bg-[#ef4444] transition-colors shadow"
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
