'use client';
import {useMemo,useState} from 'react';
import {BarChart3 as BarChartIcon,FileText as FileTextIcon,Printer as PrinterIcon,Building2 as Building2Icon,Info as InfoIcon} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {actionLabels,farmKey,sameChapterScope,metricStatusDescriptions,metricStatusLabels,type MetricStatus,type Visit} from '@/lib/model';
import {exportFarmMetricsWord} from '@/lib/export-metrics-word';
import {farmMetricHistory} from '@/lib/metric-analysis';
import ConsolidatedMetrics from './consolidated-metrics';
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

function FarmMetrics({visits,loading,onOpen}:{visits:Visit[];loading:boolean;onOpen:(visit:Visit)=>void}){
  const farms=useMemo(()=>Array.from(new Map(visits.map(v=>[farmKey(v.farm),v.farm.trim()])).entries()).filter(([,name])=>name).sort((a,b)=>a[1].localeCompare(b[1],'es')),[visits]);
  const [farm,setFarm]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [expandedActionsForFarm,setExpandedActionsForFarm]=useState('');
  const [showGuide,setShowGuide]=useState(false);
  const [showGuideModal,setShowGuideModal]=useState(false);

  const activeFarm=farm||farms[0]?.[0]||'';
  const scoped=useMemo(()=>visits.filter(v=>(!from||v.date>=`${from}-01-01`)&&(!to||v.date<=`${to}-12-31`)),[visits,from,to]);
  const data=useMemo(()=>farmMetricHistory(scoped,activeFarm),[scoped,activeFarm]);

  const current=data.latest;
  const podium=data.records.slice(-3).map((record,index,items)=>{const previous=index>0?items[index-1]:undefined;return {record,label:index===items.length-1?'Último aseguramiento':index===items.length-2?'Aseguramiento anterior':'Inicio del periodo',delta:previous&&sameChapterScope(previous.visit,record.visit)?record.score-previous.score:null,hasPrevious:!!previous};});
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
          <span className="block text-xs text-slate-500">Informe de Aseguramiento MIPE</span>
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
          <h2 id="farm-metrics-title">Aseguramiento MIPE de la finca</h2>
          <p>Resultado, prioridad de atención y avance reciente, en una sola lectura.</p>
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
            <button className={`b2b-range-btn ${!from&&!to?'active':''}`} onClick={()=>setPreset('all')}>Todo el periodo</button>
            <button className={`b2b-range-btn ${from===String(currentYear-1)&&to===String(currentYear)?'active':''}`} onClick={()=>setPreset('lastYear')}>Últimos 24m</button>
            <button className={`b2b-range-btn ${from===String(currentYear)&&to===String(currentYear)?'active':''}`} onClick={()=>setPreset('currentYear')}>{currentYear}</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Cargando indicadores de aseguramiento…</div>
      ) : !farms.length ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500">
          Aún no hay aseguramientos registrados para calcular los indicadores.
        </div>
      ) : !current ? (
        <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
          Esta finca no tiene aseguramientos revisados con criterios aplicables en el periodo seleccionado.
        </div>
      ) : (
        <>
          <div className="metrics-executive-dashboard">
            <section className={`metrics-outcome ${current.status}`} aria-label="Conclusión de la finca">
              <div className="metrics-outcome-main">
                <div className="metrics-section-kicker">Último aseguramiento · {current.date}</div>
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
                <div><span>Desviaciones</span><strong>{current.findings}</strong></div>
                <div><span>Cobertura</span><strong>{current.evaluatedChapters}/5 capítulos</strong></div>
                <div><span>Variación reciente</span><strong className={data.recentDelta===null?'':data.recentDelta>0?'positive':data.recentDelta<0?'negative':''}>{data.recentDelta===null?'Sin comparación':`${data.recentDelta>0?'+':''}${data.recentDelta} pts`}</strong></div>
              </div>
            </section>

            <div className="metrics-overview-grid">
              <section className="metrics-priority-panel">
                <div className="metrics-section-heading">
                  <div><div className="metrics-section-kicker">Qué corregir</div><h3>Desviaciones y acciones</h3></div>
                  <span className={`metrics-count ${data.problems.length?'risk':'clear'}`}>{data.problems.length}</span>
                </div>
                {data.problems.length ? (
                  <ul className="metrics-action-list">
                    {(expandedActionsForFarm===activeFarm?data.problems:data.problems.slice(0,3)).map(problem=>(
                      <li key={problem.id}>
                        <div className="metrics-action-title"><strong>{problem.id} · {problem.text}</strong><span>Cap. {problem.chapter} · {problem.weightPct}%</span></div>
                        <p>{problem.recommendation||'Definir y documentar la acción correctiva.'}</p>
                        <div className="metrics-action-meta"><span>Responsable: <b>{problem.action.owner||'Sin asignar'}</b></span><span>Fecha: <b>{problem.action.due||'Sin definir'}</b></span><span>Estado: <b>{actionLabels[problem.action.status as keyof typeof actionLabels]||problem.action.status}</b></span></div>
                      </li>
                    ))}
                    {data.problems.length>3&&<button className="metrics-more-button" onClick={()=>setExpandedActionsForFarm(expandedActionsForFarm===activeFarm?'':activeFarm)}>{expandedActionsForFarm===activeFarm?'Mostrar menos':`Ver las ${data.problems.length-3} acciones restantes`}</button>}
                  </ul>
                ) : <p className="metrics-empty">No se identificaron desviaciones en el último aseguramiento.</p>}
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
                <div className="metrics-section-heading"><div><div className="metrics-section-kicker">Cambio reciente</div><h3>Últimos aseguramientos</h3></div><span className="metrics-note">Comparamos solo con el mismo alcance</span></div>
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
          <span className="font-bold text-slate-800 text-sm tracking-tight">ASEGURAMIENTO MIPE:</span>
        </div>

        <div className="b2b-quick-ranges" role="tablist" aria-label="Tipo de métricas">
          <button role="tab" aria-selected={view==='farm'} className={`b2b-range-btn py-1.5 px-4 text-xs ${view==='farm'?'active':''}`} onClick={()=>setView('farm')}>
            Por finca
          </button>
          <button role="tab" aria-selected={view==='consolidated'} className={`b2b-range-btn py-1.5 px-4 text-xs ${view==='consolidated'?'active':''}`} onClick={()=>setView('consolidated')}>
            Todas las fincas
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
