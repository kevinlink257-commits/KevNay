import React, { useState, useEffect, useRef, useCallback } from 'react';
import { posAudio } from '../utils/audio';

interface BarcodeCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => void;
  title?: string;
  description?: string;
  sampleCodes?: Array<{ label: string; code: string }>;
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Lector de Código de Barras / Guías',
  description = 'Apunta la cámara al código de barras, guía de envío o código QR',
  sampleCodes,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Handle successful scan
  const handleSuccessScan = useCallback(
    (code: string) => {
      posAudio.playScanBeep();
      setScannedFeedback(code);
      setTimeout(() => {
        stopCamera();
        onScan(code.trim());
      }, 500);
    },
    [onScan, stopCamera]
  );

  // Start real camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScannedFeedback(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador o dispositivo no soporta acceso a cámara WebRTC.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        // Check if browser has native BarcodeDetector API
        const windowWithDetector = window as unknown as {
          BarcodeDetector?: new (options?: { formats: string[] }) => {
            detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
          };
        };

        if (windowWithDetector.BarcodeDetector) {
          try {
            const detector = new windowWithDetector.BarcodeDetector({
              formats: [
                'code_128',
                'ean_13',
                'ean_8',
                'qr_code',
                'upc_a',
                'upc_e',
                'code_39',
                'data_matrix',
              ],
            });

            // Start optical polling loop
            scanIntervalRef.current = setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0) {
                    const found = barcodes[0].rawValue;
                    if (found) {
                      clearInterval(scanIntervalRef.current!);
                      handleSuccessScan(found);
                    }
                  }
                } catch {
                  // Frame capture error failsafe
                }
              }
            }, 300);
          } catch {
            // Barcode detector initialization fallback
          }
        }
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Puedes habilitar el permiso en la barra del navegador o ingresar el código manualmente abajo.'
            : err.message
          : 'No se pudo iniciar la cámara.';
      setCameraError(errorMsg);
      setCameraActive(false);
    }
  }, [facingMode, handleSuccessScan, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Flip between front and rear cameras
  const toggleFacingMode = () => {
    posAudio.playKeyClick();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessScan(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-4 sm:p-5 w-full max-w-md flex flex-col space-y-3.5 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#dc2626]/20 text-[#ef4444] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
              <p className="text-[11px] text-[#e6bdb8] truncate">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Video / Camera Viewport Window */}
        <div className="relative w-full h-56 sm:h-64 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-[#374151]/60">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Scanner Overlay HUD */}
          {cameraActive && !scannedFeedback && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              {/* Animated Laser Scan Line */}
              <div className="w-full h-0.5 bg-[#ef4444] shadow-[0_0_14px_#ef4444] animate-pulse"></div>

              {/* Target Aim Reticle */}
              <div className="absolute inset-x-8 inset-y-8 border-2 border-dashed border-[#10b981]/70 rounded-xl flex items-center justify-center">
                <span className="text-[10px] text-white/80 font-mono bg-black/60 px-2 py-0.5 rounded">
                  Centra el código o guía
                </span>
              </div>
            </div>
          )}

          {/* Success Scanned Indicator */}
          {scannedFeedback && (
            <div className="absolute inset-0 bg-[#10b981]/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center animate-fadeIn">
              <span className="material-symbols-outlined text-[48px] text-white animate-bounce">
                check_circle
              </span>
              <p className="text-sm font-bold text-white mt-2">¡Código Detectado!</p>
              <span className="font-mono text-xs bg-black/60 px-2.5 py-1 rounded-md text-white mt-1">
                {scannedFeedback}
              </span>
            </div>
          )}

          {/* Fallback Viewport if Camera is not started or errored */}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2">
              <span className="material-symbols-outlined text-[36px] text-[#e6bdb8]/50">
                videocam_off
              </span>
              <p className="text-xs text-[#e6bdb8] max-w-xs">
                {cameraError || 'Iniciando cámara del dispositivo...'}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#90cdff] border border-[#374151]/50 flex items-center gap-1 mt-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Reintentar Encender Cámara</span>
              </button>
            </div>
          )}

          {/* Floating Camera Controls */}
          {cameraActive && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={toggleFacingMode}
                title="Cambiar Cámara Frontal / Trasera"
                className="w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">cameraswitch</span>
              </button>
            </div>
          )}
        </div>

        {/* Manual Code Input Form */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-[#e6bdb8] flex items-center justify-between">
              <span>Ingreso manual de código o guía:</span>
              <span className="text-[10px] text-[#90cdff] font-mono">EAN-13 • Guía • SKU</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ej: 770209001011 o GUIA-SRV-901842"
                className="flex-1 bg-[#070e1d] border border-[#374151]/50 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#dc2626]"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-40 text-xs font-bold text-white transition-all shadow-md"
              >
                Ingresar
              </button>
            </div>
          </div>

          {/* Quick sample buttons for fast testing */}
          {sampleCodes && sampleCodes.length > 0 && (
            <div className="pt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-[#e6bdb8] w-full">Códigos de muestra para prueba rápida:</span>
              {sampleCodes.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleSuccessScan(item.code);
                  }}
                  className="px-2 py-1 rounded bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] text-[10px] font-mono border border-[#374151]/40 transition-colors"
                >
                  {item.label}: <strong className="text-white">{item.code}</strong>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-[#374151]/30">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
            >
              Cerrar Escáner
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
