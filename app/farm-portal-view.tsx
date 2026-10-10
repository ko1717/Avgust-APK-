'use client';
import {useState, useEffect, useMemo} from 'react';
import {
  ShieldCheck,
  FileText,
  Download,
  Globe,
  TrendingUp,
  AlertTriangle,
  LogOut,
  Layers,
  Lock,
  KeyRound,
  ArrowUpRight,
  ArrowDownRight,
  Minus
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
import {
  catalog,
  CHAPTER_WEIGHTS,
  farmKey,
  metrics,
  metricStatusLabels,
  metricTrendLabels,
  actionLabels,
  type MetricStatus,
  type Visit
} from '@/lib/model';
import {farmMetricHistory, type FarmMetricAnalysis} from '@/lib/metric-analysis';
import {ensurePortalAuth, listFarmCloudVisits, subscribeToFarmVisits} from '@/lib/firebase';
import {StandaloneOnlineReport} from './online-report-view';
import './farm-portal.css';

type FarmPortalViewProps = {
  initialToken?: string;
  visits: Visit[];
  onExitPortal: () => void;
};

type PortalTab = 'overview' | 'reports' | 'processes' | 'commitments';

const STATUS_CLASS: Record<MetricStatus, string> = {
  healthy: 'is-healthy',
  acceptable: 'is-alert',
  critical: 'is-critical',
  pending: 'is-pending'
};

const CHAPTER_BLURBS: Record<number, string> = {
  1: 'Almacenamiento y rotulado',
  2: 'Calibración y probetas',
  3: 'Traslado y contención',
  4: 'Orden y pre-dilución',
  5: 'Boquillas, aforo y EPP'
};

function statusClass(status: MetricStatus | null | undefined) {
  return STATUS_CLASS[status || 'pending'];
}

function statusLabel(score: number | null, status?: MetricStatus) {
  if (score === null || !status || status === 'pending') return 'Sin evaluación';
  if (status === 'healthy') return 'Saludable (≥95%)';
  if (status === 'acceptable') return 'Alerta (80-94%)';
  return 'Vulnerable (<80%)';
}

export function FarmPortalView({initialToken, visits, onExitPortal}: FarmPortalViewProps) {
  const [invitation, setInvitation] = useState<FarmInvitation | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [cloudVisits, setCloudVisits] = useState<Visit[]>([]);
  const [cloudSyncedFarm, setCloudSyncedFarm] = useState('');

  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      setErrorMsg('');
      await ensurePortalAuth();

      if (initialToken) {
        const found = await verifyFarmInvitation(initialToken);
        if (found) {
          setInvitation(found);
          setClientSession(found);
          setLoading(false);
          return;
        }
        setErrorMsg('El enlace de invitación no es válido o ha sido revocado. Ingresa tu código manualmente.');
      }

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

  useEffect(() => {
    if (!invitation?.farm) return;

    let active = true;
    const farm = invitation.farm;
    void listFarmCloudVisits(farm).then(list => {
      if (!active) return;
      if (list.length) setCloudVisits(list);
      setCloudSyncedFarm(farm);
    }).catch(() => {
      if (active) setCloudSyncedFarm(farm);
    });

    const unsubscribe = subscribeToFarmVisits(farm, list => {
      if (!active) return;
      setCloudVisits(current => {
        const map = new Map(current.map(item => [item.id, item]));
        for (const visit of list) {
          if (visit.id && visit.farm) map.set(visit.id, {...map.get(visit.id), ...visit});
        }
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
      setCloudSyncedFarm(farm);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [invitation?.farm]);

  const cloudFarm = invitation?.farm || '';
  const cloudLoading = Boolean(cloudFarm) && cloudSyncedFarm !== cloudFarm;

  const farmVisits = useMemo(() => {
    if (!invitation) return [];
    const targetKey = farmKey(invitation.farm);
    const map = new Map<string, Visit>();
    for (const visit of [...visits, ...cloudVisits]) {
      if (farmKey(visit.farm) === targetKey && visit.reviewed && visit.id) {
        map.set(visit.id, visit);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [invitation, visits, cloudVisits]);

  const historyAnalysis: FarmMetricAnalysis | null = useMemo(() => {
    if (!invitation || !farmVisits.length) return null;
    return farmMetricHistory(farmVisits, invitation.farm);
  }, [invitation, farmVisits]);

  const latestVisit = farmVisits.at(-1);
  const latestMetrics = latestVisit ? metrics(latestVisit) : null;
  const latestScore = latestMetrics?.score ?? null;
  const latestStatus = latestMetrics?.status ?? 'pending';
  const coveragePct = latestMetrics ? Math.round(latestMetrics.auditedWeight * 100) : 0;
  const trend = historyAnalysis?.trend ?? 'pending';
  const recentDelta = historyAnalysis?.recentDelta ?? null;

  const handleVerifyCode = async (e: {preventDefault: () => void}) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setVerifying(true);
    setErrorMsg('');
    try {
      await ensurePortalAuth();
      const found = await verifyFarmInvitation(inputCode.trim());
      if (found) {
        setInvitation(found);
        setClientSession(found);
        setInputCode('');
      } else {
        setErrorMsg('Código no encontrado o revocado. Verifica el código con tu técnico de AVGUST.');
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor de autenticación. Intenta de nuevo en unos segundos.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    clearClientSession();
    setInvitation(null);
    onExitPortal();
  };

  if (viewingReportId) {
    return (
      <StandaloneOnlineReport
        reportId={viewingReportId}
        onClose={() => setViewingReportId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="fp-loading">
        <div className="fp-spinner" aria-hidden />
        <h2>Conectando con AVGUST Cloud</h2>
        <p>Verificando invitación y credenciales del Portal de Finca…</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="fp-gate">
        <section className="fp-gate-brand" aria-label="Identidad AVGUST">
          <div>
            <div className="fp-gate-logo">
              <img src="/avgust-logo.svg" alt="AVGUST Crop Protection" />
            </div>
            <span className="fp-gate-kicker">CARE 360 · Servidor en línea</span>
            <h1 className="fp-gate-product">
              Portal de <span>Finca</span>
            </h1>
            <p className="fp-gate-lead">
              Consulta el estado MIPE de tu finca, la evolución por proceso y los informes de
              aseguramiento sin depender del papel.
            </p>
            <ul className="fp-gate-points">
              <li>Índice MIPE con umbrales oficiales: Saludable ≥95%, Alerta 80–94%, Vulnerable &lt;80%.</li>
              <li>Informes en línea con evidencias y descarga Word cuando lo necesites.</li>
              <li>Hallazgos, recomendaciones y compromisos visibles para el responsable de finca.</li>
            </ul>
          </div>
          <p className="fp-gate-foot">AVGUST · Juntos Crecemos Bien</p>
        </section>

        <section className="fp-gate-panel">
          <div className="fp-gate-card">
            <h2>Acceso con código de invitación</h2>
            <p>
              Ingresa el PIN emitido por tu técnico AVGUST para ver solo la información de tu finca.
            </p>

            {errorMsg && (
              <div className="fp-error" role="alert">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="fp-form">
              <label htmlFor="portalPinInput">
                Código de invitación
                <div className="fp-pin-wrap">
                  <Lock size={16} aria-hidden />
                  <input
                    id="portalPinInput"
                    type="text"
                    placeholder="EJ. MIPE-7482"
                    value={inputCode}
                    onChange={e => setInputCode(e.target.value.toUpperCase())}
                    autoComplete="one-time-code"
                    inputMode="text"
                    required
                  />
                </div>
              </label>

              <button type="submit" className="fp-btn-primary" disabled={verifying}>
                <KeyRound size={16} aria-hidden />
                {verifying ? 'Validando…' : 'Entrar al portal'}
              </button>
            </form>

            <div className="fp-gate-help">
              <p>
                ¿Sin código? Solicítalo a tu técnico comercial o responsable de zona AVGUST.
              </p>
              <button type="button" className="fp-link-btn" onClick={onExitPortal}>
                Volver a la consola de trabajo
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const trajectoryData = farmVisits.map((v, idx) => {
    const m = metrics(v);
    return {
      index: idx + 1,
      date: v.date,
      label: `V${idx + 1}`,
      fullLabel: `Visita ${idx + 1} · ${v.date}`,
      score: m.score ?? 0,
      compliance: m.criteriaCompliance ?? 0,
      findings: m.findings,
      responsible: v.responsible,
      status: m.status
    };
  });

  const TrendIcon = recentDelta === null
    ? Minus
    : recentDelta >= 5
      ? ArrowUpRight
      : recentDelta <= -5
        ? ArrowDownRight
        : Minus;

  const tabs: {id: PortalTab; label: string; icon: typeof TrendingUp}[] = [
    {id: 'overview', label: 'Estado actual', icon: TrendingUp},
    {id: 'reports', label: `Informes (${farmVisits.length})`, icon: FileText},
    {id: 'processes', label: '5 procesos', icon: Layers},
    {id: 'commitments', label: 'Hallazgos y compromisos', icon: AlertTriangle}
  ];

  return (
    <div className="farm-portal">
      <header className="fp-topbar">
        <div className="fp-topbar-brand">
          <img src="/avgust-logo.svg" alt="AVGUST" />
          <div className="fp-topbar-meta">
            <small>Portal de Finca · En línea</small>
            <strong title={invitation.farm}>{invitation.farm}</strong>
          </div>
        </div>

        <div className="fp-topbar-actions">
          <div className="fp-chip is-desktop">
            <ShieldCheck size={14} aria-hidden />
            <span>
              Invitado: <strong>{invitation.clientName}</strong>
            </span>
            <span aria-hidden>·</span>
            <span>Código {invitation.code}</span>
          </div>
          <button type="button" className="fp-btn-ghost" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={14} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <main className="fp-main">
        <section className="fp-hero" aria-labelledby="fp-hero-title">
          <div className="fp-hero-copy">
            <small>
              <ShieldCheck size={13} aria-hidden />
              Acceso verificado · Técnico {invitation.createdBy || 'AVGUST'}
            </small>
            <h1 id="fp-hero-title">Aseguramiento MIPE</h1>
            <p>
              Lee en segundos el estado de tu finca: índice ponderado, cobertura de procesos,
              hallazgos abiertos y la tendencia frente a la visita anterior.
            </p>
            <div className="fp-hero-meta">
              <span>
                Finca: <strong>{invitation.farm}</strong>
              </span>
              <span>
                Última visita:{' '}
                <strong>{latestVisit?.date || (cloudLoading ? 'Cargando…' : 'Sin informes')}</strong>
              </span>
              <span>
                Tendencia:{' '}
                <strong>
                  {metricTrendLabels[trend]}
                  {recentDelta !== null ? ` (${recentDelta > 0 ? '+' : ''}${recentDelta} pts)` : ''}
                </strong>
              </span>
            </div>
          </div>

          <div className={`fp-score ${statusClass(latestStatus)}`} aria-live="polite">
            <span className="fp-score-label">Índice MIPE actual</span>
            <span className={`fp-score-value farm-portal-tabular ${statusClass(latestStatus)}`}>
              {latestScore === null ? '—' : `${latestScore}%`}
            </span>
            <span className={`fp-status ${statusClass(latestStatus)}`}>
              {statusLabel(latestScore, latestStatus)}
            </span>
            <span className="fp-score-date">
              {latestVisit
                ? `Informe del ${latestVisit.date} · Resp. ${latestVisit.responsible}`
                : cloudLoading
                  ? 'Sincronizando informes en la nube…'
                  : 'Aún no hay visitas revisadas para esta finca'}
            </span>
          </div>
        </section>

        <div className="fp-snapshot" aria-label="Resumen operativo">
          <div className="fp-snapshot-item">
            <span>Auditorías</span>
            <strong className="farm-portal-tabular">{farmVisits.length}</strong>
            <em>{cloudLoading && !farmVisits.length ? 'Buscando en la nube…' : 'Visitas revisadas en línea'}</em>
          </div>
          <div className="fp-snapshot-item">
            <span>Conformidad</span>
            <strong className="farm-portal-tabular is-accent">
              {latestMetrics ? `${latestMetrics.positive}/${latestMetrics.applicable}` : '—'}
            </strong>
            <em>
              {latestMetrics?.criteriaCompliance != null
                ? `${latestMetrics.criteriaCompliance}% criterios con Sí`
                : 'Sin criterios aplicables'}
            </em>
          </div>
          <div className="fp-snapshot-item">
            <span>Hallazgos abiertos</span>
            <strong
              className={`farm-portal-tabular ${(latestMetrics?.findings ?? 0) > 0 ? 'is-bad' : 'is-good'}`}
            >
              {latestMetrics?.findings ?? 0}
            </strong>
            <em>
              {(latestMetrics?.findings ?? 0) === 0
                ? 'Sin desviaciones en la última visita'
                : 'Requieren plan correctivo'}
            </em>
          </div>
          <div className="fp-snapshot-item">
            <span>Cobertura ponderada</span>
            <strong className="farm-portal-tabular">
              {latestMetrics ? `${coveragePct}%` : '—'}
            </strong>
            <em>
              {latestVisit
                ? `${latestMetrics?.evaluatedChapters.length ?? 0}/5 capítulos con peso auditado`
                : 'Pesos oficiales 5 / 25 / 10 / 30 / 30'}
            </em>
          </div>
        </div>

        <nav className="fp-tabs" aria-label="Secciones del portal">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`fp-tab${active ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={15} aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === 'overview' && (
          <div className="fp-panel">
            <div className="fp-section-head">
              <h2>Evolución del índice MIPE</h2>
              <p>
                Curva de todas las auditorías revisadas. Líneas de referencia en 95% (Saludable) y 80% (Alerta).
              </p>
            </div>

            {trajectoryData.length > 0 ? (
              <div className="fp-chart">
                <div className="fp-chart-legend">
                  <span><i style={{background: '#78be20'}} />Saludable ≥95%</span>
                  <span><i style={{background: '#f2a900'}} />Alerta 80–94%</span>
                  <span><i style={{background: '#c23131'}} />Vulnerable &lt;80%</span>
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                    <TrendIcon size={13} aria-hidden />
                    {metricTrendLabels[trend]}
                    {recentDelta !== null ? ` · ${recentDelta > 0 ? '+' : ''}${recentDelta} pts vs. visita previa` : ''}
                  </span>
                </div>
                <div className="w-full overflow-x-auto">
                  <div style={{minWidth: Math.max(420, trajectoryData.length * 72)}}>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={trajectoryData} margin={{top: 12, right: 16, left: -12, bottom: 0}}>
                        <defs>
                          <linearGradient id="portalColorMipe" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007fa3" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#007fa3" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d5dee4" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize: 11, fill: '#5b6b75'}} />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={v => `${v}%`}
                          tick={{fontSize: 11, fill: '#5b6b75'}}
                        />
                        <Tooltip
                          content={({active, payload}) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0].payload as (typeof trajectoryData)[0];
                            return (
                              <div className="fp-tooltip">
                                <strong>{item.fullLabel}</strong>
                                <div>Responsable AVGUST: {item.responsible}</div>
                                <div style={{color: '#007fa3', fontWeight: 700}}>Índice MIPE: {item.score}%</div>
                                <div>Conformidad: {item.compliance}%</div>
                                <div style={{fontWeight: 700, color: item.findings > 0 ? '#c23131' : '#5c9914'}}>
                                  Hallazgos: {item.findings}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine
                          y={95}
                          stroke="#78be20"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          label={{value: '≥95%', fill: '#5c9914', fontSize: 10, position: 'insideTopRight'}}
                        />
                        <ReferenceLine
                          y={80}
                          stroke="#f2a900"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          label={{value: '80%', fill: '#b45309', fontSize: 10, position: 'insideBottomRight'}}
                        />
                        <Area
                          type="monotone"
                          name="Índice MIPE"
                          dataKey="score"
                          stroke="#007fa3"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#portalColorMipe)"
                          dot={{r: 4, fill: '#00b5e2', strokeWidth: 2, stroke: '#fff'}}
                          activeDot={{r: 6}}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fp-empty">
                <strong>
                  {cloudLoading ? 'Sincronizando informes…' : 'Aún no hay auditorías para graficar'}
                </strong>
                <p>
                  {cloudLoading
                    ? 'Estamos cargando las visitas revisadas desde AVGUST Cloud.'
                    : 'Cuando tu técnico publique un informe revisado, aquí verás la evolución del índice MIPE.'}
                </p>
              </div>
            )}

            {historyAnalysis?.chapters && farmVisits.length > 0 && (
              <div className="fp-chapters" aria-label="Vista rápida por proceso">
                {historyAnalysis.chapters.map(chapter => (
                  <div key={chapter.id} className={`fp-chapter ${statusClass(chapter.status)}`}>
                    <div className="fp-chapter-top">
                      <span style={{background: 'transparent', padding: 0, color: 'inherit'}}>
                        Cap. {chapter.id}
                      </span>
                      <span>{chapter.weightPct}%</span>
                    </div>
                    <h3>{chapter.title}</h3>
                    <strong className={`farm-portal-tabular ${statusClass(chapter.status)}`}>
                      {chapter.score === null ? '—' : `${chapter.score}%`}
                    </strong>
                    <p>{metricStatusLabels[chapter.status]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="fp-panel">
            <div className="fp-section-head">
              <h2>Historial de informes en línea</h2>
              <p>
                Abre el informe digital con evidencias o descárgalo en Word. Solo visitas revisadas de tu finca.
              </p>
            </div>

            {farmVisits.length === 0 ? (
              <div className="fp-empty">
                <strong>
                  {cloudLoading ? 'Buscando informes en la nube…' : 'No hay informes publicados aún'}
                </strong>
                <p>
                  {cloudLoading
                    ? 'La sincronización puede tardar unos segundos la primera vez.'
                    : 'Tu técnico AVGUST debe marcar la visita como revisada y publicarla para que aparezca aquí.'}
                </p>
              </div>
            ) : (
              farmVisits
                .slice()
                .reverse()
                .map((visit, idx) => {
                  const m = metrics(visit);
                  const score = m.score;
                  return (
                    <article key={visit.id} className="fp-report">
                      <div className="fp-report-main">
                        <div className="fp-report-title">
                          <span>Informe #{farmVisits.length - idx}</span>
                          <strong>Auditoría del {visit.date}</strong>
                          <span className={`fp-status ${statusClass(m.status)}`}>
                            {statusLabel(score, m.status)}
                          </span>
                        </div>
                        <div className="fp-report-meta">
                          <span>
                            Índice:{' '}
                            <strong className="farm-portal-tabular">
                              {score === null ? '—' : `${score}%`}
                            </strong>
                          </span>
                          <span>
                            Responsable AVGUST: <strong>{visit.responsible}</strong>
                          </span>
                          <span>
                            Representante finca: <strong>{visit.technician || '—'}</strong>
                          </span>
                          <span>
                            Capítulos: <strong>{visit.chapters.length}/5</strong>
                          </span>
                          <span>
                            Hallazgos:{' '}
                            <strong style={{color: m.findings > 0 ? '#c23131' : '#5c9914'}}>
                              {m.findings}
                            </strong>
                          </span>
                        </div>
                      </div>
                      <div className="fp-report-actions">
                        <button
                          type="button"
                          className="fp-btn-action"
                          onClick={() => setViewingReportId(visit.id)}
                          title="Ver informe interactivo"
                        >
                          <Globe size={14} aria-hidden />
                          Ver en línea
                        </button>
                        <button
                          type="button"
                          className="fp-btn-secondary"
                          onClick={() => void exportWord(visit)}
                          title="Descargar Word"
                        >
                          <Download size={14} aria-hidden />
                          Word
                        </button>
                      </div>
                    </article>
                  );
                })
            )}
          </div>
        )}

        {activeTab === 'processes' && (
          <div className="fp-panel">
            <div className="fp-section-head">
              <h2>Comportamiento por proceso normativo</h2>
              <p className="fp-weights-note">
                Ponderación oficial MIPE: Almacén 5%, Dosificación 25%, Transporte 10%, Mezclas 30% y Aplicación 30%.
              </p>
            </div>

            {!farmVisits.length ? (
              <div className="fp-empty">
                <strong>Sin datos de procesos todavía</strong>
                <p>
                  Los cinco capítulos aparecerán con su puntaje cuando exista al menos una visita revisada.
                </p>
              </div>
            ) : (
              <div className="fp-chapters">
                {catalog.map(chapter => {
                  const chapterStats = historyAnalysis?.chapters.find(c => c.id === chapter.id);
                  const score = chapterStats?.score ?? null;
                  const status = chapterStats?.status ?? 'pending';
                  const weightPct = Math.round((CHAPTER_WEIGHTS[chapter.id] ?? 0) * 100);
                  return (
                    <div key={chapter.id} className={`fp-chapter ${statusClass(status)}`}>
                      <div className="fp-chapter-top">
                        <span style={{background: 'transparent', padding: 0, color: 'inherit'}}>
                          Capítulo {chapter.id}
                        </span>
                        <span>Peso {weightPct}%</span>
                      </div>
                      <h3>{chapter.title}</h3>
                      <strong className={`farm-portal-tabular ${statusClass(status)}`}>
                        {score === null ? '—' : `${score}%`}
                      </strong>
                      <p>{CHAPTER_BLURBS[chapter.id] || metricStatusLabels[status]}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'commitments' && (
          <div className="fp-panel">
            <div className="fp-section-head">
              <h2>Hallazgos y compromisos de mejora</h2>
              <p>
                Desviaciones de la última auditoría, con recomendación técnica y estado del compromiso cuando exista.
              </p>
            </div>

            {historyAnalysis?.problems && historyAnalysis.problems.length > 0 ? (
              <div className="fp-problems">
                {historyAnalysis.problems.map(prob => {
                  const actionStatus = (prob.action.status || 'proposed') as keyof typeof actionLabels;
                  return (
                    <article key={prob.id} className="fp-problem">
                      <div className="fp-problem-top">
                        <span>Criterio {prob.id}</span>
                        <em>
                          Cap. {prob.chapter} · Peso {prob.weightPct}%
                          {prob.isRecurrent ? ' · Recurrente' : prob.isNew ? ' · Nuevo' : ''}
                        </em>
                      </div>
                      <h3>{prob.text}</h3>
                      <div className="fp-problem-rec">
                        <strong>Recomendación AVGUST</strong>
                        {prob.recommendation || 'Sin recomendación registrada.'}
                      </div>
                      <div className="fp-problem-foot">
                        <span>
                          Compromiso:{' '}
                          <strong>
                            {actionLabels[actionStatus] || actionStatus}
                          </strong>
                        </span>
                        {prob.action.owner ? <span>Responsable: {prob.action.owner}</span> : null}
                        {prob.action.due ? <span>Vence: {prob.action.due}</span> : null}
                        <span>
                          Recurrencia: {prob.occurrences} informe{prob.occurrences === 1 ? '' : 's'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="fp-empty is-good">
                <strong>
                  {farmVisits.length
                    ? 'Sin hallazgos abiertos en la última auditoría'
                    : cloudLoading
                      ? 'Cargando hallazgos…'
                      : 'Sin auditorías para revisar compromisos'}
                </strong>
                <p>
                  {farmVisits.length
                    ? 'Mantén el estándar: la finca no tiene desviaciones registradas en el informe más reciente.'
                    : 'Cuando se publique una visita con hallazgos, los verás aquí con su plan de acción.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fp-footer">
        AVGUST CARE 360 · Portal de Finca · Juntos Crecemos Bien
      </footer>
    </div>
  );
}
