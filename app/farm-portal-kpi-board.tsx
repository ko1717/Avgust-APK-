'use client';

import {useMemo} from 'react';
import {Minus, TrendingDown, TrendingUp} from 'lucide-react';
import type {MetricRecord} from '@/lib/metric-analysis';
import type {MetricStatus} from '@/lib/model';
import type {ChapterTrendKpi} from './metrics-kpi-strip';
import './farm-portal-kpi.css';

const STATUS_LABELS: Record<Exclude<MetricStatus, 'pending'>, string> = {
  healthy: 'Saludable',
  acceptable: 'Alerta',
  critical: 'Vulnerable'
};

const STATUS_COLORS: Record<Exclude<MetricStatus, 'pending'>, string> = {
  healthy: 'var(--fp-kpi-green)',
  acceptable: 'var(--fp-kpi-gold)',
  critical: 'var(--fp-kpi-cyan-deep, #005f7a)'
};

const MAX_VISITS_CHART = 8;

function chapterTone(score: number | null): 'healthy' | 'acceptable' | 'critical' | 'empty' {
  if (score === null) return 'empty';
  if (score >= 95) return 'healthy';
  if (score >= 80) return 'acceptable';
  return 'critical';
}

function formatDelta(delta: number) {
  const value = Number.isInteger(delta) ? String(delta) : delta.toFixed(1);
  return `${delta > 0 ? '+' : ''}${value} pts`;
}

type FarmPortalKpiBoardProps = {
  records: MetricRecord[];
  chapterTrends: ChapterTrendKpi[];
  indexDelta: number | null;
  latestDate?: string;
  baselineDate?: string;
};

function IndexEvolutionBars({points}: {points: {score: number; isLatest: boolean}[]}) {
  const width = 280;
  const height = 120;
  const pad = {left: 28, right: 8, top: 8, bottom: 18};
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxY = 100;
  const barGap = 6;
  const barW = Math.max(8, (innerW - barGap * (points.length - 1)) / Math.max(1, points.length));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución del índice oficial por visita">
      <line
        className="fp-kpi-axis"
        x1={pad.left}
        y1={pad.top}
        x2={pad.left}
        y2={pad.top + innerH}
      />
      <line
        className="fp-kpi-axis"
        x1={pad.left}
        y1={pad.top + innerH}
        x2={pad.left + innerW}
        y2={pad.top + innerH}
      />
      {[0, 50, 100].map(tick => {
        const y = pad.top + innerH - (tick / maxY) * innerH;
        return (
          <text key={tick} className="fp-kpi-axis-tick" x={pad.left - 6} y={y + 3} textAnchor="end">
            {tick}
          </text>
        );
      })}
      {points.map((point, index) => {
        const h = (point.score / maxY) * innerH;
        const x = pad.left + index * (barW + barGap);
        const y = pad.top + innerH - h;
        return (
          <rect
            key={index}
            className={`fp-kpi-bar${point.isLatest ? ' is-latest' : ''}`}
            x={x}
            y={y}
            width={barW}
            height={Math.max(1, h)}
            rx={2}
          />
        );
      })}
    </svg>
  );
}

function IndexTrendLine({
  points,
  indexDelta
}: {
  points: {score: number; isLatest: boolean}[];
  indexDelta: number | null;
}) {
  const width = 280;
  const height = 120;
  const pad = {left: 28, right: 12, top: 12, bottom: 18};
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const scores = points.map(p => p.score);
  const minScore = Math.min(...scores, 70);
  const maxScore = Math.max(...scores, 100);
  const range = Math.max(8, maxScore - minScore);
  const yMin = minScore - range * 0.08;
  const yMax = maxScore + range * 0.08;

  const coords = points.map((point, index) => {
    const x = pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.top + innerH - ((point.score - yMin) / (yMax - yMin)) * innerH;
    return {x, y, ...point};
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  const trendClass =
    indexDelta === null ? 'is-flat' : indexDelta > 0 ? 'is-up' : indexDelta < 0 ? 'is-down' : 'is-flat';

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia del índice entre visitas">
        <line
          className="fp-kpi-axis"
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + innerH}
        />
        <line
          className="fp-kpi-axis"
          x1={pad.left}
          y1={pad.top + innerH}
          x2={pad.left + innerW}
          y2={pad.top + innerH}
        />
        {points.length > 1 && <path className="fp-kpi-line" d={pathD} />}
        {coords.map((c, index) => (
          <circle
            key={index}
            className={`fp-kpi-line-dot${c.isLatest ? ' is-latest' : ''}`}
            cx={c.x}
            cy={c.y}
            r={c.isLatest ? 4.5 : 3.5}
          />
        ))}
      </svg>
      {indexDelta !== null && (
        <p className={`fp-kpi-delta-chip ${trendClass}`}>
          {indexDelta > 0 ? (
            <TrendingUp size={14} aria-hidden />
          ) : indexDelta < 0 ? (
            <TrendingDown size={14} aria-hidden />
          ) : (
            <Minus size={14} aria-hidden />
          )}
          {indexDelta === 0 ? 'Sin cambio vs. visita anterior' : `Variación ${formatDelta(indexDelta)} vs. anterior`}
        </p>
      )}
    </div>
  );
}

function StatusDonut({counts, total}: {counts: Record<Exclude<MetricStatus, 'pending'>, number>; total: number}) {
  const size = 100;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const order: Exclude<MetricStatus, 'pending'>[] = ['healthy', 'acceptable', 'critical'];

  let offset = 0;
  const segments = order
    .map(status => {
      const value = counts[status];
      if (!value) return null;
      const pct = value / total;
      const length = pct * circumference;
      const seg = {
        status,
        dasharray: `${length} ${circumference - length}`,
        dashoffset: -offset
      };
      offset += length;
      return seg;
    })
    .filter(Boolean) as {
    status: Exclude<MetricStatus, 'pending'>;
    dasharray: string;
    dashoffset: number;
  }[];

  return (
    <div className="fp-kpi-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribución de estados en aseguramientos revisados">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(15,33,40,0.08)"
          strokeWidth={stroke}
        />
        {segments.map(seg => (
          <circle
            key={seg.status}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={STATUS_COLORS[seg.status]}
            strokeWidth={stroke}
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      <ul className="fp-kpi-donut-legend">
        {order.map(status => {
          const n = counts[status];
          if (!n) return null;
          const pct = Math.round((n / total) * 100);
          return (
            <li key={status}>
              <i className={`is-${status}`} aria-hidden />
              <span>
                <strong>{STATUS_LABELS[status]}</strong> · {n} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChapterHorizontalBars({chapters}: {chapters: ChapterTrendKpi[]}) {
  return (
    <div className="fp-kpi-hbars" role="list" aria-label="Porcentaje por capítulo en el último aseguramiento">
      {chapters.map(chapter => {
        const tone = chapterTone(chapter.score);
        const width = chapter.score === null ? 0 : Math.min(100, Math.max(0, chapter.score));
        return (
          <div key={chapter.id} className={`fp-kpi-hbar-row is-${tone}`} role="listitem">
            <label>Cap.{chapter.id}</label>
            <div className="fp-kpi-hbar-track" aria-hidden>
              <span className="fp-kpi-hbar-fill" style={{width: `${width}%`}} />
            </div>
            <span>{chapter.score === null ? '—' : `${chapter.score}%`}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FarmPortalKpiBoard({
  records,
  chapterTrends,
  indexDelta,
  latestDate,
  baselineDate
}: FarmPortalKpiBoardProps) {
  const chartRecords = useMemo(() => records.slice(-MAX_VISITS_CHART), [records]);

  const barPoints = useMemo(
    () =>
      chartRecords.map((record, index) => ({
        score: record.score,
        isLatest: index === chartRecords.length - 1
      })),
    [chartRecords]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<Exclude<MetricStatus, 'pending'>, number> = {
      healthy: 0,
      acceptable: 0,
      critical: 0
    };
    for (const record of records) {
      if (record.status === 'pending') continue;
      counts[record.status] += 1;
    }
    return counts;
  }, [records]);

  const statusTotal = statusCounts.healthy + statusCounts.acceptable + statusCounts.critical;
  const visitLabel = records.length === 1 ? '1 visita revisada' : `${records.length} visitas revisadas`;

  return (
    <section className="fp-kpi-board" aria-labelledby="fp-kpi-board-title">
      <header className="fp-kpi-board-head">
        <div className="metrics-section-kicker">Lectura visual</div>
        <h3 id="fp-kpi-board-title">Indicadores del aseguramiento</h3>
        <p className="fp-kpi-board-note">
          Evolución del índice oficial, tendencia frente a la visita anterior y reparto de estados en el historial
          de {visitLabel}. Los capítulos reflejan el último informe consultado
          {latestDate ? ` (${latestDate})` : ''}.
        </p>
      </header>

      <div className="fp-kpi-grid">
        <article className="fp-kpi-tile">
          <h4 className="fp-kpi-tile-title">Evolución del índice oficial</h4>
          <div className="fp-kpi-chart">
            {barPoints.length ? (
              <IndexEvolutionBars points={barPoints} />
            ) : (
              <p className="fp-kpi-tile-caption">Sin visitas con índice publicado.</p>
            )}
          </div>
          <p className="fp-kpi-tile-caption">
            Últimas {Math.min(MAX_VISITS_CHART, records.length)} visitas · escala 0–100%
          </p>
        </article>

        <article className="fp-kpi-tile">
          <h4 className="fp-kpi-tile-title">Tendencia del índice</h4>
          <div className="fp-kpi-chart">
            {barPoints.length ? (
              <IndexTrendLine points={barPoints} indexDelta={indexDelta} />
            ) : (
              <p className="fp-kpi-tile-caption">Aún no hay serie para comparar.</p>
            )}
          </div>
          <p className="fp-kpi-tile-caption">
            {baselineDate && indexDelta !== null
              ? `Comparado con la visita del ${baselineDate}.`
              : 'La variación aparece cuando hay una visita anterior con el mismo alcance.'}
          </p>
        </article>

        <article className="fp-kpi-tile">
          <h4 className="fp-kpi-tile-title">Distribución de estados</h4>
          <div className="fp-kpi-chart">
            {statusTotal > 0 ? (
              <StatusDonut counts={statusCounts} total={statusTotal} />
            ) : (
              <p className="fp-kpi-tile-caption">Sin clasificación en el historial.</p>
            )}
          </div>
          <p className="fp-kpi-tile-caption">Saludable 95–100% · Alerta 80–94% · Vulnerable &lt;80%</p>
        </article>

        <article className="fp-kpi-tile">
          <h4 className="fp-kpi-tile-title">Capítulos por %</h4>
          <div className="fp-kpi-chart">
            <ChapterHorizontalBars chapters={chapterTrends} />
          </div>
          <p className="fp-kpi-tile-caption">Pesos oficiales 5 / 25 / 10 / 30 / 30 en el índice ponderado.</p>
        </article>
      </div>
    </section>
  );
}
