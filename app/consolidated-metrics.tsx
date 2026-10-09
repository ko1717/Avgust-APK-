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
  Users,
  Target,
  Sparkles,
  BarChart3
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
import {actionLabels,catalog,CHAPTER_WEIGHTS,findings,farmKey,metricStatusDescriptions,sameChapterScope,metricStatusLabels,metricTrendLabels,type MetricStatus,type Visit} from '@/lib/model';
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
    healthy:'Saludable (95-100%)',
    acceptable:'Alerta (80-94%)',
    critical:'Vulnerable (<80%)',
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

  // Robustly calculate fleet farm summaries with chronological ordering & disambiguation
  const fleetFarms=useMemo(()=>{
    const farmGroups=new Map<string,typeof data.records>();
    for(const r of data.records){
      const key=farmKey(r.visit.farm);
      const list=farmGroups.get(key)||[];
      list.push(r);
      farmGroups.set(key,list);
    }

    const result = Array.from(farmGroups.entries()).map(([key, records])=>{
      // Sort chronologically by date and revision/updated
      records.sort((a,b)=>{
        const dateCmp=a.date.localeCompare(b.date);
        if(dateCmp!==0)return dateCmp;
        return (a.visit.revision||0)-(b.visit.revision||0)||a.visit.id.localeCompare(b.visit.id);
      });

      const latest=records[records.length-1];
      const previous=records.length>1?records[records.length-2]:undefined;
      const comparable=!!previous&&sameChapterScope(previous.visit,latest.visit);
      const recentDelta=comparable?latest.score-previous!.score:null;
      const evaluatedChapters=latest.evaluatedChapters;
      const correctiveActions=findings(latest.visit).map(problem=>({
        id:problem.id,
        chapter:Number(problem.id.split('.')[0]),
        weightPct:Math.round((CHAPTER_WEIGHTS[Number(problem.id.split('.')[0])]||0)*100),
        text:problem.text,
        recommendation:problem.answer.recommendation||'Definir y documentar la acción correctiva.',
        owner:problem.action.owner,
        due:problem.action.due,
        status:problem.action.status,
        closure:problem.action.closure
      }));

      return {
        farm:latest.visit.farm,
        key,
        city:latest.visit.city||'',
        zone:latest.visit.zone||'',
        totalVisits:records.length,
        latestDate:latest.date,
        latestScore:latest.score,
        recentDelta,
        correctiveActions,
        latestFindings:latest.findings,
        latestApplicable:latest.applicable,
        latestStatus:latest.status,
        latestCompliance:latest.criteriaCompliance,
        latestWeightedScore:latest.weightedScore,
        latestPointsEarned:latest.pointsEarned,
        evaluatedChaptersCount:evaluatedChapters,
        evaluatedChaptersList:[...latest.visit.chapters].sort((a,b)=>a-b),
        responsible:latest.responsible,
        technician:latest.visit.technician||''
      };
    });

    return result.sort((a,b)=>b.latestScore-a.latestScore||a.farm.localeCompare(b.farm,'es'));
  },[data.records]);

  const filteredFleet=useMemo(()=>{
    return fleetFarms.filter(f=>{
      if(fleetStatusFilter!=='all'&&f.latestStatus!==fleetStatusFilter) return false;
      if(fleetScopeFilter==='complete'&&f.evaluatedChaptersCount!==5) return false;
      if(fleetScopeFilter==='partial'&&f.evaluatedChaptersCount===5) return false;
      if(fleetSearch){
        const q=fleetSearch.toLowerCase();
        return f.farm.toLowerCase().includes(q)||f.zone.toLowerCase().includes(q)||f.city.toLowerCase().includes(q)||f.responsible.toLowerCase().includes(q);
      }
      return true;
    });
  },[fleetFarms,fleetSearch,fleetStatusFilter,fleetScopeFilter]);

  const improvingFarms=useMemo(()=>filteredFleet.filter(f=>f.recentDelta!==null&&f.recentDelta>0).sort((a,b)=>(b.recentDelta||0)-(a.recentDelta||0)).slice(0,3),[filteredFleet]);
  const decliningFarms=useMemo(()=>filteredFleet.filter(f=>f.recentDelta!==null&&f.recentDelta<0).sort((a,b)=>(a.recentDelta||0)-(b.recentDelta||0)).slice(0,3),[filteredFleet]);
  const priorityFarms=useMemo(()=>filteredFleet.filter(f=>f.correctiveActions.length>0).sort((a,b)=>a.latestScore-b.latestScore||b.correctiveActions.length-a.correctiveActions.length),[filteredFleet]);
  const completeAuditsCount=useMemo(()=>fleetFarms.filter(f=>f.evaluatedChaptersCount===5).length,[fleetFarms]);
  const healthyCount=useMemo(()=>fleetFarms.filter(f=>f.latestStatus==='healthy').length,[fleetFarms]);
  const acceptableCount=useMemo(()=>fleetFarms.filter(f=>f.latestStatus==='acceptable').length,[fleetFarms]);
  const criticalCount=useMemo(()=>fleetFarms.filter(f=>f.latestStatus==='critical').length,[fleetFarms]);

  // Official fleet average weighted score
  const fleetAverageScore = data.weightedScore ?? data.score ?? 0;

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
          <h2 id="consolidated-title">Panorama MIPE de todas las fincas</h2>
          <p>Estado de salud, cambios entre visitas y acciones correctivas pendientes en una sola vista.</p>
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
          <div className="metrics-executive-dashboard">
            <section className={`metrics-outcome ${data.status}`} aria-label="Conclusión consolidada de las fincas">
              <div className="metrics-outcome-main">
                <div className="metrics-section-kicker">Resultado de la flota · {data.farms} fincas · {data.records.length} visitas revisadas</div>
                <h3>Estado fitosanitario de las fincas</h3>
                <StatusBadge value={data.status}/>
                <p className="metrics-outcome-copy">{metricStatusDescriptions[data.status]}</p>
              </div>
              <div className="metrics-outcome-score" aria-label={`Índice MIPE promedio ${fleetAverageScore} por ciento`}>
                <strong>{fleetAverageScore}<span>%</span></strong>
                <small>Promedio MIPE</small>
                <div className="metrics-score-track"><span style={{width:`${Math.min(100,Math.max(0,fleetAverageScore))}%`}}/></div>
              </div>
              <div className="metrics-fleet-status-counts">
                <div className="healthy"><strong>{healthyCount}</strong><span>Saludables</span><small>95–100%</small></div>
                <div className="acceptable"><strong>{acceptableCount}</strong><span>En alerta</span><small>80–94%</small></div>
                <div className="critical"><strong>{criticalCount}</strong><span>Vulnerables</span><small>Menos de 80%</small></div>
                <div className="total"><strong>{fleetFarms.length}</strong><span>Fincas evaluadas</span><small>En el periodo</small></div>
              </div>
            </section>

            <section className="metrics-podium-panel">
              <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Cambio entre visitas comparables</div><h3>Podios de evolución</h3></div><span className="metrics-note">Mismo alcance de capítulos</span></div>
              <div className="metrics-podium-columns">
                <div className="metrics-podium-group improve"><h4><TrendingUp size={17}/> Mejoras</h4>{improvingFarms.length?improvingFarms.map((farm,index)=><div className="metrics-podium-farm" key={farm.key}><span>{['🥇','🥈','🥉'][index]} {farm.farm}</span><strong>+{farm.recentDelta} pts</strong></div>):<p>No hay mejoras comparables en el periodo.</p>}</div>
                <div className="metrics-podium-group decline"><h4><TrendingDown size={17}/> Desmejoras</h4>{decliningFarms.length?decliningFarms.map((farm,index)=><div className="metrics-podium-farm" key={farm.key}><span>{['🥇','🥈','🥉'][index]} {farm.farm}</span><strong>{farm.recentDelta} pts</strong></div>):<p>No hay desmejoras comparables en el periodo.</p>}</div>
              </div>
            </section>

            <section className="metrics-weights-panel">
              <div className="metrics-section-kicker">Modelo oficial de calificación</div>
              <h3>Peso de los cinco capítulos</h3>
              <div className="metrics-weight-list metrics-fleet-weight-list">
                {catalog.map(chapter=>(
                  <div className="metrics-weight-row" key={chapter.id}>
                    <div className="metrics-weight-label"><span><b>Cap. {chapter.id}</b> {chapter.title}</span><strong>{Math.round(CHAPTER_WEIGHTS[chapter.id]*100)}%</strong></div>
                    <div className="metrics-score-track"><span style={{width:`${CHAPTER_WEIGHTS[chapter.id]*100}%`}}/></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="metrics-fleet-panel">
              <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Lectura rápida · ordenadas por puntaje</div><h3>Estado por finca</h3></div><span className="metrics-note">{filteredFleet.length} de {fleetFarms.length}</span></div>
              <div className="metrics-fleet-filters">
                <input type="search" aria-label="Buscar finca, municipio o responsable AVGUST" placeholder="Buscar finca, municipio o responsable…" value={fleetSearch} onChange={e=>setFleetSearch(e.target.value)}/>
                <select aria-label="Filtrar por estado" value={fleetStatusFilter} onChange={e=>setFleetStatusFilter(e.target.value as 'all'|'healthy'|'acceptable'|'critical')}>
                  <option value="all">Todos los estados</option><option value="healthy">Saludable</option><option value="acceptable">Alerta</option><option value="critical">Vulnerable</option>
                </select>
                <select aria-label="Filtrar por alcance de auditoría" value={fleetScopeFilter} onChange={e=>setFleetScopeFilter(e.target.value as 'all'|'complete'|'partial')}>
                  <option value="all">Todos los alcances</option><option value="complete">Auditoría completa</option><option value="partial">Auditoría parcial</option>
                </select>
              </div>
              <div className="metrics-farm-list">
                {filteredFleet.map((farm,index)=>(
                  <article className={`metrics-farm-row ${farm.latestStatus}`} key={farm.key}>
                    <span className="metrics-farm-rank">{String(index+1).padStart(2,'0')}</span>
                    <div className="metrics-farm-identity"><strong>{farm.farm}</strong><small>{[farm.city,farm.zone].filter(Boolean).join(' · ')||'Ubicación sin registrar'} · Última visita {farm.latestDate}</small></div>
                    <div className="metrics-farm-score"><strong>{farm.latestScore}%</strong><small>MIPE</small></div>
                    <div><StatusBadge value={farm.latestStatus}/><small className="metrics-farm-conclusion">{metricStatusDescriptions[farm.latestStatus]}</small></div>
                    <div className="metrics-farm-findings"><strong>{farm.latestFindings}</strong><small>hallazgos</small></div>
                    <div className={`metrics-farm-delta ${farm.recentDelta===null?'neutral':farm.recentDelta>0?'positive':farm.recentDelta<0?'negative':'neutral'}`}>{farm.recentDelta===null?'Sin comparación':`${farm.recentDelta>0?'+':''}${farm.recentDelta} pts`}</div>
                  </article>
                ))}
                {!filteredFleet.length&&<p className="metrics-empty">No hay fincas que coincidan con la búsqueda y los filtros.</p>}
              </div>
            </section>

            <section className="metrics-priority-panel">
              <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Plan de trabajo</div><h3>Acciones correctivas por finca</h3></div><span className="metrics-count risk">{priorityFarms.reduce((sum,farm)=>sum+farm.correctiveActions.length,0)}</span></div>
              <p className="metrics-note">Primero aparecen las fincas con menor calificación. Abre cada finca para consultar todos los hallazgos, responsables, plazos y acciones.</p>
              <div className="metrics-farm-actions-list">
                {priorityFarms.map(farm=>(
                  <details className="metrics-farm-actions" key={farm.key}>
                    <summary><span><strong>{farm.farm}</strong><small>{farm.latestDate} · {farm.latestFindings} hallazgos · {farm.correctiveActions.length} acciones</small></span><span className={`metrics-farm-action-score ${farm.latestStatus}`}>{farm.latestScore}%</span></summary>
                    <ul className="metrics-action-list">
                      {farm.correctiveActions.map(action=>(
                        <li key={action.id}>
                          <div className="metrics-action-title"><strong>{action.id} · {action.text}</strong><span>Cap. {action.chapter} · {action.weightPct}%</span></div>
                          <p>{action.recommendation}</p>
                          <div className="metrics-action-meta"><span>Responsable: <b>{action.owner||'Sin asignar'}</b></span><span>Fecha: <b>{action.due||'Sin definir'}</b></span><span>Estado: <b>{actionLabels[action.status as keyof typeof actionLabels]||action.status}</b></span>{action.closure&&<span>Verificación: <b>{action.closure}</b></span>}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
                {!priorityFarms.length&&<p className="metrics-empty">No se encontraron acciones correctivas para las fincas filtradas.</p>}
              </div>
            </section>
          </div>

          <details className="metrics-deep-dive">
            <summary><span>Explorar análisis e historial</span><small>Elige una sección para consultar su detalle.</small></summary>
          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Indicadores históricos</span><small>Lecturas adicionales de la evolución de la flota</small></summary>
          {/* Executive Multi-Farm KPI Grid with Recharts Trend Lines & Well-Written Cards */}
          <div className="b2b-kpi-grid">
            {/* KPI 1: Índice MIPE Promedio de la Flota */}
            <div
              className={`b2b-kpi-card ${data.status} cursor-pointer transition-all ${timelineView==='score'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setTimelineView('score')}
              title="Click para enfocar Índice Consolidado en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('score');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#007fa3] flex items-center gap-1">
                    <Target size={12}/> Flota Integral MIPE
                  </span>
                  <span className="b2b-kpi-title">Índice MIPE Promedio</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Media ponderada de la flota</span>
                </div>
                <StatusBadge value={data.status}/>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{fleetAverageScore}%</span>
                <span className="text-xs font-semibold text-slate-500">puntos promedio</span>
              </div>

              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color="#007fa3" fillGradientId="sparkConsolidatedScore" unit="%" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                <strong>{metricStatusLabels[data.status]}:</strong> {metricStatusDescriptions[data.status]}
                <span className="block mt-1">{healthyCount} saludables · {acceptableCount} en alerta · {criticalCount} vulnerables.</span>
              </div>

              <div className="b2b-kpi-progress-wrap">
                <div className="b2b-kpi-progress">
                  <div className={`b2b-kpi-progress-fill ${data.status}`} style={{width:`${fleetAverageScore||0}%`}}/>
                </div>
                <div className="b2b-kpi-target-mark acceptable" style={{left:'80%'}} title="Umbral Alerta: 80%"/>
                <div className="b2b-kpi-target-mark" style={{left:'95%'}} title="Saludable: 95-100%"/>
              </div>
            </div>

            {/* KPI 2: Comportamiento Global de la Red */}
            <div
              className={`b2b-kpi-card highlight cursor-pointer transition-all ${timelineView==='all'?'ring-2 ring-[#78be20] shadow-md':''}`}
              onClick={()=>setTimelineView('all')}
              title="Click para comparar Comportamiento Global en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('all');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#78be20] flex items-center gap-1">
                    <TrendingUp size={12}/> Evolución Longitudinal
                  </span>
                  <span className="b2b-kpi-title">Tendencia de la Red</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Primer vs último periodo</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${data.trend==='improved'?'text-[#78be20]':data.trend==='declined'?'text-[#dc2626]':'text-slate-600'}`}>
                  {data.trend==='improved'?<TrendingUp size={14}/>:data.trend==='declined'?<TrendingDown size={14}/>:null}
                  {metricTrendLabels[data.trend]}
                </span>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">
                  {metricTrendLabels[data.trend]}
                </span>
                <span className="text-xs font-semibold text-slate-500">{data.timeline.length} periodos analizados</span>
              </div>

              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color={data.trend==='improved'?'#78be20':data.trend==='declined'?'#dc2626':'#007fa3'} fillGradientId="sparkConsolidatedTrend" unit="%" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                Comportamiento longitudinal ponderado a través de las evaluaciones registradas.
              </div>
            </div>

            {/* KPI 3: Cobertura de Fincas */}
            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${timelineView==='reports'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setTimelineView('reports')}
              title="Click para enfocar Informes y Fincas en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('reports');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#007fa3] flex items-center gap-1">
                    <Users size={12}/> Alcance Multi-Finca
                  </span>
                  <span className="b2b-kpi-title">Población Auditada</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Fincas con aseguramiento</span>
                </div>
                <Users size={15} className="text-[#007fa3]"/>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.farms}</span>
                <span className="text-xs font-semibold text-slate-500">fincas activas</span>
              </div>

              <div className="mt-1 mb-2">
                <KpiSparkline data={reportsSparkline} color="#007fa3" fillGradientId="sparkConsolidatedFarms" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                {completeAuditsCount} con auditoría completa (5/5 procesos) · {fleetFarms.length - completeAuditsCount} focalizadas.
              </div>
            </div>

            {/* KPI 4: Inconformidades Totales */}
            <div
              className={`b2b-kpi-card ${data.findings>0?'critical':'healthy'} cursor-pointer transition-all ${timelineView==='findings'?'ring-2 ring-[#dc2626] shadow-md':''}`}
              onClick={()=>setTimelineView('findings')}
              title="Click para enfocar Inconformidades Totales en la gráfica de evolución"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('findings');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-rose-600 flex items-center gap-1">
                    <ShieldAlert size={12}/> Riesgo Agregado
                  </span>
                  <span className="b2b-kpi-title">Hallazgos Totales</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Respuestas “No” en la flota</span>
                </div>
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

            {/* KPI 5: Aseguramientos Realizados */}
            <div
              className={`b2b-kpi-card cursor-pointer transition-all ${timelineView==='reports'?'ring-2 ring-[#007fa3] shadow-md':''}`}
              onClick={()=>setTimelineView('reports')}
              title="Click para ver Volumen de Aseguramientos"
              role="button"
              tabIndex={0}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setTimelineView('reports');}}
            >
              <div className="b2b-kpi-header">
                <div>
                  <span className="b2b-kpi-category text-[#007fa3] flex items-center gap-1">
                    <Layers size={12}/> Cobertura de Operación
                  </span>
                  <span className="b2b-kpi-title">Aseguramientos</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Informes técnicos revisados</span>
                </div>
                <Layers size={15} className="text-[#007fa3]"/>
              </div>

              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.records.length}</span>
                <span className="text-xs font-semibold text-slate-500">visitas documentadas</span>
              </div>

              <div className="mt-1 mb-2">
                <KpiSparkline data={reportsSparkline} color="#007fa3" fillGradientId="sparkConsolidatedVisits" height={38}/>
              </div>

              <div className="b2b-kpi-footer">
                Auditorías que validan Almacén, Dosificación, Transporte, Mezclas y Aplicación.
              </div>
            </div>
          </div>
          </details>

          {/* MASTER FLEET DIRECTORY: CONSOLIDADO DE TODAS LAS FINCAS */}
          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Detalle histórico por finca</span><small>Alcance, conformidad, hallazgos y responsables</small></summary>
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
                  {healthyCount} Saludables (95-100%)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#f2a900]"></span>
                  {acceptableCount} En alerta (80-94%)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#dc2626]"></span>
                  {criticalCount} Vulnerables (&lt;80%)
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
                    <option value="healthy">Saludable (95-100%)</option>
                    <option value="acceptable">Alerta (80-94%)</option>
                    <option value="critical">Vulnerable (&lt;80%)</option>
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4" aria-label="Podio de mejora entre fincas">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2"><TrendingUp size={17}/> Mayores mejoras recientes</h4>
                <p className="text-xs text-emerald-800 mt-1">Variación respecto a la visita previa con el mismo alcance de capítulos.</p>
                {improvingFarms.length?improvingFarms.map((farm,index)=><div key={farm.key} className="flex justify-between gap-3 border-t border-emerald-200 mt-2 pt-2 text-sm"><span>{index===0?'🥇':index===1?'🥈':'🥉'} {farm.farm}</span><strong className="text-emerald-800">+{farm.recentDelta} pts</strong></div>):<p className="text-xs text-slate-600 mt-2">No hay mejoras comparables en el filtro actual.</p>}
              </section>
              <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-4" aria-label="Podio de desmejora entre fincas">
                <h4 className="font-bold text-rose-900 flex items-center gap-2"><TrendingDown size={17}/> Mayores desmejoras recientes</h4>
                <p className="text-xs text-rose-800 mt-1">Variación respecto a la visita previa con el mismo alcance de capítulos.</p>
                {decliningFarms.length?decliningFarms.map((farm,index)=><div key={farm.key} className="flex justify-between gap-3 border-t border-rose-200 mt-2 pt-2 text-sm"><span>{index===0?'🥇':index===1?'🥈':'🥉'} {farm.farm}</span><strong className="text-rose-800">{farm.recentDelta} pts</strong></div>):<p className="text-xs text-slate-600 mt-2">No hay desmejoras comparables en el filtro actual.</p>}
              </section>
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
                          <span className="font-bold text-xs text-slate-500 tabular-nums">#{idx+1}</span>
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
                          {farm.evaluatedChaptersCount === 5 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#78be20]/15 text-[#245b3a] border border-[#78be20]/30">
                              <CheckCircle2 size={12} className="text-[#78be20]"/>
                              5/5 Completa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-[#007fa3] border border-sky-200" title={`Capítulos evaluados: ${farm.evaluatedChaptersList.join(', ')}`}>
                              <Layers size={12} className="text-[#007fa3]"/>
                              {farm.evaluatedChaptersCount}/5 (Caps: {farm.evaluatedChaptersList.join(', ')})
                            </span>
                          )}
                        </td>
                        <td aria-label={`Índice MIPE ${farm.latestScore}%`}>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-extrabold text-[#0f172a] min-w-[38px] tabular-nums">{farm.latestScore}%</strong>
                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${farm.latestStatus==='healthy'?'bg-[#78be20]':farm.latestStatus==='acceptable'?'bg-[#f2a900]':'bg-[#dc2626]'}`}
                                style={{width:`${farm.latestScore}%`}}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs font-semibold text-slate-700 tabular-nums">
                            {farm.latestCompliance!==null ? `${farm.latestCompliance}%` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tabular-nums ${farm.latestFindings>0?'bg-rose-100 text-rose-800 border border-rose-200':'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                            {farm.latestFindings}
                          </span>
                        </td>
                        <td>
                          <div title={metricStatusDescriptions[farm.latestStatus]}>
                            <StatusBadge value={farm.latestStatus}/>
                            <span className="block max-w-[210px] mt-1 text-[10px] leading-snug text-slate-500">{metricStatusDescriptions[farm.latestStatus]}</span>
                          </div>
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
          </details>

          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Acciones registradas en informes</span><small>Recomendaciones con responsables y fechas objetivo</small></summary>
          <section className="b2b-card-block">
            <div className="b2b-kicker">Plan de mejora</div>
            <h3>Acciones correctivas por finca</h3>
            <p className="sub">Hallazgos de la visita revisada más reciente, con recomendación, responsable, fecha objetivo y estado.</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
              {filteredFleet.filter(farm=>farm.correctiveActions.length>0).map(farm=>(
                <article key={farm.key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2"><h4 className="font-bold text-slate-900">{farm.farm}</h4><span className="text-xs text-slate-500">{farm.latestDate}</span></div>
                  <ul className="mt-3 space-y-3">
                    {farm.correctiveActions.map(action=>(
                      <li key={action.id} className="border-l-2 border-amber-400 pl-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs"><strong>Criterio {action.id}</strong><span>Cap. {action.chapter} · {action.weightPct}%</span><span className="rounded bg-rose-50 px-2 py-0.5 text-rose-800">Hallazgo: {action.text}</span></div>
                        <p className="my-1 text-sm text-slate-700"><strong>Acción:</strong> {action.recommendation}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Responsable: {action.owner||'Sin asignar'}</span><span>Fecha objetivo: {action.due||'Sin definir'}</span><span>Estado: {actionLabels[action.status as keyof typeof actionLabels]||action.status}</span>{action.closure&&<span>Verificación: {action.closure}</span>}</div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              {!filteredFleet.some(farm=>farm.correctiveActions.length>0)&&<p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">No hay acciones correctivas registradas en las visitas recientes del alcance seleccionado.</p>}
            </div>
          </section>
          </details>

          {/* Benchmark / Ranking Comparison entre fincas con igual alcance */}
          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Comparación entre fincas</span><small>Compara solo auditorías con el mismo alcance</small></summary>
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
                                  <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs tabular-nums ${record.rank===1?'bg-amber-100 text-amber-800 border border-amber-300':record.rank===2?'bg-slate-200 text-slate-800':'bg-slate-100 text-slate-600'}`}>
                                    {record.tied ? `Empate #${record.rank}` : `#${record.rank}`}
                                  </span>
                                </td>
                                <td><strong className="text-slate-900">{record.farm}</strong></td>
                                <td><span className="text-slate-600">{record.date}</span></td>
                                <td><strong className="text-[#007fa3] text-sm tabular-nums">{record.score}%</strong></td>
                                <td><span className={`font-bold tabular-nums ${record.findings>0?'text-[#dc2626]':'text-[#78be20]'}`}>{record.findings}</span></td>
                                <td><span className="text-slate-600 tabular-nums">{record.applicable}</span></td>
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
          </details>

          {/* Charts Row: Timeline & Findings by Chapter */}
          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Tendencias e incidencias por capítulo</span><small>Gráficos de evolución, hallazgos e informes</small></summary>
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
                          <ReferenceLine y={95} stroke="#16a34a" strokeWidth={2} strokeDasharray="4 4" label={{value:'Meta Óptima (≥ 95%)',fill:'#15803d',fontSize:10,fontWeight:700,position:'insideTopRight'}}/>
                          <ReferenceLine y={80} stroke="#d97706" strokeWidth={1.5} strokeDasharray="3 3" label={{value:'Umbral Alerta (80%)',fill:'#b45309',fontSize:10,fontWeight:700,position:'insideBottomRight'}}/>
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
          </details>

          {/* Pareto / Top Inconvenientes */}
          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Hallazgos más frecuentes</span><small>Criterios con mayor recurrencia entre fincas</small></summary>
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
                      <td><strong className="text-[#dc2626] text-sm tabular-nums">{item.findings}</strong></td>
                      <td>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold tabular-nums ${item.rate>=50?'bg-rose-100 text-rose-800 border border-rose-200':item.rate>=25?'bg-amber-100 text-amber-800 border border-amber-200':'bg-slate-100 text-slate-700'}`}>
                          {item.rate}%
                        </span>
                      </td>
                      <td><span className="font-bold text-slate-800 tabular-nums">{item.farms}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.some(item=>item.findings>0) && (
              <div className="p-6 text-center text-emerald-800 text-xs">No hay hallazgos registrados en el periodo.</div>
            )}
          </div>
          </details>

          {/* Consolidated Chapter Deep Dive with scope evidence and evaluated filter */}
          <details className="metrics-archive-section" name="fleet-metrics-archive">
            <summary><span>Auditoría técnica por capítulo</span><small>Abre un capítulo para revisar sus criterios y evidencias</small></summary>
          <div className="b2b-card-block">
            <div className="mb-2">
              <h3>Estado y Auditoría por Capítulo Normativo</h3>
              <p className="sub">Desglose exhaustivo de los 37 criterios oficiales por proceso con filtro de alcance y subcriterios.</p>
            </div>
            <ConsolidatedChapterDetails chapters={data.chapters} items={data.items}/>
          </div>
          </details>
          </details>
        </>
      )}
    </div>
  );
}

