'use client';
import {useEffect, useState} from 'react';
import {canonicalFarmName, farmKey} from '@/lib/model';
import {clientPortalEntryUrl} from '@/lib/portal-origin';
import {
  KeyRound,
  Copy,
  Check,
  X,
  Plus,
  ShieldCheck,
  Trash2,
  MessageCircle,
  Globe
} from 'lucide-react';
import {
  createFarmInvitation,
  listFarmInvitations,
  revokeFarmInvitation,
  buildInvitationPortalUrl,
  buildWhatsAppInvitationMessage,
  type FarmInvitation
} from '@/lib/invitations';
import type {Visit} from '@/lib/model';

type InvitationManagerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  visits: Visit[];
  onOpenPortalAsClient?: (invitation: FarmInvitation) => void;
};

export function InvitationManagerModal({
  isOpen,
  onClose,
  visits,
  onOpenPortalAsClient
}: InvitationManagerModalProps) {
  const [invitations, setInvitations] = useState<FarmInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{text: string; error?: boolean} | null>(null);

  const exactFarms = (() => {
    const byKey = new Map<string, {name: string; reviewed: boolean}>();
    for (const visit of visits) {
      const name = canonicalFarmName(visit.farm);
      if (!name) continue;
      const key = farmKey(name);
      const reviewed = Boolean(visit.reviewed && visit.id);
      const current = byKey.get(key);
      if (!current) byKey.set(key, {name, reviewed});
      else if (!current.reviewed && reviewed) byKey.set(key, {name, reviewed: true});
    }
    return Array.from(byKey.values())
      .map(item => item.name)
      .sort((a, b) => a.localeCompare(b, 'es'));
  })();
  const farmListKey = exactFarms.join('\u0000');
  const clientUrl = clientPortalEntryUrl();

  const farmNames = farmListKey ? farmListKey.split('\u0000') : [];
  const [selectedFarm, setSelectedFarm] = useState(() => farmNames[0] || '');
  const [seenFarmKey, setSeenFarmKey] = useState(farmListKey);
  if (farmListKey !== seenFarmKey) {
    setSeenFarmKey(farmListKey);
    if (!farmNames.includes(selectedFarm)) setSelectedFarm(farmNames[0] || '');
  }
  const [clientName, setClientName] = useState('');
  const [clientRole, setClientRole] = useState('Administrador de Finca');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  useEffect(() => {
    let active = true;
    if (isOpen) {
      void listFarmInvitations().then(data => {
        if (active) {
          setInvitations(data);
          setLoading(false);
        }
      }).catch((err: unknown) => {
        if (active) {
          setLoading(false);
          setNotice({
            text: err instanceof Error ? err.message : 'No se pudieron cargar las invitaciones.',
            error: true
          });
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  const reviewedFor = (farm: string) =>
    visits.filter(visit => farmKey(visit.farm) === farmKey(farm) && visit.reviewed && Boolean(visit.id)).length;
  const reviewedForSelected = selectedFarm ? reviewedFor(selectedFarm) : 0;

  if (!isOpen) return null;

  const handleCreate = async (e: {preventDefault: () => void}) => {
    e.preventDefault();
    const farmName = selectedFarm.trim();
    if (!farmName || !clientName.trim()) {
      setNotice({text: 'Selecciona una finca y escribe el nombre del responsable.', error: true});
      return;
    }
    if (!reviewedFor(farmName)) {
      setNotice({
        text: 'Esta finca no tiene un informe revisado. Márcalo como revisado y pulsa «Publicar en línea» antes de invitar. El Portal Finca no muestra borradores.',
        error: true
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const targetVisit =
        visits.find(v => farmKey(v.farm) === farmKey(farmName) && v.farmId) ||
        visits.find(v => farmKey(v.farm) === farmKey(farmName));
      const newInv = await createFarmInvitation({
        farm: farmName,
        farmId: targetVisit?.farmId,
        clientName: clientName.trim(),
        clientRole: clientRole.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined
      });
      setInvitations(prev => [newInv, ...prev]);
      setNotice({text: `Invitación ${newInv.code} lista para ${newInv.clientName}. El portal empareja «${newInv.farm}» aunque cambien mayúsculas o espacios. URL del cliente: ${clientUrl}`, error: false});
      setClientName('');
      setClientPhone('');
      setClientEmail('');
    } catch (err) {
      setNotice({text: (err as Error).message, error: true});
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = (inv: FarmInvitation) => {
    const url = buildInvitationPortalUrl(inv.token);
    void navigator.clipboard.writeText(url);
    setCopiedId(inv.id + '_link');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyCode = (inv: FarmInvitation) => {
    void navigator.clipboard.writeText(inv.code);
    setCopiedId(inv.id + '_code');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleWhatsApp = (inv: FarmInvitation) => {
    const msg = buildWhatsAppInvitationMessage(inv);
    const phone = inv.clientPhone ? inv.clientPhone.replace(/\D/g, '') : '';
    const waUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('¿Deseas revocar esta invitación? El responsable de finca ya no podrá acceder a sus informes con este enlace.')) return;
    try {
      await revokeFarmInvitation(id);
      setInvitations(prev => prev.map(i => (i.id === id ? {...i, status: 'revoked' as const} : i)));
      setNotice({text: 'Invitación revocada.', error: false});
    } catch (err) {
      setNotice({text: (err as Error).message, error: true});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#007fa3]/35 flex items-center justify-between bg-gradient-to-r from-[#e8f6fb] via-white to-[#eef8e3] dark:from-slate-900 dark:to-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-[#005f7a]/40 bg-gradient-to-br from-[#007fa3] to-[#00b5e2] text-white flex items-center justify-center shadow-sm shrink-0">
              <KeyRound size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 m-0">
                Invitaciones
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 m-0 mt-0.5">
                Portal Finca. Primero «Publicar en línea». El cliente entra en{' '}
                <strong className="text-[#005f7a]">{clientUrl}</strong>
                {' '}y solo ve la finca cuyo nombre coincide.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {notice && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-xs font-semibold ${notice.error ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
            {notice.text}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Creator Form */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-[#007fa3]/30 dark:border-[#007fa3]/40">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#005f7a]/35 bg-gradient-to-br from-[#007fa3] to-[#00b5e2] text-white">
                <Plus size={14} aria-hidden />
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">
                Emitir invitación de acceso
              </h3>
            </div>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="invFarmSelect" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Finca Autorizada *
                </label>
                <select
                  id="invFarmSelect"
                  value={selectedFarm}
                  onChange={e => setSelectedFarm(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#007fa3] outline-hidden"
                  required
                >
                  {exactFarms.length ? (
                    exactFarms.map(f => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))
                  ) : (
                    <option value="">No hay fincas con nombre</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="invClientName" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Responsable / Cliente *
                </label>
                <input
                  id="invClientName"
                  type="text"
                  placeholder="Ej. Ing. Carlos Mendoza"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#007fa3] outline-hidden"
                  required
                />
              </div>

              <div>
                <label htmlFor="invClientRole" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo o Rol
                </label>
                <input
                  id="invClientRole"
                  type="text"
                  placeholder="Ej. Administrador, Jefe de aseguramiento, Dueño"
                  value={clientRole}
                  onChange={e => setClientRole(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#007fa3] outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="invClientPhone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono / WhatsApp (Opcional)
                </label>
                <input
                  id="invClientPhone"
                  type="tel"
                  placeholder="Ej. +57 310 1234567"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#007fa3] outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="invClientEmail" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  id="invClientEmail"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#007fa3] outline-hidden"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy || !selectedFarm.trim() || !clientName.trim() || reviewedForSelected === 0}
                  className="w-full py-2 px-4 bg-[#007fa3] hover:bg-[#005f7a] border border-[#005f7a] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                >
                  <KeyRound size={14} />
                  {busy ? 'Generando…' : 'Crear invitación'}
                </button>
              </div>
            </form>
            {!exactFarms.length && (
              <p className="mt-3 mb-0 text-xs font-semibold text-[#7a5200] border border-[#f2a900]/70 bg-[#fff8e8] rounded-lg px-3 py-2">
                Escribe el nombre de la finca en la visita antes de invitar.
              </p>
            )}
            {selectedFarm && reviewedForSelected === 0 && (
              <p className="mt-3 mb-0 text-xs font-semibold text-[#7a5200] border border-[#f2a900]/70 bg-[#fff8e8] rounded-lg px-3 py-2">
                Esta finca no tiene un informe revisado. Márcalo como revisado y pulsa «Publicar en línea» antes de invitar. El Portal Finca no muestra borradores.
              </p>
            )}
            {selectedFarm && reviewedForSelected > 0 && (
              <p className="mt-3 mb-0 text-xs text-slate-700 dark:text-slate-300 border border-[#007fa3]/35 bg-white dark:bg-slate-900 rounded-lg px-3 py-2">
                La invitación de <strong>«{selectedFarm}»</strong> muestra los informes de esa finca aunque el nombre publicado solo cambie en mayúsculas o espacios. Hay {reviewedForSelected} informe{reviewedForSelected === 1 ? '' : 's'} revisado{reviewedForSelected === 1 ? '' : 's'}. El cliente entra en <strong>{clientUrl}</strong> después de «Publicar en línea».
              </p>
            )}
          </div>

          {/* Active Invitations List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">
                Invitaciones Emitidas ({invitations.length})
              </h3>
              <span className="text-xs text-slate-500">
                El cliente solo verá los datos de la finca autorizada.
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Cargando invitaciones…</div>
            ) : !invitations.length ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                Aún no has generado invitaciones. Completa el formulario de arriba para enviar el primer acceso.
              </div>
            ) : (
              <div className="border border-[#007fa3]/25 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-[#d5e6ea] dark:divide-slate-800">
                {invitations.map(inv => {
                  const isRevoked = inv.status === 'revoked';
                  const farmVisitsCount = reviewedFor(inv.farm.trim());

                  return (
                    <div
                      key={inv.id}
                      className={`p-4 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${isRevoked ? 'opacity-60 bg-slate-50 dark:bg-slate-950' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {inv.clientName}
                          </strong>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            {inv.clientRole || 'Responsable'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isRevoked ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {isRevoked ? 'Revocada' : 'Activa'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-[#007fa3]">
                            {inv.farm}
                          </span>
                          <span>• {farmVisitsCount ? `${farmVisitsCount} informe${farmVisitsCount === 1 ? '' : 's'} revisado${farmVisitsCount === 1 ? '' : 's'}` : 'Sin informe revisado'}</span>
                          <span>• Creada el {new Date(inv.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 font-medium">Código ASEG:</span>
                          <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#007fa3] font-mono font-bold text-xs rounded border border-[#007fa3]/35">
                            {inv.code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(inv)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100"
                            title="Copiar código"
                          >
                            {copiedId === inv.id + '_code' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            {copiedId === inv.id + '_code' ? 'Copiado' : 'Copiar código'}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isRevoked && (
                          <>
                            <button
                              onClick={() => handleCopyLink(inv)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#9fb8c2] bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                              title="Copiar enlace del Portal Finca"
                            >
                              {copiedId === inv.id + '_link' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                              <span>{copiedId === inv.id + '_link' ? 'Enlace copiado' : 'Copiar Enlace'}</span>
                            </button>

                            <button
                              onClick={() => handleWhatsApp(inv)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#128C7E] bg-[#25D366] hover:bg-[#1ebd5b] text-white flex items-center gap-1.5 transition-colors"
                              title="Enviar invitación por WhatsApp"
                            >
                              <MessageCircle size={13} />
                              <span>WhatsApp</span>
                            </button>

                            {onOpenPortalAsClient && (
                              <button
                                onClick={() => onOpenPortalAsClient(inv)}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#007fa3]/45 bg-[#007fa3]/10 hover:bg-[#007fa3]/20 text-[#007fa3] flex items-center gap-1.5 transition-colors"
                                title="Abrir el Portal Finca con esta invitación"
                              >
                                <Globe size={13} />
                                <span>Probar acceso</span>
                              </button>
                            )}
                          </>
                        )}

                        {!isRevoked ? (
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
                            title="Revocar acceso"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Acceso inactivo</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>
              URL del cliente: <strong className="text-slate-700 dark:text-slate-200">{clientUrl}</strong>
              . El enlace agrega <strong>&invitation=</strong>. El nombre de la finca debe coincidir con el informe publicado.
            </span>
          </div>
          <button
            onClick={onClose}
            className="py-1 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

