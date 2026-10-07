'use client';
import {useState, useEffect, useMemo} from 'react';
import {
  ShieldCheck,
  Building2,
  FileText,
  Download,
  Globe,
  TrendingUp,
  AlertTriangle,
  LogOut,
  Layers,
  Lock,
  KeyRound
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  verifyFarmInvitation,
  getClientSession,
  setClientSession,
  clearClientSession,
  type FarmInvitation
} from '@/lib/invitations';
import {exportWord} from '@/lib/export-word';
import {farmKey, metrics, type Visit} from '@/lib/model';
import {farmMetricHistory, type FarmMetricAnalysis} from '@/lib/metric-analysis';
import {StandaloneOnlineReport} from './online-report-view';

type FarmPortalViewProps = {
  initialToken?: string;
  visits: Visit[];
  onExitPortal: () => void;
};

export function FarmPortalView({initialToken, visits, onExitPortal}: FarmPortalViewProps) {
  const [invitation, setInvitation] = useState<FarmInvitation | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'processes' | 'commitments'>('overview');
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

  // Attempt automatic login from URL token or existing session
  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      setErrorMsg('');

      // 1. Try URL token if provided
      if (initialToken) {
        const found = await verifyFarmInvitation(initialToken);
        if (found) {
          setInvitation(found);
          setClientSession(found);
          setLoading(false);
          return;
        } else {
          setErrorMsg('El enlace de invitación no es válido o ha sido revocado. Ingresa tu código manualmente.');
        }
      }

      // 2. Try stored session
      const stored = getClientSession();
      if (stored) {
        const recheck = await verifyFarmInvitation(stored.code || stored.token);
        if (recheck) {
          setInvitation(recheck);
          setClientSession(recheck);
        } else {
          clearClientSession();
        }
      }
      setLoading(false);
    }

    void initAuth();
  }, [initialToken]);

  // Filter visits belonging STRICTLY to the invited farm
  const farmVisits = useMemo(() => {
    if (!invitation) return [];
    const targetKey = farmKey(invitation.farm);
    return visits
      .filter(v => farmKey(v.farm) === targetKey && v.reviewed)
      .sort((a, b) => a.date.localeCompare(b.date)); // chronological
  }, [invitation, visits]);

  // Farm metric history analysis
  const historyAnalysis: FarmMetricAnalysis | null = useMemo(() => {
    if (!invitation || !farmVisits.length) return null;
    return farmMetricHistory(farmVisits, invitation.farm);
  }, [invitation, farmVisits]);

  // Latest visit data
  const latestVisit = farmVisits.at(-1);
  const latestMetrics = latestVisit ? metrics(latestVisit) : null;
  const latestScore = latestMetrics?.score ?? null;

  // Manual code submit
  const handleVerifyCode = async (e: {preventDefault: () => void}) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setVerifying(true);
    setErrorMsg('');
    try {
      const found = await verifyFarmInvitation(inputCode.trim());
      if (found) {
        setInvitation(found);
        setClientSession(found);
        setInputCode('');
      } else {
        setErrorMsg('Código no encontrado o revocado. Verifica el código con tu técnico de AVGUST.');
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor de autenticación.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    clearClientSession();
    setInvitation(null);
    onExitPortal();
  };

  // If viewing a single full report
  if (viewingReportId) {
    return (
      <StandaloneOnlineReport
        reportId={viewingReportId}
        onClose={() => setViewingReportId(null)}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 border-4 border-[#007fa3] border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold">Verificando invitación y credenciales del servidor…</h2>
        <p className="text-xs text-slate-400 mt-1">Conectando con AVGUST Cloud Platform</p>
      </div>
    );
  }

  // Security Gate / Login Screen
  if (!invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-[#002f3c] flex flex-col items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          {/* Brand */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#007fa3] to-[#78be20] flex items-center justify-center shadow-lg">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <div>
              <span className="text-xs font-extrabold tracking-widest text-[#78be20] block">AVGUST CARE 360</span>
              <h1 className="text-xl font-black text-white m-0">Portal de Aseguramiento</h1>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-base font-bold text-slate-100">Acceso Exclusivo para Responsables de Finca</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Para consultar los informes técnicos y el historial de tu finca en línea sin imprimir papel, ingresa el código de invitación emitido por tu técnico agrícola AVGUST.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-xs text-rose-200 text-center font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="portalPinInput" className="block text-xs font-semibold text-slate-300 mb-1 text-center">
                Código de Invitación (PIN)
              </label>
              <div className="relative">
                <input
                  id="portalPinInput"
                  type="text"
                  placeholder="Ej. MIPE-7482"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  className="w-full py-3.5 px-4 text-center font-mono text-lg font-bold tracking-widest rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:border-[#78be20] focus:ring-2 focus:ring-[#78be20]/30 outline-hidden uppercase transition-all"
                  required
                />
                <Lock size={16} className="absolute left-4 top-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#007fa3] to-[#78be20] hover:from-[#006e8d] hover:to-[#6ba91d] text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <KeyRoundIcon size={16} />
              {verifying ? 'Validando invitación…' : 'Acceder al Servidor en Línea'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center space-y-3">
            <p className="text-[11px] text-slate-400">
              ¿No tienes un código de acceso? Solicítalo directamente a tu técnico comercial o responsable de zona de AVGUST.
            </p>
            <div>
              <button
                type="button"
                onClick={onExitPortal}
                className="text-xs text-slate-400 hover:text-white transition-colors underline"
              >
                Volver a la consola de trabajo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Trajectory chart data across ALL visits
  const trajectoryData = farmVisits.map((v, idx) => {
    const m = metrics(v);
    return {
      index: idx + 1,
      date: v.date,
      label: `V${idx + 1} (${v.date})`,
      score: m.score ?? 0,
      compliance: m.criteriaCompliance ?? 0,
      findings: m.findings,
      responsible: v.responsible
    };
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Executive Topbar */}
      <header className="bg-slate-950/80 border-b border-slate-800/80 px-6 py-4 sticky top-0 z-40 backdrop-blur-md flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <img src="/avgust-logo.svg" alt="Avgust" className="h-8 brightness-110" />
          <div className="border-l border-slate-700 pl-3">
            <span className="text-[10px] font-extrabold tracking-widest text-[#78be20] block">
              SERVIDOR EN LÍNEA · GESTIÓN CLIENTE
            </span>
            <strong className="text-sm font-extrabold text-white flex items-center gap-2">
              <Building2 size={15} className="text-[#00b5e2]" />
              {invitation.farm}
            </strong>
          </div>
        </div>

        {/* Verification Chip & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-full text-xs">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-slate-300">
              Invitado: <strong className="text-white">{invitation.clientName}</strong>
            </span>
            <span className="text-slate-500">• Código {invitation.code}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
            title="Cerrar sesión de invitado"
          >
            <LogOut size={14} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Executive Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800/90 to-[#003847]/80 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <ShieldCheck size={14} />
                Acceso Verificado por Técnico AVGUST ({invitation.createdBy})
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white m-0 tracking-tight">
                Aseguramiento MIPE · {invitation.farm}
              </h1>
              <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed m-0">
                Consulta los resultados técnicos de tus auditorías, la evolución del estándar normativo y los compromisos de mejora sin recurrir a informes impresos en papel.
              </p>
            </div>

            {/* Semaphore Score Card */}
            <div className="bg-slate-950/90 border border-slate-700/90 rounded-2xl p-5 text-center shadow-lg">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Índice MIPE Actual (Última Visita)
              </span>
              <div className="flex items-baseline justify-center gap-1 my-1">
                <span className={`text-4xl md:text-5xl font-black ${latestScore === null ? 'text-slate-400' : latestScore >= 95 ? 'text-emerald-400' : latestScore >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {latestScore === null ? '—' : `${latestScore}%`}
                </span>
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${latestScore === null ? 'bg-slate-800 text-slate-400 border-slate-700' : latestScore >= 95 ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' : latestScore >= 85 ? 'bg-amber-950/80 text-amber-300 border-amber-500/50' : 'bg-rose-950/80 text-rose-300 border-rose-500/50'}`}>
                  {latestScore === null ? 'Sin evaluación' : latestScore >= 95 ? '● Saludable (≥95%)' : latestScore >= 85 ? '● Aceptable (85-94%)' : '● Crítico (<85%)'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-2">
                Fecha del informe: {latestVisit?.date || 'Sin visitas'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            {id: 'overview', label: 'Evolución y Tablero Integral', icon: TrendingUp},
            {id: 'reports', label: `Historial de Informes (${farmVisits.length})`, icon: FileText},
            {id: 'processes', label: '5 Procesos Normativos', icon: Layers},
            {id: 'commitments', label: 'Compromisos y Hallazgos', icon: AlertTriangle}
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${active ? 'bg-[#007fa3] text-white shadow-md' : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & MULTI-VISIT EVOLUTION */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <span className="text-xs font-semibold text-slate-400 block">Total Auditorías Registradas</span>
                <strong className="text-2xl font-black text-white mt-1 block">{farmVisits.length}</strong>
                <span className="text-[11px] text-slate-400 mt-1 block">Visitas técnicas auditadas en campo</span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <span className="text-xs font-semibold text-slate-400 block">Conformidad de Criterios</span>
                <strong className="text-2xl font-black text-[#00b5e2] mt-1 block">
                  {latestMetrics?.positive ?? 0}/{latestMetrics?.applicable ?? 0}
                </strong>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {latestMetrics?.criteriaCompliance ?? 0}% criterios con respuesta Sí
                </span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <span className="text-xs font-semibold text-slate-400 block">Hallazgos Abiertos Actuales</span>
                <strong className={`text-2xl font-black mt-1 block ${(latestMetrics?.findings ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {latestMetrics?.findings ?? 0}
                </strong>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {(latestMetrics?.findings ?? 0) === 0 ? 'Cero desviaciones en la última visita' : 'Desviaciones técnicas con plan correctivo'}
                </span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <span className="text-xs font-semibold text-slate-400 block">Cobertura de Procesos</span>
                <strong className="text-2xl font-black text-white mt-1 block">
                  {latestVisit?.chapters.length ?? 0}/5
                </strong>
                <span className="text-[11px] text-slate-400 mt-1 block">Capítulos MIPE evaluados en la visita</span>
              </div>
            </div>

            {/* Trajectory Recharts Graph Across ALL Visits */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white m-0">
                    Evolución Cronológica Integral (Todas las Visitas)
                  </h3>
                  <p className="text-xs text-slate-400 m-0 mt-0.5">
                    Curva de desempeño que compara la totalidad de auditorías técnicas de la finca en el tiempo.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#16a34a] inline-block"></span>
                    <span className="text-slate-300">Saludable ≥95%</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#d97706] inline-block"></span>
                    <span className="text-slate-300">Aceptable 85-94%</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#dc2626] inline-block"></span>
                    <span className="text-slate-300">Crítico &lt;85%</span>
                  </span>
                </div>
              </div>

              {trajectoryData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <div style={{minWidth: Math.max(500, trajectoryData.length * 90)}}>
                    <ResponsiveContainer width="100%" height={290}>
                      <AreaChart data={trajectoryData} margin={{top: 15, right: 20, left: -15, bottom: 4}}>
                        <defs>
                          <linearGradient id="portalColorMipe" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007fa3" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#007fa3" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155"/>
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize: 11, fill: '#94a3b8'}}/>
                        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} tick={{fontSize: 11, fill: '#94a3b8'}}/>
                        <Tooltip
                          content={({active, payload}) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0].payload as typeof trajectoryData[0];
                            return (
                              <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                <strong className="text-white block font-bold">{item.label}</strong>
                                <div className="text-slate-300">Responsable AVGUST: {item.responsible}</div>
                                <div className="text-[#00b5e2] font-semibold">Índice MIPE: {item.score}%</div>
                                <div className="text-slate-400">Conformidad: {item.compliance}%</div>
                                <div className={item.findings > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                                  Hallazgos: {item.findings}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine y={95} stroke="#16a34a" strokeWidth={2} strokeDasharray="4 4" label={{value: 'Meta Saludable (≥95%)', fill: '#4ade80', fontSize: 10, position: 'insideTopRight'}}/>
                        <ReferenceLine y={85} stroke="#d97706" strokeWidth={1.5} strokeDasharray="3 3" label={{value: 'Umbral Aceptable (85%)', fill: '#fbbf24', fontSize: 10, position: 'insideBottomRight'}}/>
                        <Area type="monotone" name="Índice MIPE" dataKey="score" stroke="#00b5e2" strokeWidth={3} fillOpacity={1} fill="url(#portalColorMipe)" dot={{r: 5, fill: '#00b5e2', strokeWidth: 2, stroke: '#ffffff'}} activeDot={{r: 7}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  No hay visitas auditadas suficientes para graficar la evolución.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REPORTS LIST (DIGITAL & PAPERLESS) */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-white m-0">
                  Historial de Informes de Aseguramiento en Línea
                </h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">
                  Consulta cada informe digital con sus evidencias fotográficas, o descárgalo en Word/PDF oficial.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {farmVisits.slice().reverse().map((visit, idx) => {
                const m = metrics(visit);
                const score = m.score;
                const statusCls = score === null
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : score >= 95
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : score >= 85
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/50';

                return (
                  <div
                    key={visit.id}
                    className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-600 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#00b5e2]">
                          Informe #{farmVisits.length - idx}
                        </span>
                        <strong className="text-sm font-bold text-white">
                          Auditoría del {visit.date}
                        </strong>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCls}`}>
                          {score === null ? 'Sin evaluación' : score >= 95 ? 'Saludable (≥95%)' : score >= 85 ? 'Aceptable (85-94%)' : 'Crítico (<85%)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        <span>Responsable AVGUST: <strong className="text-slate-300">{visit.responsible}</strong></span>
                        <span>Representante finca: <strong className="text-slate-300">{visit.technician}</strong></span>
                        <span>Capítulos: <strong className="text-slate-300">{visit.chapters.length}/5</strong></span>
                        <span>Hallazgos: <strong className={m.findings > 0 ? 'text-rose-400' : 'text-emerald-400'}>{m.findings}</strong></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setViewingReportId(visit.id)}
                        className="px-3 py-2 rounded-xl bg-[#007fa3] hover:bg-[#006e8d] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        title="Ver informe interactivo sin papel"
                      >
                        <Globe size={14} />
                        <span>Ver en Línea (Sin papel)</span>
                      </button>

                      <button
                        onClick={() => void exportWord(visit)}
                        className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Descargar documento Word editable"
                      >
                        <Download size={14} />
                        <span>Word</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: 5 PROCESSES EVOLUTION */}
        {activeTab === 'processes' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white m-0">
                Comportamiento por Proceso Normativo MIPE
              </h3>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Ponderación oficial: Almacén (5%), Dosificación (30%), Transporte (5%), Mezclas (30%) y Aplicación (30%).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                {id: 1, title: 'Almacén', weight: '5%', desc: 'Almacenamiento y rotulado'},
                {id: 2, title: 'Dosificación', weight: '30%', desc: 'Calibración y probetas'},
                {id: 3, title: 'Transporte', weight: '5%', desc: 'Traslado y contención'},
                {id: 4, title: 'Mezclas', weight: '30%', desc: 'Orden y pre-dilución'},
                {id: 5, title: 'Aplicación', weight: '30%', desc: 'Boquillas, aforo y EPP'}
              ].map(proc => {
                const chapterStats = historyAnalysis?.chapters.find(c => c.id === proc.id);
                const score = chapterStats?.score ?? null;

                return (
                  <div key={proc.id} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#00b5e2]">Capítulo {proc.id}</span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded">
                        Peso {proc.weight}
                      </span>
                    </div>
                    <strong className="text-sm font-bold text-white block">{proc.title}</strong>
                    <div className="my-2">
                      <span className={`text-2xl font-black ${score === null ? 'text-slate-500' : score >= 95 ? 'text-emerald-400' : score >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {score === null ? '—' : `${score}%`}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">{proc.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: COMMITMENTS & ACTION PLAN */}
        {activeTab === 'commitments' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white m-0">
                Plan de Acción y Recomendaciones Técnicas
              </h3>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Desviaciones identificadas por el técnico para que la finca mantenga su estándar de calidad.
              </p>
            </div>

            {historyAnalysis?.problems && historyAnalysis.problems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyAnalysis.problems.map(prob => (
                  <div
                    key={prob.id}
                    className="bg-slate-800/60 border border-rose-900/40 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-rose-400">Criterio {prob.id}</span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded">
                        Capítulo {prob.chapter}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-100 m-0 leading-relaxed">{prob.text}</h4>
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300">
                      <strong className="text-[#78be20] block mb-0.5">Recomendación Técnica AVGUST:</strong>
                      {prob.recommendation || 'Sin recomendación registrada.'}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Recurrencia: {prob.occurrences} informe{prob.occurrences === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-800/40 border border-emerald-900/40 rounded-2xl text-emerald-300 text-xs font-semibold">
                ✓ ¡Excelente! No se registran hallazgos ni desviaciones abiertas en la última auditoría de la finca.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 bg-slate-950/60">
        AVGUST CARE 360 · Servidor en Línea para Responsables de Finca · Juntos Crecemos Bien
      </footer>
    </div>
  );
}

function KeyRoundIcon(props: {size?: number; className?: string}) {
  return <KeyRound {...props} />;
}
