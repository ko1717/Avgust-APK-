'use client';
import {useMemo,useState} from 'react';
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Minus,
  Printer,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Building2,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {catalog,farmKey,metricStatusLabels,metricTrendLabels,type MetricStatus,type Visit} from '@/lib/model';
import {exportFarmMetricsWord} from '@/lib/export-metrics-word';
import {farmMetricHistory} from '@/lib/metric-analysis';
import {FarmChapterDetails} from './metric-chapter-details';
import ConsolidatedMetrics from './consolidated-metrics';
import {KpiSparkline,type SparklinePoint} from './kpi-sparkline';
import {GuidePresentation,GuideHelpButton} from './guide-presentation';
import './b2b-metrics.css';

function StatusBadge({value}:{value:MetricStatus}){
  const labels:Record<MetricStatus,string>={
    healthy:'Conforme / Saludable',
    acceptable:'Aceptable con hallazgos',
    critical:'Crítico / Requiere acción',
    pending:'Sin medición'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value]}</span>;
}

type TooltipPayloadItem = {
  payload: {
    label: string;
    score: number;
    criterios: number;
    hallazgos: number;
    puntos: number;
    cobertura: number;
    cap1: number | null;
    cap2: number | null;
    cap3: number | null;
    cap4: number | null;
    cap5: number | null;
  };
};

function CustomTooltip({active,payload,label,view}:{active?:boolean;payload?:TooltipPayloadItem[];label?:string;view?:string}){
  if(active&&payload&&payload.length){
    const data=payload[0].payload;
    const isHealthy=data.score>=95;
    return (
      <div className="p-3.5 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700/80 text-xs flex flex-col gap-1.5 min-w-[230px] font-sans">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100">{label}</span>
          {isHealthy ? (
            <span className="text-[10px] font-bold text-[#78be20] bg-emerald-950/80 px-2 py-0.5 rounded border border-[#78be20]/50">
              ★ Meta 95%
            </span>
          ) : (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${data.score>=85?'text-[#f2a900] bg-amber-950/80 border-[#f2a900]/50':'text-rose-300 bg-rose-950/80 border-rose-600/50'}`}>
              {data.score>=85?'Aceptable (85-94%)':'Crítico (< 85%)'}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center text-[#00b5e2]">
          <span className="font-medium">Índice MIPE Ponderado:</span>
          <b className="text-sm font-extrabold tabular-nums">{data.score}%</b>
        </div>
        <div className="flex justify-between items-center text-[#78be20]">
          <span className="font-medium">Puntos oficiales ganados:</span>
          <b className="tabular-nums">{data.puntos} / 100 pts</b>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-medium">Conformidad de criterios:</span>
          <b className="tabular-nums text-slate-100">{data.criterios}%</b>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span className="font-medium">Cobertura de auditoría:</span>
          <b className="tabular-nums text-slate-200">{data.cobertura}% peso</b>
        </div>
        <div className="flex justify-between items-center border-t border-slate-800 pt-1.5 mt-0.5" style={{color:data.hallazgos>0?'#f43f5e':'#78be20'}}>
          <span className="font-medium">Hallazgos abiertos:</span>
          <b className="tabular-nums">{data.hallazgos>0?`${data.hallazgos} no conformes`:'0 (Conforme)'}</b>
        </div>

        {view==='chapters' && (
          <div className="mt-1.5 pt-2 border-t border-slate-800 flex flex-col gap-1 text-[11px]">
            <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">Desglose 5 Procesos MIPE:</span>
            <div className="flex justify-between text-[#00b5e2]">
              <span>1. Almacén (5%):</span>
              <b className="tabular-nums">{data.cap1!==null?`${data.cap1}%`:'—'}</b>
            </div>
            <div className="flex justify-between text-[#78be20]">
              <span>2. Dosificación (30%):</span>
              <b className="tabular-nums">{data.cap2!==null?`${data.cap2}%`:'—'}</b>
            </div>
            <div className="flex justify-between text-[#f2a900]">
              <span>3. Transporte (5%):</span>
              <b className="tabular-nums">{data.cap3!==null?`${data.cap3}%`:'—'}</b>
            </div>
            <div className="flex justify-between text-[#38bdf8]">
              <span>4. Mezclas (30%):</span>
              <b className="tabular-nums">{data.cap4!==null?`${data.cap4}%`:'—'}</b>
            </div>
            <div className="flex justify-between text-[#007fa3]">
              <span>5. Aplicación (30%):</span>
              <b className="tabular-nums">{data.cap5!==null?`${data.cap5}%`:'—'}</b>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}

function FarmMetrics({visits,loading,onOpen}:{visits:Visit[];loading:boolean;onOpen:(visit:Visit)=>void}){
  const farms=useMemo(()=>Array.from(new Map(visits.map(v=>[farmKey(v.farm),v.farm.trim()])).entries()).filter(([,name])=>name).sort((a,b)=>a[1].localeCompare(b[1],'es')),[visits]);
  const [farm,setFarm]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [chartView,setChartView]=useState<'score'|'both'|'findings'|'compliance'|'coverage'|'chapters'>('both');
  const [showGuide,setShowGuide]=useState(false);
  const [showGuideModal,setShowGuideModal]=useState(false);
  
  const activeFarm=farm||farms[0]?.[0]||'';
  const scoped=useMemo(()=>visits.filter(v=>(!from||v.date>=`${from}-01-01`)&&(!to||v.date<=`${to}-12-31`)),[visits,from,to]);
  const data=useMemo(()=>farmMetricHistory(scoped,activeFarm),[scoped,activeFarm]);
  
  const chart=data.records.map(r=>{
    const getCapScore=(capId:number)=>{
      const c=catalog.find(cat=>cat.id===capId);
      if(!c||!r.visit.chapters.includes(capId))return null;
      const applicable=c.items.filter(item=>['SI','NO'].includes(r.visit.answers[item.id]?.value||''));
      if(!applicable.length)return null;
      const positive=applicable.filter(item=>r.visit.answers[item.id]?.value==='SI').length;
      return Math.round((positive/applicable.length)*100);
    };
    return {
      label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${r.date}T12:00:00`)),
      score:r.score,
      criterios:r.criteriaCompliance??r.score,
      hallazgos:r.findings,
      puntos:r.pointsEarned,
      cobertura:r.weightedCoveragePct,
      cap1:getCapScore(1),
      cap2:getCapScore(2),
      cap3:getCapScore(3),
      cap4:getCapScore(4),
      cap5:getCapScore(5)
    };
  });

  const scoreSparkline:SparklinePoint[]=useMemo(()=>data.records.map(r=>({
    date:r.date,
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
    value:r.score,
    formattedValue:`${r.score}% (${r.pointsEarned} pts)`
  })),[data.records]);

  const deltaSparkline:SparklinePoint[]=useMemo(()=>{
    const baseScore=data.records[0]?.score??0;
    return data.records.map(r=>{
      const delta=r.score-baseScore;
      return {
        date:r.date,
        label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
        value:delta,
        formattedValue:`${delta>0?'+':''}${delta} pts`
      };
    });
  },[data.records]);

  const complianceSparkline:SparklinePoint[]=useMemo(()=>data.records.map(r=>({
    date:r.date,
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
    value:r.criteriaCompliance??r.score,
    formattedValue:`${r.criteriaCompliance??r.score}% conformes`
  })),[data.records]);

  const findingsSparkline:SparklinePoint[]=useMemo(()=>data.records.map(r=>({
    date:r.date,
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
    value:r.findings,
    formattedValue:`${r.findings} hallazgo${r.findings===1?'':'s'}`
  })),[data.records]);

  const coverageSparkline:SparklinePoint[]=useMemo(()=>data.records.map(r=>({
    date:r.date,
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
    value:r.weightedCoveragePct,
    formattedValue:`${r.weightedCoveragePct}% (${r.evaluatedChapters}/5 caps)`
  })),[data.records]);
  
  const current=data.latest;
  const currentYear=new Date().getFullYear();

  function setPreset(type:'all'|'lastYear'|'currentYear'){
    if(type==='all'){setFrom('');setTo('');}
    else if(type==='currentYear'){setFrom(String(currentYear));setTo(String(currentYear));}
    else if(type==='lastYear'){setFrom(String(currentYear-1));setTo(String(currentYear));}
  }

  return (
    <div className="b2b-metrics-wrapper" aria-labelledby="farm-metrics-title">
      {/* Brand & Print Header */}
      <div className="metrics-print-brand hidden print:flex">
        <img src="/avgust-logo.svg" alt="Avgust Crop Protection" className="h-10"/>
        <div>
          <strong className="text-lg">AVGUST CARE 360 · Business Intelligence MIPE</strong>
          <span className="block text-xs text-slate-500">Informe Ejecutivo de Evolución, Control y Cumplimiento Normativo</span>
        </div>
      </div>

      {/* Executive Command Header */}
      <div className="b2b-header no-print">
        <div className="b2b-header-title">
          <div className="b2b-kicker flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00b5e2] inline-block" title="Avgust Cian"/>
              <span className="w-2 h-2 rounded-full bg-[#78be20] inline-block" title="Avgust Verde Agro"/>
              <span className="w-2 h-2 rounded-full bg-[#f2a900] inline-block" title="Avgust Oro"/>
            </span>
            <span>AVGUST CROP PROTECTION · JUNTOS CRECEMOS BIEN</span>
          </div>
          <h2 id="farm-metrics-title">Evolución y Control MIPE por Finca</h2>
          <p>Supervisión oficial ponderada por procesos: Almacén (5%), Dosificación (30%), Transporte (5%), Mezclas (30%) y Aplicación (30%).</p>
        </div>
        {current && (
          <div className="b2b-header-actions">
            <GuideHelpButton onClick={()=>setShowGuideModal(true)}/>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>setShowGuide(!showGuide)} aria-expanded={showGuide}>
              <Info size={16}/> {showGuide?'Ocultar Modelo MIPE':'Modelo MIPE'}
            </button>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportFarmMetricsWord(data)}>
              <FileText size={16}/> Informe Ejecutivo Word
            </button>
            <button className="b2b-btn b2b-btn-primary" onClick={()=>window.print()}>
              <Printer size={16}/> Exportar PDF de Alta Resolución
            </button>
          </div>
        )}
      </div>

      {showGuide && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl no-print shadow-sm text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-[#007fa3]"/>
              <strong className="text-sm font-bold text-slate-900 dark:text-slate-100">Guía Oficial de Ponderación Normativa MIPE (37 Criterios · 100 Puntos)</strong>
            </div>
            <button onClick={()=>setShowGuide(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold px-2 py-0.5">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 border-t-2 border-t-[#007fa3]">
              <span className="font-bold text-[#007fa3] block text-xs">Capítulo 1: Almacén</span>
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">5 Puntos (5%)</b>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">4 criterios de almacenamiento seguro y señalización técnica.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 border-t-2 border-t-[#78be20]">
              <span className="font-bold text-[#78be20] block text-xs">Capítulo 2: Dosificación</span>
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">30 Puntos (30%)</b>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">8 criterios de calibración, probetas y pesaje exacto de PPC.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 border-t-2 border-t-[#f2a900]">
              <span className="font-bold text-[#f2a900] block text-xs">Capítulo 3: Transporte</span>
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">5 Puntos (5%)</b>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">4 criterios de traslado seguro y contención de derrames.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 border-t-2 border-t-[#00b5e2]">
              <span className="font-bold text-[#00b5e2] block text-xs">Capítulo 4: Mezclas</span>
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">30 Puntos (30%)</b>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">10 criterios de orden de mezcla, pre-dilución y calidad de agua.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 border-t-2 border-t-[#005f7a]">
              <span className="font-bold text-[#005f7a] dark:text-[#38bdf8] block text-xs">Capítulo 5: Aplicación</span>
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">30 Puntos (30%)</b>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">11 criterios de boquillas, presión, aforo y uso de EPP.</p>
            </div>
          </div>
          <div className="mt-3.5 text-[11.5px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            <span>• <strong>Lógica de puntuación:</strong> Los capítulos 2, 4 y 5 aportan el 90% del peso normativo por su criticidad agronómica directa.</span>
            <span>• <strong>Meta Saludable Oficial:</strong> <span className="text-[#15803d] font-bold">≥ 95%</span> (Estándar de floricultura para auditorías corporativas).</span>
            <span>• <strong>Rango Aceptable:</strong> <span className="text-[#92400e] font-bold">85% a 94%</span> (Permite seguimiento con compromisos correctivos).</span>
            <span>• <strong>Límite Crítico:</strong> <span className="text-[#dc2626] font-bold">&lt; 85%</span> (Exige plan de contingencia inmediato).</span>
            <span>• <strong>No Aplica (NA):</strong> Se excluye del cálculo sin penalizar puntuación ni inflar conformidad.</span>
          </div>
        </div>
      )}

      {/* Filter & Selector Ribbon */}
      <div className="b2b-filter-card no-print">
        <div className="b2b-filter-group">
          <label className="b2b-filter-label">
            <span>Finca en Consulta</span>
            <Select value={activeFarm||'none'} onValueChange={value=>setFarm(value==='none'?'':String(value))} items={[{value:'none',label:'Selecciona una finca'},...farms.map(([id,name])=>({value:id,label:name}))]}>
              <SelectTrigger aria-label="Finca para consultar métricas" className="b2b-select-trigger min-w-[240px]">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-slate-400"/>
                  <SelectValue placeholder="Selecciona una finca"/>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecciona una finca</SelectItem>
                {farms.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          <label className="b2b-filter-label">
            <span>Año Desde</span>
            <input type="number" min="2020" max="2100" placeholder="2022" value={from} onChange={e=>setFrom(e.target.value)} className="b2b-input w-24"/>
          </label>

          <label className="b2b-filter-label">
            <span>Año Hasta</span>
            <input type="number" min="2020" max="2100" placeholder="2026" value={to} onChange={e=>setTo(e.target.value)} className="b2b-input w-24"/>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Periodos rápidos:</span>
          <div className="b2b-quick-ranges">
            <button className={`b2b-range-btn ${!from&&!to?'active':''}`} onClick={()=>setPreset('all')}>Todo el Histórico</button>
            <button className={`b2b-range-btn ${from===String(currentYear-1)&&to===String(currentYear)?'active':''}`} onClick={()=>setPreset('lastYear')}>Últimos 24m</button>
            <button className={`b2b-range-btn ${from===String(currentYear)&&to===String(currentYear)?'active':''}`} onClick={()=>setPreset('currentYear')}>{currentYear}</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Cargando métricas y análisis de finca…</div>
      ) : !farms.length ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500">
          Aún no hay visitas guardadas para calcular métricas.
        </div>
      ) : !current ? (
        <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
          Esta finca no tiene informes revisados con criterios aplicables en el periodo seleccionado.
        </div>
      ) : (
        <>
          {/* Executive KPI Scorecard with Recharts Trend Lines */}
          <div className="b2b-kpi-grid">
            <div
              className={`b2b-kpi-card ${current.status} cursor-pointer transition-all ${chartView==='score'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setChartView('score')}
              title="Click para enfocar Índice MIPE en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('score');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Índice MIPE Ponderado</span>
                <StatusBadge value={current.status}/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.score}%</span>
                <span className="text-xs font-semibold text-slate-500">({current.pointsEarned} / 100 pts)</span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color="#007fa3" fillGradientId="sparkMipe" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Puntuación oficial ponderada según matriz de 5 procesos normativos.
              </div>
              <div className="b2b-kpi-progress">
                <div className={`b2b-kpi-progress-fill ${current.status}`} style={{width:`${Math.min(100,Math.max(0,current.score))}%`}}/>
              </div>
            </div>

            <div
              className={`b2b-kpi-card highlight cursor-pointer transition-all ${chartView==='both'?'ring-2 ring-[#78be20] shadow-md':''}`}
              onClick={()=>setChartView('both')}
              title="Click para comparar Trayectoria y Conformidad en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('both');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Trayectoria Temporal</span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${data.trend==='improved'?'text-[#78be20]':data.trend==='declined'?'text-[#dc2626]':'text-slate-600'}`}>
                  {data.trend==='improved'?<TrendingUp size={14}/>:data.trend==='declined'?<TrendingDown size={14}/>:<Minus size={14}/>}
                  {metricTrendLabels[data.trend]}
                </span>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">
                  {data.delta===null?'—':`${data.delta>0?'+':''}${data.delta} pts`}
                </span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={deltaSparkline} color={data.trend==='improved'?'#78be20':data.trend==='declined'?'#dc2626':'#007fa3'} fillGradientId="sparkDelta" unit=" pts" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {data.delta===null?'Línea base inicial':`Variación absoluta desde la primera auditoría técnica.`}
              </div>
            </div>

            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${chartView==='compliance'?'ring-2 ring-[#00b5e2] shadow-md':''}`}
              onClick={()=>setChartView('compliance')}
              title="Click para enfocar Tasa de Conformidad en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('compliance');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Tasa de Conformidad</span>
                <span className="text-xs font-bold text-slate-700">{current.positive}/{current.applicable} conformes</span>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.criteriaCompliance!==null?`${current.criteriaCompliance}%`:'—'}</span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={complianceSparkline} color="#00b5e2" fillGradientId="sparkCompliance" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Porcentaje de criterios individuales evaluados con respuesta “Sí”.
              </div>
              <div className="b2b-kpi-progress">
                <div className="b2b-kpi-progress-fill bg-[#00b5e2]" style={{width:`${current.criteriaCompliance||0}%`}}/>
              </div>
            </div>

            <div
              className={`b2b-kpi-card ${current.findings>0?'critical':'healthy'} cursor-pointer transition-all ${chartView==='findings'?'ring-2 ring-[#dc2626] shadow-md':''}`}
              onClick={()=>setChartView('findings')}
              title="Click para enfocar Hallazgos Abiertos en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('findings');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Hallazgos Abiertos</span>
                {current.findings>0?<AlertTriangle size={15} className="text-[#dc2626]"/>:<CheckCircle2 size={15} className="text-[#78be20]"/>}
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value" style={{color:current.findings>0?'#dc2626':'#78be20'}}>
                  {current.findings}
                </span>
                <span className="text-xs font-semibold text-slate-500">criterios en “No”</span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={findingsSparkline} color={current.findings>0?'#dc2626':'#78be20'} fillGradientId="sparkFindings" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {current.findings===0?'Cero desviaciones detectadas en la última visita.':'Inconformidades técnicas que exigen planes de acción correctiva.'}
              </div>
            </div>

            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${chartView==='coverage'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setChartView('coverage')}
              title="Click para enfocar Cobertura Normativa en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('coverage');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Cobertura Normativa</span>
                <span className="text-xs font-bold text-[#007fa3]">{current.weightedCoveragePct}% Peso</span>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.evaluatedChapters}/5</span>
                <span className="text-xs font-semibold text-slate-500">capítulos</span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={coverageSparkline} color="#007fa3" fillGradientId="sparkCoverage" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {current.evaluatedChapters===5?'Auditoría integral completa (100% de procesos).':'Auditoría de alcance parcial por requerimiento de campo.'}
              </div>
            </div>
          </div>

          {/* Interactive Chart Section */}
          <div className="b2b-chart-card">
            <div className="b2b-chart-header">
              <div>
                <h3>Evolución Histórica del Desempeño MIPE</h3>
                <p>Curva interactiva de comportamiento longitudinal por auditoría técnica en el tiempo.</p>
              </div>

              <div className="flex items-center gap-3 no-print">
                <div className="b2b-quick-ranges">
                  <button className={`b2b-range-btn ${chartView==='both'?'active':''}`} onClick={()=>setChartView('both')}>Ambos Índices</button>
                  <button className={`b2b-range-btn ${chartView==='score'?'active':''}`} onClick={()=>setChartView('score')}>Solo Índice MIPE</button>
                  <button className={`b2b-range-btn ${chartView==='chapters'?'active':''}`} onClick={()=>setChartView('chapters')}>5 Procesos MIPE</button>
                  <button className={`b2b-range-btn ${chartView==='compliance'?'active':''}`} onClick={()=>setChartView('compliance')}>Solo Conformidad</button>
                  <button className={`b2b-range-btn ${chartView==='findings'?'active':''}`} onClick={()=>setChartView('findings')}>Hallazgos</button>
                  <button className={`b2b-range-btn ${chartView==='coverage'?'active':''}`} onClick={()=>setChartView('coverage')}>Cobertura</button>
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <div style={{minWidth:Math.max(680,chart.length*105)}}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chart} margin={{top:15,right:20,left:-15,bottom:4}}>
                    <defs>
                      <linearGradient id="colorMipe" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007fa3" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#007fa3" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorCriterios" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00b5e2" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00b5e2" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#005f7a" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#005f7a" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} tick={{fontSize:11,fill:'#64748b'}}/>
                    <YAxis domain={chartView==='findings'?[0,'auto']:[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>chartView==='findings'?String(v):`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                    <Tooltip content={<CustomTooltip view={chartView}/>}/>
                    {chartView!=='findings' && (
                      <>
                        <ReferenceLine y={95} stroke="#16a34a" strokeWidth={2} strokeDasharray="4 4" label={{value:'Meta Saludable (≥ 95%)',fill:'#15803d',fontSize:10,fontWeight:700,position:'insideTopRight'}}/>
                        <ReferenceLine y={85} stroke="#d97706" strokeWidth={1.5} strokeDasharray="3 3" label={{value:'Umbral Aceptable (85%)',fill:'#b45309',fontSize:10,fontWeight:700,position:'insideBottomRight'}}/>
                      </>
                    )}
                    
                    {(chartView==='score'||chartView==='both') && (
                      <Area type="monotone" name="Índice MIPE Ponderado" dataKey="score" stroke="#007fa3" strokeWidth={3.5} fillOpacity={1} fill="url(#colorMipe)" dot={{r:5,fill:'#007fa3',strokeWidth:2,stroke:'#ffffff'}} activeDot={{r:7,fill:'#007fa3'}}/>
                    )}
                    {(chartView==='both'||chartView==='compliance') && (
                      <Line type="monotone" name="Cumplimiento Criterios" dataKey="criterios" stroke="#00b5e2" strokeWidth={2.5} strokeDasharray={chartView==='both'?'4 4':'0'} dot={{r:4,fill:'#00b5e2'}} activeDot={{r:6}}/>
                    )}
                    {(chartView==='findings') && (
                      <Line type="linear" name="Hallazgos Abiertos" dataKey="hallazgos" stroke="#dc2626" strokeWidth={2.5} dot={{r:4,fill:'#dc2626'}} activeDot={{r:6}}/>
                    )}
                    {(chartView==='coverage') && (
                      <Area type="monotone" name="Cobertura Normativa" dataKey="cobertura" stroke="#005f7a" strokeWidth={3} fillOpacity={1} fill="url(#colorCoverage)" dot={{r:5,fill:'#005f7a'}} activeDot={{r:7}}/>
                    )}
                    {(chartView==='chapters') && (
                      <>
                        <Line type="monotone" name="1. Almacén (5%)" dataKey="cap1" stroke="#007fa3" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#007fa3'}} activeDot={{r:6}}/>
                        <Line type="monotone" name="2. Dosificación (30%)" dataKey="cap2" stroke="#78be20" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#78be20'}} activeDot={{r:6}}/>
                        <Line type="monotone" name="3. Transporte (5%)" dataKey="cap3" stroke="#f2a900" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#f2a900'}} activeDot={{r:6}}/>
                        <Line type="monotone" name="4. Mezclas (30%)" dataKey="cap4" stroke="#00b5e2" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#00b5e2'}} activeDot={{r:6}}/>
                        <Line type="monotone" name="5. Aplicación (30%)" dataKey="cap5" stroke="#005f7a" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#005f7a'}} activeDot={{r:6}}/>
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="b2b-chart-legend mt-3 justify-center">
              {chartView!=='chapters' && (
                <>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#007fa3]"/>
                    <span>Índice MIPE Ponderado (Oficial)</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#00b5e2]"/>
                    <span>Conformidad Criterios (%)</span>
                  </div>
                </>
              )}
              {chartView==='findings' && (
                <div className="b2b-legend-item">
                  <span className="b2b-legend-dot bg-[#dc2626]"/>
                  <span>Hallazgos Abiertos (Inconformidades)</span>
                </div>
              )}
              {chartView==='coverage' && (
                <div className="b2b-legend-item">
                  <span className="b2b-legend-dot bg-[#005f7a]"/>
                  <span>Cobertura Normativa (% Peso)</span>
                </div>
              )}
              {chartView==='chapters' && (
                <>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#007fa3]"/>
                    <span>1. Almacén (5%)</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#78be20]"/>
                    <span>2. Dosificación (30%)</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#f2a900]"/>
                    <span>3. Transporte (5%)</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#00b5e2]"/>
                    <span>4. Mezclas (30%)</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#005f7a]"/>
                    <span>5. Aplicación (30%)</span>
                  </div>
                </>
              )}
              {chartView!=='findings' && (
                <>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#16a34a]"/>
                    <span>Meta Saludable Oficial MIPE ≥ 95%</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#d97706]"/>
                    <span>Rango Aceptable 85% a 94%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dual Column: Annual Closes & Process Health Radar */}
          <div className="b2b-dual-grid">
            <div className="b2b-card-block">
              <h3>Cierre por Año</h3>
              <p className="sub">Consolidación anual de visitas y promedios.</p>
              <div className="b2b-year-list">
                {data.yearly.map(y=>(
                  <div key={y.year} className="b2b-year-item">
                    <div className="b2b-year-meta">
                      <strong>Año {y.year}</strong>
                      <small>{y.visits} visita{y.visits===1?'':'s'} · Promedio {y.average}%</small>
                    </div>
                    <div className="b2b-year-score">
                      <b>{y.closing}%</b>
                      <StatusBadge value={y.status}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="b2b-card-block">
              <h3>Desglose y Ponderación por Proceso Normativo</h3>
              <p className="sub">Distribución oficial de los 5 capítulos MIPE con pesos normativos (5%, 30%, 5%, 30%, 30%).</p>
              <FarmChapterDetails chapters={data.chapters}/>
            </div>
          </div>

          {/* Priority Risk Alerts */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="b2b-kicker">Gestión de Riesgo Agronómico</div>
                <h3>Hallazgos Técnicos y Alertas de la Última Visita</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">{data.problems.length} desviación{data.problems.length===1?'':'es'} identificada{data.problems.length===1?'':'s'}</span>
            </div>

            {data.problems.length ? (
              <div className="b2b-alerts-grid">
                {data.problems.map(problem=>(
                  <div key={problem.id} className={`b2b-alert-card ${problem.occurrences>1?'recurrent':''}`}>
                    <div>
                      <div className="b2b-alert-header">
                        <span className="b2b-alert-code">Criterio {problem.id}</span>
                        <span className="b2b-alert-tag">Capítulo {problem.chapter}</span>
                      </div>
                      <h4>{problem.text}</h4>
                      <p><strong>Recomendación:</strong> {problem.recommendation || 'Pendiente de registrar recomendación técnica.'}</p>
                    </div>
                    <div className={`b2b-alert-footer ${problem.occurrences>1?'recurrent':''}`}>
                      <span>{problem.occurrences>1 ? `Recurrente en ${problem.occurrences} informes consecutivos` : 'Detectado en la última evaluación'}</span>
                      {problem.occurrences>1 && <ShieldAlert size={14}/>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 mt-3 text-center bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-medium">
                La última visita no registra inconformidades ni respuestas “No” en los capítulos evaluados.
              </div>
            )}
          </div>

          {/* High-Density Audit History Table */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3>Historial Cronológico de Auditorías e Informes</h3>
                <p className="sub">Registro auditado de visitas técnicas, indicadores y responsables.</p>
              </div>
            </div>

            <div className="b2b-table-container">
              <table className="b2b-table">
                <thead>
                  <tr>
                    <th>Fecha Auditoría</th>
                    <th>Índice MIPE (Ponderado)</th>
                    <th>Criterios Conformes</th>
                    <th>Estado de Salud</th>
                    <th>Comportamiento</th>
                    <th>Auditor / Responsable</th>
                    <th>Hallazgos</th>
                    <th className="no-print">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.slice().reverse().map((record,index)=>{
                    const prior=data.records[data.records.length-index-2];
                    const difference=prior?record.score-prior.score:0;
                    return (
                      <tr key={record.visit.id}>
                        <td>
                          <span className="b2b-table-strong">{record.date}</span>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-[#007fa3] font-extrabold text-sm">{record.score}%</strong>
                            <small className="text-slate-500">{record.pointsEarned} / 100 pts</small>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-slate-800 font-bold">{record.criteriaCompliance!==null?`${record.criteriaCompliance}%`:'—'}</strong>
                            <small className="text-slate-500">{record.positive}/{record.applicable} conformes</small>
                          </div>
                        </td>
                        <td>
                          <StatusBadge value={record.status}/>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${difference>=5?'text-[#78be20]':difference<=-5?'text-[#dc2626]':'text-slate-500'}`}>
                            {index===data.records.length-1?'Línea base':difference>=5?`+${difference} pts`:difference<=-5?`${difference} pts`:'Estable'}
                          </span>
                        </td>
                        <td>{record.responsible || 'Sin registrar'}</td>
                        <td>
                          <span className={`font-bold ${record.findings>0?'text-[#dc2626]':'text-[#78be20]'}`}>
                            {record.findings}
                          </span>
                        </td>
                        <td className="no-print">
                          <button className="b2b-btn b2b-btn-secondary text-xs py-1 px-2.5" onClick={()=>onOpen(record.visit)}>
                            <Download size={13}/> Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <GuidePresentation open={showGuideModal} onClose={()=>setShowGuideModal(false)}/>
    </div>
  );
}

export default function MetricsPanel(props:{visits:Visit[];loading:boolean;onOpen:(visit:Visit)=>void;onImport:(visits:Visit[])=>Promise<void>}){
  const [view,setView]=useState<'farm'|'consolidated'>('farm');
  return (
    <section className="metrics-area">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 no-print">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-[#007fa3]"/>
          <span className="font-bold text-slate-800 text-sm tracking-tight">VISTA ANALÍTICA MIPE:</span>
        </div>
        <div className="b2b-quick-ranges" role="tablist" aria-label="Tipo de métricas">
          <button role="tab" aria-selected={view==='farm'} className={`b2b-range-btn py-1.5 px-4 text-xs ${view==='farm'?'active':''}`} onClick={()=>setView('farm')}>
            Evolución por Finca Individual
          </button>
          <button role="tab" aria-selected={view==='consolidated'} className={`b2b-range-btn py-1.5 px-4 text-xs ${view==='consolidated'?'active':''}`} onClick={()=>setView('consolidated')}>
            Matriz Consolidada Multi-Finca
          </button>
        </div>
      </div>
      {view==='farm' ? (
        <FarmMetrics visits={props.visits} loading={props.loading} onOpen={props.onOpen}/>
      ) : (
        <ConsolidatedMetrics visits={props.visits} loading={props.loading} onImport={props.onImport}/>
      )}
    </section>
  );
}
