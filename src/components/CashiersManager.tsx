import React, { useState } from 'react';
import { Cashier, AuditEvent } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';

interface CashiersManagerProps {
  cashiers: Cashier[];
  currentCashier: Cashier;
  onAddCashier: (newCashier: Cashier) => void;
  onUpdateCashier: (updatedCashier: Cashier) => void;
  onDeleteCashier: (cashierId: string) => void;
  onSwitchCashier: (cashier: Cashier) => void;
  onLogAudit: (type: AuditEvent['type'], details: string) => void;
  onOpenBackupModal?: () => void;
  onOpenAnalytics?: () => void;
}

export const CashiersManager: React.FC<CashiersManagerProps> = ({
  cashiers,
  currentCashier,
  onAddCashier,
  onUpdateCashier,
  onDeleteCashier,
  onSwitchCashier,
  onLogAudit,
  onOpenBackupModal,
  onOpenAnalytics,
}) => {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingCashier, setEditingCashier] = useState<Cashier | null>(null);
  const [cashierToDelete, setCashierToDelete] = useState<Cashier | null>(null);
  const [showAdminEditModal, setShowAdminEditModal] = useState<boolean>(false);
  const [visiblePinIds, setVisiblePinIds] = useState<Record<string, boolean>>({});

  // Create Form State
  const [newName, setNewName] = useState<string>('');
  const [newCode, setNewCode] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('Cajero Turno Diurno');
  const [newPin, setNewPin] = useState<string>('');
  const [newConfirmPin, setNewConfirmPin] = useState<string>('');
  const [newDrawerCash, setNewDrawerCash] = useState<number>(300000);
  const [newNfcCardId, setNewNfcCardId] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');

  // Admin Self-Edit Form State
  const adminCashier = cashiers.find((c) => c.isMaster) || {
    id: 'admin',
    name: 'Carlos M.',
    code: 'ADMIN',
    role: 'Administrador General / Llave Maestra',
    initials: 'CM',
    pin: '9999',
    isMaster: true,
    drawerCash: 1250000,
    completedTickets: 0,
    nfcCardId: 'NFC-MASTER-0001',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  };

  const [adminName, setAdminName] = useState<string>(adminCashier.name);
  const [adminCode, setAdminCode] = useState<string>(adminCashier.code);
  const [adminPin, setAdminPin] = useState<string>(adminCashier.pin);
  const [adminConfirmPin, setAdminConfirmPin] = useState<string>(adminCashier.pin);
  const [adminNfcCardId, setAdminNfcCardId] = useState<string>(adminCashier.nfcCardId || 'NFC-MASTER-0001');
  const [adminEditError, setAdminEditError] = useState<string>('');

  // Edit Cashier Form State
  const [editName, setEditName] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('');
  const [editNfcCardId, setEditNfcCardId] = useState<string>('');
  const [editError, setEditError] = useState<string>('');

  const togglePinVisibility = (id: string) => {
    setVisiblePinIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open Edit Modal for a standard cashier
  const handleStartEdit = (cashier: Cashier) => {
    if (cashier.isMaster) {
      // If editing admin, open Admin Edit modal
      setAdminName(cashier.name);
      setAdminCode(cashier.code);
      setAdminPin(cashier.pin);
      setAdminConfirmPin(cashier.pin);
      setAdminNfcCardId(cashier.nfcCardId || 'NFC-MASTER-0001');
      setAdminEditError('');
      setShowAdminEditModal(true);
      return;
    }

    setEditingCashier(cashier);
    setEditName(cashier.name);
    setEditRole(cashier.role);
    setEditPin(cashier.pin);
    setEditNfcCardId(cashier.nfcCardId || '');
    setEditError('');
  };

  // Submit Edit Cashier
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCashier) return;

    if (!editName.trim()) {
      setEditError('El nombre no puede estar vacío.');
      return;
    }
    if (!editPin.trim() || editPin.length < 4) {
      setEditError('La contraseña/PIN debe tener al menos 4 dígitos.');
      return;
    }

    const updated: Cashier = {
      ...editingCashier,
      name: editName.trim(),
      role: editRole.trim() || editingCashier.role,
      pin: editPin.trim(),
      nfcCardId: editNfcCardId.trim() || editingCashier.nfcCardId,
      initials: editName
        .trim()
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    };

    onUpdateCashier(updated);
    posAudio.playSuccessChime();
    onLogAudit('lock', `Usuario ${updated.name} actualizado por administrador`);
    setEditingCashier(null);
  };

  // Submit Admin Edit
  const handleSaveAdminCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) {
      setAdminEditError('El nombre de acceso no puede estar vacío.');
      return;
    }
    if (!adminPin.trim() || adminPin.length < 4) {
      setAdminEditError('La contraseña/PIN de administrador debe tener al menos 4 caracteres.');
      return;
    }
    if (adminPin !== adminConfirmPin) {
      setAdminEditError('Las contraseñas no coinciden.');
      return;
    }

    const updatedAdmin: Cashier = {
      ...adminCashier,
      name: adminName.trim(),
      code: adminCode.trim() || 'ADMIN',
      pin: adminPin.trim(),
      nfcCardId: adminNfcCardId.trim() || 'NFC-MASTER-0001',
      initials: adminName
        .trim()
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    };

    onUpdateCashier(updatedAdmin);
    posAudio.playSuccessChime();
    onLogAudit('unlock_supervisor', `Credenciales del Administrador modificadas por ${updatedAdmin.name}`);
    setShowAdminEditModal(false);
  };

  // Submit Create New Cashier
  const handleCreateCashier = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newName.trim()) {
      setCreateError('Por favor ingresa el nombre del cajero.');
      return;
    }
    if (!newPin.trim() || newPin.length < 4) {
      setCreateError('El PIN/Contraseña debe tener al menos 4 dígitos.');
      return;
    }
    if (newPin !== newConfirmPin) {
      setCreateError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    const cleanInitials = newName
      .trim()
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const nextCode = newCode.trim() || `T-0${cashiers.length + 1}`;
    const generatedNfc =
      newNfcCardId.trim() ||
      `NFC-${cleanInitials}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCashier: Cashier = {
      id: `c-${Date.now()}`,
      name: newName.trim(),
      code: nextCode,
      role: newRole.trim() || 'Cajero de Turno',
      initials: cleanInitials,
      pin: newPin.trim(),
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      drawerCash: Number(newDrawerCash) || 200000,
      completedTickets: 0,
      nfcCardId: generatedNfc,
      isMaster: false,
    };

    onAddCashier(newCashier);
    posAudio.playSuccessChime();
    onLogAudit('lock', `Nuevo cajero ${newCashier.name} (${newCashier.code}) creado por administrador`);

    // Reset Form
    setNewName('');
    setNewCode('');
    setNewPin('');
    setNewConfirmPin('');
    setNewNfcCardId('');
    setShowCreateModal(false);
  };

  // Handle Delete Cashier
  const handleConfirmDelete = () => {
    if (!cashierToDelete) return;

    if (cashierToDelete.isMaster) {
      posAudio.playErrorBuzz();
      alert('No se puede eliminar la cuenta de Administrador General.');
      setCashierToDelete(null);
      return;
    }

    if (cashierToDelete.id === currentCashier.id) {
      posAudio.playErrorBuzz();
      alert('No puedes eliminar al operador que tiene la sesión activa actualmente.');
      setCashierToDelete(null);
      return;
    }

    onDeleteCashier(cashierToDelete.id);
    posAudio.playKeyClick();
    onLogAudit('lock', `Cajero ${cashierToDelete.name} (${cashierToDelete.code}) eliminado del sistema`);
    setCashierToDelete(null);
  };

  const standardCashiers = cashiers.filter((c) => !c.isMaster);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-5">
      {/* Top Banner and Role Status */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#dc2626]/20 border border-[#dc2626]/40 flex items-center justify-center text-[#ef4444] shrink-0">
            <span className="material-symbols-outlined text-[28px]">manage_accounts</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Gestión de Personal & Cajeros</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
                Control RBAC Activo
              </span>
            </div>
            <p className="text-xs text-[#e6bdb8] mt-1 leading-relaxed">
              El Administrador posee <strong className="text-white">acceso total exclusivo</strong> a inventario y configuraciones. Los cajeros tienen acceso esencial limitado a ventas y cierre de caja.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenAnalytics && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onOpenAnalytics();
              }}
              title="Ver Métricas y Gráficas de Ventas Semanales"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#10b981]/20 hover:bg-[#10b981] text-[#10b981] hover:text-black border border-[#10b981]/40 text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
              <span>Ver Métricas</span>
            </button>
          )}

          {onOpenBackupModal && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onOpenBackupModal();
              }}
              title="Descargar copia de respaldo JSON (Inventario, Cajeros y Auditoría)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f59e0b]/20 hover:bg-[#f59e0b] text-[#f59e0b] hover:text-[#3d2400] border border-[#f59e0b]/40 text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Respaldar JSON</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              posAudio.playKeyClick();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-[#fff6f5] text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Nuevo Cajero</span>
          </button>
        </div>
      </div>

      {/* 1. ADMINISTRATOR EXCLUSIVE CREDENTIALS CARD */}
      <div className="bg-[#191f2f] border-2 border-[#f59e0b]/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 bg-[#f59e0b] text-[#3d2400] text-[10px] font-bold font-mono px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">shield</span>
          <span>Acceso Total Exclusivo</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative w-14 h-14 rounded-2xl bg-[#232a3a] overflow-hidden border-2 border-[#f59e0b]/60 shadow-md">
              <img
                src={adminCashier.avatar}
                alt={adminCashier.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#f59e0b] rounded-full ring-2 ring-[#191f2f] flex items-center justify-center">
                <span className="material-symbols-outlined text-[9px] text-[#3d2400]">star</span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{adminCashier.name}</span>
                <span className="font-mono text-xs font-semibold text-[#f59e0b] px-2 py-0.5 rounded bg-[#f59e0b]/20 border border-[#f59e0b]/30">
                  {adminCashier.code}
                </span>
                {currentCashier.isMaster && (
                  <span className="text-[10px] font-mono text-[#10b981] font-semibold bg-[#10b981]/15 px-2 py-0.5 rounded">
                    (Sesión Actual)
                  </span>
                )}
              </div>
              <span className="text-xs text-[#e6bdb8] block mt-0.5">{adminCashier.role}</span>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono text-[#e6bdb8]">
                <div className="flex items-center gap-1">
                  <span className="text-white/70">Contraseña / PIN Maestro:</span>
                  <span className="font-bold text-[#f59e0b] bg-[#141b2b] px-2 py-0.5 rounded border border-[#374151]/40">
                    {visiblePinIds[adminCashier.id] ? adminCashier.pin : '••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePinVisibility(adminCashier.id)}
                    className="text-[#adc6ff] hover:text-white p-0.5"
                    title={visiblePinIds[adminCashier.id] ? 'Ocultar PIN' : 'Ver PIN'}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {visiblePinIds[adminCashier.id] ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white/70">Tarjeta NFC Maestra:</span>
                  <span className="font-bold text-[#90cdff] bg-[#141b2b] px-2 py-0.5 rounded border border-[#374151]/40">
                    {adminCashier.nfcCardId || 'NFC-MASTER-0001'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenAnalytics && (
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  onOpenAnalytics();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#10b981] border border-[#10b981]/40 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">monitoring</span>
                <span>Ver Métricas Semanales</span>
              </button>
            )}

            {onOpenBackupModal && (
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  onOpenBackupModal();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#f59e0b] border border-[#f59e0b]/40 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">backup</span>
                <span>Descargar Respaldo JSON</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setAdminName(adminCashier.name);
                setAdminCode(adminCashier.code);
                setAdminPin(adminCashier.pin);
                setAdminConfirmPin(adminCashier.pin);
                setAdminNfcCardId(adminCashier.nfcCardId || 'NFC-MASTER-0001');
                setAdminEditError('');
                setShowAdminEditModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#3d2400] text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">badge</span>
              <span>Cambiar Nombre y Contraseña de Administrador</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REGISTERED CASHIERS (ESSENTIAL ACCESS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Cajeros Registrados ({standardCashiers.length})
            </h3>
            <span className="text-[11px] text-[#e6bdb8]">
              Permisos: Punto de Venta (Caja POS) y Cierre de Turno de su gaveta.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {standardCashiers.map((cashier) => {
            const isCurrent = cashier.id === currentCashier.id;
            const isPinVisible = !!visiblePinIds[cashier.id];

            return (
              <div
                key={cashier.id}
                className={`bg-[#191f2f] border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                  isCurrent ? 'border-[#10b981] shadow-lg ring-1 ring-[#10b981]/50' : 'border-[#374151]/40 hover:border-[#374151]'
                }`}
              >
                <div>
                  {/* Top info row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-11 h-11 rounded-xl bg-[#232a3a] overflow-hidden border border-[#374151]/50">
                        <img
                          src={cashier.avatar}
                          alt={cashier.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        {isCurrent && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10b981] rounded-full ring-2 ring-[#191f2f]"></span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white truncate">{cashier.name}</span>
                          <span className="font-mono text-[10px] text-[#90cdff] px-1.5 py-0.2 rounded bg-[#0078b2]/20 font-semibold">
                            {cashier.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#e6bdb8] truncate block">{cashier.role}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#232a3a] text-[#adc6ff] border border-[#374151]/40">
                      Esencial
                    </span>
                  </div>

                  {/* Credentials & Metrics */}
                  <div className="mt-3 bg-[#141b2b] p-2.5 rounded-xl border border-[#374151]/30 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#e6bdb8] font-sans">Contraseña / PIN:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white bg-[#070e1d] px-2 py-0.5 rounded border border-[#374151]/40">
                          {isPinVisible ? cashier.pin : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePinVisibility(cashier.id)}
                          className="text-[#adc6ff] hover:text-white"
                          title={isPinVisible ? 'Ocultar' : 'Mostrar'}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isPinVisible ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#e6bdb8] font-sans">Tarjeta NFC:</span>
                      <span className="text-[#90cdff]">{cashier.nfcCardId || 'No asignada'}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-[#374151]/20">
                      <span className="text-[#e6bdb8] font-sans">Efectivo en Gaveta:</span>
                      <span className="text-[#10b981] font-bold">{formatCOP(cashier.drawerCash)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-[#374151]/30">
                  <div className="flex items-center gap-1.5">
                    {/* Switch operator button */}
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.playKeyClick();
                          onSwitchCashier(cashier);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">login</span>
                        <span>Asignar</span>
                      </button>
                    )}
                    {isCurrent && (
                      <span className="text-[11px] font-mono text-[#10b981] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                        En Turno
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        posAudio.playKeyClick();
                        handleStartEdit(cashier);
                      }}
                      title="Editar nombre y contraseña"
                      className="p-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#dce2f7] hover:text-white border border-[#374151]/40 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        posAudio.playKeyClick();
                        setCashierToDelete(cashier);
                      }}
                      title={isCurrent ? 'No se puede eliminar el cajero en turno activo' : 'Eliminar cajero'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'opacity-30 cursor-not-allowed bg-[#232a3a] border-[#374151]/20 text-gray-500'
                          : 'bg-[#dc2626]/20 hover:bg-[#dc2626] text-[#ef4444] hover:text-white border-[#dc2626]/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE CASHIER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#dc2626] text-[22px]">person_add</span>
                <span className="font-bold text-base text-white">Crear Nuevo Cajero</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCashier} className="space-y-3">
              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">Nombre Completo del Cajero *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej. Andrés Morales"
                  className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#dc2626]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Código Terminal</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder={`ej. T-0${cashiers.length + 1}`}
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#dc2626]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Rol / Turno</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#dc2626]"
                  >
                    <option value="Cajero Turno Diurno">Cajero Turno Diurno</option>
                    <option value="Cajero Turno Tarde">Cajero Turno Tarde</option>
                    <option value="Cajero Turno Noche">Cajero Turno Noche</option>
                    <option value="Cajero Auxiliar">Cajero Auxiliar</option>
                    <option value="Cajero Fin de Semana">Cajero Fin de Semana</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Contraseña / PIN (4+ dígitos) *</label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="ej. 1234"
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#dc2626]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Confirmar Contraseña *</label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={newConfirmPin}
                    onChange={(e) => setNewConfirmPin(e.target.value)}
                    placeholder="ej. 1234"
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Efectivo Inicial en Gaveta (COP)</label>
                  <input
                    type="number"
                    value={newDrawerCash}
                    onChange={(e) => setNewDrawerCash(Number(e.target.value))}
                    step={10000}
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#dc2626]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">ID Tarjeta NFC (Opcional)</label>
                  <input
                    type="text"
                    value={newNfcCardId}
                    onChange={(e) => setNewNfcCardId(e.target.value)}
                    placeholder="Auto-generar"
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#e6bdb8]/50 focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-xs font-medium">
                  {createError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-xs font-bold text-white transition-colors shadow-md"
                >
                  Guardar Cajero
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STANDARD CASHIER MODAL */}
      {editingCashier && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff] text-[22px]">manage_accounts</span>
                <span className="font-bold text-base text-white">Editar Usuario Cajero</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCashier(null)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">Nombre de Usuario *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#adc6ff]"
                />
              </div>

              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">Rol / Turno</label>
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#adc6ff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Nueva Contraseña / PIN *</label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#adc6ff]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Tarjeta NFC</label>
                  <input
                    type="text"
                    value={editNfcCardId}
                    onChange={(e) => setEditNfcCardId(e.target.value)}
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#adc6ff]"
                  />
                </div>
              </div>

              {editError && (
                <div className="p-2.5 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCashier(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0078b2] hover:bg-[#0566d9] text-xs font-bold text-white transition-colors shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMINISTRATOR CREDENTIALS MODAL */}
      {showAdminEditModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border-2 border-[#f59e0b]/50 rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f59e0b] text-[24px]">shield</span>
                <span className="font-bold text-base text-white">Credenciales del Administrador</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminEditModal(false)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#e6bdb8]">
              Modifica tu nombre de acceso administrativo y tu contraseña maestra. Como Administrador, eres el único con acceso total a toda la configuración, inventario y gestión de usuarios.
            </p>

            <form onSubmit={handleSaveAdminCredentials} className="space-y-3">
              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">Nombre de Acceso de Administrador *</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="ej. Carlos M. o Administrador Kev Nay"
                  className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f59e0b]"
                />
              </div>

              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">Código de Acceso</label>
                <input
                  type="text"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="ADMIN"
                  className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#f59e0b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Nueva Contraseña / PIN Maestro *</label>
                  <input
                    type="password"
                    required
                    maxLength={10}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#f59e0b]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#e6bdb8] block mb-1">Confirmar Contraseña *</label>
                  <input
                    type="password"
                    required
                    maxLength={10}
                    value={adminConfirmPin}
                    onChange={(e) => setAdminConfirmPin(e.target.value)}
                    placeholder="Repetir contraseña"
                    className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#f59e0b]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#e6bdb8] block mb-1">ID Tarjeta NFC Maestra</label>
                <input
                  type="text"
                  value={adminNfcCardId}
                  onChange={(e) => setAdminNfcCardId(e.target.value)}
                  placeholder="NFC-MASTER-0001"
                  className="w-full bg-[#141b2b] border border-[#374151]/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#f59e0b]"
                />
              </div>

              {adminEditError && (
                <div className="p-2.5 rounded-lg bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-xs font-medium">
                  {adminEditError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-xs font-bold text-[#3d2400] transition-colors shadow-md"
                >
                  Guardar Credenciales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {cashierToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#dc2626]/60 rounded-2xl p-5 w-full max-w-sm shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center gap-2 text-[#ef4444]">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <span className="font-bold text-sm text-white">¿Eliminar Cajero?</span>
            </div>

            <p className="text-xs text-[#e6bdb8] leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente al cajero{' '}
              <strong className="text-white">{cashierToDelete.name}</strong> ({cashierToDelete.code})? Sus accesos y contraseñas serán revocados inmediatamente.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCashierToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-xs font-semibold text-[#dce2f7] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-xs font-bold text-white transition-colors shadow-md"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
