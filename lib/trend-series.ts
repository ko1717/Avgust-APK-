import {blankAction, findings, metricStatusLabels, type MetricStatus} from './model';
import type {MetricRecord} from './metric-analysis';

/** Presentation windows for the portal trend card. They do not affect the official index. */
export type TrendRange = '7d' | '30d' | '90d' | '12m' | 'year';

const DAY_MS = 24 * 60 * 60 * 1000;

const ROLLING_WINDOWS: Record<Exclude<TrendRange, 'year'>, number> = {
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  '90d': 90 * DAY_MS,
  '12m': 365 * DAY_MS
};

export function parseVisitDate(iso: string): number {
  return Date.parse(`${iso}T12:00:00`);
}

export function formatTrendDate(iso: string): string {
  const ms = parseVisitDate(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('es-CO', {day: 'numeric', month: 'short', year: 'numeric'}).format(ms);
}

export function formatTrendAxisDate(iso: string): string {
  const ms = parseVisitDate(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('es-CO', {day: 'numeric', month: 'short'}).format(ms);
}

/**
 * Keeps readings inside the selected window.
 * Rolling ranges count backward from the latest reading already on file.
 * "Año" is the calendar year of that latest reading.
 * An empty window stays empty: the chart must not invent a point outside the range.
 */
export function filterRecordsByRange(records: MetricRecord[], range: TrendRange): MetricRecord[] {
  if (!records.length) return [];
  const latest = records[records.length - 1];
  if (range === 'year') {
    const year = latest.date.slice(0, 4);
    return records.filter(record => record.date.slice(0, 4) === year);
  }
  const latestMs = parseVisitDate(latest.date);
  if (Number.isNaN(latestMs)) return records;
  const cutoff = latestMs - ROLLING_WINDOWS[range];
  return records.filter(record => {
    const ms = parseVisitDate(record.date);
    return !Number.isNaN(ms) && ms >= cutoff;
  });
}

export type TrendPoint = {
  chartKey: string;
  date: string;
  axisLabel: string;
  fullDate: string;
  score: number;
  status: MetricStatus;
  statusLabel: string;
  findings: number;
  responsible: string;
  isLatest: boolean;
};

export function toTrendPoints(records: MetricRecord[]): TrendPoint[] {
  return records.map((record, index) => ({
    chartKey: `${record.date}|${record.visit.id || index}`,
    date: record.date,
    axisLabel: formatTrendAxisDate(record.date),
    fullDate: formatTrendDate(record.date),
    score: record.score,
    status: record.status,
    statusLabel: metricStatusLabels[record.status],
    findings: record.findings,
    responsible: record.responsible?.trim() || 'Sin responsable',
    isLatest: index === records.length - 1
  }));
}

export type FindingClosureCounts = {
  open: number;
  closed: number;
  cancelled: number;
};

/** Counts action status on the findings already stored in a visit. Does not rescore the index. */
export function findingClosureCounts(record: MetricRecord | undefined): FindingClosureCounts | null {
  if (!record) return null;
  const items = findings(record.visit);
  const counts: FindingClosureCounts = {open: 0, closed: 0, cancelled: 0};
  for (const item of items) {
    const status = item.action?.status || blankAction().status;
    if (status === 'closed') counts.closed += 1;
    else if (status === 'cancelled') counts.cancelled += 1;
    else counts.open += 1;
  }
  return counts;
}

export type SeriesStats = {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  /** Last score minus first score inside the visible series. Not the official visit-to-visit delta. */
  spanDelta: number | null;
  closures: FindingClosureCounts | null;
};

export function seriesStats(records: MetricRecord[]): SeriesStats {
  if (!records.length) {
    return {count: 0, average: null, min: null, max: null, spanDelta: null, closures: null};
  }
  const scores = records.map(record => record.score);
  const average = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  const spanDelta =
    records.length > 1
      ? Math.round((scores[scores.length - 1] - scores[0]) * 10) / 10
      : null;
  return {
    count: records.length,
    average,
    min: Math.min(...scores),
    max: Math.max(...scores),
    spanDelta,
    closures: findingClosureCounts(records[records.length - 1])
  };
}

export function formatPoints(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return text;
}

export function formatSignedPoints(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  if (value === 0) return '0 pts';
  const text = formatPoints(value);
  return `${value > 0 ? '+' : ''}${text} pts`;
}

function csvCell(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Semicolon-separated so Excel in es-CO opens the columns. Values are the stored readings. */
export function seriesToCsv(records: MetricRecord[]): string {
  const header = ['fecha', 'indice_oficial', 'estado', 'hallazgos', 'criterios_aplicables', 'responsable'];
  const rows = records.map(record =>
    [
      record.date,
      formatPoints(record.score),
      metricStatusLabels[record.status],
      String(record.findings),
      String(record.applicable),
      record.responsible?.trim() || ''
    ]
      .map(csvCell)
      .join(';')
  );
  return `\uFEFF${[header.join(';'), ...rows].join('\n')}`;
}

export function downloadTrendCsv(records: MetricRecord[], filename = 'tendencia-indice-oficial.csv') {
  if (!records.length || typeof document === 'undefined') return;
  const blob = new Blob([seriesToCsv(records)], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
