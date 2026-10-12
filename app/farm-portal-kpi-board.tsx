'use client';

import {useMemo, useState} from 'react';
import {Download, Minus, TrendingDown, TrendingUp} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type {MetricRecord} from '@/lib/metric-analysis';
import {metricStatusDescriptions, metricStatusLabels, type MetricStatus} from '@/lib/model';
import {
  downloadTrendCsv,
  filterRecordsByRange,
  formatPoints,
  formatSignedPoints,
  formatTrendAxisDate,
  seriesStats,
  toTrendPoints,
  type TrendPoint,
  type TrendRange
} from '@/lib/trend-series';
import type {ChapterTrendKpi} from './metrics-kpi-strip';
import './farm-portal-kpi.css';

const STATUS_LABELS: Record<Exclude<MetricStatus, 'pending'>, string> = {
  healthy: metricStatusLabels.healthy,
  acceptable: metricStatusLabels.acceptable,
  critical: metricStatusLabels.critical
};

const STATUS_RANGES: Record<Exclude<MetricStatus, 'pending'>, string> = {
  healthy: '≥ 95%',
  acceptable: '80–94%',
  critical: '< 80%'
};

const STATUS_COLORS: Record<Exclude<MetricStatus, 'pending'>, string> = {
  healthy: 'var(--fp-kpi-green)',
  acceptable: 'var(--fp-kpi-gold)',
  critical: 'var(--fp-kpi-cyan-deep, #005f7a)'
};

const DOT_COLORS: Record<MetricStatus, string> = {
  healthy: '#3f7d12',
  acceptable: '#c4840a',
  critical: '#b42318',
  pending: '#5b6b75'
};

const TREND_RANGE_LABELS: Record<TrendRange, string> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '12m': '12m',
  year: 'Año'
};

const TREND_RANGE_HINTS: Record<TrendRange, string> = {
  '7d': '7 días hacia atrás desde la última lectura',
  '30d': '30 días hacia atrás desde la última lectura',
  '90d': '90 días hacia atrás desde la última lectura',
  '12m': '365 días hacia atrás desde la última lectura',
  year: 'Año calendario de la última lectura'
};

function IndexThresholdLegend({compact = false}: {compact?: boolean}) {
  const order: Exclude<MetricStatus, 'pending'>[] = ['healthy', 'acceptable', 'critical'];
  return (
    <div
      className={`fp-kpi-threshold-legend${compact ? ' is-compact' : ''}`}
      role="note"
      aria-label="Umbrales Saludable, Alerta y Vulnerable"
    >
      <ul>
        {order.map(status => (
          <li key={status} className={status}>
            <strong>{STATUS_LABELS[status]}</strong>
            <span className="fp-kpi-threshold-range">{STATUS_RANGES[status]}</span>
            {!compact && <p>{metricStatusDescriptions[status]}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function chapterTone(score: number | null): 'healthy' | 'acceptable' | 'critical' | 'empty' {
  if (score === null) return 'empty';
  if (score >= 95) return 'healthy';
  if (score >= 80) return 'acceptable';
  return 'critical';
}

function ScoreTick({
  x = 0,
  y = 0,
  payload
}: {
  x?: string | number;
  y?: string | number;
  payload?: {value?: number};
}) {
  const value = payload?.value;
  const marked = value === 80 || value === 95 || value === 100;
  const fill = value === 95 ? '#3f6212' : value === 80 ? '#92400e' : '#5b6b75';
  return (
    <text x={Number(x) || 0} y={Number(y) || 0} dy={4} textAnchor="end" fill={fill} fontSize={11} fontWeight={marked ? 700 : 500}>
      {value}
    </text>
  );
}

function ScoreDot({cx, cy, payload}: {cx?: number; cy?: number; payload?: TrendPoint}) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null;
  const fill = DOT_COLORS[payload.status];
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.isLatest ? 6 : 4.5}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

function TrendTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: ReadonlyArray<{payload?: TrendPoint}>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="fp-kpi-tooltip">
      <strong>{point.fullDate}</strong>
      <span>Índice oficial {formatPoints(point.score)}%</span>
      <span>{point.statusLabel}</span>
      <span>
        {point.findings} {point.findings === 1 ? 'hallazgo' : 'hallazgos'}
      </span>
      <span>{point.responsible}</span>
    </div>
  );
}

function IndexTrendChart({points}: {points: TrendPoint[]}) {
  const summary =
    points.length === 0
      ? 'Sin lecturas del índice oficial'
      : `Tendencia del índice oficial, ${points.length} ${points.length === 1 ? 'lectura' : 'lecturas'}. Última ${formatPoints(points[points.length - 1].score)}% el ${points[points.length - 1].fullDate}.`;

  return (
    <figure className="fp-kpi-chart-frame" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{top: 16, right: 12, left: 0, bottom: 4}}>
          <ReferenceArea y1={95} y2={100} fill="rgba(120, 190, 32, 0.2)" strokeOpacity={0} ifOverflow="hidden" />
          <ReferenceArea y1={80} y2={95} fill="rgba(242, 169, 0, 0.18)" strokeOpacity={0} ifOverflow="hidden" />
          <ReferenceArea y1={0} y2={80} fill="rgba(0, 95, 122, 0.07)" strokeOpacity={0} ifOverflow="hidden" />
          <CartesianGrid stroke="rgba(15, 33, 40, 0.08)" vertical={false} />
          <ReferenceLine y={95} stroke="#78be20" strokeDasharray="4 4" strokeOpacity={0.9} />
          <ReferenceLine y={80} stroke="#f2a900" strokeDasharray="4 4" strokeOpacity={0.95} />
          <XAxis
            dataKey="chartKey"
            tickFormatter={value => formatTrendAxisDate(String(value).split('|')[0] || '')}
            tick={{fill: '#5b6b75', fontSize: 11}}
            tickLine={false}
            axisLine={{stroke: 'rgba(15, 33, 40, 0.18)'}}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 40, 80, 95, 100]}
            width={36}
            tick={ScoreTick}
            tickLine={false}
            axisLine={{stroke: 'rgba(15, 33, 40, 0.18)'}}
          />
          <Tooltip
            content={props => <TrendTooltip active={props.active} payload={props.payload as ReadonlyArray<{payload?: TrendPoint}>} />}
            cursor={{stroke: '#0f2128', strokeOpacity: 0.25, strokeDasharray: '3 3'}}
          />
          <Line
            type="linear"
            dataKey="score"
            name="Índice oficial"
            stroke="#1f4d32"
            strokeWidth={2.5}
            dot={ScoreDot}
            activeDot={{r: 7, fill: '#1f4d32', stroke: '#fff', strokeWidth: 2}}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

function ReadingsTable({points}: {points: TrendPoint[]}) {
  const rows = [...points].reverse();
  return (
    <div className="fp-kpi-readings-wrap">
      <table className="fp-kpi-readings">
        <caption className="fp-visually-hidden">Lecturas del índice oficial en el rango visible</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Índice</th>
            <th scope="col">Estado</th>
            <th scope="col">Hallazgos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(point => (
            <tr key={point.chartKey}>
              <td>{point.fullDate}</td>
              <td>{formatPoints(point.score)}%</td>
              <td>{point.statusLabel}</td>
              <td>{point.findings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className={`fp-kpi-fact${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function deltaTone(value: number | null): 'up' | 'down' | 'flat' | undefined {
  if (value === null) return undefined;
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

type FarmPortalKpiBoardProps = {
  records: MetricRecord[];
  chapterTrends: ChapterTrendKpi[];
  indexDelta: number | null;
  latestDate?: string;
  baselineDate?: string;
  /** Full grid or single trend panel for the dashboard layout. */
  variant?: 'full' | 'trend';
};

function StatusDonut({counts, total}: {counts: Record<Exclude<MetricStatus, 'pending'>, number>; total: number}) {
  const size = 112;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const order: Exclude<MetricStatus, 'pending'>[] = ['healthy', 'acceptable', 'critical'];

  let offset = 0;
  const segments = order
    .map(status => {
      const value = counts[status];
      if (!value) return null;
      const length = (value / total) * circumference;
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
      <div className="fp-kpi-donut-figure">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Distribución de estados en aseguramientos revisados">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(15,33,40,0.08)" strokeWidth={stroke} />
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
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
        </svg>
        <strong className="fp-kpi-donut-total">{total}</strong>
      </div>
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
    <ul className="fp-kpi-hbars" aria-label="Porcentaje por capítulo en el último aseguramiento">
      {chapters.map(chapter => {
        const tone = chapterTone(chapter.score);
        const width = chapter.score === null ? 0 : Math.min(100, Math.max(0, chapter.score));
        return (
          <li key={chapter.id} className={`fp-kpi-hbar-row is-${tone}`} title={chapter.title}>
            <label title={chapter.title}>Cap.{chapter.id}</label>
            <div className="fp-kpi-hbar-track" aria-hidden>
              <span className="fp-kpi-hbar-fill" style={{width: `${width}%`}} />
            </div>
            <span>{chapter.score === null ? '—' : `${formatPoints(chapter.score)}%`}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SeriesFacts({
  records,
  indexDelta,
  baselineDate
}: {
  records: MetricRecord[];
  indexDelta: number | null;
  baselineDate?: string;
}) {
  const stats = seriesStats(records);
  const baselineInView = Boolean(baselineDate && records.some(record => record.date === baselineDate));
  const officialDetail =
    indexDelta === null
      ? 'Sin visita anterior con el mismo alcance'
      : baselineDate
        ? `Visita ${baselineDate}${baselineInView ? '' : ' · fuera de este rango'}`
        : undefined;
  const closureDetail = stats.closures
    ? stats.closures.cancelled
      ? `${stats.closures.cancelled} cancelado${stats.closures.cancelled === 1 ? '' : 's'}`
      : 'En la última lectura del rango'
    : undefined;

  return (
    <div className="fp-kpi-facts" aria-label="Resumen del rango visible">
      <Fact label="Lecturas" value={String(stats.count)} detail={stats.count === 1 ? 'Una sola visita' : 'Aseguramientos revisados'} />
      <Fact label="Promedio" value={stats.average === null ? '—' : `${formatPoints(stats.average)}%`} detail="Media del rango visible" />
      <Fact
        label="Mínimo / máximo"
        value={stats.min === null || stats.max === null ? '—' : `${formatPoints(stats.min)}–${formatPoints(stats.max)}%`}
        detail="Índice oficial del rango"
      />
      <Fact
        label="Vs. visita anterior"
        value={formatSignedPoints(indexDelta)}
        detail={officialDetail}
        tone={deltaTone(indexDelta)}
      />
      <Fact
        label="En el rango"
        value={formatSignedPoints(stats.spanDelta)}
        detail={stats.count > 1 ? 'Primera a última lectura visible' : 'Hace falta otra lectura'}
        tone={deltaTone(stats.spanDelta)}
      />
      <Fact
        label="Incumplimientos abiertos"
        value={stats.closures ? String(stats.closures.open) : '—'}
        detail={closureDetail}
      />
      <Fact
        label="Incumplimientos cerrados"
        value={stats.closures ? String(stats.closures.closed) : '—'}
        detail="Estado Completado en la última lectura"
      />
    </div>
  );
}

export default function FarmPortalKpiBoard({
  records,
  chapterTrends,
  indexDelta,
  latestDate,
  baselineDate,
  variant = 'full'
}: FarmPortalKpiBoardProps) {
  const [trendRange, setTrendRange] = useState<TrendRange>('30d');

  const rangedRecords = useMemo(
    () => (variant === 'trend' ? filterRecordsByRange(records, trendRange) : records),
    [records, trendRange, variant]
  );
  const points = useMemo(() => toTrendPoints(rangedRecords), [rangedRecords]);

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
  const rangeHint = variant === 'trend' ? TREND_RANGE_HINTS[trendRange] : 'Historial completo de aseguramientos revisados';

  const chartBlock = points.length ? (
    <>
      <IndexTrendChart points={points} />
      {points.length === 1 && (
        <p className="fp-kpi-sparse">
          Hay una sola lectura
          {points[0].fullDate ? ` (${points[0].fullDate})` : ''}. La línea entre visitas aparece cuando el rango
          incluye otra lectura revisada.
        </p>
      )}
      <ReadingsTable points={points} />
    </>
  ) : (
    <div className="fp-kpi-empty">
      <div>
        <strong>No hay lecturas en este rango.</strong>
        <p>
          {latestDate
            ? `La última lectura publicada es del ${latestDate}. Prueba 12m o Año.`
            : 'Cuando exista un aseguramiento revisado, cada visita se verá como un punto.'}
        </p>
      </div>
    </div>
  );

  const exportButton = (
    <button
      type="button"
      className="fp-kpi-export"
      disabled={!rangedRecords.length}
      onClick={() => downloadTrendCsv(rangedRecords)}
    >
      <Download size={14} aria-hidden />
      CSV
    </button>
  );

  if (variant === 'trend') {
    return (
      <section className="fp-kpi-board is-trend-panel" id="fp-kpi-trend" aria-labelledby="fp-kpi-trend-title">
        <header className="fp-kpi-trend-head">
          <div>
            <h3 id="fp-kpi-trend-title">Tendencia del indicador</h3>
            <p className="fp-kpi-board-note">
              Índice oficial en aseguramientos revisados
              {latestDate ? ` · última lectura ${latestDate}` : ''}. {rangeHint}.
            </p>
          </div>
          <div className="fp-kpi-trend-tools">
            <div className="fp-kpi-range-tabs" role="tablist" aria-label="Rango de tiempo">
              {(Object.keys(TREND_RANGE_LABELS) as TrendRange[]).map(key => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  title={TREND_RANGE_HINTS[key]}
                  aria-selected={trendRange === key}
                  className={trendRange === key ? 'is-active' : ''}
                  onClick={() => setTrendRange(key)}
                >
                  {TREND_RANGE_LABELS[key]}
                </button>
              ))}
            </div>
            {exportButton}
          </div>
        </header>
        <SeriesFacts records={rangedRecords} indexDelta={indexDelta} baselineDate={baselineDate} />
        <div className="fp-kpi-trend-chart-wrap">{chartBlock}</div>
        {indexDelta !== null && (
          <p className={`fp-kpi-delta-chip is-${deltaTone(indexDelta) || 'flat'}`}>
            {indexDelta > 0 ? (
              <TrendingUp size={14} aria-hidden />
            ) : indexDelta < 0 ? (
              <TrendingDown size={14} aria-hidden />
            ) : (
              <Minus size={14} aria-hidden />
            )}
            {indexDelta === 0
              ? 'Sin cambio vs. visita anterior'
              : `Variación ${formatSignedPoints(indexDelta)} vs. anterior`}
            {baselineDate ? ` · ${baselineDate}` : ''}
          </p>
        )}
        <IndexThresholdLegend compact />
      </section>
    );
  }

  return (
    <section className="fp-kpi-board" aria-labelledby="fp-kpi-board-title">
      <header className="fp-kpi-board-head">
        <div className="metrics-section-kicker">Lectura visual</div>
        <div className="fp-kpi-board-title-row">
          <h3 id="fp-kpi-board-title">Indicadores del aseguramiento</h3>
          {exportButton}
        </div>
        <p className="fp-kpi-board-note">
          Cada punto es el índice oficial de una visita revisada ({visitLabel}
          {latestDate ? `, última el ${latestDate}` : ''}). La variación frente a la visita anterior solo compara
          el mismo alcance de capítulos.
        </p>
      </header>

      <SeriesFacts records={records} indexDelta={indexDelta} baselineDate={baselineDate} />
      <IndexThresholdLegend />

      <article className="fp-kpi-tile is-wide">
        <h4 className="fp-kpi-tile-title">Evolución del índice oficial</h4>
        <div className="fp-kpi-chart is-series">{chartBlock}</div>
        <p className="fp-kpi-tile-caption">
          Eje vertical 0–100. Bandas: Vulnerable por debajo de 80, Alerta entre 80 y 95, Saludable desde 95.
          {baselineDate && indexDelta !== null
            ? ` Comparado con la visita del ${baselineDate}.`
            : ' La comparación oficial aparece cuando hay una visita anterior con el mismo alcance.'}
        </p>
      </article>

      <div className="fp-kpi-grid">
        <article className="fp-kpi-tile">
          <h4 className="fp-kpi-tile-title">Distribución de estados</h4>
          <div className="fp-kpi-chart">
            {statusTotal > 0 ? (
              <StatusDonut counts={statusCounts} total={statusTotal} />
            ) : (
              <p className="fp-kpi-tile-caption">Sin clasificación en el historial.</p>
            )}
          </div>
          <p className="fp-kpi-tile-caption">Saludable ≥95% · Alerta 80–94% · Vulnerable &lt;80%. El centro es el número de visitas.</p>
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
