'use client';
import {useMemo} from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis
} from 'recharts';

export type SparklinePoint = {
  date: string;
  label: string;
  value: number;
  formattedValue?: string;
};

interface KpiSparklineProps {
  data: SparklinePoint[];
  color?: string;
  fillGradientId?: string;
  unit?: string;
  height?: number;
  strokeWidth?: number;
  higherIsBetter?: boolean;
}

type SparklineTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: SparklinePoint;
    value: number;
  }>;
  unit?: string;
};

function SparklineTooltip({active, payload, unit}: SparklineTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900/95 text-white px-2.5 py-1.5 rounded-md shadow-lg border border-slate-700/80 text-[11px] leading-tight flex flex-col gap-0.5 pointer-events-none backdrop-blur-sm z-50">
        <span className="text-slate-400 font-medium text-[10px]">{item.label || item.date}</span>
        <div className="flex items-center gap-1 font-extrabold text-slate-100">
          <span className="tabular-nums text-sky-400">{item.formattedValue ?? `${item.value}${unit || ''}`}</span>
        </div>
      </div>
    );
  }
  return null;
}

export function KpiSparkline({
  data,
  color = '#007fa3',
  fillGradientId = 'sparkGradient',
  unit = '',
  height = 42,
  strokeWidth = 2
}: KpiSparklineProps) {
  const gradientKey = useMemo(() => `${fillGradientId}-${color.replace(/[^a-zA-Z0-9]/g, '')}`, [fillGradientId, color]);

  if (!data || data.length === 0) {
    return (
      <div className="h-[42px] flex items-center justify-center text-[11px] text-slate-400 italic">
        Sin histórico
      </div>
    );
  }

  // Single point (baseline initial visit)
  if (data.length === 1) {
    return (
      <div className="h-[42px] flex items-center justify-between px-2 bg-slate-50/80 dark:bg-slate-800/40 rounded border border-dashed border-slate-200 dark:border-slate-700/60">
        <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{backgroundColor: color}} />
          Línea base única
        </span>
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 tabular-nums">
          {data[0].formattedValue ?? `${data[0].value}${unit}`}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-visible" style={{height}} aria-label="Gráfica de tendencia histórica">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{top: 4, right: 4, left: 4, bottom: 2}}>
          <defs>
            <linearGradient id={gradientKey} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip
            content={<SparklineTooltip unit={unit} />}
            cursor={{stroke: color, strokeWidth: 1, strokeDasharray: '2 2'}}
            wrapperStyle={{outline: 'none'}}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={`url(#${gradientKey})`}
            isAnimationActive={false}
            dot={data.length <= 6 ? {r: 2.5, fill: color, stroke: '#fff', strokeWidth: 1.5} : false}
            activeDot={{r: 4.5, fill: color, stroke: '#ffffff', strokeWidth: 2}}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
