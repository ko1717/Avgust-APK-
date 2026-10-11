'use client';
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode
} from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Droplets,
  ExternalLink,
  FileStack,
  FileText,
  Globe,
  Home,
  KeyRound,
  Lightbulb,
  LineChart,
  Lock,
  LogOut,
  MapPin,
  Minus,
  Scale,
  Search,
  Sprout,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wifi,
  WifiOff,
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
  metricStatus,
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
import {portalActionPresentation, stripMarkdownLite} from '@/lib/portal-format';
import {type ChapterTrendKpi} from './metrics-kpi-strip';
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

type PortalNavId = 'inicio' | 'informes' | 'solicitudes' | 'metricas';

function chapterTrend(trends: ChapterTrendKpi[], id: number) {
  return trends.find(chapter => chapter.id === id);
}

function vsMetaDelta(score: number | null) {
  if (score === null) return null;
  return Math.round((score - 95) * 10) / 10;
}

function kpiScoreStatusLabel(score: number | null) {
  if (score === null) return metricStatusLabels.pending;
  return metricStatusLabels[metricStatus(score)];
}

function kpiScoreStatusClass(score: number | null) {
  if (score === null) return 'is-neutral';
  return `is-${metricStatus(score)}`;
}

function kpiFindingsStatusLabel(findingsCount: number) {
  if (findingsCount === 0) return 'Sin desviaciones';
  if (findingsCount <= 10) return 'Seguimiento';
  return 'Prioritario';
}

function kpiFindingsStatusClass(findingsCount: number) {
  if (findingsCount === 0) return 'is-healthy';
  if (findingsCount <= 10) return 'is-acceptable';
  return 'is-critical';
}

const INDEX_STATUS_THRESHOLDS: {
  status: Exclude<MetricStatus, 'pending'>;
  range: string;
}[] = [
  {status: 'healthy', range: '95–100%'},
  {status: 'acceptable', range: '80–94%'},
  {status: 'critical', range: '< 80%'}
];

function IndexStatusLegend({compact = false}: {compact?: boolean}) {
  return (
    <section
      className={`fp-status-legend${compact ? ' is-compact' : ''}`}
      aria-label="Umbrales del índice oficial de aseguramiento"
    >
      <header className="fp-status-legend-head">
        <p className="fp-kicker">Cómo se lee el índice</p>
        <h3>Semáforo oficial del aseguramiento</h3>
      </header>
      <ul className="fp-status-legend-list">
        {INDEX_STATUS_THRESHOLDS.map(item => (
          <li key={item.status} className={item.status}>
            <span className="fp-status-legend-range">{item.range}</span>
            <strong>{metricStatusLabels[item.status]}</strong>
            <p>{metricStatusDescriptions[item.status]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatVisitDateLabel(isoDate?: string) {
  if (!isoDate) return '—';
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return isoDate;
  }
}

function PortalStatusKpiCard({
  tone,
  icon,
  title,
  value,
  valueSuffix,
  priorDelta,
  metaDelta,
  visits,
  statusLabel,
  statusClassName
}: {
  tone: 'green' | 'blue' | 'purple' | 'orange';
  icon: ReactNode;
  title: string;
  value: string;
  valueSuffix?: string;
  priorDelta?: number | null;
  metaDelta?: number | null;
  visits?: number;
  statusLabel: string;
  statusClassName?: string;
}) {
  const statusClass = statusClassName ?? 'is-neutral';

  return (
    <article className={`fp-status-kpi is-${tone}`}>
      <div className="fp-status-kpi-icon" aria-hidden>{icon}</div>
      <div className="fp-status-kpi-body">
        <h4>{title}</h4>
        <p className="fp-status-kpi-value">
          <strong>{value}</strong>
          {valueSuffix ? <span>{valueSuffix}</span> : null}
        </p>
        <ul className="fp-status-kpi-compare">
          {priorDelta !== undefined && priorDelta !== null && (
            <li className={priorDelta >= 0 ? 'is-up' : 'is-down'}>
              {priorDelta >= 0 ? '+' : ''}
              {priorDelta} vs. anterior
            </li>
          )}
          {metaDelta !== undefined && metaDelta !== null && (
            <li className={metaDelta >= 0 ? 'is-up' : 'is-down'}>
              {metaDelta >= 0 ? '+' : ''}
              {metaDelta} vs. meta
            </li>
          )}
          {visits !== undefined && <li>{visits} visitas</li>}
        </ul>
        <span className={`fp-status-kpi-pill ${statusClass}`}>{statusLabel}</span>
      </div>
    </article>
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
  const [portalNav, setPortalNav] = useState<PortalNavId>('inicio');
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const heroRef = useRef<HTMLElement | null>(null);
  const shellScrollRef = useRef<HTMLDivElement | null>(null);

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
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!invitation) {
      setScrollCompact(false);
      return;
    }

    let raf = 0;
    const updateScrollChrome = () => {
      raf = 0;
      const hero = heroRef.current;
      const scroller = shellScrollRef.current;
      if (!hero || !scroller) return;

      const rect = hero.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const range = Math.max(120, hero.offsetHeight * 0.45);
      const traveled = Math.min(range, Math.max(0, scrollerRect.top - rect.top));
      const progress = traveled / range;
      hero.style.setProperty('--fp-hero-collapse', progress.toFixed(3));
      setScrollCompact(progress > 0.35);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateScrollChrome);
    };

    updateScrollChrome();
    const scroller = shellScrollRef.current;
    scroller?.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    return () => {
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [invitation]);

  const openAssurance = (tab: 'schedule' | 'reports') => {
    setAssuranceTab(tab);
    setAssuranceOpen(true);
    setPortalNav(tab === 'schedule' ? 'solicitudes' : 'informes');
  };

  const handlePortalNav = (id: PortalNavId) => {
    setPortalNav(id);
    if (id === 'informes') {
      openAssurance('reports');
      return;
    }
    if (id === 'solicitudes') {
      openAssurance('schedule');
      return;
    }
    const scroller = shellScrollRef.current;
    if (!scroller) return;
    if (id === 'metricas') {
      const target = document.getElementById('fp-kpi-trend');
      if (target) {
        target.scrollIntoView({behavior: 'smooth', block: 'start'});
      }
      return;
    }
    scroller.scrollTo({top: 0, behavior: 'smooth'});
  };

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
  const mezclasChapter = chapterTrend(chapterTrends, 4);
  const medicionesChapter = chapterTrend(chapterTrends, 2);
  const findingsCount = current?.findings ?? 0;
  const visitCount = historyAnalysis?.records.length ?? 0;

  const sidebarPrimary: {id: PortalNavId; label: string; icon: typeof Home}[] = [
    {id: 'inicio', label: 'Inicio', icon: Home},
    {id: 'informes', label: 'Informes', icon: FileStack},
    {id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList},
    {id: 'metricas', label: 'Métricas', icon: LineChart}
  ];

  return (
    <div className={`farm-portal is-dashboard${scrollCompact ? ' is-compact' : ''}`}>
      <aside className="fp-sidebar" aria-label="Navegación del portal">
        <div className="fp-sidebar-brand">
          <img src="/portal/avgust-logo-light.svg" alt="AVGUST Crop Protection" />
        </div>
        <nav className="fp-sidebar-nav">
          {sidebarPrimary.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`fp-sidebar-link${portalNav === item.id ? ' is-active' : ''}`}
                onClick={() => handlePortalNav(item.id)}
              >
                <Icon size={18} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="fp-sidebar-divider" role="presentation" />
          <button type="button" className="fp-sidebar-link is-disabled" disabled title="Disponible en la app técnica AVGUST">
            <MapPin size={18} aria-hidden />
            <span>Fincas</span>
          </button>
          <button type="button" className="fp-sidebar-link is-disabled" disabled title="Consulta en línea próximamente en el portal">
            <Search size={18} aria-hidden />
            <span>Consulta</span>
          </button>
          <button type="button" className="fp-sidebar-link is-disabled" disabled title="Disponible en la app técnica AVGUST">
            <CalendarDays size={18} aria-hidden />
            <span>Visitas</span>
          </button>
          <button type="button" className="fp-sidebar-link is-disabled" disabled title="Disponible en la app técnica AVGUST">
            <BarChart3 size={18} aria-hidden />
            <span>Seguimiento</span>
          </button>
        </nav>
        <div className="fp-sidebar-foot">
          <div className={`fp-sidebar-status${online ? ' is-online' : ''}`}>
            {online ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
            <span>{online ? 'En línea' : 'Sin conexión'}</span>
          </div>
        </div>
      </aside>

      <div className="fp-shell-main">
      <header className={`fp-topbar${scrollCompact ? ' is-compact' : ''}`}>
        <div className="fp-topbar-row">
        <div className="fp-topbar-brand">
          <div className="fp-topbar-wordmark" aria-hidden>
            <span>CARE</span>
            <em>360</em>
          </div>
          <div className="fp-topbar-meta">
            <small>Portal de finca</small>
            <strong title={invitation.farm}>
              <Sprout size={14} aria-hidden />
              {invitation.farm}
            </strong>
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
            <a className="fp-topbar-cta" href="#fp-dashboard">
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
            <UserRound size={14} aria-hidden />
            <span>
              Invitado <strong>{invitation.clientName}</strong>
            </span>
          </div>
          <div className="fp-chip is-desktop fp-topbar-code">
            <span>{invitation.code}</span>
          </div>
          <button type="button" className="fp-topbar-exit" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={14} aria-hidden />
            <span>Salir</span>
          </button>
          <span className="fp-topbar-avatar" aria-hidden>
            {invitation.clientName.slice(0, 1).toUpperCase()}
          </span>
        </div>
        </div>
      </header>

      <div className="fp-shell-scroll" ref={shellScrollRef}>
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
              <a className="fp-hero-cta is-primary" href="#fp-dashboard">
                Ver el indicador
                <ChevronRight size={16} aria-hidden />
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

      </section>

      <dl className="fp-meta-strip">
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

      <main className="fp-main" id="fp-dashboard">
        <div className="fp-dashboard" aria-label="Indicadores de aseguramiento">
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
                  : 'Cuando tu técnico publique un informe revisado, aquí verás el índice oficial, los capítulos clave y las acciones correctivas.'}
              </p>
              <button
                type="button"
                className="fp-metrics-assurance-link"
                style={{marginTop: 16}}
                onClick={() => openAssurance('schedule')}
              >
                <CalendarDays size={15} aria-hidden />
                Solicitar un aseguramiento
              </button>
            </div>
          ) : (
            <>
              <div className="fp-dashboard-main">
                <header className="fp-dashboard-head">
                  <div>
                    <h2>
                      <Sprout size={20} aria-hidden />
                      Estado de la finca
                    </h2>
                    <p>Resumen del desempeño actual del cultivo.</p>
                  </div>
                  <div className="fp-dashboard-date" aria-label="Fecha del aseguramiento consultado">
                    <CalendarDays size={16} aria-hidden />
                    {formatVisitDateLabel(current.date)}
                  </div>
                </header>

                <div className="fp-status-kpi-grid">
                  <PortalStatusKpiCard
                    tone="green"
                    icon={<Sprout size={18} />}
                    title="Indicador"
                    value={latestScore === null ? '—' : `${latestScore}`}
                    valueSuffix={latestScore === null ? undefined : '%'}
                    priorDelta={indexDelta}
                    metaDelta={vsMetaDelta(latestScore)}
                    visits={visitCount}
                    statusLabel={kpiScoreStatusLabel(latestScore)}
                    statusClassName={kpiScoreStatusClass(latestScore)}
                  />
                  <PortalStatusKpiCard
                    tone="blue"
                    icon={<Droplets size={18} />}
                    title="Mezclas"
                    value={mezclasChapter?.score === null || mezclasChapter?.score === undefined ? '—' : `${mezclasChapter.score}`}
                    valueSuffix={
                      mezclasChapter?.score === null || mezclasChapter?.score === undefined ? undefined : '%'
                    }
                    priorDelta={mezclasChapter?.delta ?? null}
                    metaDelta={vsMetaDelta(mezclasChapter?.score ?? null)}
                    statusLabel={kpiScoreStatusLabel(mezclasChapter?.score ?? null)}
                    statusClassName={kpiScoreStatusClass(mezclasChapter?.score ?? null)}
                  />
                  <PortalStatusKpiCard
                    tone="purple"
                    icon={<Scale size={18} />}
                    title="Mediciones y pesaje"
                    value={
                      medicionesChapter?.score === null || medicionesChapter?.score === undefined
                        ? '—'
                        : `${medicionesChapter.score}`
                    }
                    valueSuffix={
                      medicionesChapter?.score === null || medicionesChapter?.score === undefined
                        ? undefined
                        : '%'
                    }
                    priorDelta={medicionesChapter?.delta ?? null}
                    metaDelta={vsMetaDelta(medicionesChapter?.score ?? null)}
                    statusLabel={kpiScoreStatusLabel(medicionesChapter?.score ?? null)}
                    statusClassName={kpiScoreStatusClass(medicionesChapter?.score ?? null)}
                  />
                  <PortalStatusKpiCard
                    tone="orange"
                    icon={<AlertTriangle size={18} />}
                    title="Hallazgos"
                    value={String(findingsCount)}
                    priorDelta={null}
                    metaDelta={null}
                    statusLabel={kpiFindingsStatusLabel(findingsCount)}
                    statusClassName={kpiFindingsStatusClass(findingsCount)}
                  />
                </div>

                <IndexStatusLegend compact />

                {historyAnalysis && (
                  <Suspense fallback={<div className="fp-metrics-loading">Cargando tendencia…</div>}>
                    <FarmPortalKpiBoard
                      variant="trend"
                      records={historyAnalysis.records}
                      chapterTrends={chapterTrends}
                      indexDelta={indexDelta}
                      latestDate={current.date}
                      baselineDate={baseline?.date}
                    />
                  </Suspense>
                )}
              </div>

              <aside className="fp-dashboard-rail" aria-label="Perfil de finca y acciones">
                <article className="fp-farm-card">
                  <div className="fp-farm-card-photo" aria-hidden />
                  <div className="fp-farm-card-body">
                    <div className="fp-farm-card-title">
                      <h3>{invitation.farm}</h3>
                      <span className="fp-farm-card-badge">Activa</span>
                    </div>
                    <dl className="fp-farm-card-facts">
                      <div>
                        <dt>Código</dt>
                        <dd>{invitation.code}</dd>
                      </div>
                      <div>
                        <dt>Cliente</dt>
                        <dd>{invitation.clientName}</dd>
                      </div>
                      <div>
                        <dt>Área</dt>
                        <dd>N/D</dd>
                      </div>
                      <div>
                        <dt>Última visita</dt>
                        <dd>{current.date}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="fp-farm-card-cta"
                      onClick={() => setViewingReportId(current.visit.id)}
                    >
                      Ver detalles de la finca
                    </button>
                  </div>
                </article>

                <section className="fp-actions-card">
                  <header>
                    <h3>
                      <Lightbulb size={18} aria-hidden />
                      Acciones recomendadas
                    </h3>
                    {selectedProblems.length > 0 && (
                      <button
                        type="button"
                        className="fp-actions-card-link"
                        onClick={() => setExpandedActions(value => !value)}
                      >
                        {expandedActions ? 'Ver menos' : 'Ver todas'}
                        <ChevronRight size={14} aria-hidden />
                      </button>
                    )}
                  </header>
                  {selectedProblems.length ? (
                    <ul className="fp-actions-mini-list">
                      {(expandedActions ? selectedProblems : selectedProblems.slice(0, 3)).map(problem => (
                        <li key={problem.id}>
                          <strong>{problem.id}</strong>
                          <p>{problem.text}</p>
                          <span>{problem.recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="fp-actions-empty">No hay desviaciones pendientes en este aseguramiento.</p>
                  )}
                </section>
              </aside>
            </>
          )}
        </div>

        {current && (
          <section className="fp-interlude" aria-label="Cómo se lee el índice oficial">
            <div className="fp-interlude-inner">
              <p className="fp-kicker">Cómo se lee el índice</p>
              <h2>
                Cinco procesos.
                <br />
                Un índice oficial.
              </h2>
              <ul className="fp-interlude-scale">
                {INDEX_STATUS_THRESHOLDS.map(item => (
                  <li key={item.status} className={item.status}>
                    <strong>{item.range}</strong>
                    <span>{metricStatusLabels[item.status]}</span>
                  </li>
                ))}
              </ul>
              <p className="fp-interlude-note">
                Pesos por capítulo{' '}
                {[1, 2, 3, 4, 5].map(id => Math.round((CHAPTER_WEIGHTS[id] || 0) * 100)).join(' / ')}.
                Cada visita revisada por tu técnico AVGUST actualiza esta lectura.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="fp-footer fp-footer-compact">
        <span>Juntos Crecemos Bien · AVGUST CARE 360</span>
      </footer>
      </div>
      </div>

      <nav className="fp-mobile-nav" aria-label="Navegación móvil">
        {sidebarPrimary.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={portalNav === item.id ? 'is-active' : ''}
              onClick={() => handlePortalNav(item.id)}
            >
              <Icon size={20} aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
