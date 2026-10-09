'use client';
import {useMemo,useState} from 'react';
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
import {
  BarChart3 as BarChartIcon,
  CheckCircle2 as CheckCircleIcon,
  Download as DownloadIcon,
  FileText as FileTextIcon,
  Minus as MinusIcon,
  Printer as PrinterIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  AlertTriangle as AlertTriangleIcon,
  Building2 as Building2Icon,
  ShieldAlert as ShieldAlertIcon,
  Info as InfoIcon,
  ShieldCheck as ShieldCheckIcon,
  Target as TargetIcon,
  Sparkles as SparklesIcon,
  Layers as LayersIcon
} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {actionLabels,catalog,farmKey,sameChapterScope,metricStatusDescriptions,metricStatusLabels,metricTrendLabels,type MetricStatus,type Visit} from '@/lib/model';
import {exportFarmMetricsWord} from '@/lib/export-metrics-word';
import {farmMetricHistory} from '@/lib/metric-analysis';
import {FarmChapterDetails} from './metric-chapter-details';
import ConsolidatedMetrics from './consolidated-metrics';
import {KpiSparkline,type SparklinePoint} from './kpi-sparkline';
import {GuidePresentation,GuideHelpButton} from './guide-presentation';
import './b2b-metrics.css';

function StatusBadge({value}:{value:MetricStatus}){
  const labels:Record<MetricStatus,string>={
    healthy:'Saludable (95-100%)',
    acceptable:'Alerta (80-94%)',
    critical:'Vulnerable (< 80%)',
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
      <div className="p-3.5 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700/80 text-xs flex flex-col gap-1.5 min-w-[260px] font-sans">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100">{label}</span>
          {view==='findings' ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${data.hallazgos===0?'text-[#78be20] bg-emerald-950/80 border-[#78be20]/50':'text-rose-300 bg-rose-950/80 border-rose-600/50'}`}>
              {data.hallazgos===0?'0 Desviaciones':'No Conforme'}
            </span>
          ) : isHealthy ? (
            <span className="text-[10px] font-bold text-[#78be20] bg-emerald-950/80 px-2 py-0.5 rounded border border-[#78be20]/50">
              ★ Saludable (95-100%)
            </span>
          ) : (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${data.score>=80?'text-[#f2a900] bg-amber-950/80 border-[#f2a900]/50':'text-rose-300 bg-rose-950/80 border-rose-600/50'}`}>
              {data.score>=80?'Alerta (80-94%)':'Vulnerable (< 80%)'}
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
              <span>2. Dosificación (25%):</span>
              <b className="tabular-nums">{data.cap2!==null?`${data.cap2}%`:'—'}</b>
            </div>
            <div className="flex justify-between text-[#f2a900]">
              <span>3. Transporte (10%):</span>
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
      const vChapters=r.visit.chapters && r.visit.chapters.length ? r.visit.chapters : [1, 2, 3, 4, 5];
      if(!c||!vChapters.includes(capId))return null;
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
    if(data.records.length<=1)return [];
    const first=data.records[0];
    const comparable=data.records.filter(record=>sameChapterScope(first.visit,record.visit));
    if(comparable.length<=1)return [];
    const baseScore=comparable[0].score;
    return comparable.map(r=>{
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
  const podium=data.records.slice(-3).map((record,index,items)=>{const previous=index>0?items[index-1]:undefined;return {record,label:index===items.length-1?'Última visita':index===items.length-2?'Visita anterior':'Inicio del periodo',delta:previous&&sameChapterScope(previous.visit,record.visit)?record.score-previous.score:null,hasPrevious:!!previous};});
  const currentYear=new Date().getFullYear();

  function setPreset(type:'all'|'lastYear'|'currentYear'){
    if(type==='all'){setFrom('');setTo('');}
    else if(type==='currentYear'){setFrom(String(currentYear));setTo(String(currentYear));}
    else if(type==='lastYear'){setFrom(String(currentYear-1));setTo(String(currentYear));}
  }

  // Count recurrent vs new findings
  const recurrentProblemsCount = useMemo(()=>data.problems.filter(p=>p.isRecurrent).length,[data.problems]);
  const newProblemsCount = useMemo(()=>data.problems.filter(p=>p.isNew).length,[data.problems]);

  // Identify chapter with the greatest opportunity for improvement
  const bottleneckChapter = useMemo(()=>{
    if(!data.chapters.length) return null;
    const evaluated = data.chapters.filter(c => c.score !== null && c.applicable > 0);
    if(!evaluated.length) return null;
    return evaluated.slice().sort((a,b) => {
      const lostPointsA = a.maxPoints - a.pointsEarned;
      const lostPointsB = b.maxPoints - b.pointsEarned;
      return lostPointsB - lostPointsA;
    })[0];
  },[data.chapters]);

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
          <h2 id="farm-metrics-title">Indicadores y acciones de la finca</h2>
          <p>Conclusión de la visita, cambios frente a mediciones anteriores y acciones para mejorar el proceso MIPE.</p>
        </div>

        {current && (
          <div className="b2b-header-actions">
            <GuideHelpButton onClick={()=>setShowGuideModal(true)}/>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>setShowGuide(!showGuide)} aria-expanded={showGuide}>
              <InfoIcon size={16}/> {showGuide?'Ocultar Modelo MIPE':'Modelo MIPE'}
            </button>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportFarmMetricsWord(data)}>
              <FileTextIcon size={16}/> Informe Ejecutivo Word
            </button>
            <button className="b2b-btn b2b-btn-primary" onClick={()=>window.print()}>
              <PrinterIcon size={16}/> Exportar PDF de Alta Resolución
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Methodology Guide */}
      {showGuide && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-all no-print animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <InfoIcon size={18} className="text-[#007fa3]"/>
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
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">25 Puntos (25%)</b>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">8 criterios de calibración, probetas y pesaje exacto de PPC.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 border-t-2 border-t-[#f2a900]">
              <span className="font-bold text-[#f2a900] block text-xs">Capítulo 3: Transporte</span>
              <b className="text-base text-slate-900 dark:text-slate-100 block my-1">10 Puntos (10%)</b>
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
            <span>• <strong>Lógica de puntuación:</strong> Los capítulos 2, 4 y 5 aportan el 85% del peso total.</span>
            <span>• <strong>Saludable:</strong> <span className="text-[#15803d] font-bold">95% a 100%</span>.</span>
            <span>• <strong>Alerta:</strong> <span className="text-[#92400e] font-bold">80% a 94%</span>.</span>
            <span>• <strong>Vulnerable:</strong> <span className="text-[#dc2626] font-bold">&lt; 80%</span>.</span>
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
                  <Building2Icon size={15} className="text-slate-400"/>
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
          <div className="metrics-executive-dashboard">
            <section className={`metrics-outcome ${current.status}`} aria-label="Conclusión de la finca">
              <div className="metrics-outcome-main">
                <div className="metrics-section-kicker">Resultado de la última visita · {current.date}</div>
                <h3>{data.farm}</h3>
                <StatusBadge value={current.status}/>
                <p className="metrics-outcome-copy">{metricStatusDescriptions[current.status]}</p>
              </div>
              <div className="metrics-outcome-score" aria-label={`Índice MIPE ${current.score} por ciento`}>
                <strong>{current.score}<span>%</span></strong>
                <small>Índice MIPE ponderado</small>
                <div className="metrics-score-track"><span style={{width:`${Math.min(100,Math.max(0,current.score))}%`}}/></div>
              </div>
              <div className="metrics-outcome-facts">
                <div><span>Puntaje</span><strong>{current.pointsEarned} / 100</strong></div>
                <div><span>Hallazgos</span><strong>{current.findings}</strong></div>
                <div><span>Cobertura</span><strong>{current.evaluatedChapters}/5 capítulos</strong></div>
                <div><span>Variación reciente</span><strong className={data.recentDelta===null?'':data.recentDelta>0?'positive':data.recentDelta<0?'negative':''}>{data.recentDelta===null?'Sin comparación':`${data.recentDelta>0?'+':''}${data.recentDelta} pts`}</strong></div>
              </div>
            </section>

            <div className="metrics-overview-grid">
              <section className="metrics-priority-panel">
                <div className="metrics-section-heading">
                  <div><div className="metrics-section-kicker">Qué corregir</div><h3>Hallazgos y acciones</h3></div>
                  <span className={`metrics-count ${data.problems.length?'risk':'clear'}`}>{data.problems.length}</span>
                </div>
                {data.problems.length ? (
                  <ul className="metrics-action-list">
                    {data.problems.map(problem=>(
                      <li key={problem.id}>
                        <div className="metrics-action-title"><strong>{problem.id} · {problem.text}</strong><span>Cap. {problem.chapter} · {problem.weightPct}%</span></div>
                        <p>{problem.recommendation||'Definir y documentar la acción correctiva.'}</p>
                        <div className="metrics-action-meta"><span>Responsable: <b>{problem.action.owner||'Sin asignar'}</b></span><span>Fecha: <b>{problem.action.due||'Sin definir'}</b></span><span>Estado: <b>{actionLabels[problem.action.status as keyof typeof actionLabels]||problem.action.status}</b></span></div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="metrics-empty">No hay hallazgos en la última visita revisada.</p>}
              </section>

              <section className="metrics-weights-panel">
                <div className="metrics-section-kicker">Ponderación de la calificación</div>
                <h3>Resultado por capítulo</h3>
                <div className="metrics-weight-list">
                  {data.chapters.map(chapter=>(
                    <div className="metrics-weight-row" key={chapter.id}>
                      <div className="metrics-weight-label"><span><b>Cap. {chapter.id}</b> {chapter.title}</span><strong>{chapter.weightPct}%</strong></div>
                      <div className="metrics-score-track"><span className={chapter.status} style={{width:`${chapter.score??0}%`}}/></div>
                      <small>{chapter.score===null?'Sin evaluar':`${chapter.pointsEarned.toFixed(1)} / ${chapter.maxPoints} pts · ${chapter.score}%`}</small>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {podium.length>0&&(
              <section className="metrics-podium-panel">
                <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Evolución de la finca</div><h3>Últimas visitas</h3></div><span className="metrics-note">Solo comparamos visitas con el mismo alcance</span></div>
                <div className="metrics-podium-list">
                  {podium.map((point,index)=>(
                    <article key={point.record.visit.id} className={index===podium.length-1?'current':''}>
                      <span className="metrics-podium-rank">0{index+1}</span>
                      <div><small>{point.label} · {point.record.date}</small><StatusBadge value={point.record.status}/></div>
                      <strong className="metrics-podium-score">{point.record.score}%</strong>
                      <span className={`metrics-podium-delta ${point.delta===null?'neutral':point.delta>0?'positive':point.delta<0?'negative':'neutral'}`}>{point.delta===null?(point.hasPrevious?'Sin comparación':'Línea base'):point.delta>0?`+${point.delta} pts`:point.delta<0?`${point.delta} pts`:'Sin cambio'}</span>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <details className="metrics-deep-dive">
            <summary><span>Más análisis e historial</span><small>Abre únicamente la sección que necesitas.</small></summary>
          <details className="metrics-archive-section" name="farm-metrics-archive">
            <summary><span>Indicadores históricos</span><small>Conformidad, cobertura y variación de las visitas</small></summary>
          {/* Executive KPI Scorecard with Recharts Trend Lines & Clear Well-Written Cards */}
          <div className="b2b-kpi-grid">
            {/* Card 1: Índice MIPE Ponderado */}
            <div
              className={`b2b-kpi-card ${current.status} cursor-pointer transition-all ${chartView==='score'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setChartView('score')}
              title="Click para enfocar Índice MIPE en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('score');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#007fa3] flex items-center gap-1">
                    <ShieldCheckIcon size={12}/> Programa Oficial MIPE
                  </span>
                  <span className="b2b-kpi-title">Índice MIPE Ponderado</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Puntuación ponderada global</span>
                </div>
                <StatusBadge value={current.status}/>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.score}%</span>
                <span className="text-xs font-semibold text-slate-600 tabular-nums">({current.pointsEarned} / 100 pts oficiales)</span>
              </div>

              {/* Interactive Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color="#007fa3" fillGradientId="sparkMipe" unit="%" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                {metricStatusDescriptions[current.status]}
              </div>

              <div className="b2b-kpi-progress-wrap">
                <div className="b2b-kpi-progress">
                  <div className={`b2b-kpi-progress-fill ${current.status}`} style={{width:`${Math.min(100,Math.max(0,current.score))}%`}}/>
                </div>
                <div className="b2b-kpi-target-mark acceptable" style={{left:'80%'}} title="Umbral Alerta: 80%"/>
                <div className="b2b-kpi-target-mark" style={{left:'95%'}} title="Meta Óptima: 95%"/>
              </div>
            </div>

            {/* Card 2: Trayectoria Temporal */}
            <div
              className={`b2b-kpi-card highlight cursor-pointer transition-all ${chartView==='both'?'ring-2 ring-[#78be20] shadow-md':''}`}
              onClick={()=>setChartView('both')}
              title="Click para comparar Trayectoria y Conformidad en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('both');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#78be20] flex items-center gap-1">
                    <TrendingUpIcon size={12}/> Trayectoria Histórica
                  </span>
                  <span className="b2b-kpi-title">Variación vs Línea Base</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Evolución frente al inicio</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${data.trend==='improved'?'text-[#78be20]':data.trend==='declined'?'text-[#dc2626]':'text-slate-600'}`}>
                  {data.trend==='improved'?<TrendingUpIcon size={14}/>:data.trend==='declined'?<TrendingDownIcon size={14}/>:<MinusIcon size={14}/>}
                  {metricTrendLabels[data.trend]}
                </span>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">
                  {data.delta===null ? 'Línea Base' : `${data.delta>0?'+':''}${data.delta} pts`}
                </span>
                {data.recentDelta !== null && data.recentDelta !== undefined ? (
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    ({data.recentDelta>0?'+':''}{data.recentDelta} vs previa)
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">{data.records.length>1?'Alcance distinto':'Punto inicial'}</span>
                )}
              </div>

              {/* Interactive Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={deltaSparkline} color={data.trend==='improved'?'#78be20':data.trend==='declined'?'#dc2626':'#007fa3'} fillGradientId="sparkDelta" unit=" pts" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                {data.delta===null
                  ? data.records.length<=1?'Primera medición: punto de referencia para evaluar ciclos futuros.':'Cambió el alcance de capítulos; no se compara la variación hasta tener dos visitas con el mismo alcance.'
                  : data.delta >= 5
                  ? `Avance acumulado de +${data.delta} puntos sobre el estado inicial; trayectoria favorable sostenida.`
                  : data.delta <= -5
                  ? `Desviación acumulada de ${data.delta} puntos respecto a la línea base; revisar causas de retroceso.`
                  : 'Desempeño técnico estable, manteniéndose en el rango de variación normal (±4 puntos).'}
              </div>
            </div>

            {/* Card 3: Tasa de Conformidad */}
            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${chartView==='compliance'?'ring-2 ring-[#00b5e2] shadow-md':''}`}
              onClick={()=>setChartView('compliance')}
              title="Click para enfocar Tasa de Conformidad en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('compliance');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#00b5e2] flex items-center gap-1">
                    <CheckCircleIcon size={12}/> 37 Criterios Técnicos
                  </span>
                  <span className="b2b-kpi-title">Tasa de Conformidad</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Respuestas favorables Sí / (Sí+No)</span>
                </div>
                <span className="text-xs font-bold text-slate-700 tabular-nums">{current.positive}/{current.applicable} conformes</span>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.criteriaCompliance!==null?`${current.criteriaCompliance}%`:'—'}</span>
                <span className="text-xs font-semibold text-slate-500">criterios aprobados</span>
              </div>

              {/* Interactive Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={complianceSparkline} color="#00b5e2" fillGradientId="sparkCompliance" unit="%" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                Porcentaje de criterios con respuesta favorable “Sí”. Criterios 'No Aplica' quedan estrictamente aislados del cómputo.
              </div>

              <div className="b2b-kpi-progress">
                <div className="b2b-kpi-progress-fill bg-[#00b5e2]" style={{width:`${current.criteriaCompliance||0}%`}}/>
              </div>
            </div>

            {/* Card 4: Hallazgos Abiertos */}
            <div
              className={`b2b-kpi-card ${current.findings>0?'critical':'healthy'} cursor-pointer transition-all ${chartView==='findings'?'ring-2 ring-[#dc2626] shadow-md':''}`}
              onClick={()=>setChartView('findings')}
              title="Click para enfocar Hallazgos Abiertos en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('findings');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-rose-600 flex items-center gap-1">
                    <AlertTriangleIcon size={12}/> Desviaciones y Riesgos
                  </span>
                  <span className="b2b-kpi-title">Hallazgos Abiertos</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">No conformidades detectadas</span>
                </div>
                {current.findings>0?<AlertTriangleIcon size={15} className="text-[#dc2626]"/>:<CheckCircleIcon size={15} className="text-[#78be20]"/>}
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value" style={{color:current.findings>0?'#dc2626':'#78be20'}}>
                  {current.findings}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {current.findings === 0
                    ? '0 desviaciones (Conforme)'
                    : `${recurrentProblemsCount} recurrente${recurrentProblemsCount===1?'':'s'} · ${newProblemsCount} nueva${newProblemsCount===1?'':'s'}`}
                </span>
              </div>

              {/* Interactive Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={findingsSparkline} color={current.findings>0?'#dc2626':'#78be20'} fillGradientId="sparkFindings" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                {current.findings===0
                  ? 'Cero desviaciones en la última auditoría: todos los procesos evaluados cumplen la norma técnica.'
                  : `${current.findings} observación${current.findings===1?'':'es'} con respuesta “No”; compromisos correctivos exigidos.`}
              </div>
            </div>

            {/* Card 5: Cobertura Normativa */}
            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${chartView==='coverage'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setChartView('coverage')}
              title="Click para enfocar Cobertura Normativa en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('coverage');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#007fa3] flex items-center gap-1">
                    <LayersIcon size={12}/> Alcance Auditado
                  </span>
                  <span className="b2b-kpi-title">Cobertura Normativa</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Peso ponderado auditado</span>
                </div>
                <span className="text-xs font-bold text-[#007fa3]">{current.weightedCoveragePct}% Peso</span>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.evaluatedChapters}/5</span>
                <span className="text-xs font-semibold text-slate-500">procesos auditados</span>
              </div>

              {/* Interactive Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={coverageSparkline} color="#007fa3" fillGradientId="sparkCoverage" unit="%" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                {current.evaluatedChapters===5
                  ? 'Auditoría integral completa: 100% de los 5 procesos fueron verificados con rigor en campo.'
                  : `Auditoría focalizada: ${5-current.evaluatedChapters} proceso(s) no incluido(s) en esta visita técnica.`}
              </div>
            </div>
          </div>


          {podium.length>0&&(
            <section className="b2b-card-block">
              <div className="b2b-kicker">Comparación de visitas</div>
              <h3>Podio de mejora y desmejora</h3>
              <p className="sub">Compara puntuaciones revisadas y muestra la variación entre visitas consecutivas.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {podium.map((point,index)=>(
                  <div key={point.record.visit.id} className={index===podium.length-1?'rounded-xl border border-[#007fa3] bg-sky-50 p-4':'rounded-xl border border-slate-200 bg-slate-50 p-4'}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-600">{index===0?'①':index===1?'②':'③'} {point.label}</span>
                      <StatusBadge value={point.record.status}/>
                    </div>
                    <strong className="block text-3xl text-slate-900 mt-2 tabular-nums">{point.record.score}%</strong>
                    <span className="text-xs text-slate-500">{point.record.date} · {point.record.pointsEarned} puntos</span>
                    {point.delta!==null&&<p className={point.delta>0?'mt-2 text-sm font-bold text-emerald-700':point.delta<0?'mt-2 text-sm font-bold text-rose-700':'mt-2 text-sm font-bold text-slate-600'}>{point.delta>0?'Mejora +'+point.delta+' puntos':point.delta<0?'Desmejora '+point.delta+' puntos':'Sin variación'}</p>}
                    {point.delta===null&&<p className="mt-2 text-xs text-slate-500">{point.hasPrevious?'Alcance distinto; sin comparación':'Línea base del periodo'}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Process Bottleneck Quick Insight */}
          {bottleneckChapter && (bottleneckChapter.maxPoints - bottleneckChapter.pointsEarned) > 0 && (
            <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between flex-wrap gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg text-amber-800 dark:text-amber-200">
                  <TargetIcon size={18}/>
                </div>
                <div>
                  <strong className="block text-sm font-bold text-amber-950 dark:text-amber-100">
                    Oportunidad de Mayor Impacto: Capítulo {bottleneckChapter.id} ({bottleneckChapter.title})
                  </strong>
                  <span className="text-amber-800/90 dark:text-amber-300">
                    Este proceso representa una brecha de {(bottleneckChapter.maxPoints - bottleneckChapter.pointsEarned).toFixed(1)} puntos no alcanzados ({bottleneckChapter.findings} hallazgo{bottleneckChapter.findings===1?'':'s'} en {bottleneckChapter.applicable} criterios).
                  </span>
                </div>
              </div>
              <button
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                onClick={()=>setChartView('chapters')}
              >
                Revisar Desglose de Capítulos →
              </button>
            </div>
          )}
          </details>

          {/* Interactive Chart Section */}
          <details className="metrics-archive-section" name="farm-metrics-archive">
            <summary><span>Gráfico de evolución</span><small>Explora el índice, los capítulos, hallazgos y cobertura</small></summary>
          <div className="b2b-chart-card">
            <div className="b2b-chart-header">
              <div>
                <h3>Evolución Histórica del Desempeño MIPE</h3>
                <p>Curva longitudinal por auditoría técnica verificable en el tiempo.</p>
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
                        <ReferenceLine y={95} stroke="#16a34a" strokeWidth={2} strokeDasharray="4 4" label={{value:'Meta Óptima (≥ 95%)',fill:'#15803d',fontSize:10,fontWeight:700,position:'insideTopRight'}}/>
                        <ReferenceLine y={80} stroke="#d97706" strokeWidth={1.5} strokeDasharray="3 3" label={{value:'Umbral Alerta (80%)',fill:'#b45309',fontSize:10,fontWeight:700,position:'insideBottomRight'}}/>
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
                        <Line type="monotone" name="2. Dosificación (25%)" dataKey="cap2" stroke="#78be20" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#78be20'}} activeDot={{r:6}}/>
                        <Line type="monotone" name="3. Transporte (10%)" dataKey="cap3" stroke="#f2a900" strokeWidth={2.5} connectNulls dot={{r:4,fill:'#f2a900'}} activeDot={{r:6}}/>
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
                    <span>2. Dosificación (25%)</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#f2a900]"/>
                    <span>3. Transporte (10%)</span>
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
                    <span>Saludable MIPE 95%-100%</span>
                  </div>
                  <div className="b2b-legend-item">
                    <span className="b2b-legend-dot bg-[#d97706]"/>
                    <span>Alerta 80% a 94%</span>
                  </div>
                </>
              )}
            </div>
          </div>
          </details>

          {/* Dual Column: Annual Closes & Process Health Radar */}
          <details className="metrics-archive-section" name="farm-metrics-archive">
            <summary><span>Cierres anuales y desglose técnico</span><small>Consulta resultados por año y por capítulo MIPE</small></summary>
          <div className="b2b-dual-grid">
            <div className="b2b-card-block">
              <h3>Cierre por Año</h3>
              <p className="sub">Consolidación anual de visitas, cierres oficiales y promedios.</p>
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
              <p className="sub">Distribución oficial de los 5 capítulos MIPE con pesos normativos (5%, 25%, 10%, 30%, 30%).</p>
              <FarmChapterDetails chapters={data.chapters}/>
            </div>
          </div>
          </details>

          {/* Priority Risk Alerts - Redesigned Cards */}
          <details className="metrics-archive-section" name="farm-metrics-archive">
            <summary><span>Hallazgos y acciones prioritarias</span><small>Recomendaciones, responsables, plazos y recurrencias</small></summary>
          <div className="b2b-card-block">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="b2b-kicker">Gestión de Riesgo Fitosanitario</div>
                <h3>Acciones correctivas prioritarias</h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>{data.problems.length} desviación{data.problems.length===1?'':'es'} identificada{data.problems.length===1?'':'s'}</span>
                {recurrentProblemsCount > 0 && (
                  <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold">
                    {recurrentProblemsCount} recurrente{recurrentProblemsCount===1?'':'s'}
                  </span>
                )}
              </div>
            </div>

            {data.problems.length ? (
              <div className="b2b-alerts-grid">
                {data.problems.map(problem=>(
                  <div key={problem.id} className={`b2b-alert-card ${problem.isRecurrent?'recurrent':problem.isReincident?'border-amber-400':''}`}>
                    <div>
                      <div className="b2b-alert-header">
                        <span className="b2b-alert-code">Criterio {problem.id}</span>
                        <span className="b2b-alert-tag">Capítulo {problem.chapter}</span>
                        {problem.chapter === 2 || problem.chapter === 4 || problem.chapter === 5 ? (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Peso {problem.weightPct}%
                          </span>
                        ) : null}
                      </div>
                      <h4>{problem.text}</h4>
                      <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80 my-2 text-xs">
                        <strong className="text-slate-800 block mb-0.5">Recomendación Técnica:</strong>
                        <p className="text-slate-600 m-0 leading-relaxed">
                          {problem.recommendation || 'Registrar plan de acción correctiva con responsable y plazo.'}
                        </p>
                        <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Responsable: <strong>{problem.action.owner||'Sin asignar'}</strong></span>
                          <span>Fecha objetivo: <strong>{problem.action.due||'Sin definir'}</strong></span>
                          <span>Estado: <strong>{actionLabels[problem.action.status as keyof typeof actionLabels]||problem.action.status}</strong></span>
                          {problem.action.closure&&<span>Verificación de cierre: <strong>{problem.action.closure}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <div className={`b2b-alert-footer ${problem.isRecurrent?'recurrent':''}`}>
                      <div className="flex items-center gap-1.5">
                        {problem.isRecurrent ? (
                          <>
                            <ShieldAlertIcon size={14} className="text-rose-600"/>
                            <strong className="text-rose-700">
                              Recurrente: presente en las últimas {problem.consecutiveStreak} visitas consecutivas
                            </strong>
                          </>
                        ) : problem.isReincident ? (
                          <>
                            <AlertTriangleIcon size={14} className="text-amber-600"/>
                            <strong className="text-amber-800">
                              Reincidente: {problem.occurrences} apariciones en el histórico
                            </strong>
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon size={14} className="text-blue-600"/>
                            <span className="text-slate-600">
                              Nueva desviación detectada en la última auditoría
                            </span>
                          </>
                        )}
                      </div>
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
          </details>

          {/* High-Density Audit History Table */}
          <details className="metrics-archive-section" name="farm-metrics-archive">
            <summary><span>Historial de visitas e informes</span><small>Registro completo y acceso a cada informe</small></summary>
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
                    <th>Variación vs Previa</th>
                    <th>Auditor / Responsable</th>
                    <th>Hallazgos</th>
                    <th className="no-print">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.slice().reverse().map((record,index)=>{
                    const prior=data.records[data.records.length-index-2];
                    const difference=prior?record.score-prior.score:0;
                    const isBase=index===data.records.length-1;
                    return (
                      <tr key={record.visit.id}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="b2b-table-strong">{record.date}</span>
                            {index === 0 && data.records.length > 1 && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-[#007fa3]/15 text-[#007fa3] border border-[#007fa3]/30 uppercase tracking-wider">
                                Oficial
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-[#007fa3] font-extrabold text-sm tabular-nums">{record.score}%</strong>
                            <small className="text-slate-500 tabular-nums">{record.pointsEarned} / 100 pts</small>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-slate-800 font-bold tabular-nums">{record.criteriaCompliance!==null?`${record.criteriaCompliance}%`:'—'}</strong>
                            <small className="text-slate-500 tabular-nums">{record.positive}/{record.applicable} conformes</small>
                          </div>
                        </td>
                        <td>
                          <StatusBadge value={record.status}/>
                        </td>
                        <td>
                          {isBase ? (
                            <span className="text-xs font-semibold text-slate-500 italic">Línea base</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${difference>=5?'text-[#78be20]':difference<=-5?'text-[#dc2626]':difference>0?'text-emerald-600':difference<0?'text-rose-500':'text-slate-500'}`}>
                              {difference>0?`+${difference} pts`:difference<0?`${difference} pts`:'0 pts (Estable)'}
                            </span>
                          )}
                        </td>
                        <td>{record.responsible || 'Sin registrar'}</td>
                        <td>
                          <span className={`font-bold tabular-nums ${record.findings>0?'text-[#dc2626]':'text-[#78be20]'}`}>
                            {record.findings}
                          </span>
                        </td>
                        <td className="no-print">
                          <button className="b2b-btn b2b-btn-secondary text-xs py-1 px-2.5" onClick={()=>onOpen(record.visit)}>
                            <DownloadIcon size={13}/> Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </details>
          </details>
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
          <BarChartIcon size={20} className="text-[#007fa3]"/>
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

