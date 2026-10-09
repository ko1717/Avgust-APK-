'use client';
import {useMemo,useState} from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  FileDown,
  FileSpreadsheet,
  Printer,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';
import {actionLabels,catalog,CHAPTER_WEIGHTS,findings,farmKey,metrics as calculateMetrics,metricStatusDescriptions,sameChapterScope,metricStatusLabels,type MetricStatus,type Visit} from '@/lib/model';
import {consolidatedMetricAnalysis} from '@/lib/metric-analysis';
import {exportConsolidatedMatrixExcel} from '@/lib/export-matrix-excel';
import {exportConsolidatedMatrixCsv} from '@/lib/export-matrix-csv';
import {exportConsolidatedWord} from '@/lib/export-consolidated-word';
import ImportMatrix from './import-matrix';
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

export default function ConsolidatedMetrics({visits,loading,onImport}:{visits:Visit[];loading:boolean;onImport:(visits:Visit[])=>Promise<void>}){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [month,setMonth]=useState('');

  // Fleet directory search and filter state
  const [fleetSearch,setFleetSearch]=useState('');
  const [fleetStatusFilter,setFleetStatusFilter]=useState<'all'|'healthy'|'acceptable'|'critical'>('all');
  const [fleetScopeFilter,setFleetScopeFilter]=useState<'all'|'complete'|'partial'>('all');
  const [expandedActionFarms,setExpandedActionFarms]=useState<Record<string,boolean>>({});
  const [selectedTrendChapter,setSelectedTrendChapter]=useState<number|null>(null);

  const scoped=useMemo(()=>visits.filter(v=>(!from||v.date>=`${from}-01-01`)&&(!to||v.date<=`${to}-12-31`)&&(!month||v.date.startsWith(month))),[visits,from,to,month]);
  const data=useMemo(()=>consolidatedMetricAnalysis(scoped),[scoped]);
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
      const latestChapterScores=calculateMetrics(latest.visit).chapterScores;
      const previousChapterScores=comparable?calculateMetrics(previous!.visit).chapterScores:null;
      const chapterTrends=catalog.map(chapter=>{
        const score=latestChapterScores[chapter.id]??null;
        const previousScore=previousChapterScores?.[chapter.id]??null;
        const delta=comparable&&score!==null&&previousScore!==null?Math.round((score-previousScore)*10)/10:null;
        return {id:chapter.id,title:chapter.title,weightPct:Math.round(CHAPTER_WEIGHTS[chapter.id]*100),score,delta,comparisons:delta===null?0:1};
      });
      const correctiveActions=findings(latest.visit).map(problem=>({
        id:problem.id,
        chapter:Number(problem.id.split('.')[0]),
        weightPct:Math.round((CHAPTER_WEIGHTS[Number(problem.id.split('.')[0])]||0)*100),
        text:problem.text,
        observation:problem.answer.observation,
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
        latestDate:latest.date,
        latestScore:latest.score,
        recentDelta,
        correctiveActions,
        latestFindings:latest.findings,
        latestStatus:latest.status,
        evaluatedChaptersCount:evaluatedChapters,
        responsible:latest.responsible,
        chapterTrends
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

  const fleetChapterTrends=useMemo(()=>catalog.map(chapter=>{
    const chapterValues=fleetFarms.map(farm=>farm.chapterTrends.find(item=>item.id===chapter.id)!);
    const scores=chapterValues.flatMap(item=>item.score===null?[]:[item.score]);
    const farms=chapterValues.flatMap((item,index)=>item.delta===null?[]:[{farm:fleetFarms[index].farm,key:fleetFarms[index].key,date:fleetFarms[index].latestDate,delta:item.delta}]);
    const deltas=farms.map(item=>item.delta);
    return {id:chapter.id,title:chapter.title,weightPct:Math.round(CHAPTER_WEIGHTS[chapter.id]*100),score:scores.length?Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length*10)/10:null,delta:deltas.length?Math.round(deltas.reduce((sum,value)=>sum+value,0)/deltas.length*10)/10:null,comparisons:deltas.length,improvedCount:deltas.filter(value=>value>0).length,declinedCount:deltas.filter(value=>value<0).length,unchangedCount:deltas.filter(value=>value===0).length,farms};
  }),[fleetFarms]);
  const selectedTrend=fleetChapterTrends.find(chapter=>chapter.id===selectedTrendChapter)??fleetChapterTrends.find(chapter=>chapter.comparisons>0)??fleetChapterTrends[0];
  const trendScale=Math.max(5,...fleetChapterTrends.flatMap(chapter=>chapter.delta===null?[]:[Math.abs(chapter.delta)]));
  const improvingChapterCount=fleetChapterTrends.filter(chapter=>chapter.delta!==null&&chapter.delta>0).length;
  const decliningChapterCount=fleetChapterTrends.filter(chapter=>chapter.delta!==null&&chapter.delta<0).length;
  const unchangedChapterCount=fleetChapterTrends.filter(chapter=>chapter.delta===0).length;
  const uncomparableChapterCount=fleetChapterTrends.filter(chapter=>chapter.delta===null).length;
  const comparableFarmCount=fleetFarms.filter(farm=>farm.recentDelta!==null).length;

  const improvingFarms=useMemo(()=>filteredFleet.filter(f=>f.recentDelta!==null&&f.recentDelta>0).sort((a,b)=>(b.recentDelta||0)-(a.recentDelta||0)).slice(0,3),[filteredFleet]);
  const decliningFarms=useMemo(()=>filteredFleet.filter(f=>f.recentDelta!==null&&f.recentDelta<0).sort((a,b)=>(a.recentDelta||0)-(b.recentDelta||0)).slice(0,3),[filteredFleet]);
  const priorityFarms=useMemo(()=>filteredFleet.filter(f=>f.correctiveActions.length>0).sort((a,b)=>a.latestScore-b.latestScore||b.correctiveActions.length-a.correctiveActions.length),[filteredFleet]);
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
          <strong className="text-lg">AVGUST CARE 360 · Indicadores de aseguramiento</strong>
          <span className="block text-xs text-slate-500">Resumen del aseguramiento técnico · Multi-finca</span>
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
          <h2 id="consolidated-title">Aseguramiento técnico de fincas</h2>
          <p>Estado fitosanitario, cambios recientes y prioridades de atención, en una sola lectura.</p>
        </div>

        {data.records.length>0 && (
          <div className="b2b-header-actions">
            <button className="b2b-btn b2b-btn-primary" onClick={()=>void exportConsolidatedWord(data,month||`${from||'Inicio'} a ${to||'hoy'}`)}>
              <FileSpreadsheet size={16}/> Informe Word
            </button>
            <details className="metrics-export-menu">
              <summary><FileDown size={16}/> Más formatos</summary>
              <div className="metrics-export-options">
                <button onClick={()=>void exportConsolidatedMatrixExcel(data)}><FileSpreadsheet size={15}/> Matriz Excel</button>
                <button onClick={()=>void exportConsolidatedMatrixCsv(data)}><FileDown size={15}/> Descargar CSV</button>
                <button onClick={()=>window.print()}><Printer size={15}/> Guardar como PDF</button>
              </div>
            </details>
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
                <div className="metrics-section-kicker">Estado actual · {data.farms} fincas evaluadas</div>
                <h3>Estado fitosanitario de las fincas</h3>
                <StatusBadge value={data.status}/>
                <p className="metrics-outcome-copy">{metricStatusDescriptions[data.status]}</p>
              </div>
              <div className="metrics-outcome-score" aria-label={`Promedio de aseguramiento ${fleetAverageScore} por ciento`}>
                <strong>{fleetAverageScore}<span>%</span></strong>
                <small>Promedio de aseguramiento</small>
                <div className="metrics-score-track"><span style={{width:`${Math.min(100,Math.max(0,fleetAverageScore))}%`}}/></div>
              </div>
              <div className="metrics-fleet-status-counts">
                <div className="healthy"><strong>{healthyCount}</strong><span>Saludables</span><small>95–100%</small></div>
                <div className="acceptable"><strong>{acceptableCount}</strong><span>En alerta</span><small>80–94%</small></div>
                <div className="critical"><strong>{criticalCount}</strong><span>Vulnerables</span><small>Menos de 80%</small></div>
                <div className="total"><strong>{fleetFarms.length}</strong><span>Fincas evaluadas</span><small>En el periodo</small></div>
              </div>
            </section>

            <section className="metrics-chapter-evolution" aria-labelledby="metrics-chapter-evolution-title">
              <div className="metrics-section-heading">
                <div><div className="metrics-section-kicker">{data.records.length} aseguramientos · {data.farms} fincas</div><h3 id="metrics-chapter-evolution-title">¿Qué capítulos mejoraron?</h3></div>
                <span className="metrics-note">Comparación entre aseguramientos</span>
              </div>
              <p className="metrics-chapter-evolution-intro">Comparamos los dos últimos aseguramientos de cada finca cuando tienen el mismo alcance. Un valor positivo significa que subió el puntaje promedio; uno negativo, que bajó.</p>
              <div className="metrics-chapter-evolution-summary" aria-label="Resumen de tendencia por capítulo">
                <span className="positive"><ArrowUpRight size={15}/><strong>{improvingChapterCount}</strong> mejoraron</span>
                <span className="negative"><ArrowDownRight size={15}/><strong>{decliningChapterCount}</strong> bajaron</span>
                <span className="neutral"><Minus size={14}/><strong>{unchangedChapterCount}</strong> sin cambio</span>
                {uncomparableChapterCount>0&&<span className="neutral"><strong>{uncomparableChapterCount}</strong> sin comparación</span>}
                <span className="metrics-chapter-comparison-total">En {comparableFarmCount} {comparableFarmCount===1?'finca comparable':'fincas comparables'}</span>
              </div>
              <div className="metrics-chapter-chart" role="group" aria-label="Variación promedio por capítulo. Selecciona una barra para consultar las fincas incluidas.">
                {fleetChapterTrends.map(chapter=>{
                  const delta=chapter.delta;
                  const selected=selectedTrend?.id===chapter.id;
                  const tone=delta===null||delta===0?'neutral':delta>0?'positive':'negative';
                  const barHeight=delta===null?0:Math.max(delta===0?3:6,Math.abs(delta)/trendScale*42);
                  const movement=delta===null?'Sin comparación':delta===0?'Sin cambio':delta>0?'Subió':'Bajó';
                  return <button type="button" key={chapter.id} className={`metrics-chapter-bar-item ${selected?'selected':''}`} aria-pressed={selected} aria-label={`Capítulo ${chapter.id}, ${chapter.title}: ${delta===null?'sin comparación':`${delta>0?'+':''}${delta} puntos porcentuales`}, ${chapter.comparisons} fincas comparables`} onClick={()=>setSelectedTrendChapter(chapter.id)}>
                    <span className={`metrics-chapter-bar-value ${tone}`}>{delta===null?<Minus size={15}/>:delta>0?<ArrowUpRight size={16}/>:delta<0?<ArrowDownRight size={16}/>:<Minus size={14}/>} {movement} · {delta===null?'—':`${delta>0?'+':''}${delta} pts`}</span>
                    <span className="metrics-chapter-bar-plot"><span className={`metrics-chapter-bar ${tone}`} style={delta===null?undefined:{height:`${barHeight}%`}} /></span>
                    <span className="metrics-chapter-bar-label"><strong>Capítulo {chapter.id}</strong><small>{chapter.title}</small></span>
                  </button>;
                })}
              </div>
              <div className="metrics-chapter-chart-legend"><span><i className="positive"/>La barra sube: aumentó el puntaje</span><span><i className="negative"/>La barra baja: disminuyó el puntaje</span><span><i className="neutral"/>Sin comparación: alcance distinto o datos insuficientes</span></div>
              {selectedTrend&&<div className="metrics-chapter-contributors" aria-live="polite">
                <div className="metrics-chapter-contributors-heading"><div><strong>Capítulo {selectedTrend.id} · {selectedTrend.title}</strong><small>{selectedTrend.comparisons} fincas incluidas en el promedio</small></div><strong className={`metrics-chapter-contributors-average ${selectedTrend.delta===null||selectedTrend.delta===0?'neutral':selectedTrend.delta>0?'positive':'negative'}`}>{selectedTrend.delta===null?'Sin base':`${selectedTrend.delta>0?'+':''}${selectedTrend.delta} pts`}</strong></div>
                {selectedTrend.farms.length?<ul>{selectedTrend.farms.slice().sort((a,b)=>b.delta-a.delta).map(farm=><li key={farm.key}><span>{farm.farm}<small>Último aseguramiento · {farm.date}</small></span><strong className={farm.delta===0?'neutral':farm.delta>0?'positive':'negative'}>{farm.delta>0?'+':''}{farm.delta} pts</strong></li>)}</ul>:<p className="metrics-empty">No hay dos aseguramientos comparables para este capítulo en el periodo.</p>}
              </div>}
            </section>

            <section className="metrics-podium-panel">
              <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Cambio entre aseguramientos comparables</div><h3>Podios de evolución</h3></div><span className="metrics-note">Mismo alcance de capítulos</span></div>
              <div className="metrics-podium-columns">
                <div className="metrics-podium-group improve"><h4><TrendingUp size={17}/> Mejoras</h4>{improvingFarms.length?improvingFarms.map((farm,index)=><div className="metrics-podium-farm" key={farm.key}><span>{['🥇','🥈','🥉'][index]} {farm.farm}</span><strong>+{farm.recentDelta} pts</strong></div>):<p>No hay mejoras comparables en el periodo.</p>}</div>
                <div className="metrics-podium-group decline"><h4><TrendingDown size={17}/> Desmejoras</h4>{decliningFarms.length?decliningFarms.map((farm,index)=><div className="metrics-podium-farm" key={farm.key}><span>{['🥇','🥈','🥉'][index]} {farm.farm}</span><strong>{farm.recentDelta} pts</strong></div>):<p>No hay desmejoras comparables en el periodo.</p>}</div>
              </div>
            </section>

            <section className="metrics-fleet-panel">
              <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Lectura rápida · ordenadas por puntaje</div><h3>Estado por finca</h3></div><span className="metrics-note">{filteredFleet.length} de {fleetFarms.length}</span></div>
              <div className="metrics-fleet-filters">
                <input type="search" aria-label="Buscar finca, municipio o responsable AVGUST" placeholder="Buscar finca, municipio o responsable…" value={fleetSearch} onChange={e=>setFleetSearch(e.target.value)}/>
                <select aria-label="Filtrar por estado" value={fleetStatusFilter} onChange={e=>setFleetStatusFilter(e.target.value as 'all'|'healthy'|'acceptable'|'critical')}>
                  <option value="all">Todos los estados</option><option value="healthy">Saludable</option><option value="acceptable">Alerta</option><option value="critical">Vulnerable</option>
                </select>
                <select aria-label="Filtrar por cobertura de aseguramiento" value={fleetScopeFilter} onChange={e=>setFleetScopeFilter(e.target.value as 'all'|'complete'|'partial')}>
                  <option value="all">Toda la cobertura</option><option value="complete">Cobertura completa</option><option value="partial">Cobertura parcial</option>
                </select>
              </div>
              <div className="metrics-farm-list">
                {filteredFleet.map((farm,index)=>(
                  <article className={`metrics-farm-row ${farm.latestStatus}`} key={farm.key}>
                    <span className="metrics-farm-rank">{String(index+1).padStart(2,'0')}</span>
                    <div className="metrics-farm-identity"><strong>{farm.farm}</strong><small>{[farm.city,farm.zone].filter(Boolean).join(' · ')||'Ubicación sin registrar'} · Último aseguramiento {farm.latestDate}</small></div>
                    <div className="metrics-farm-score"><strong>{farm.latestScore}%</strong><small>Aseguramiento · {farm.evaluatedChaptersCount}/5 cap.</small></div>
                    <div><StatusBadge value={farm.latestStatus}/><small className="metrics-farm-conclusion">{metricStatusDescriptions[farm.latestStatus]}</small></div>
                    <div className="metrics-farm-findings"><strong>{farm.latestFindings}</strong><small>desviaciones</small></div>
                    <div className={`metrics-farm-delta ${farm.recentDelta===null?'neutral':farm.recentDelta>0?'positive':farm.recentDelta<0?'negative':'neutral'}`}>{farm.recentDelta===null?'Sin comparación':`${farm.recentDelta>0?'+':''}${farm.recentDelta} pts`}</div>
                  </article>
                ))}
                {!filteredFleet.length&&<p className="metrics-empty">No hay fincas que coincidan con la búsqueda y los filtros.</p>}
              </div>
            </section>

            <section className="metrics-priority-panel">
              <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Plan de trabajo</div><h3>Acciones prioritarias por finca</h3></div><span className="metrics-count risk">{priorityFarms.reduce((sum,farm)=>sum+farm.correctiveActions.length,0)}</span></div>
              <p className="metrics-note">Se priorizan las fincas con mayor necesidad de atención. Abre una finca para ver desviaciones, responsables, plazos y acciones.</p>
              <div className="metrics-farm-actions-list">
                {priorityFarms.map(farm=>(
                  <details className="metrics-farm-actions" key={farm.key}>
                    <summary><span><strong>{farm.farm}</strong><small>{farm.latestDate} · {farm.latestFindings} desviaciones · {farm.correctiveActions.length} acciones</small></span><span className={`metrics-farm-action-score ${farm.latestStatus}`}>{farm.latestScore}%</span></summary>
                    <ul className="metrics-action-list">
                    {(expandedActionFarms[farm.key]?farm.correctiveActions:farm.correctiveActions.slice(0,3)).map(action=>(
                        <li key={action.id}>
                          <div className="metrics-action-title"><strong>{action.id} · {action.text}</strong><span>Cap. {action.chapter} · {action.weightPct}%</span></div>
                          <p className="metrics-action-observation"><strong>Hallazgo / observación:</strong> {action.observation||'Sin observación registrada en este informe.'}</p>
                          <p className="metrics-action-recommendation"><strong>Recomendación sugerida:</strong> {action.recommendation}</p>
                          <div className="metrics-action-meta"><span>Responsable: <b>{action.owner||'Sin asignar'}</b></span><span>Fecha: <b>{action.due||'Sin definir'}</b></span><span>Estado: <b>{actionLabels[action.status as keyof typeof actionLabels]||action.status}</b></span>{action.closure&&<span>Verificación: <b>{action.closure}</b></span>}</div>
                        </li>
                      ))}
                    </ul>
                    {farm.correctiveActions.length>3&&<button className="metrics-more-button" onClick={()=>setExpandedActionFarms(current=>({...current,[farm.key]:!current[farm.key]}))}>{expandedActionFarms[farm.key]?'Mostrar menos':`Ver las ${farm.correctiveActions.length-3} acciones restantes`}</button>}
                  </details>
                ))}
                {!priorityFarms.length&&<p className="metrics-empty">No se encontraron acciones correctivas para las fincas filtradas.</p>}
              </div>
            </section>
          </div>


        </>
      )}
    </div>
  );
}
