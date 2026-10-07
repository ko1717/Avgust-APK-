'use client';
import {useMemo,useState} from 'react';
import {
  Building2,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  Printer,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {catalog,farmKey,metricStatusLabels,metricTrendLabels,type MetricStatus,type Visit} from '@/lib/model';
import {compareFarmBenchmarks,consolidatedMetricAnalysis} from '@/lib/metric-analysis';
import {exportConsolidatedMatrixExcel} from '@/lib/export-matrix-excel';
import {exportConsolidatedMatrixCsv} from '@/lib/export-matrix-csv';
import {exportConsolidatedWord} from '@/lib/export-consolidated-word';
import ImportMatrix from './import-matrix';
import {ConsolidatedChapterDetails} from './metric-chapter-details';
import {KpiSparkline,type SparklinePoint} from './kpi-sparkline';
import './b2b-metrics.css';

function StatusBadge({value}:{value:MetricStatus}){
  const labels:Record<MetricStatus,string>={
    healthy:'Saludable',
    acceptable:'Aceptable',
    critical:'Crítico',
    pending:'Sin evaluar'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value]}</span>;
}

const monthLabel=(period:string)=>new Intl.DateTimeFormat('es-CO',{month:'short',year:'numeric'}).format(new Date(`${period}-01T12:00:00`));

export default function ConsolidatedMetrics({visits,loading,onImport}:{visits:Visit[];loading:boolean;onImport:(visits:Visit[])=>Promise<void>}){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [month,setMonth]=useState('');
  const [timelineView,setTimelineView]=useState<'score'|'findings'|'reports'|'all'>('score');
  
  // Fleet directory search and filter state
  const [fleetSearch,setFleetSearch]=useState('');
  const [fleetStatusFilter,setFleetStatusFilter]=useState<'all'|'healthy'|'acceptable'|'critical'>('all');
  const [fleetScopeFilter,setFleetScopeFilter]=useState<'all'|'complete'|'partial'>('all');

  const scoped=useMemo(()=>visits.filter(v=>(!from||v.date>=`${from}-01-01`)&&(!to||v.date<=`${to}-12-31`)&&(!month||v.date.startsWith(month))),[visits,from,to,month]);
  const data=useMemo(()=>consolidatedMetricAnalysis(scoped),[scoped]);
  const benchmark=useMemo(()=>compareFarmBenchmarks(scoped),[scoped]);
  
  const chart=data.timeline.map(row=>({...row,label:monthLabel(row.period)}));
  const chapterChart=data.chapters.map(row=>({chapter:`Cap ${row.id}`,hallazgos:row.findings,title:row.title}));

  const scoreSparkline:SparklinePoint[]=useMemo(()=>data.timeline.map(t=>({
    date:t.period,
    label:monthLabel(t.period),
    value:t.score,
    formattedValue:`${t.score}% MIPE`
  })),[data.timeline]);

  const reportsSparkline:SparklinePoint[]=useMemo(()=>data.timeline.map(t=>({
    date:t.period,
    label:monthLabel(t.period),
    value:t.reports,
    formattedValue:`${t.reports} informes`
  })),[data.timeline]);

  const findingsSparkline:SparklinePoint[]=useMemo(()=>data.timeline.map(t=>({
    date:t.period,
    label:monthLabel(t.period),
    value:t.findings,
    formattedValue:`${t.findings} hallazgos`
  })),[data.timeline]);

  // Consolidado detallado de todas las fincas de la flota
  const fleetFarms=useMemo(()=>{
    const map=new Map<string,{
      farm:string;
      key:string;
      city:string;
      zone:string;
      totalVisits:number;
      latestDate:string;
      latestScore:number;
      latestFindings:number;
      latestApplicable:number;
      latestStatus:MetricStatus;
      latestCompliance:number|null;
      latestWeightedScore:number|null;
      latestPointsEarned:number;
      evaluatedChapters:number[];
      responsible:string;
      technician:string;
    }>();

    for(const r of data.records){
      const key=farmKey(r.visit.farm);
      const existing=map.get(key);
      if(!existing||r.date>existing.latestDate){
        map.set(key,{
          farm:r.visit.farm,
          key,
          city:r.visit.city||'',
          zone:r.visit.zone||'',
          totalVisits:(existing?.totalVisits||0)+1,
          latestDate:r.date,
          latestScore:r.score,
          latestFindings:r.findings,
          latestApplicable:r.applicable,
          latestStatus:r.status,
          latestCompliance:r.criteriaCompliance,
          latestWeightedScore:r.weightedScore,
          latestPointsEarned:r.pointsEarned,
          evaluatedChapters:[...r.visit.chapters].sort((a,b)=>a-b),
          responsible:r.responsible,
          technician:r.visit.technician||''
        });
      }else{
        existing.totalVisits+=1;
      }
    }

    return Array.from(map.values()).sort((a,b)=>b.latestScore-a.latestScore||a.farm.localeCompare(b.farm,'es'));
  },[data.records]);

  const filteredFleet=useMemo(()=>{
    return fleetFarms.filter(f=>{
      if(fleetStatusFilter!=='all'&&f.latestStatus!==fleetStatusFilter) return false;
      if(fleetScopeFilter==='complete'&&f.evaluatedChapters.length!==5) return false;
      if(fleetScopeFilter==='partial'&&f.evaluatedChapters.length===5) return false;
      if(fleetSearch){
        const q=fleetSearch.toLowerCase();
        return f.farm.toLowerCase().includes(q)||f.zone.toLowerCase().includes(q)||f.city.toLowerCase().includes(q)||f.responsible.toLowerCase().includes(q);
      }
      return true;
    });
  },[fleetFarms,fleetSearch,fleetStatusFilter,fleetScopeFilter]);

  const completeAuditsCount=useMemo(()=>fleetFarms.filter(f=>f.evaluatedChapters.length===5).length,[fleetFarms]);
  const healthyCount=useMemo(()=>fleetFarms.filter(f=>f.latestStatus==='healthy').length,[fleetFarms]);
  const acceptableCount=useMemo(()=>fleetFarms.filter(f=>f.latestStatus==='acceptable').length,[fleetFarms]);
  const criticalCount=useMemo(()=>fleetFarms.filter(f=>f.latestStatus==='critical').length,[fleetFarms]);

  return (
    <div className="b2b-metrics-wrapper" aria-labelledby="consolidated-title">
      {/* Brand & Print Header */}
      <div className="metrics-print-brand hidden print:flex">
        <img src="/avgust-logo.svg" alt="Avgust Crop Protection" className="h-10"/>
        <div>
          <strong className="text-lg">AVGUST CARE 360 · Business Intelligence MIPE</strong>
          <span className="block text-xs text-slate-500">Informe Técnico Consolidado Multi-Finca</span>
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
          <h2 id="consolidated-title">Matriz Técnica de Aseguramientos Multi-Finca</h2>
          <p>Análisis transversal de todas las fincas para identificar procesos críticos, patrones de no conformidad y desempeño relativo.</p>
        </div>
        {data.records.length>0 && (
          <div className="b2b-header-actions">
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportConsolidatedWord(data,month||`${from||'Inicio'} a ${to||'hoy'}`)}>
              <FileSpreadsheet size={16}/> Informe Word
            </button>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportConsolidatedMatrixExcel(data)}>
              <FileSpreadsheet size={16}/> Matriz Excel
            </button>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportConsolidatedMatrixCsv(data)}>
              <FileDown size={16}/> CSV
            </button>
            <button className="b2b-btn b2b-btn-primary" onClick={()=>window.print()}>
              <Printer size={16}/> Guardar PDF
            </button>
          </div>
        )}
      </div>

      {/* Filter & Selector Ribbon */}
      <div className="b2b-filter-card no-print">
        <div className="b2b-filter-group">
          <label className="b2b-filter-label">
            <span>Mes Específico</span>
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="b2b-input"/>
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

        <div>
          <ImportMatrix onImport={onImport}/>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Cargando consolidado multi-finca…</div>
      ) : !data.records.length ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500">
          No hay aseguramientos revisados con criterios aplicables en el periodo seleccionado.
        </div>
      ) : (
        <>
          {/* Executive Multi-Farm KPI Grid with Recharts Trend Lines */}
          <div className="b2b-kpi-grid">
            <div
              className={`b2b-kpi-card ${data.status} cursor-pointer transition-all ${timelineView==='score'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setTimelineView('score')}
              title="Click para enfocar Índice Consolidado en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('score');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Índice Consolidado</span>
                <StatusBadge value={data.status}/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.score}%</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color="#007fa3" fillGradientId="sparkConsolidatedScore" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Promedio ponderado global entre todos los aseguramientos revisados.
              </div>
              <div className="b2b-kpi-progress">
                <div className={`b2b-kpi-progress-fill ${data.status}`} style={{width:`${data.score||0}%`}}/>
              </div>
            </div>

            <div
              className={`b2b-kpi-card highlight cursor-pointer transition-all ${timelineView==='all'?'ring-2 ring-[#78be20] shadow-md':''}`}
              onClick={()=>setTimelineView('all')}
              title="Click para comparar Comportamiento Global en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('all');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Comportamiento Global</span>
                <span className="text-xs font-bold text-[#007fa3]">
                  {metricTrendLabels[data.trend]}
                </span>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">
                  {data.trend==='improved'?<TrendingUp size={24} className="text-[#78be20] inline mr-1"/>:data.trend==='declined'?<TrendingDown size={24} className="text-[#dc2626] inline mr-1"/>:null}
                  {metricTrendLabels[data.trend]}
                </span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color={data.trend==='improved'?'#78be20':data.trend==='declined'?'#dc2626':'#007fa3'} fillGradientId="sparkConsolidatedTrend" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Comparación temporal entre el primer y último periodo registrado.
              </div>
            </div>

            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${timelineView==='reports'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setTimelineView('reports')}
              title="Click para enfocar Informes y Fincas en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('reports');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Población de Fincas</span>
                <Users size={15} className="text-[#007fa3]"/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.farms}</span>
                <span className="text-xs font-semibold text-slate-500">fincas auditadas</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={reportsSparkline} color="#007fa3" fillGradientId="sparkConsolidatedFarms" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {completeAuditsCount} con auditoría completa (5/5) · {fleetFarms.length - completeAuditsCount} parciales.
              </div>
            </div>

            <div
              className={`b2b-kpi-card ${data.findings>0?'critical':'healthy'} cursor-pointer transition-all ${timelineView==='findings'?'ring-2 ring-[#dc2626] shadow-md':''}`}
              onClick={()=>setTimelineView('findings')}
              title="Click para enfocar Inconformidades Totales en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('findings');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Inconformidades Totales</span>
                <ShieldAlert size={15} className="text-[#dc2626]"/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value text-[#dc2626]">{data.findings}</span>
                <span className="text-xs font-semibold text-slate-500">en {data.applicable} criterios</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={findingsSparkline} color={data.findings>0?'#dc2626':'#78be20'} fillGradientId="sparkConsolidatedFindings" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Tasa global de hallazgos: {data.applicable ? Math.round((data.findings/data.applicable)*100) : 0}% de los criterios evaluados.
              </div>
            </div>

            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${timelineView==='reports'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setTimelineView('reports')}
              title="Click para ver Volumen de Aseguramientos"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('reports');}}
            >
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Aseguramientos</span>
                <Layers size={15} className="text-[#007fa3]"/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.records.length}</span>
                <span className="text-xs font-semibold text-slate-500">visitas registradas</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={reportsSparkline} color="#007fa3" fillGradientId="sparkConsolidatedVisits" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Procesos: Almacén, Dosificación, Transporte, Mezclas y Equipos.
              </div>
            </div>
          </div>

          {/* MASTER FLEET DIRECTORY: CONSOLIDADO DE TODAS LAS FINCAS */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <div className="b2b-kicker">Consolidado General de Operación</div>
                <h3 className="flex items-center gap-2">
                  <Building2 size={19} className="text-[#007fa3]"/>
                  Directorio Consolidado de Todas las Fincas Auditadas
                </h3>
                <p className="sub">
                  Resumen exhaustivo de la auditoría técnica más reciente de cada finca en el periodo, su alcance normativo evaluado, calificación MIPE y desviaciones abiertas.
                </p>
              </div>

              {/* Fleet Overview Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#78be20]"></span>
                  {healthyCount} Saludables (≥95%)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#f2a900]"></span>
                  {acceptableCount} Aceptables (85-94%)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#dc2626]"></span>
                  {criticalCount} Críticas (&lt;85%)
                </span>
              </div>
            </div>

            {/* Filter Bar for Master Table */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Search size={16} className="text-slate-400"/>
                <input
                  type="search"
                  aria-label="Buscar finca, municipio o responsable AVGUST"
                  placeholder="Buscar finca, municipio o responsable AVGUST…"
                  value={fleetSearch}
                  onChange={e=>setFleetSearch(e.target.value)}
                  className="b2b-input w-full"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <Filter size={14} className="text-slate-400"/>
                  <span>Estado:</span>
                  <select
                    aria-label="Filtrar por estado"
                    value={fleetStatusFilter}
                    onChange={e=>setFleetStatusFilter(e.target.value as 'all'|'healthy'|'acceptable'|'critical')}
                    className="b2b-input py-1 text-xs"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="healthy">Saludable (≥95%)</option>
                    <option value="acceptable">Aceptable (85-94%)</option>
                    <option value="critical">Crítico (&lt;85%)</option>
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <span>Alcance:</span>
                  <select
                    aria-label="Filtrar por alcance de auditoría"
                    value={fleetScopeFilter}
                    onChange={e=>setFleetScopeFilter(e.target.value as 'all'|'complete'|'partial')}
                    className="b2b-input py-1 text-xs"
                  >
                    <option value="all">Todos los alcances</option>
                    <option value="complete">Auditoría Completa (5/5)</option>
                    <option value="partial">Auditoría Parcial (&lt;5)</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Fleet Master Table */}
            <div className="b2b-table-container">
              <table className="b2b-table">
                <thead>
                  <tr>
                    <th style={{width:'50px'}} aria-label="Posición">Posición</th>
                    <th>Finca y Ubicación</th>
                    <th>Último Aseguramiento</th>
                    <th>Capítulos Evaluados</th>
                    <th>Índice MIPE</th>
                    <th>Conformidad</th>
                    <th>Hallazgos (“No”)</th>
                    <th>Estado Semáforo</th>
                    <th>Responsable AVGUST</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFleet.length ? (
                    filteredFleet.map((farm,idx)=>(
                      <tr key={farm.key}>
                        <td>
                          <span className="font-bold text-xs text-slate-500">#{idx+1}</span>
                        </td>
                        <td>
                          <div>
                            <strong className="text-slate-900 block text-sm">{farm.farm}</strong>
                            {(farm.zone||farm.city) && (
                              <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={11} className="text-slate-400"/>
                                {[farm.zone,farm.city].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="text-slate-700 text-xs font-medium">{farm.latestDate}</span>
                          <span className="block text-[11px] text-slate-400">{farm.totalVisits} visita{farm.totalVisits===1?'':'s'} en histórico</span>
                        </td>
                        <td>
                          {farm.evaluatedChapters.length === 5 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#78be20]/15 text-[#245b3a] border border-[#78be20]/30">
                              <CheckCircle2 size={12} className="text-[#78be20]"/>
                              5/5 Completa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-[#007fa3] border border-sky-200" title={`Capítulos evaluados: ${farm.evaluatedChapters.join(', ')}`}>
                              <Layers size={12} className="text-[#007fa3]"/>
                              {farm.evaluatedChapters.length}/5 (Caps: {farm.evaluatedChapters.join(', ')})
                            </span>
                          )}
                        </td>
                        <td aria-label={`Índice MIPE ${farm.latestScore}%`}>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-extrabold text-[#0f172a] min-w-[38px]">{farm.latestScore}%</strong>
                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${farm.latestStatus==='healthy'?'bg-[#78be20]':farm.latestStatus==='acceptable'?'bg-[#f2a900]':'bg-[#dc2626]'}`}
                                style={{width:`${farm.latestScore}%`}}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs font-semibold text-slate-700">
                            {farm.latestCompliance!==null ? `${farm.latestCompliance}%` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${farm.latestFindings>0?'bg-rose-100 text-rose-800 border border-rose-200':'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                            {farm.latestFindings}
                          </span>
                        </td>
                        <td>
                          <StatusBadge value={farm.latestStatus}/>
                        </td>
                        <td>
                          <span className="text-xs text-slate-600 font-medium">{farm.responsible||'Sin asignar'}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                        No hay fincas coincidentes con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-2 flex-wrap gap-2">
              <span>Mostrando {filteredFleet.length} de {fleetFarms.length} fincas en el consolidado.</span>
              <span>Metodología oficial AVGUST Crop Protection · Escala 0-100 Puntos</span>
            </div>
          </div>

          {/* Benchmark / Ranking Comparison entre fincas con igual alcance */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="b2b-kicker">Clasificación Comparativa Homogénea</div>
                <h3>Benchmark de Desempeño entre Fincas con Igual Alcance</h3>
                <p className="sub">Compara la auditoría revisada más reciente de cada finca dentro del periodo. Solo se agrupan fincas con idénticos capítulos evaluados para garantizar rigor estadístico y equidad.</p>
              </div>
            </div>

            {benchmark.groups.length ? (
              <div className="grid gap-4 mt-3">
                {benchmark.groups.map(group=>{
                  const scope=group.chapterIds.map(id=>catalog.find(chapter=>chapter.id===id)?.title||`Capítulo ${id}`).join(' · ');
                  return (
                    <div key={group.chapterIds.join('-')} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy size={16} className="text-[#f2a900]"/>
                        <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Alcance Evaluado: {scope}</span>
                      </div>

                      <div className="b2b-table-container">
                        <table className="b2b-table">
                          <thead>
                            <tr>
                              <th style={{width:'90px'}}>Posición</th>
                              <th>Finca</th>
                              <th>Último Informe</th>
                              <th>Índice Oficial MIPE</th>
                              <th>Hallazgos Abiertos</th>
                              <th>Criterios Evaluados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.records.map(record=>(
                              <tr key={record.farm}>
                                <td>
                                  <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs ${record.rank===1?'bg-amber-100 text-amber-800 border border-amber-300':record.rank===2?'bg-slate-200 text-slate-800':'bg-slate-100 text-slate-600'}`}>
                                    {record.tied ? `Empate #${record.rank}` : `#${record.rank}`}
                                  </span>
                                </td>
                                <td><strong className="text-slate-900">{record.farm}</strong></td>
                                <td><span className="text-slate-600">{record.date}</span></td>
                                <td><strong className="text-[#007fa3] text-sm">{record.score}%</strong></td>
                                <td><span className={`font-bold ${record.findings>0?'text-[#dc2626]':'text-[#78be20]'}`}>{record.findings}</span></td>
                                <td><span className="text-slate-600">{record.applicable}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs">
                Aún no hay dos fincas con informes revisados de alcance idéntico en este periodo.
              </div>
            )}

            {benchmark.singleScopes.length>0 && (
              <details className="mt-3 p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
                <summary className="font-semibold cursor-pointer">{benchmark.singleScopes.length} finca{benchmark.singleScopes.length===1?'':'s'} con alcance particular sin pares directos</summary>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {benchmark.singleScopes.map(item=>(
                    <li key={item.farm}><strong>{item.farm}</strong> · {item.date} ({item.chapterIds.length?item.chapterIds.map(id=>`Cap. ${id}`).join(', '):'sin capítulos'})</li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* Charts Row: Timeline & Findings by Chapter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="b2b-chart-card">
              <div className="b2b-chart-header">
                <div>
                  <h3>Evolución Mensual Consolidada</h3>
                  <p>Comportamiento longitudinal ponderado de la flota de fincas.</p>
                </div>
                <div className="b2b-quick-ranges no-print">
                  <button className={`b2b-range-btn ${timelineView==='score'?'active':''}`} onClick={()=>setTimelineView('score')}>Índice MIPE</button>
                  <button className={`b2b-range-btn ${timelineView==='findings'?'active':''}`} onClick={()=>setTimelineView('findings')}>Hallazgos</button>
                  <button className={`b2b-range-btn ${timelineView==='reports'?'active':''}`} onClick={()=>setTimelineView('reports')}>Informes</button>
                  <button className={`b2b-range-btn ${timelineView==='all'?'active':''}`} onClick={()=>setTimelineView('all')}>Todos</button>
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                <div style={{minWidth:Math.max(400,chart.length*60)}}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chart} margin={{top:15,right:20,left:-15,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                      <YAxis domain={timelineView==='findings'||timelineView==='reports'?[0,'auto']:[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>timelineView==='findings'||timelineView==='reports'?String(v):`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <Tooltip formatter={(value,name)=>[timelineView==='score'||name==='Índice MIPE'?`${value}%`:value,String(name)]}/>
                      {(timelineView==='score'||timelineView==='all') && (
                        <>
                          <ReferenceLine y={95} stroke="#78be20" strokeWidth={2} strokeDasharray="4 4" label={{value:'Meta Saludable (≥ 95%)',fill:'#15803d',fontSize:10,position:'insideTopRight'}}/>
                          <ReferenceLine y={50} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 4" label={{value:'Crítico (50%)',fill:'#dc2626',fontSize:10,position:'insideBottomRight'}}/>
                        </>
                      )}
                      {(timelineView==='score'||timelineView==='all') && (
                        <Line type="monotone" dataKey="score" name="Índice MIPE" stroke="#007fa3" strokeWidth={3} dot={{r:5,fill:'#007fa3'}} activeDot={{r:7}}/>
                      )}
                      {(timelineView==='findings'||timelineView==='all') && (
                        <Line type="linear" dataKey="findings" name="Hallazgos" stroke="#dc2626" strokeWidth={2.5} strokeDasharray={timelineView==='all'?'4 4':'0'} dot={{r:4,fill:'#dc2626'}} activeDot={{r:6}}/>
                      )}
                      {(timelineView==='reports'||timelineView==='all') && (
                        <Line type="monotone" dataKey="reports" name="Informes" stroke="#005f7a" strokeWidth={2} strokeDasharray={timelineView==='all'?'2 2':'0'} dot={{r:3,fill:'#005f7a'}} activeDot={{r:5}}/>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="b2b-chart-card">
              <div className="b2b-chart-header">
                <div>
                  <h3>Concentración de Hallazgos por Proceso</h3>
                  <p>Número total de incumplimientos por capítulo MIPE.</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chapterChart} margin={{top:15,right:12,left:-20,bottom:4}}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3"/>
                  <XAxis dataKey="chapter" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                  <Tooltip formatter={(value,_name,item)=>[value,`Hallazgos en ${item.payload.title}`]}/>
                  <Bar dataKey="hallazgos" name="Hallazgos" fill="#f2a900" radius={[6,6,0,0]} isAnimationActive={false}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pareto / Top Inconvenientes */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="b2b-kicker">Priorización de Intervención</div>
                <h3>Criterios con Mayor Frecuencia de No Conformidad</h3>
                <p className="sub">Listado ordenado por volumen de respuestas “No” acumuladas en todas las fincas.</p>
              </div>
            </div>

            <div className="b2b-table-container">
              <table className="b2b-table">
                <thead>
                  <tr>
                    <th>Capítulo</th>
                    <th style={{width:'80px'}}>Código</th>
                    <th>Criterio Técnico / Inconveniente</th>
                    <th>Hallazgos Totales</th>
                    <th>Frecuencia Relativa</th>
                    <th>Fincas Afectadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.filter(item=>item.findings>0).slice(0,12).map(item=>(
                    <tr key={item.id}>
                      <td><span className="font-semibold text-slate-700">Cap. {item.chapter} · {item.chapterTitle}</span></td>
                      <td><strong className="text-slate-900">{item.id}</strong></td>
                      <td><span className="text-slate-700 text-xs">{item.text}</span></td>
                      <td><strong className="text-[#dc2626] text-sm">{item.findings}</strong></td>
                      <td>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${item.rate>=50?'bg-rose-100 text-rose-800 border border-rose-200':item.rate>=25?'bg-amber-100 text-amber-800 border border-amber-200':'bg-slate-100 text-slate-700'}`}>
                          {item.rate}%
                        </span>
                      </td>
                      <td><span className="font-bold text-slate-800">{item.farms}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.some(item=>item.findings>0) && (
              <div className="p-6 text-center text-emerald-800 text-xs">No hay hallazgos registrados en el periodo.</div>
            )}
          </div>

          {/* Consolidated Chapter Deep Dive with scope evidence and evaluated filter */}
          <div className="b2b-card-block">
            <div className="mb-2">
              <h3>Estado y Auditoría por Capítulo Normativo</h3>
              <p className="sub">Desglose exhaustivo de los 37 criterios oficiales por proceso con filtro de alcance y subcriterios.</p>
            </div>
            <ConsolidatedChapterDetails chapters={data.chapters} items={data.items}/>
          </div>
        </>
      )}
    </div>
  );
}
