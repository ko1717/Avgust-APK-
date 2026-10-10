'use client';
import {lazy, Suspense, useState, useEffect, useMemo} from 'react';
import {
  Download,
  Globe,
  LogOut,
  Lock,
  KeyRound,
  ExternalLink,
  FileText
} from 'lucide-react';
import {
  verifyFarmInvitation,
  getClientSession,
  setClientSession,
  clearClientSession,
  type FarmInvitation
} from '@/lib/invitations';
import {exportWord} from '@/lib/export-word';
import {
  actionLabels,
  CHAPTER_WEIGHTS,
  farmKey,
  findings,
  metricStatusDescriptions,
  metricStatusLabels,
  sameChapterScope,
  type MetricStatus,
  type Visit
} from '@/lib/model';
import {farmMetricHistory} from '@/lib/metric-analysis';
import {ensurePortalAuth, getLastPortalAuthWarning, listFarmCloudVisits, subscribeToFarmVisits} from '@/lib/firebase';
import MetricsKpiStrip from './metrics-kpi-strip';
import './b2b-metrics.css';
import './farm-portal.css';

const StandaloneOnlineReport = lazy(() =>
  import('./online-report-view').then(module => ({default: module.StandaloneOnlineReport}))
);

type FarmPortalViewProps = {
  initialToken?: string;
  visits: Visit[];
  onExitPortal: () => void;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>(resolve => {
        timer = setTimeout(() => resolve(fallback), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function StatusBadge({value}: {value: MetricStatus}) {
  const labels: Record<MetricStatus, string> = {
    healthy: 'Saludable (95-100%)',
    acceptable: 'Alerta (80-94%)',
    critical: 'Vulnerable (< 80%)',
    pending: 'Sin medición'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value]}</span>;
}

export function FarmPortalView({initialToken, visits, onExitPortal}: FarmPortalViewProps) {
  const [invitation, setInvitation] = useState<FarmInvitation | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState(false);
  const [expandedReports, setExpandedReports] = useState(false);
  const [cloudVisits, setCloudVisits] = useState<Visit[]>([]);
  const [cloudSyncedFarm, setCloudSyncedFarm] = useState('');
  const [authWarning, setAuthWarning] = useState('');

  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      setErrorMsg('');
      setAuthWarning('');
      await withTimeout(ensurePortalAuth(), 8000, null);
      const warning = getLastPortalAuthWarning();
      if (warning) setAuthWarning(warning);

      if (initialToken) {
        const found = await withTimeout(verifyFarmInvitation(initialToken), 8000, null);
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
        const recheck = await withTimeout(verifyFarmInvitation(stored.code || stored.token), 8000, null);
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

  const historyAnalysis = useMemo(() => {
    if (!invitation || !farmVisits.length) return null;
    return farmMetricHistory(farmVisits, invitation.farm);
  }, [invitation, farmVisits]);

  const current = historyAnalysis?.latest;
  const previous = historyAnalysis && historyAnalysis.records.length > 1
    ? historyAnalysis.records[historyAnalysis.records.length - 2]
    : undefined;
  const comparableChapterPair = Boolean(
    current && previous && sameChapterScope(previous.visit, current.visit)
  );
  const selectedDelta = comparableChapterPair && current && previous
    ? current.score - previous.score
    : null;

  const chapterTrends = useMemo(() => {
    if (!historyAnalysis || !current) {
      return [1, 2, 3, 4, 5].map(id => ({
        id,
        title: historyAnalysis?.chapters.find(c => c.id === id)?.title || `Capítulo ${id}`,
        weightPct: Math.round((CHAPTER_WEIGHTS[id] || 0) * 100),
        score: null as number | null,
        delta: null as number | null,
        comparisons: 0
      }));
    }

    return historyAnalysis.chapters.map(chapter => {
      const currentPoint = chapter.visitEvolution.find(point => point.visitId === current.visit.id);
      const previousPoint = chapter.visitEvolution.find(point => point.visitId === previous?.visit.id);
      const delta =
        comparableChapterPair &&
        currentPoint?.score !== null &&
        currentPoint?.score !== undefined &&
        previousPoint?.score !== null &&
        previousPoint?.score !== undefined
          ? Math.round((currentPoint.score - previousPoint.score) * 10) / 10
          : null;
      return {
        id: chapter.id,
        title: chapter.title,
        weightPct: chapter.weightPct,
        score: currentPoint?.score ?? null,
        delta,
        comparisons: delta === null ? 0 : 1
      };
    });
  }, [historyAnalysis, current, previous, comparableChapterPair]);

  const selectedProblems = useMemo(() => {
    if (!current) return [];
    return findings(current.visit).map(f => ({
      id: f.id,
      text: f.text,
      observation: f.answer.observation,
      recommendation: f.answer.recommendation,
      chapter: Number(f.id.split('.')[0]),
      weightPct: Math.round((CHAPTER_WEIGHTS[Number(f.id.split('.')[0])] || 0) * 100),
      action: {
        owner: f.action.owner,
        due: f.action.due,
        status: f.action.status
      }
    }));
  }, [current]);

  const podium = useMemo(() => {
    if (!historyAnalysis) return [];
    return historyAnalysis.records.slice(-3).map((record, index, items) => {
      const prior = index > 0 ? items[index - 1] : undefined;
      return {
        record,
        label:
          index === items.length - 1
            ? 'Último aseguramiento'
            : index === items.length - 2
              ? 'Aseguramiento anterior'
              : 'Inicio del periodo',
        delta:
          prior && sameChapterScope(prior.visit, record.visit)
            ? record.score - prior.score
            : null,
        hasPrevious: Boolean(prior)
      };
    });
  }, [historyAnalysis]);

  const handleVerifyCode = async (e: {preventDefault: () => void}) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setVerifying(true);
    setErrorMsg('');
    try {
      await withTimeout(ensurePortalAuth(), 8000, null);
      const warning = getLastPortalAuthWarning();
      if (warning) setAuthWarning(warning);
      const found = await withTimeout(verifyFarmInvitation(inputCode.trim()), 10000, null);
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
      <Suspense fallback={<div className="fp-loading"><div className="fp-spinner" aria-hidden /><h2>Cargando informe…</h2><p>Preparando el aseguramiento en línea.</p></div>}>
        <StandaloneOnlineReport
          reportId={viewingReportId}
          onClose={() => setViewingReportId(null)}
        />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="fp-loading">
        <div className="fp-spinner" aria-hidden />
        <h2>Conectando con AVGUST Cloud</h2>
        <p>Verificando invitación del Portal de Finca…</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="fp-gate">
        <div className="fp-gate-stage" aria-hidden />
        <div className="fp-gate-veil" aria-hidden />

        <div className="fp-gate-frame">
          <header className="fp-gate-brand" aria-label="Identidad AVGUST">
            <img src="/avgust-logo.svg" alt="AVGUST Crop Protection" className="fp-gate-mark" />
            <p className="fp-gate-product">
              AVGUST <span>CARE 360</span>
            </p>
            <h1 className="fp-gate-headline">Portal de finca</h1>
            <p className="fp-gate-lead">
              Consulta el aseguramiento de tu cultivo con la misma lectura del programa Aptus.
            </p>
          </header>

          <section className="fp-gate-panel" aria-labelledby="portal-access-title">
            <form onSubmit={handleVerifyCode} className="fp-gate-access">
              <h2 id="portal-access-title">Código de aseguramiento</h2>
              <p>PIN emitido por tu técnico AVGUST para acceder solo a tu finca.</p>

              {errorMsg && (
                <div className="fp-error" role="alert">
                  {errorMsg}
                </div>
              )}
              {authWarning && !errorMsg && (
                <div className="fp-error" role="status">
                  {authWarning}
                </div>
              )}

              <label htmlFor="portalPinInput">
                Código de aseguramiento
                <div className="fp-pin-wrap">
                  <Lock size={16} aria-hidden />
                  <input
                    id="portalPinInput"
                    type="text"
                    placeholder="EJ. ASEG-7482"
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

              <div className="fp-gate-help">
                <p>¿Sin código? Pídelo a tu técnico o responsable de zona AVGUST.</p>
                <button type="button" className="fp-link-btn" onClick={onExitPortal}>
                  Volver a la consola de trabajo
                </button>
              </div>
            </form>
          </section>
        </div>

        <p className="fp-gate-foot">AVGUST Crop Protection · Juntos Crecemos Bien</p>
      </div>
    );
  }

  const latestStatus: MetricStatus = current?.status ?? 'pending';
  const latestScore = current?.score ?? null;

  return (
    <div className="farm-portal">
      <div className="fp-lateral fp-lateral-left" aria-hidden>
        <span className="fp-lateral-brand">AVGUST</span>
      </div>
      <div className="fp-lateral fp-lateral-right" aria-hidden>
        <span className="fp-lateral-brand">CARE 360</span>
      </div>

      <header className="fp-topbar">
        <div className="fp-topbar-brand">
          <img src="/avgust-logo.svg" alt="AVGUST" />
          <div className="fp-topbar-meta">
            <small>Portal de Finca · CARE 360</small>
            <strong title={invitation.farm}>{invitation.farm}</strong>
          </div>
        </div>

        <div className="fp-topbar-actions">
          {current && (
            <div className={`fp-status-chip ${latestStatus}`} title={metricStatusDescriptions[latestStatus]}>
              <span>Índice</span>
              <strong>
                {latestScore === null ? '—' : `${latestScore}%`}
              </strong>
              <StatusBadge value={latestStatus} />
            </div>
          )}
          <div className="fp-chip is-desktop">
            <span>
              Invitado: <strong>{invitation.clientName}</strong>
            </span>
            <span aria-hidden>·</span>
            <span>Código de aseguramiento {invitation.code}</span>
          </div>
          <button type="button" className="b2b-btn b2b-btn-secondary" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={14} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <section className="fp-hero" aria-labelledby="farm-portal-title">
        <div className="fp-hero-stage" aria-hidden />
        <div className="fp-hero-veil" aria-hidden />
        <div className="fp-hero-inner">
          <div className="fp-hero-copy">
            <p className="fp-hero-product">
              AVGUST <span>CARE 360</span>
            </p>
            <h1 id="farm-portal-title">Portal de finca</h1>
            <p className="fp-hero-farm">{invitation.farm}</p>
            <p className="fp-hero-lead">
              Misma lectura de métricas: resultado ponderado, capítulos y acciones correctivas.
            </p>
          </div>
          <div className="fp-hero-actions">
            {current ? (
              <>
                <a className="fp-hero-cta" href="#fp-metrics-anchor">
                  Ver estado de aseguramiento {latestScore === null ? '' : `· ${latestScore}%`}
                </a>
                <button
                  type="button"
                  className="b2b-btn b2b-btn-secondary"
                  onClick={() => setViewingReportId(current.visit.id)}
                >
                  <ExternalLink size={16} aria-hidden />
                  Abrir último informe
                </button>
                <button
                  type="button"
                  className="b2b-btn b2b-btn-primary"
                  onClick={() => void exportWord(current.visit)}
                >
                  <FileText size={16} aria-hidden />
                  Descargar Word
                </button>
              </>
            ) : (
              <a className="fp-hero-cta" href="#fp-metrics-anchor">
                Ver estado de aseguramiento
              </a>
            )}
          </div>
        </div>
      </section>

      <main className="fp-main" id="fp-metrics-anchor">
        <div className="b2b-metrics-wrapper" aria-label="Indicadores de aseguramiento">
          {cloudLoading && !farmVisits.length ? (
            <div className="fp-metrics-loading">Cargando indicadores de aseguramiento…</div>
          ) : !current ? (
            <div className="fp-metrics-empty" aria-live="polite">
              <span className="fp-empty-kicker">Estado de la finca</span>
              <strong>
                {cloudLoading
                  ? 'Sincronizando aseguramientos…'
                  : 'Aún no hay aseguramientos revisados para esta finca'}
              </strong>
              <p>
                {cloudLoading
                  ? 'Estamos cargando las visitas revisadas desde AVGUST Cloud.'
                  : 'Cuando tu técnico publique un informe revisado, aquí verás el resultado ponderado, la tendencia por capítulo y las desviaciones con acción correctiva.'}
              </p>
              <ul className="fp-empty-preview" aria-hidden={cloudLoading ? true : undefined}>
                <li><span>Índice de aseguramiento</span><em>Saludable · Alerta · Vulnerable</em></li>
                <li><span>5 procesos</span><em>Pesos 5 / 25 / 10 / 30 / 30</em></li>
                <li><span>Acciones</span><em>Hallazgos y compromisos</em></li>
              </ul>
              <p className="fp-weights-note">
                Umbrales oficiales: Saludable 95–100% · Alerta 80–94% · Vulnerable &lt;80%.
              </p>
            </div>
          ) : (
            <div className="metrics-executive-dashboard">
              <section className={`metrics-outcome ${latestStatus}`} aria-label="Conclusión de la finca">
                <div className="metrics-outcome-main">
                  <div className="metrics-section-kicker">
                    Aseguramiento consultado · {current.date}
                  </div>
                  <h3>{historyAnalysis?.farm || invitation.farm}</h3>
                  <StatusBadge value={latestStatus} />
                  <p className="metrics-outcome-copy">{metricStatusDescriptions[latestStatus]}</p>
                  <div className="metrics-outcome-actions">
                    <button
                      type="button"
                      className="b2b-btn b2b-btn-secondary"
                      onClick={() => setViewingReportId(current.visit.id)}
                    >
                      <Globe size={16} aria-hidden />
                      Ver informe en línea
                    </button>
                  </div>
                </div>
                <div
                  className="metrics-outcome-score"
                  aria-label={`Resultado de aseguramiento ${latestScore} por ciento`}
                >
                  <strong>
                    {latestScore}
                    <span>%</span>
                  </strong>
                  <small>Resultado ponderado</small>
                  <div className="metrics-score-track">
                    <span style={{width: `${Math.min(100, Math.max(0, latestScore ?? 0))}%`}} />
                  </div>
                </div>
                <div className="metrics-outcome-facts">
                  <div>
                    <span>Puntaje</span>
                    <strong>{current.pointsEarned} / 100</strong>
                  </div>
                  <div>
                    <span>Desviaciones</span>
                    <strong>{current.findings}</strong>
                  </div>
                  <div>
                    <span>Cobertura</span>
                    <strong>{current.evaluatedChapters}/5 capítulos</strong>
                  </div>
                  <div>
                    <span>Variación vs. anterior</span>
                    <strong
                      className={
                        selectedDelta === null
                          ? ''
                          : selectedDelta > 0
                            ? 'positive'
                            : selectedDelta < 0
                              ? 'negative'
                              : ''
                      }
                    >
                      {selectedDelta === null
                        ? 'Sin comparación'
                        : `${selectedDelta > 0 ? '+' : ''}${selectedDelta} pts`}
                    </strong>
                  </div>
                </div>
              </section>

              <MetricsKpiStrip
                count={historyAnalysis?.records.length || 0}
                scope={`${historyAnalysis?.farm || invitation.farm} · aseguramientos revisados`}
                chapterTrends={chapterTrends}
                comparisonLabel={
                  comparableChapterPair
                    ? 'Vs. aseguramiento anterior'
                    : 'Sin comparación comparable'
                }
                collapsible
              />

              <div className="metrics-overview-grid">
                <section className="metrics-priority-panel">
                  <div className="metrics-section-heading">
                    <div>
                      <div className="metrics-section-kicker">Qué corregir</div>
                      <h3>Desviaciones y acciones</h3>
                    </div>
                    <span className={`metrics-count ${selectedProblems.length ? 'risk' : 'clear'}`}>
                      {selectedProblems.length}
                    </span>
                  </div>
                  {selectedProblems.length ? (
                    <ul className="metrics-action-list">
                      {(expandedActions ? selectedProblems : selectedProblems.slice(0, 3)).map(problem => (
                        <li key={problem.id}>
                          <div className="metrics-action-title">
                            <strong>
                              {problem.id} · {problem.text}
                            </strong>
                            <span>
                              Cap. {problem.chapter} · {problem.weightPct}%
                            </span>
                          </div>
                          <p className="metrics-action-observation">
                            <strong>Hallazgo / observación:</strong>{' '}
                            {problem.observation || 'Sin observación registrada en este informe.'}
                          </p>
                          <p className="metrics-action-recommendation">
                            <strong>Recomendación sugerida:</strong>{' '}
                            {problem.recommendation || 'Definir y documentar la acción correctiva.'}
                          </p>
                          <div className="metrics-action-meta">
                            <span>
                              Responsable: <b>{problem.action.owner || 'Sin asignar'}</b>
                            </span>
                            <span>
                              Fecha: <b>{problem.action.due || 'Sin definir'}</b>
                            </span>
                            <span>
                              Estado:{' '}
                              <b>
                                {actionLabels[problem.action.status as keyof typeof actionLabels] ||
                                  problem.action.status}
                              </b>
                            </span>
                          </div>
                        </li>
                      ))}
                      {selectedProblems.length > 3 && (
                        <button
                          type="button"
                          className="metrics-more-button"
                          onClick={() => setExpandedActions(value => !value)}
                        >
                          {expandedActions
                            ? 'Mostrar menos'
                            : `Ver las ${selectedProblems.length - 3} acciones restantes`}
                        </button>
                      )}
                    </ul>
                  ) : (
                    <p className="metrics-empty">No se identificaron desviaciones en este aseguramiento.</p>
                  )}
                </section>
              </div>

              {podium.length > 0 && (
                <section className="metrics-podium-panel">
                  <div className="metrics-section-heading">
                    <div>
                      <div className="metrics-section-kicker">Cambio reciente</div>
                      <h3>Últimos aseguramientos</h3>
                    </div>
                    <span className="metrics-note">Comparamos solo con el mismo alcance</span>
                  </div>
                  <div className="metrics-podium-list">
                    {podium.map((point, index) => (
                      <article
                        key={point.record.visit.id}
                        className={point.record.visit.id === current.visit.id ? 'current' : ''}
                      >
                        <span className="metrics-podium-rank">0{index + 1}</span>
                        <div>
                          <small>
                            {point.label} · {point.record.date}
                          </small>
                          <StatusBadge value={point.record.status} />
                        </div>
                        <strong className="metrics-podium-score">{point.record.score}%</strong>
                        <span
                          className={`metrics-podium-delta ${
                            point.delta === null
                              ? 'neutral'
                              : point.delta > 0
                                ? 'positive'
                                : point.delta < 0
                                  ? 'negative'
                                  : 'neutral'
                          }`}
                        >
                          {point.delta === null
                            ? point.hasPrevious
                              ? 'Sin comparación'
                              : 'Línea base'
                            : point.delta > 0
                              ? `+${point.delta} pts`
                              : point.delta < 0
                                ? `${point.delta} pts`
                                : 'Sin cambio'}
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="fp-reports-panel" aria-labelledby="fp-reports-title">
                <div className="metrics-section-heading">
                  <div>
                    <div className="metrics-section-kicker">Historial</div>
                    <h3 id="fp-reports-title">Informes de aseguramiento</h3>
                  </div>
                  <span className="metrics-note">{farmVisits.length} revisados</span>
                </div>
                <div className="fp-reports-summary">
                  <p>
                    {farmVisits.length === 1
                      ? '1 aseguramiento revisado disponible.'
                      : `${farmVisits.length} aseguramientos revisados disponibles.`}
                  </p>
                  <button
                    type="button"
                    className="metrics-disclosure-button"
                    aria-expanded={expandedReports}
                    aria-controls="fp-reports-list"
                    onClick={() => setExpandedReports(value => !value)}
                  >
                    <span>{expandedReports ? 'Ocultar aseguramientos' : 'Ver aseguramientos'}</span>
                  </button>
                </div>
                {expandedReports && (
                  <div className="fp-reports-list" id="fp-reports-list">
                    {farmVisits
                      .slice()
                      .reverse()
                      .map((visit, idx) => {
                        const record = historyAnalysis?.records.find(r => r.visit.id === visit.id);
                        const score = record?.score ?? null;
                        const status = record?.status ?? 'pending';
                        return (
                          <article key={visit.id} className="fp-report-row">
                            <div className="fp-report-row-main">
                              <div className="fp-report-row-title">
                                <span>Informe #{farmVisits.length - idx}</span>
                                <strong>Aseguramiento del {visit.date}</strong>
                                <StatusBadge value={status} />
                              </div>
                              <div className="fp-report-row-meta">
                                <span>
                                  Resultado:{' '}
                                  <strong>{score === null ? '—' : `${score}%`}</strong>
                                </span>
                                <span>
                                  Responsable AVGUST: <strong>{visit.responsible}</strong>
                                </span>
                                <span>
                                  Capítulos: <strong>{visit.chapters.length}/5</strong>
                                </span>
                                <span>
                                  Desviaciones:{' '}
                                  <strong>{record?.findings ?? 0}</strong>
                                </span>
                              </div>
                            </div>
                            <div className="fp-report-row-actions">
                              <button
                                type="button"
                                className="b2b-btn b2b-btn-primary"
                                onClick={() => setViewingReportId(visit.id)}
                              >
                                <Globe size={14} aria-hidden />
                                Ver en línea
                              </button>
                              <button
                                type="button"
                                className="b2b-btn b2b-btn-secondary"
                                onClick={() => void exportWord(visit)}
                              >
                                <Download size={14} aria-hidden />
                                Word
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      <footer className="fp-footer">
        <span>AVGUST CARE 360 · Portal de Finca · Juntos Crecemos Bien</span>
      </footer>
    </div>
  );
}
