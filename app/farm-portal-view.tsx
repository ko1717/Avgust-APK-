'use client';
import {lazy, Suspense, useState, useEffect, useMemo, useRef, type CSSProperties} from 'react';
import {
  CalendarDays,
  ChevronDown,
  Download,
  Globe,
  LogOut,
  Lock,
  KeyRound,
  ExternalLink,
  FileText,
  Minus,
  TrendingDown,
  TrendingUp,
  X
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
import {
  createAssuranceRequest,
  ensurePortalAuth,
  getLastPortalAuthWarning,
  listFarmAssuranceRequests,
  listFarmCloudVisits,
  subscribeToFarmVisits,
  type AssuranceRequest
} from '@/lib/firebase';
import {complianceAnswerLabel, portalActionPresentation, stripMarkdownLite} from '@/lib/portal-format';
import MetricsKpiStrip, {type ChapterTrendKpi} from './metrics-kpi-strip';
import './b2b-metrics.css';
import './farm-portal.css';

const FarmPortalKpiBoard = lazy(() => import('./farm-portal-kpi-board'));
const StandaloneOnlineReport = lazy(() =>
  import('./online-report-view').then(module => ({default: module.StandaloneOnlineReport}))
);

type FarmPortalViewProps = {
  initialToken?: string;
  visits: Visit[];
  onExitPortal: () => void;
  /** When true (Firebase Hosting), hide paths back to the technician console. */
  portalOnly?: boolean;
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

type TrendDirection = 'up' | 'down' | 'flat' | 'none';

function trendDirection(delta: number | null): TrendDirection {
  if (delta === null) return 'none';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

function formatDelta(delta: number) {
  const value = Number.isInteger(delta) ? String(delta) : delta.toFixed(1);
  return `${delta > 0 ? '+' : ''}${value} pts`;
}

function TrendIcon({direction, size = 14}: {direction: TrendDirection; size?: number}) {
  if (direction === 'up') return <TrendingUp size={size} aria-hidden />;
  if (direction === 'down') return <TrendingDown size={size} aria-hidden />;
  return <Minus size={size} aria-hidden />;
}

function trendLabel(direction: TrendDirection) {
  if (direction === 'up') return 'Subió';
  if (direction === 'down') return 'Bajó';
  if (direction === 'flat') return 'Se mantuvo';
  return 'Primera lectura';
}

function SectionMark({index, label}: {index: string; label: string}) {
  return (
    <div className="fp-section-mark" aria-hidden>
      <span>{index}</span>
      <p>{label}</p>
    </div>
  );
}

export function FarmPortalView({
  initialToken,
  visits,
  onExitPortal,
  portalOnly = false
}: FarmPortalViewProps) {
  const [invitation, setInvitation] = useState<FarmInvitation | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState(false);
  const [assuranceOpen, setAssuranceOpen] = useState(false);
  const [assuranceTab, setAssuranceTab] = useState<'schedule' | 'reports'>('schedule');
  const [cloudVisits, setCloudVisits] = useState<Visit[]>([]);
  const [cloudSyncedFarm, setCloudSyncedFarm] = useState('');
  const [authWarning, setAuthWarning] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMsg, setRequestMsg] = useState<{text: string; error?: boolean} | null>(null);
  const [assuranceRequests, setAssuranceRequests] = useState<AssuranceRequest[]>([]);
  const [scrollCompact, setScrollCompact] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);

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
    setRequestPhone(invitation.clientPhone || '');
    setRequestEmail(invitation.clientEmail || '');
    setRequestMsg(null);

    void listFarmCloudVisits(farm).then(list => {
      if (!active) return;
      if (list.length) setCloudVisits(list);
      setCloudSyncedFarm(farm);
    }).catch(() => {
      if (active) setCloudSyncedFarm(farm);
    });

    void listFarmAssuranceRequests(farm)
      .then(list => {
        if (active) setAssuranceRequests(list);
      })
      .catch(() => {
        if (active) setAssuranceRequests([]);
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
  }, [invitation?.farm, invitation?.clientPhone, invitation?.clientEmail]);

  useEffect(() => {
    if (!invitation) {
      setScrollCompact(false);
      return;
    }

    let raf = 0;
    const updateScrollChrome = () => {
      raf = 0;
      const hero = heroRef.current;
      if (!hero) return;

      const rect = hero.getBoundingClientRect();
      const range = Math.max(160, hero.offsetHeight * 0.55);
      const traveled = Math.min(range, Math.max(0, -rect.top));
      const progress = traveled / range;
      hero.style.setProperty('--fp-hero-collapse', progress.toFixed(3));
      setScrollCompact(progress > 0.42);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateScrollChrome);
    };

    updateScrollChrome();
    const scroller = heroRef.current?.closest('.farm-portal');
    scroller?.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    return () => {
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [invitation]);

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
  const baseline = useMemo(() => {
    if (!historyAnalysis || !current) return undefined;
    const earlier = historyAnalysis.records.slice(0, -1);
    for (let index = earlier.length - 1; index >= 0; index -= 1) {
      if (sameChapterScope(earlier[index].visit, current.visit)) return earlier[index];
    }
    return undefined;
  }, [historyAnalysis, current]);
  const indexDelta = current && baseline
    ? Math.round((current.score - baseline.score) * 10) / 10
    : null;
  const indexTrend = trendDirection(indexDelta);

  const chapterTrends = useMemo<ChapterTrendKpi[]>(() => {
    if (!historyAnalysis || !current) {
      return [1, 2, 3, 4, 5].map(id => ({
        id,
        title: historyAnalysis?.chapters.find(c => c.id === id)?.title || `Capítulo ${id}`,
        weightPct: Math.round((CHAPTER_WEIGHTS[id] || 0) * 100),
        score: null,
        delta: null,
        comparisons: 0
      }));
    }

    return historyAnalysis.chapters.map(chapter => {
      const currentIndex = chapter.visitEvolution.findIndex(point => point.visitId === current.visit.id);
      const currentPoint = currentIndex >= 0 ? chapter.visitEvolution[currentIndex] : undefined;
      const previousPoint = currentIndex > 0
        ? chapter.visitEvolution
            .slice(0, currentIndex)
            .reverse()
            .find(point => point.score !== null && point.score !== undefined)
        : undefined;
      const delta =
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
        comparisons: delta === null ? 0 : 1,
        baselineDate: delta === null ? undefined : previousPoint?.date
      };
    });
  }, [historyAnalysis, current]);
  const hasChapterDeltas = chapterTrends.some(chapter => chapter.delta !== null);

  const selectedProblems = useMemo(() => {
    if (!current) return [];
    return findings(current.visit).map(f => {
      const presentation = portalActionPresentation({
        observation: f.answer.observation,
        recommendation: f.answer.recommendation,
        action: f.action
      });
      return {
        id: f.id,
        text: stripMarkdownLite(f.text) || f.text,
        chapter: Number(f.id.split('.')[0]),
        weightPct: Math.round((CHAPTER_WEIGHTS[Number(f.id.split('.')[0])] || 0) * 100),
        ...presentation
      };
    });
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
    setAssuranceRequests([]);
    setRequestMsg(null);
    // Stay on the portal gate; do not open the technician console.
  };

  const handleAssuranceRequest = async (e: {preventDefault: () => void}) => {
    e.preventDefault();
    if (!invitation?.farm) return;
    setRequestBusy(true);
    setRequestMsg(null);
    try {
      await withTimeout(ensurePortalAuth(), 8000, null);
      const created = await createAssuranceRequest({
        farm: invitation.farm,
        farmId: invitation.farmId,
        clientName: invitation.clientName,
        clientPhone: requestPhone,
        clientEmail: requestEmail,
        preferredDate: requestDate,
        notes: requestNotes,
        invitationCode: invitation.code
      });
      setAssuranceRequests(current => [created, ...current.filter(item => item.id !== created.id)]);
      setRequestNotes('');
      setRequestMsg({
        text: 'Solicitud enviada. El equipo técnico AVGUST la verá como pendiente y te contactará para confirmar la fecha.'
      });
    } catch {
      setRequestMsg({
        text: 'No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.',
        error: true
      });
    } finally {
      setRequestBusy(false);
    }
  };

  const pendingRequests = assuranceRequests.filter(
    item => item.status === 'pending' || item.status === 'scheduled'
  );

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

        <header className="fp-gate-top">
          <img src="/portal/avgust-logo-light.svg" alt="AVGUST Crop Protection" className="fp-gate-mark" />
          <span className="fp-gate-top-tag">Portal de finca</span>
        </header>

        <div className="fp-gate-frame">
          <section className="fp-gate-brand" aria-label="Identidad AVGUST CARE 360">
            <p className="fp-kicker">Aseguramiento AVGUST · Fincas de flores</p>
            <h1 className="fp-wordmark">
              <span className="fp-wordmark-pre">AVGUST</span>
              <span className="fp-wordmark-main">
                CARE <em>360</em>
              </span>
            </h1>
            <span className="fp-brand-rule" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            <p className="fp-gate-lead">
              <strong>Portal de finca.</strong> La lectura oficial de tu cultivo, capítulo por capítulo,
              con las acciones que tu técnico AVGUST ya revisó.
            </p>
          </section>

          <section className="fp-gate-panel" aria-labelledby="portal-access-title">
            <form onSubmit={handleVerifyCode} className="fp-gate-access">
              <span className="fp-gate-step">Acceso privado</span>
              <h2 id="portal-access-title">Ingresa tu código</h2>
              <p>Código ASEG emitido por tu técnico AVGUST — acceso exclusivo a tu finca.</p>

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
                Código de acceso
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
                <p>¿Sin código? Solicítalo a tu técnico o responsable de zona AVGUST.</p>
                {!portalOnly && (
                  <button type="button" className="fp-link-btn" onClick={onExitPortal}>
                    Volver a la consola de trabajo
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>

        <footer className="fp-gate-foot">
          <span>AVGUST Crop Protection</span>
          <span>Juntos Crecemos Bien</span>
        </footer>
      </div>
    );
  }

  const latestStatus: MetricStatus = current?.status ?? 'pending';
  const latestScore = current?.score ?? null;

  return (
    <div className={`farm-portal${scrollCompact ? ' is-compact' : ''}`}>
      <header className={`fp-topbar${scrollCompact ? ' is-compact' : ''}`}>
        <div className="fp-page-width fp-topbar-row">
        <div className="fp-topbar-brand">
          <img src="/portal/avgust-logo-light.svg" alt="AVGUST" />
          <div className="fp-topbar-meta">
            <small>CARE 360 · Portal de finca</small>
            <strong title={invitation.farm}>{invitation.farm}</strong>
          </div>
        </div>

        <div className="fp-topbar-actions">
          {current && (
            <div
              className={`fp-status-chip ${latestStatus}`}
              title={`Índice oficial del aseguramiento: ${latestScore === null ? '—' : `${latestScore}%`}. ${metricStatusDescriptions[latestStatus]}`}
            >
              <span>Índice oficial</span>
              <strong>
                {latestScore === null ? '—' : `${latestScore}%`}
              </strong>
              {indexDelta !== null && (
                <em className={`fp-trend-pill is-${indexTrend}`} aria-label={`${trendLabel(indexTrend)} ${formatDelta(indexDelta)} frente a la visita anterior`}>
                  <TrendIcon direction={indexTrend} size={12} />
                  {indexDelta === 0 ? '0' : formatDelta(indexDelta).replace(' pts', '')}
                </em>
              )}
              <StatusBadge value={latestStatus} />
            </div>
          )}
          <div className="fp-topbar-scroll-ctas" aria-hidden={!scrollCompact}>
            <a className="fp-topbar-cta" href="#fp-metrics-anchor">
              Ver el indicador
            </a>
            {current && (
              <button
                type="button"
                className="fp-topbar-cta is-report"
                onClick={() => setViewingReportId(current.visit.id)}
              >
                <ExternalLink size={14} aria-hidden />
                Último informe
              </button>
            )}
          </div>
          <div className="fp-chip is-desktop fp-topbar-guest">
            <span>
              Invitado <strong>{invitation.clientName}</strong>
            </span>
            <span aria-hidden className="fp-chip-sep" />
            <span>{invitation.code}</span>
          </div>
          <button type="button" className="fp-topbar-exit" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={14} aria-hidden />
            <span>Salir</span>
          </button>
        </div>
        </div>
      </header>

      <section
        ref={heroRef}
        className="fp-hero"
        aria-labelledby="farm-portal-title"
        style={{'--fp-hero-collapse': 0} as CSSProperties}
      >
        <div className="fp-hero-stage" aria-hidden>
          <div className="fp-hero-stage-photo" />
        </div>
        <div className="fp-hero-veil" aria-hidden />
        <div className="fp-page-width fp-hero-inner">
          <div className="fp-hero-copy">
            <p className="fp-kicker">Portal de finca · Aseguramiento AVGUST</p>
            <h1 id="farm-portal-title" className="fp-wordmark">
              <span className="fp-wordmark-pre">AVGUST</span>
              <span className="fp-wordmark-main">
                CARE <em>360</em>
              </span>
              <span className="fp-visually-hidden"> · Portal de finca</span>
            </h1>
            <span className="fp-brand-rule" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            <p className="fp-hero-farm">{invitation.farm}</p>
            <p className="fp-hero-lead">
              Estado del cultivo, capítulos y acciones correctivas con la lectura oficial del programa.
            </p>
            <div className="fp-hero-actions">
              <a className="fp-hero-cta" href="#fp-metrics-anchor">
                Ver el indicador
                <ChevronDown size={16} aria-hidden />
              </a>
              {current && (
                <>
                  <button
                    type="button"
                    className="fp-hero-ghost"
                    onClick={() => setViewingReportId(current.visit.id)}
                  >
                    <ExternalLink size={15} aria-hidden />
                    Último informe
                  </button>
                  <button
                    type="button"
                    className="fp-hero-ghost"
                    onClick={() => void exportWord(current.visit)}
                  >
                    <FileText size={15} aria-hidden />
                    Descargar Word
                  </button>
                </>
              )}
            </div>
          </div>

          {current && (
            <aside className={`fp-hero-index ${latestStatus}`} aria-label="Índice oficial del último aseguramiento">
              <span className="fp-hero-index-label">Índice oficial</span>
              <strong className="fp-hero-index-value">
                {latestScore === null ? '—' : latestScore}
                {latestScore !== null && <small>%</small>}
              </strong>
              <span className="fp-hero-index-track" aria-hidden>
                <span style={{width: `${Math.min(100, Math.max(0, latestScore ?? 0))}%`}} />
              </span>
              <StatusBadge value={latestStatus} />
              <span className={`fp-hero-index-trend is-${indexTrend}`}>
                <TrendIcon direction={indexTrend} size={14} />
                {indexDelta === null ? (
                  <span>Primera lectura de referencia</span>
                ) : (
                  <span>
                    <b>{indexDelta === 0 ? 'Sin cambio' : formatDelta(indexDelta)}</b>
                    {' '}vs. visita {baseline?.date}
                  </span>
                )}
              </span>
            </aside>
          )}
        </div>

        <dl className="fp-page-width fp-hero-credits">
          <div>
            <dt>Cliente</dt>
            <dd>{invitation.clientName}</dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd>{invitation.code}</dd>
          </div>
          <div>
            <dt>Último aseguramiento</dt>
            <dd>{current ? current.date : 'Pendiente'}</dd>
          </div>
          <div>
            <dt>Técnico</dt>
            <dd>{current?.visit.responsible || 'Equipo AVGUST'}</dd>
          </div>
        </dl>
      </section>

      <aside className={`fp-assurance-dock ${assuranceOpen ? 'is-open' : ''}`}>
        {assuranceOpen && (
          <button
            type="button"
            className="fp-assurance-scrim"
            aria-label="Cerrar panel de aseguramiento"
            onClick={() => setAssuranceOpen(false)}
          />
        )}
        {!assuranceOpen ? (
          <button
            type="button"
            className="fp-assurance-fab"
            aria-expanded={false}
            aria-controls="fp-assurance-panel"
            onClick={() => setAssuranceOpen(true)}
            title="Agendar y consultar el aseguramiento AVGUST"
          >
            <CalendarDays size={18} aria-hidden />
            <span>Aseguramiento</span>
            {pendingRequests.length > 0 && (
              <em className="fp-assurance-badge" aria-label={`${pendingRequests.length} pendientes`}>
                {pendingRequests.length}
              </em>
            )}
          </button>
        ) : (
          <div
            className="fp-assurance-panel"
            id="fp-assurance-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="fp-assurance-title"
          >
            <header className="fp-assurance-panel-head">
              <div>
                <p className="fp-assurance-kicker">Aseguramiento AVGUST</p>
                <h2 id="fp-assurance-title">Aseguramiento</h2>
              </div>
              <button
                type="button"
                className="fp-assurance-close"
                aria-label="Cerrar panel de aseguramiento"
                onClick={() => setAssuranceOpen(false)}
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="fp-assurance-tabs" role="tablist" aria-label="Secciones de aseguramiento">
              <button
                type="button"
                role="tab"
                aria-selected={assuranceTab === 'schedule'}
                className={assuranceTab === 'schedule' ? 'is-active' : ''}
                onClick={() => setAssuranceTab('schedule')}
              >
                Agendar
                {pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={assuranceTab === 'reports'}
                className={assuranceTab === 'reports' ? 'is-active' : ''}
                onClick={() => setAssuranceTab('reports')}
              >
                Informes ({farmVisits.length})
              </button>
            </div>

            {assuranceTab === 'schedule' ? (
              <div className="fp-assurance-body" role="tabpanel">
                <p className="fp-schedule-lead">
                  Indica tu fecha preferida. El técnico AVGUST confirma la visita; no se reserva un cupo automático.
                </p>
                <form className="fp-schedule-form" onSubmit={e => void handleAssuranceRequest(e)}>
                  <label>
                    Fecha preferida
                    <input
                      type="date"
                      value={requestDate}
                      onChange={e => setRequestDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    Teléfono de contacto
                    <input
                      type="tel"
                      maxLength={40}
                      value={requestPhone}
                      onChange={e => setRequestPhone(e.target.value)}
                      placeholder="Celular o fijo"
                      autoComplete="tel"
                    />
                  </label>
                  <label>
                    Correo (opcional)
                    <input
                      type="email"
                      maxLength={120}
                      value={requestEmail}
                      onChange={e => setRequestEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      autoComplete="email"
                    />
                  </label>
                  <label className="fp-schedule-notes">
                    Comentario para el técnico
                    <textarea
                      maxLength={2000}
                      value={requestNotes}
                      onChange={e => setRequestNotes(e.target.value)}
                      placeholder="Cultivo, urgencia, ventana horaria u observaciones de campo…"
                      rows={3}
                    />
                  </label>
                  <div className="fp-schedule-actions">
                    <button type="submit" className="fp-btn-primary" disabled={requestBusy}>
                      <CalendarDays size={16} aria-hidden />
                      {requestBusy ? 'Enviando…' : 'Solicitar visita'}
                    </button>
                  </div>
                </form>
                {requestMsg && (
                  <div className={`fp-schedule-msg ${requestMsg.error ? 'error' : 'ok'}`} role="status">
                    {requestMsg.text}
                  </div>
                )}
                {pendingRequests.length > 0 && (
                  <ul className="fp-schedule-list" aria-label="Solicitudes recientes">
                    {pendingRequests.slice(0, 5).map(item => (
                      <li key={item.id}>
                        <strong>
                          {item.status === 'scheduled' ? 'Programada' : 'Pendiente'}
                          {item.preferredDate ? ` · preferida ${item.preferredDate}` : ''}
                        </strong>
                        <span>
                          Enviada{' '}
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString('es-CO')
                            : 'reciente'}
                          {item.notes ? ` · ${item.notes}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="fp-assurance-body" role="tabpanel">
                {!farmVisits.length ? (
                  <p className="fp-schedule-lead">
                    Aún no hay informes revisados. Cuando tu técnico publique uno, aparecerá aquí.
                  </p>
                ) : (
                  <div className="fp-reports-list">
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
                                <span>#{farmVisits.length - idx}</span>
                                <strong>{visit.date}</strong>
                                <StatusBadge value={status} />
                              </div>
                              <div className="fp-report-row-meta">
                                <span>
                                  Resultado:{' '}
                                  <strong>{score === null ? '—' : `${score}%`}</strong>
                                </span>
                                <span>
                                  Técnico: <strong>{visit.responsible}</strong>
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
                                Ver
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
              </div>
            )}
          </div>
        )}
      </aside>

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
              <button
                type="button"
                className="fp-metrics-assurance-link"
                style={{marginTop: 16}}
                onClick={() => {
                  setAssuranceTab('schedule');
                  setAssuranceOpen(true);
                }}
              >
                <CalendarDays size={15} aria-hidden />
                Solicitar un aseguramiento
              </button>
            </div>
          ) : (
            <div className="metrics-executive-dashboard">
              <div className="fp-band is-field">
              <div className="fp-band-inner">
              <SectionMark index="01" label="Estado de la finca" />
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
                  aria-label={`Índice oficial de aseguramiento ${latestScore} por ciento`}
                >
                  <strong>
                    {latestScore}
                    <span>%</span>
                  </strong>
                  <small>Índice oficial</small>
                  <p className="fp-score-explain">
                    Resultado ponderado de los capítulos evaluados en esta visita. Es el único
                    indicador de referencia del portal.
                  </p>
                  <div className="metrics-score-track">
                    <span style={{width: `${Math.min(100, Math.max(0, latestScore ?? 0))}%`}} />
                  </div>
                </div>
                <div className="metrics-outcome-facts fp-facts-with-trend">
                  <div>
                    <span>Desviaciones</span>
                    <strong>{current.findings}</strong>
                  </div>
                  <div>
                    <span>Cobertura</span>
                    <strong>{current.evaluatedChapters}/5 capítulos</strong>
                  </div>
                  <div className={`fp-index-trend is-${indexTrend}`}>
                    <span>Tendencia del índice</span>
                    <strong>
                      <i aria-hidden>
                        <TrendIcon direction={indexTrend} size={16} />
                      </i>
                      {indexDelta === null
                        ? 'Primera lectura'
                        : `${trendLabel(indexTrend)} ${indexDelta === 0 ? '' : formatDelta(indexDelta)}`.trim()}
                    </strong>
                    <small>
                      {baseline
                        ? `Vs. visita ${baseline.date} · ${baseline.score}% → ${current.score}%`
                        : 'Aún no hay una visita anterior con el mismo alcance para comparar.'}
                    </small>
                  </div>
                </div>
              </section>

              <SectionMark index="02" label="Capítulos evaluados" />
              <MetricsKpiStrip
                count={historyAnalysis?.records.length || 0}
                scope={`${historyAnalysis?.farm || invitation.farm} · aseguramientos revisados`}
                chapterTrends={chapterTrends}
                comparisonLabel={hasChapterDeltas ? 'Vs. visita anterior' : 'Lectura actual'}
                showComparison
                note={
                  hasChapterDeltas
                    ? 'Porcentaje de cada capítulo en el aseguramiento consultado.'
                    : 'Porcentaje de cada capítulo en el aseguramiento consultado. Los capítulos sin medición se muestran como no evaluados.'
                }
                chapterTiles
              />
              {historyAnalysis && (
                <Suspense fallback={null}>
                  <FarmPortalKpiBoard
                    records={historyAnalysis.records}
                    chapterTrends={chapterTrends}
                    indexDelta={indexDelta}
                    latestDate={current?.date}
                    baselineDate={baseline?.date}
                  />
                </Suspense>
              )}
              </div>
              </div>

              <div className="fp-band is-greenhouse">
              <div className="fp-band-inner">
              <SectionMark index="03" label="Acciones correctivas" />
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
                        <li key={problem.id} className={problem.thin ? 'is-thin-action' : undefined}>
                          <div className="metrics-action-title">
                            <strong>
                              {problem.id} · {problem.text}
                            </strong>
                            <span>
                              {complianceAnswerLabel('NO')} · Cap. {problem.chapter} · {problem.weightPct}%
                            </span>
                          </div>
                          <p className="metrics-action-observation">
                            <strong>Hallazgo / observación:</strong> {problem.observation}
                          </p>
                          <p className="metrics-action-recommendation">
                            <strong>Acción recomendada:</strong> {problem.recommendation}
                          </p>
                          <div className="metrics-action-meta">
                            <span>
                              Responsable: <b>{problem.owner}</b>
                            </span>
                            <span>
                              Fecha: <b>{problem.due}</b>
                            </span>
                            <span>
                              Estado: <b>{problem.statusLabel}</b>
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
              </div>
              </div>

              <section className="fp-interlude" aria-label="Cómo se lee el índice oficial">
                <div className="fp-interlude-inner">
                  <p className="fp-kicker">Cómo se lee el índice</p>
                  <h2>
                    Cinco procesos.
                    <br />
                    Un índice oficial.
                  </h2>
                  <ul className="fp-interlude-scale">
                    <li className="healthy">
                      <strong>95–100%</strong>
                      <span>Saludable</span>
                    </li>
                    <li className="acceptable">
                      <strong>80–94%</strong>
                      <span>Alerta</span>
                    </li>
                    <li className="critical">
                      <strong>&lt; 80%</strong>
                      <span>Vulnerable</span>
                    </li>
                  </ul>
                  <p className="fp-interlude-note">
                    Pesos por capítulo{' '}
                    {[1, 2, 3, 4, 5].map(id => Math.round((CHAPTER_WEIGHTS[id] || 0) * 100)).join(' / ')}.
                    Cada visita revisada por tu técnico AVGUST actualiza esta lectura.
                  </p>
                </div>
              </section>

              <div className="fp-band is-ornamental">
              <div className="fp-band-inner">
              {podium.length > 1 && <SectionMark index="04" label="Trayectoria" />}
              {podium.length > 1 && (
                <section className="metrics-podium-panel">
                  <div className="metrics-section-heading">
                    <div>
                      <div className="metrics-section-kicker">Historial reciente</div>
                      <h3>Últimos aseguramientos</h3>
                    </div>
                    {indexDelta !== null ? (
                      <span className="metrics-note">Vs. visita con el mismo alcance</span>
                    ) : null}
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
                        {point.delta !== null ? (
                          <span
                            className={`metrics-podium-delta ${
                              point.delta > 0
                                ? 'positive'
                                : point.delta < 0
                                  ? 'negative'
                                  : 'neutral'
                            }`}
                          >
                            {point.delta > 0
                              ? `+${point.delta} pts`
                              : point.delta < 0
                                ? `${point.delta} pts`
                                : 'Sin cambio'}
                          </span>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <div className="fp-metrics-assurance-hint">
                <button
                  type="button"
                  className="fp-metrics-assurance-link"
                  onClick={() => {
                    setAssuranceTab('reports');
                    setAssuranceOpen(true);
                  }}
                >
                  <FileText size={15} aria-hidden />
                  Ver historial de informes
                  <ChevronDown size={14} aria-hidden className="fp-metrics-assurance-chevron" />
                </button>
              </div>
              </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="fp-footer">
        <span className="fp-brand-rule" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <div className="fp-footer-inner">
          <img src="/portal/avgust-logo-light.svg" alt="AVGUST Crop Protection" />
          <p>
            <strong>AVGUST CARE 360</strong> · Portal de finca
          </p>
          <span>Juntos Crecemos Bien</span>
        </div>
      </footer>
    </div>
  );
}
