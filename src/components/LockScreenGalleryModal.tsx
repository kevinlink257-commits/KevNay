import React, { useState, useRef } from 'react';
import {
  LockScreenImage,
  DEFAULT_ACCESSORY_STORE_IMAGES,
  compressAndReadFile,
  saveStoredLockScreenImages,
  resetLockScreenImagesToDefault,
  saveStoredDimmerLevel,
  saveStoredSlideInterval,
} from '../utils/lockScreenImages';
import { posAudio } from '../utils/audio';

interface LockScreenGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: LockScreenImage[];
  currentIndex: number;
  onImagesChange: (newImages: LockScreenImage[], newActiveIndex?: number) => void;
  dimmerLevel: 'low' | 'medium' | 'high';
  onDimmerChange: (dimmer: 'low' | 'medium' | 'high') => void;
  slideInterval: number;
  onIntervalChange: (sec: number) => void;
  onShowToast: (message: string, type?: 'success' | 'info') => void;
}

export const LockScreenGalleryModal: React.FC<LockScreenGalleryModalProps> = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  onImagesChange,
  dimmerLevel,
  onDimmerChange,
  slideInterval,
  onIntervalChange,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'settings'>('gallery');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [urlTitleInput, setUrlTitleInput] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle file upload from user device gallery
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const newImagesToAdd: LockScreenImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          continue;
        }

        const dataUrl = await compressAndReadFile(file);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        const cleanTitle = nameWithoutExt
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        newImagesToAdd.push({
          id: `custom-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title: cleanTitle || 'Foto de Local de Accesorios',
          category: 'Mi Galería',
          url: dataUrl,
          isDefault: false,
          addedAt: Date.now(),
        });
      }

      if (newImagesToAdd.length === 0) {
        setUploadError('No se encontraron imágenes válidas en la selección.');
        setIsUploading(false);
        return;
      }

      const updated = [...newImagesToAdd, ...images];
      saveStoredLockScreenImages(updated);
      onImagesChange(updated, 0); // Switch to the first newly added image
      posAudio.playCashRegisterChime();
      onShowToast(`✓ ${newImagesToAdd.length} imagen(es) de tu galería agregada(s) con éxito`, 'success');
      setActiveTab('gallery');
    } catch (err) {
      console.error(err);
      setUploadError('Ocurrió un error al procesar las imágenes de tu galería.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle adding via image URL
  const handleAddViaUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    try {
      new URL(urlInput.trim());
    } catch {
      setUploadError('Por favor ingresa una URL válida (http o https).');
      return;
    }

    const newImg: LockScreenImage = {
      id: `url-${Date.now()}`,
      title: urlTitleInput.trim() || 'Accesorio / Boutique',
      category: 'Enlace Web',
      url: urlInput.trim(),
      isDefault: false,
      addedAt: Date.now(),
    };

    const updated = [newImg, ...images];
    saveStoredLockScreenImages(updated);
    onImagesChange(updated, 0);
    posAudio.playSuccessChime();
    setUrlInput('');
    setUrlTitleInput('');
    setPreviewUrl(null);
    onShowToast('✓ Imagen agregada con éxito a la pantalla de bloqueo', 'success');
    setActiveTab('gallery');
  };

  // Delete an image
  const handleDeleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length <= 1) {
      setUploadError('Debes mantener al menos una imagen en la pantalla de bloqueo.');
      return;
    }

    posAudio.playKeyClick();
    const updated = images.filter((img) => img.id !== id);
    saveStoredLockScreenImages(updated);
    const newIdx = currentIndex >= updated.length ? 0 : currentIndex;
    onImagesChange(updated, newIdx);
    onShowToast('Imagen eliminada de la galería', 'info');
  };

  // Reset to default accessories store images
  const handleResetToDefaults = () => {
    posAudio.playSuccessChime();
    const restored = resetLockScreenImagesToDefault();
    saveStoredLockScreenImages(restored);
    onImagesChange(restored, 0);
    setConfirmReset(false);
    onShowToast('✨ Imágenes de accesorios restablecidas por defecto', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070e1d]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-[#141b2b] border border-[#374151]/70 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#dce2f7]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#191f2f] border-b border-[#374151]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#dc2626] to-[#f59e0b] flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-[22px]">storefront</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Galería del Local de Accesorios
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#dc2626]/20 text-[#ef4444] border border-[#dc2626]/30">
                  {images.length} Fotos
                </span>
              </div>
              <p className="text-xs text-[#e6bdb8]">
                Personaliza las imágenes de la pantalla de bloqueo o restablece los valores de fábrica
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#e6bdb8] hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 bg-[#191f2f]/60 border-b border-[#374151]/40 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setActiveTab('gallery');
                setUploadError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'gallery'
                  ? 'border-[#ef4444] text-white bg-[#141b2b]'
                  : 'border-transparent text-[#e6bdb8] hover:text-white hover:bg-[#232a3a]/40'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">photo_library</span>
              <span>Galería Actual ({images.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setActiveTab('upload');
                setUploadError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-[#ef4444] text-white bg-[#141b2b]'
                  : 'border-transparent text-[#e6bdb8] hover:text-white hover:bg-[#232a3a]/40'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">add_photo_alternate</span>
              <span>Subir de mi Galería</span>
            </button>

            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setActiveTab('settings');
                setUploadError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-[#ef4444] text-white bg-[#141b2b]'
                  : 'border-transparent text-[#e6bdb8] hover:text-white hover:bg-[#232a3a]/40'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">tune</span>
              <span>Ajustes & Visor</span>
            </button>
          </div>

          {/* Quick Reset Button in header */}
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#f59e0b] hover:text-amber-300 text-[11px] font-semibold transition-colors border border-[#f59e0b]/30 mb-1"
            title="Restablecer a imágenes de tienda por defecto"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            <span className="hidden sm:inline">Restablecer por Defecto</span>
          </button>
        </div>

        {/* Reset Confirmation Overlay */}
        {confirmReset && (
          <div className="p-4 bg-amber-950/40 border-b border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-[24px]">warning</span>
              <div className="text-xs">
                <span className="font-bold text-white block">
                  ¿Restablecer todas las imágenes por defecto?
                </span>
                <span className="text-[#e6bdb8]">
                  Se restaurarán las 6 imágenes originales del local de accesorios y vitrinas.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg bg-[#232a3a] text-xs font-semibold text-[#dce2f7] hover:bg-[#323949]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                <span>Sí, Restablecer</span>
              </button>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-[18px]">error</span>
                <span>{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-red-300 hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* TAB 1: Current Gallery */}
          {activeTab === 'gallery' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#191f2f]/80 p-3 rounded-xl border border-[#374151]/40">
                <div className="text-xs">
                  <span className="text-white font-semibold block">Imágenes activas en la pantalla de bloqueo</span>
                  <span className="text-[#e6bdb8]">
                    Toca cualquier imagen para seleccionarla inmediatamente como fondo visible.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="px-3 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-[#dc2626]/25 shrink-0"
                >
                  <span className="material-symbols-outlined text-[17px]">upload</span>
                  <span>Subir de mi Galería</span>
                </button>
              </div>

              {/* Grid of Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {images.map((img, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        posAudio.playKeyClick();
                        onImagesChange(images, idx);
                        onShowToast(`Fondo cambiado a: "${img.title}"`, 'info');
                      }}
                      className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
                        isActive
                          ? 'border-[#ef4444] ring-2 ring-[#ef4444]/50 shadow-lg shadow-[#ef4444]/20 scale-[1.01]'
                          : 'border-[#374151]/50 hover:border-[#90cdff]/60 bg-[#191f2f]'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="h-36 w-full relative bg-[#070e1d] overflow-hidden">
                        <img
                          src={img.url}
                          alt={img.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            // Fallback if URL broken
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&auto=format&fit=crop&q=80';
                          }}
                        />

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide backdrop-blur-md ${
                              img.isDefault
                                ? 'bg-[#232a3a]/80 text-[#adc6ff] border border-[#374151]/60'
                                : 'bg-[#10b981]/80 text-white border border-[#10b981]'
                            }`}
                          >
                            {img.isDefault ? 'Local Tienda' : 'Mi Galería'}
                          </span>

                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dc2626] text-white flex items-center gap-1 shadow">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                              En Pantalla
                            </span>
                          )}
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteImage(img.id, e)}
                          title="Eliminar de la galería"
                          className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-[#dc2626] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>

                      {/* Card Info */}
                      <div className="p-2.5 bg-[#191f2f]">
                        <h4 className="text-xs font-semibold text-white truncate">{img.title}</h4>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-[#e6bdb8]">
                          <span className="truncate">{img.category}</span>
                          <span className="font-mono text-[10px] opacity-75">#{idx + 1}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Upload from User's Device Gallery */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              {/* Device Gallery Picker Box */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-[#ef4444]/40 hover:border-[#ef4444] bg-[#191f2f]/60 hover:bg-[#191f2f] transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-[#dc2626]/20 text-[#ef4444] group-hover:bg-[#dc2626] group-hover:text-white transition-colors flex items-center justify-center mb-3 shadow-inner">
                  <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                  Seleccionar fotos desde tu galería de fotos o cámara
                </h3>
                <p className="text-xs text-[#e6bdb8] max-w-md mb-4">
                  Elige una o varias imágenes de tu tienda, vitrinas, accesorios o productos. Se optimizarán automáticamente para guardarse en la memoria del dispositivo.
                </p>

                <button
                  type="button"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-[#dc2626] text-white text-xs font-bold flex items-center gap-2 group-hover:bg-[#ef4444] transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isUploading ? 'progress_activity' : 'photo_library'}
                  </span>
                  <span>{isUploading ? 'Procesando imágenes...' : 'Abrir Galería de mi Dispositivo'}</span>
                </button>
                <span className="text-[10px] text-[#e6bdb8]/80 mt-2 font-mono">
                  Soporta JPG, PNG, WEBP, HEIC (hasta resolución Ultra-HD)
                </span>
              </div>

              {/* Alternative: Add image via Web URL */}
              <div className="p-4 rounded-xl bg-[#191f2f]/80 border border-[#374151]/50 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <span className="material-symbols-outlined text-[18px] text-[#90cdff]">link</span>
                  <span>¿Tienes una URL de imagen web? (Opcional)</span>
                </div>

                <form onSubmit={handleAddViaUrl} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-[#e6bdb8] block mb-1">Título o Nombre de la Vitrina</label>
                      <input
                        type="text"
                        value={urlTitleInput}
                        onChange={(e) => setUrlTitleInput(e.target.value)}
                        placeholder="Ej. Vitrina de Collares & Anillos"
                        className="w-full bg-[#141b2b] border border-[#374151]/70 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ef4444]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#e6bdb8] block mb-1">URL Directa de la Imagen</label>
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          setPreviewUrl(e.target.value);
                        }}
                        placeholder="https://ejemplo.com/tienda.jpg"
                        className="w-full bg-[#141b2b] border border-[#374151]/70 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ef4444]"
                      />
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="flex items-center gap-3 p-2 bg-[#141b2b] rounded-lg border border-[#374151]/40">
                      <img
                        src={previewUrl}
                        alt="Vista previa"
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 object-cover rounded-lg border border-[#374151]"
                        onError={() => setPreviewUrl(null)}
                      />
                      <span className="text-[11px] text-[#10b981] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        Vista previa cargada correctamente
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={!urlInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors border border-[#374151]"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_link</span>
                      <span>Agregar URL a la Galería</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: Settings & Visual Controls */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Slideshow Speed */}
              <div className="p-4 rounded-xl bg-[#191f2f]/80 border border-[#374151]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#90cdff]">slideshow</span>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Rotación Automática de Imágenes (Carrusel)
                      </span>
                      <span className="text-[11px] text-[#e6bdb8]">
                        Intervalo de cambio de fotos mientras el POS está bloqueado
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#ef4444]">
                    {slideInterval === 0 ? 'Pausado (Manual)' : `Cada ${slideInterval}s`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[
                    { label: '5 seg', value: 5 },
                    { label: '8 seg (Recomendado)', value: 8 },
                    { label: '15 seg', value: 15 },
                    { label: 'Pausado', value: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        posAudio.playKeyClick();
                        onIntervalChange(opt.value);
                        saveStoredSlideInterval(opt.value);
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors border ${
                        slideInterval === opt.value
                          ? 'bg-[#dc2626] text-white border-[#ef4444] shadow'
                          : 'bg-[#141b2b] text-[#e6bdb8] hover:text-white border-[#374151]/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dark Overlay Dimmer Level */}
              <div className="p-4 rounded-xl bg-[#191f2f]/80 border border-[#374151]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#f59e0b]">contrast</span>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Atenuador de Contraste para el Teclado PIN
                      </span>
                      <span className="text-[11px] text-[#e6bdb8]">
                        Ajusta la oscuridad de la foto de fondo para que los números siempre sean 100% legibles
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Ligero (Vívido)', value: 'low' as const, desc: 'Fondo más luminoso' },
                    { label: 'Equilibrado (Ideal)', value: 'medium' as const, desc: 'Contraste balanceado' },
                    { label: 'Alto Contraste', value: 'high' as const, desc: 'Máxima visibilidad teclado' },
                  ].map((dim) => (
                    <button
                      key={dim.value}
                      type="button"
                      onClick={() => {
                        posAudio.playKeyClick();
                        onDimmerChange(dim.value);
                        saveStoredDimmerLevel(dim.value);
                      }}
                      className={`p-2.5 rounded-lg text-left transition-colors border ${
                        dimmerLevel === dim.value
                          ? 'bg-[#dc2626]/20 text-white border-[#ef4444]'
                          : 'bg-[#141b2b] text-[#e6bdb8] hover:text-white border-[#374151]/50'
                      }`}
                    >
                      <div className="font-semibold text-xs text-white">{dim.label}</div>
                      <div className="text-[10px] text-[#e6bdb8] mt-0.5">{dim.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Defaults Action Card */}
              <div className="p-4 rounded-xl bg-[#232a3a]/60 border border-[#f59e0b]/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 text-[#f59e0b] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">restart_alt</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Restablecer Imágenes por Defecto</h4>
                    <p className="text-[11px] text-[#e6bdb8]">
                      Vuelve a cargar las 6 fotografías curadas del local de accesorios, vitrinas y joyería.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-2 rounded-xl bg-[#f59e0b] hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-colors shadow shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span>Restablecer</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#191f2f] border-t border-[#374151]/50 flex items-center justify-between text-xs">
          <div className="text-[#e6bdb8] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
            <span>Guardado automático en LocalStorage</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white font-semibold transition-colors shadow"
            >
              Listo / Volver al Bloqueo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
