import React, { useRef, useState } from 'react';
import { posAudio } from '../utils/audio';

export const CASHIER_AVATAR_PRESETS = [
  {
    id: 'avatar-1',
    label: 'Hombre Ejecutivo',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-2',
    label: 'Mujer Profesional 1',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-3',
    label: 'Mujer Ejecutiva',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-4',
    label: 'Mujer Sonriente',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-5',
    label: 'Hombre Casual',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-6',
    label: 'Hombre Joven',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-7',
    label: 'Mujer Profesional 2',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-8',
    label: 'Hombre Barba',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  },
];

interface CashierAvatarPickerProps {
  currentAvatar: string;
  onChangeAvatar: (newAvatarUrl: string) => void;
  cashierName?: string;
  themeColor?: 'sky' | 'amber' | 'red';
}

export const CashierAvatarPicker: React.FC<CashierAvatarPickerProps> = ({
  currentAvatar,
  onChangeAvatar,
  cashierName = 'Cajero',
  themeColor = 'sky',
}) => {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      posAudio.playErrorBuzz();
      setUploadError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    // Convert file to base64 Data URL so it works offline and persists
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        posAudio.playKeyClick();
        onChangeAvatar(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const ringColorClass =
    themeColor === 'amber'
      ? 'border-[#f59e0b] shadow-amber-500/20'
      : themeColor === 'red'
      ? 'border-[#dc2626] shadow-red-500/20'
      : 'border-[#0078b2] shadow-sky-500/20';

  return (
    <div className="bg-[#141b2b] border border-[#374151]/50 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-white flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[17px] text-[#90cdff]">photo_camera</span>
          <span>Foto de Perfil del Cajero</span>
        </label>
        <span className="text-[10px] text-[#e6bdb8] font-mono">
          Sube tu foto o elige un avatar
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Avatar Preview */}
        <div className="relative shrink-0">
          <div
            className={`w-16 h-16 rounded-2xl bg-[#232a3a] overflow-hidden border-2 shadow-lg flex items-center justify-center ${ringColorClass}`}
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={cashierName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                }}
              />
            ) : (
              <span className="material-symbols-outlined text-[32px] text-gray-400">person</span>
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#10b981] ring-2 ring-[#141b2b] flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[12px]">check</span>
          </span>
        </div>

        {/* Upload Button & URL input */}
        <div className="flex-1 space-y-2 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                fileInputRef.current?.click();
              }}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#374151]/60 transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#90cdff]">upload_file</span>
              <span>Subir Foto del Dispositivo</span>
            </button>

            {currentAvatar && (
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  onChangeAvatar(
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  );
                }}
                title="Restablecer avatar"
                className="p-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white border border-[#374151]/40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              </button>
            )}
          </div>

          {uploadError && (
            <p className="text-[11px] text-[#ef4444] font-medium">{uploadError}</p>
          )}

          <div className="relative">
            <input
              type="text"
              value={currentAvatar.startsWith('data:') ? 'Foto personalizada cargada (base64)' : currentAvatar}
              onChange={(e) => {
                if (!e.target.value.startsWith('Foto personalizada')) {
                  onChangeAvatar(e.target.value);
                }
              }}
              placeholder="O pega aquí el enlace URL de la foto..."
              className="w-full bg-[#0c1322] border border-[#374151]/60 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#0078b2]"
            />
          </div>
        </div>
      </div>

      {/* Preset Avatars Selection */}
      <div className="pt-2 border-t border-[#374151]/30">
        <span className="text-[10px] text-[#e6bdb8] block mb-1.5 font-medium">
          O selecciona un avatar predeterminado rápido:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CASHIER_AVATAR_PRESETS.map((preset) => {
            const isSelected = currentAvatar === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  onChangeAvatar(preset.url);
                }}
                title={preset.label}
                className={`relative w-8 h-8 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#10b981] scale-110 shadow-md ring-2 ring-[#10b981]/50'
                    : 'border-[#374151]/50 hover:border-gray-300 opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={preset.url}
                  alt={preset.label}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
