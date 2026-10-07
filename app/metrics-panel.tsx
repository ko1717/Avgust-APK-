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
  ShieldAlert
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
import {farmKey,metricStatusLabels,metricTrendLabels,type MetricStatus,type Visit} from '@/lib/model';
import {AVGUST_COMPLIANCE_TARGET} from './metric-display';
import {exportFarmMetricsWord} from '@/lib/export-metrics-word';
import {farmMetricHistory} from '@/lib/metric-analysis';
import {FarmChapterDetails} from './metric-chapter-details';
import ConsolidatedMetrics from './consolidated-metrics';
import {KpiSparkline,type SparklinePoint} from './kpi-sparkline';
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
  };
};

function CustomTooltip({active,payload,label}:{active?:boolean;payload?:TooltipPayloadItem[];label?:string}){
  if(active&&payload&&payload.length){
    const data=payload[0].payload;
    return (
      <div className="p-3 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700 text-xs flex flex-col gap-1.5 min-w-[180px]">
        <span className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</span>
        <div className="flex justify-between items-center text-sky-400">
          <span>Índice MIPE:</span>
          <b className="text-sm font-extrabold">{data.score}%</b>
        </div>
        <div className="flex justify-between items-center text-emerald-400">
          <span>Puntos ganados:</span>
          <b>{data.puntos} / 100</b>
        </div>
        <div className="flex justify-between items-center text-amber-400">
          <span>Cumplimiento criterios:</span>
          <b>{data.criterios}%</b>
        </div>
        <div className="flex justify-between items-center text-rose-400 border-t border-slate-800 pt-1 mt-0.5">
          <span>Hallazgos abiertos:</span>
          <b>{data.hallazgos}</b>
        </div>
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
  const [chartView,setChartView]=useState<'score'|'both'|'findings'|'compliance'|'coverage'>('both');
  
  const activeFarm=farm||farms[0]?.[0]||'';
  const scoped=useMemo(()=>visits.filter(v=>(!from||v.date>=`${from}-01-01`)&&(!to||v.date<=`${to}-12-31`)),[visits,from,to]);
  const data=useMemo(()=>farmMetricHistory(scoped,activeFarm),[scoped,activeFarm]);
  
  const chart=data.records.map(r=>({
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${r.date}T12:00:00`)),
    score:r.score,
    criterios:r.criteriaCompliance??r.score,
    hallazgos:r.findings,
    puntos:r.pointsEarned,
    cobertura:r.weightedCoveragePct
  }));

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
          <div className="b2b-kicker">Panel de Inteligencia Agronómica · B2B</div>
          <h2 id="farm-metrics-title">Evolución y Control MIPE por Finca</h2>
          <p>Supervisión oficial ponderada por procesos: Almacén (5%), Dosificación (30%), Transporte (5%), Mezclas (30%) y Aplicación (30%).</p>
        </div>
        {current && (
          <div className="b2b-header-actions">
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportFarmMetricsWord(data)}>
              <FileText size={16}/> Informe Ejecutivo Word
            </button>
            <button className="b2b-btn b2b-btn-primary" onClick={()=>window.print()}>
              <Printer size={16}/> Exportar PDF de Alta Resolución
            </button>
          </div>
        )}
      </div>

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
                Puntuación oficial ponderada según matriz de 5 procesos normativos. Meta AVGUST {AVGUST_COMPLIANCE_TARGET}%:
                {' '}{current.score>=AVGUST_COMPLIANCE_TARGET?'alcanzada':`faltan ${AVGUST_COMPLIANCE_TARGET-current.score} puntos porcentuales`}.
              </div>
              <div className="b2b-kpi-progress">
                <div className={`b2b-kpi-progress-fill ${current.status}`} style={{width:`${Math.min(100,Math.max(0,current.score))}%`}}/>
              </div>
            </div>

            <div
              className={`b2b-kpi-card highlight cursor-pointer transition-all ${chartView==='both'?'ring-2 ring-emerald-500 shadow-md':''}`}
              onClick={()=>setChartView('both')}
              title="Click para comparar Trayectoria y Conformidad en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('both');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Trayectoria Temporal</span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${data.trend==='improved'?'text-emerald-600':data.trend==='declined'?'text-rose-600':'text-slate-600'}`}>
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
                <KpiSparkline data={deltaSparkline} color={data.trend==='improved'?'#10b981':data.trend==='declined'?'#f43f5e':'#0284c7'} fillGradientId="sparkDelta" unit=" pts" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {data.delta===null?'Línea base inicial':`Variación absoluta desde la primera auditoría técnica.`}
              </div>
            </div>

            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${chartView==='compliance'?'ring-2 ring-sky-500 shadow-md':''}`}
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
                <KpiSparkline data={complianceSparkline} color="#0284c7" fillGradientId="sparkCompliance" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Porcentaje de criterios individuales evaluados con respuesta “Sí”.
              </div>
              <div className="b2b-kpi-progress">
                <div className="b2b-kpi-progress-fill bg-sky-600" style={{width:`${current.criteriaCompliance||0}%`}}/>
              </div>
            </div>

            <div
              className={`b2b-kpi-card ${current.findings>0?'critical':'healthy'} cursor-pointer transition-all ${chartView==='findings'?'ring-2 ring-rose-500 shadow-md':''}`}
              onClick={()=>setChartView('findings')}
              title="Click para enfocar Hallazgos Abiertos en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('findings');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Hallazgos Abiertos</span>
                {current.findings>0?<AlertTriangle size={15} className="text-rose-600"/>:<CheckCircle2 size={15} className="text-emerald-600"/>}
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value" style={{color:current.findings>0?'#e11d48':'#059669'}}>
                  {current.findings}
                </span>
                <span className="text-xs font-semibold text-slate-500">criterios en “No”</span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={findingsSparkline} color={current.findings>0?'#e11d48':'#10b981'} fillGradientId="sparkFindings" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {current.findings===0?'Cero desviaciones detectadas en la última visita.':'Inconformidades técnicas que exigen planes de acción correctiva.'}
              </div>
            </div>

            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${chartView==='coverage'?'ring-2 ring-indigo-500 shadow-md':''}`}
              onClick={()=>setChartView('coverage')}
              title="Click para enfocar Cobertura Normativa en la gráfica principal"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setChartView('coverage');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Cobertura Normativa</span>
                <span className="text-xs font-bold text-indigo-600">{current.weightedCoveragePct}% Peso</span>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{current.evaluatedChapters}/5</span>
                <span className="text-xs font-semibold text-slate-500">capítulos</span>
              </div>
              {/* Interactive Recharts Sparkline */}
              <div className="mt-1 mb-2">
                <KpiSparkline data={coverageSparkline} color="#6366f1" fillGradientId="sparkCoverage" unit="%" height={38}/>
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
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} tick={{fontSize:11,fill:'#64748b'}}/>
                    <YAxis domain={chartView==='findings'?[0,'auto']:[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>chartView==='findings'?String(v):`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    {chartView!=='findings' && chartView!=='coverage' && (
                      <>
                        <ReferenceLine y={AVGUST_COMPLIANCE_TARGET} stroke="#78be20" strokeDasharray="5 4" label={{value:`Meta AVGUST (${AVGUST_COMPLIANCE_TARGET}%)`,fill:'#4b7413',fontSize:10,position:'insideTopRight'}}/>
                        <ReferenceLine y={80} stroke="#007fa3" strokeDasharray="4 4" label={{value:'Umbral saludable MIPE (80%)',fill:'#007fa3',fontSize:10,position:'insideTopRight'}}/>
                        <ReferenceLine y={50} stroke="#b83a32" strokeDasharray="4 4" label={{value:'Umbral crítico MIPE (50%)',fill:'#9d3028',fontSize:10,position:'insideBottomRight'}}/>
                      </>
                    )}
                    
                    {(chartView==='score'||chartView==='both') && (
                      <Area type="monotone" name="Índice MIPE Ponderado" dataKey="score" stroke="#007fa3" strokeWidth={3.5} fillOpacity={1} fill="url(#colorMipe)" dot={{r:5,fill:'#007fa3',strokeWidth:2,stroke:'#ffffff'}} activeDot={{r:7,fill:'#007fa3'}}/>
                    )}
                    {(chartView==='both'||chartView==='compliance') && (
                      <Line type="monotone" name="Cumplimiento Criterios" dataKey="criterios" stroke="#0284c7" strokeWidth={2.5} strokeDasharray={chartView==='both'?'4 4':'0'} dot={{r:4,fill:'#0284c7'}} activeDot={{r:6}}/>
                    )}
                    {(chartView==='findings') && (
                      <Line type="linear" name="Hallazgos Abiertos" dataKey="hallazgos" stroke="#e11d48" strokeWidth={2.5} dot={{r:4,fill:'#e11d48'}} activeDot={{r:6}}/>
                    )}
                    {(chartView==='coverage') && (
                      <Area type="monotone" name="Cobertura Normativa" dataKey="cobertura" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCoverage)" dot={{r:5,fill:'#6366f1'}} activeDot={{r:7}}/>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="b2b-chart-legend mt-3 justify-center">
              <div className="b2b-legend-item">
                <span className="b2b-legend-dot bg-[#007fa3]"/>
                <span>Índice MIPE Ponderado (Oficial)</span>
              </div>
              <div className="b2b-legend-item">
                <span className="b2b-legend-dot bg-[#0284c7]"/>
                <span>Conformidad Criterios (%)</span>
              </div>
              {chartView==='findings' && (
                <div className="b2b-legend-item">
                  <span className="b2b-legend-dot bg-[#e11d48]"/>
                  <span>Hallazgos Abiertos (Inconformidades)</span>
                </div>
              )}
              {chartView==='coverage' && (
                <div className="b2b-legend-item">
                  <span className="b2b-legend-dot bg-[#6366f1]"/>
                  <span>Cobertura Normativa (% Peso)</span>
                </div>
              )}
              {chartView!=='findings' && chartView!=='coverage' && (
                <div className="b2b-legend-item">
                  <span className="b2b-legend-dot bg-[#78be20]"/>
                  <span>Meta AVGUST ≥ {AVGUST_COMPLIANCE_TARGET}%</span>
                </div>
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
                      <p><strong>Observación registrada:</strong> {data.latest?.visit.answers[problem.id]?.observation || 'No se registró una observación para este hallazgo.'}</p>
                      <p><strong>Recomendación:</strong> {problem.recommendation || 'Pendiente de registrar recomendación técnica.'}</p>
                    </div>
                    <div className={`b2b-alert-footer ${problem.occurrences>1?'recurrent':''}`}>
                      <span>{problem.occurrences>1 ? `Registrado en ${problem.occurrences} informes del periodo` : 'Detectado en la última evaluación'}</span>
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
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${difference>=5?'text-emerald-600':difference<=-5?'text-rose-600':'text-slate-500'}`}>
                            {index===data.records.length-1?'Línea base':difference>=5?`+${difference} pts`:difference<=-5?`${difference} pts`:'Estable'}
                          </span>
                        </td>
                        <td>{record.responsible || 'Sin registrar'}</td>
                        <td>
                          <span className={`font-bold ${record.findings>0?'text-rose-600':'text-emerald-600'}`}>
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
