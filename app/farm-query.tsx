'use client';
import {useMemo,useState} from 'react';
import {ArrowRight,CalendarDays,FileText,MapPin,Search,Users} from 'lucide-react';
import {actionLabels,farmKey,findings,metricStatusLabels,metrics,type MetricStatus,type Visit} from '@/lib/model';
import {farmMetricHistory} from '@/lib/metric-analysis';
import type {Farm} from '@/lib/team';
import FarmMetricEvolution from './farm-metric-evolution';
import {KpiSparkline,type SparklinePoint} from './kpi-sparkline';

function Status({value}:{value:MetricStatus}){return <span className={'metric-status '+value}>{metricStatusLabels[value]}</span>;}

export default function FarmQuery({visits,farms,loading,onOpen,onNew}:{visits:Visit[];farms:Farm[];loading:boolean;onOpen:(visit:Visit)=>void;onNew:(farm:Farm|undefined,name:string)=>void}){
 const [query,setQuery]=useState('');const [selected,setSelected]=useState('');
 const candidates=useMemo(()=>Array.from(new Map([...farms.map(f=>[farmKey(f.name),f.name] as const),...visits.map(v=>[farmKey(v.farm),v.farm.trim()] as const)]).entries()).filter(([,name])=>name).sort((a,b)=>a[1].localeCompare(b[1],'es')),[farms,visits]);
 const matches=useMemo(()=>candidates.filter(([key,name])=>!query||key.includes(farmKey(query))||farmKey(name).includes(farmKey(query))).slice(0,8),[candidates,query]);
 const selectedName=candidates.find(([key])=>key===selected)?.[1]||'';
 const farm=farms.find(item=>farmKey(item.name)===selected);
 const reports=useMemo(()=>selected?visits.filter(v=>farmKey(v.farm)===selected).slice().sort((a,b)=>b.date.localeCompare(a.date)):[],[visits,selected]);
 const history=useMemo(()=>farmMetricHistory(reports,selected),[reports,selected]);
 const latest=history.latest;
 const scoreSparkline:SparklinePoint[]=useMemo(()=>reports.filter(r=>r.reviewed).map(r=>{
  const m=metrics(r);
  return {
    date:r.date,
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
    value:m.score??0,
    formattedValue:`${m.score??0}%`
  };
 }).reverse(),[reports]);
 const findingsSparkline:SparklinePoint[]=useMemo(()=>reports.filter(r=>r.reviewed).map(r=>{
  const m=metrics(r);
  return {
    date:r.date,
    label:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short'}).format(new Date(`${r.date}T12:00:00`)),
    value:m.findings,
    formattedValue:`${m.findings} hallazgos`
  };
 }).reverse(),[reports]);
 const recurring=useMemo(()=>{const map=new Map<string,{id:string;text:string;count:number;last:string}>();reports.filter(v=>v.reviewed).forEach(v=>findings(v).forEach(f=>{const record=map.get(f.id)||{id:f.id,text:f.text,count:0,last:v.date};record.count++;if(v.date>record.last)record.last=v.date;map.set(f.id,record);}));return [...map.values()].sort((a,b)=>b.count-a.count||b.last.localeCompare(a.last)).slice(0,6);},[reports]);
 const pending=useMemo(()=>reports.flatMap(v=>findings(v).map(f=>({...f,date:v.date}))).filter(f=>['pending','progress'].includes(f.action.status)).sort((a,b)=>(a.action.due||'9999').localeCompare(b.action.due||'9999')).slice(0,8),[reports]);
 const photoComparisons=useMemo(()=>reports.flatMap(visit=>findings(visit).filter(f=>f.action.status==='closed'&&f.action.beforePhotoId&&f.action.photoId).map(f=>{const before=visit.photos.find(photo=>photo.id===f.action.beforePhotoId),after=visit.photos.find(photo=>photo.id===f.action.photoId);return before&&after?{id:`${visit.id}-${f.id}`,visit,f,before,after}:null;}).filter((item):item is NonNullable<typeof item>=>item!==null)).slice(0,8),[reports]);
 function choose(key:string,name:string){setSelected(key);setQuery(name);}
 return <section className="farm-query" aria-labelledby="farm-query-title"><div className="query-hero"><div><div className="eyebrow">HISTORIAL CENTRALIZADO</div><h2 id="farm-query-title">Consulta de finca</h2><p>Busca una finca para reunir sus contactos, visitas, indicadores, hallazgos y compromisos en una sola consulta.</p></div><div className="query-search"><label htmlFor="farm-search">Buscar finca</label><div><Search size={20}/><input id="farm-search" placeholder="Escribe el nombre de una finca" value={query} onChange={e=>{setQuery(e.target.value);if(selected&&farmKey(e.target.value)!==selected)setSelected('');}}/></div>{query&&!selected&&<div className="query-results">{matches.length?matches.map(([key,name])=><button key={key} onClick={()=>choose(key,name)}>{name}<ArrowRight size={16}/></button>):<p>No hay una finca con ese nombre en los informes guardados.</p>}</div>}</div></div>
 {loading?<output className="query-empty">Cargando información de las fincas…</output>:!selected?<div className="query-empty"><Search size={28}/><strong>Encuentra una finca</strong><p>La búsqueda incluye las fincas registradas y todas las que aparecen en informes históricos.</p>{!query&&candidates.slice(0,6).map(([key,name])=><button key={key} className="secondary" onClick={()=>choose(key,name)}>{name}</button>)}</div>:<><div className="query-farm-heading"><div><h3>{selectedName}</h3><p>{farm?.zone?<><MapPin size={16}/>{farm.zone}</>:<>Zona sin registrar</>}</p></div><div className="query-heading-actions"><button className="primary" onClick={()=>onNew(farm,selectedName)}><FileText size={17}/>Nuevo informe para esta finca</button><span><FileText size={17}/>{reports.length} informe{reports.length===1?'':'s'}</span>{farm&&<span><Users size={17}/>{farm.members.length} participante{farm.members.length===1?'':'s'}</span>}</div></div>
  <div className="metric-summary query-summary">
   <div className="b2b-kpi-card highlight">
    <span className="b2b-kpi-title">Estado actual</span>
    <div className="b2b-kpi-body">
     <b className="b2b-kpi-value">{latest?.score===null||!latest?'—':`${latest.score}%`}</b>
     {latest?<Status value={latest.status}/>:<small>Sin medición revisada</small>}
    </div>
    <div className="mt-1 mb-2">
     <KpiSparkline data={scoreSparkline} color="#007fa3" fillGradientId="sparkQueryScore" unit="%" height={36}/>
    </div>
    <small className="b2b-kpi-footer">Puntuación oficial de la última visita revisada.</small>
   </div>
   <div className="b2b-kpi-card">
    <span className="b2b-kpi-title">Comportamiento</span>
    <div className="b2b-kpi-body">
     <b className={'b2b-kpi-value trend '+history.trend}>{history.trend==='improved'?'Mejoró':history.trend==='declined'?'Disminuyó':history.trend==='stable'?'Estable':'Sin comparación'}</b>
    </div>
    <div className="mt-1 mb-2">
     <KpiSparkline data={scoreSparkline} color={history.trend==='improved'?'#10b981':history.trend==='declined'?'#f43f5e':'#0284c7'} fillGradientId="sparkQueryTrend" unit="%" height={36}/>
    </div>
    <small className="b2b-kpi-footer">{history.delta===null?'Línea base':`${history.delta>0?'+':''}${history.delta} puntos desde la primera medición`}</small>
   </div>
   <div className="b2b-kpi-card">
    <span className="b2b-kpi-title">Último informe</span>
    <div className="b2b-kpi-body">
     <b className="b2b-kpi-value" style={{fontSize:'20px'}}>{reports[0]?.date||'—'}</b>
    </div>
    <div className="mt-1 mb-2">
     <div className="h-[36px] flex items-center justify-center text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded px-2">
      {reports.length} visita{reports.length===1?'':'s'} en histórico
     </div>
    </div>
    <small className="b2b-kpi-footer">{reports[0]?.responsible||'Sin responsable registrado'}</small>
   </div>
   <div className={`b2b-kpi-card ${(latest?.findings??0)>0?'critical':'healthy'}`}>
    <span className="b2b-kpi-title">Hallazgos actuales</span>
    <div className="b2b-kpi-body">
     <b className="b2b-kpi-value" style={{color:(latest?.findings??0)>0?'#e11d48':'#059669'}}>{latest?.findings??0}</b>
     <span className="text-xs font-semibold text-slate-500">de {latest?.applicable??0} criterios</span>
    </div>
    <div className="mt-1 mb-2">
     <KpiSparkline data={findingsSparkline} color={(latest?.findings??0)>0?'#e11d48':'#10b981'} fillGradientId="sparkQueryFindings" height={36}/>
    </div>
    <small className="b2b-kpi-footer">{(latest?.findings??0)===0?'Sin desviaciones pendientes':'Respuestas “No” en la última visita'}</small>
   </div>
  </div>
  <div className="query-grid"><section><div className="eyebrow">FICHA DE LA FINCA</div><h3>Contactos y responsables</h3>{farm?.contacts.length?<div className="query-contacts">{farm.contacts.map(contact=><article key={contact.id}><strong>{contact.name||'Contacto sin nombre'}</strong><span>{contact.role||'Cargo sin registrar'}</span><small>{contact.phone||'Sin teléfono'} · {contact.email||'Sin correo'}</small>{contact.receiveReports&&<em>Recibe informes</em>}</article>)}</div>:<p className="muted">Esta finca aparece en los informes, pero aún no tiene contactos registrados.</p>}</section><section><div className="eyebrow">HALLAZGOS RECURRENTES</div><h3>Prioridades históricas</h3>{recurring.length?<div className="query-recurrence">{recurring.map(item=><article key={item.id}><strong>{item.id}</strong><p>{item.text}</p><span>{item.count} vez{item.count===1?'':'es'} · última: {item.last}</span></article>)}</div>:<p className="metric-clear">No hay hallazgos revisados para esta finca.</p>}</section></div>
  {farm?<FarmMetricEvolution farmId={farm.id} onOpenVisit={id=>{const visit=visits.find(item=>item.id===id);if(visit)onOpen(visit);}}/>:<p className="notice">Registra esta finca para consultar sus métricas con filtros y comparación local.</p>}
 <section className="query-actions"><div><div className="eyebrow">SEGUIMIENTO</div><h3>Compromisos abiertos</h3></div>{pending.length?<div className="table-scroll"><table className="followup-table"><thead><tr><th>Ítem</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead><tbody>{pending.map((item,index)=><tr key={`${item.id}-${item.date}-${index}`}><td><strong>{item.id}</strong><small>{item.text}</small></td><td>{item.action.owner||'Sin asignar'}</td><td>{item.action.due||'Sin fecha'}</td><td>{actionLabels[item.action.status]}</td></tr>)}</tbody></table></div>:<p className="metric-clear">No hay compromisos aceptados o en proceso.</p>}</section>
 <section className="photo-comparisons"><div><div className="eyebrow">EVIDENCIA DE MEJORA</div><h3>Antes y después de hallazgos cerrados</h3><p className="muted">La comparación se muestra cuando el responsable registra una foto inicial y una evidencia de cierre para el mismo hallazgo.</p></div>{photoComparisons.length?<div className="photo-comparison-grid">{photoComparisons.map(item=><article key={item.id}><div className="comparison-heading"><strong>{item.f.id} · {item.visit.date}</strong><span>{item.f.action.closure||'Cierre verificado'}</span></div><div className="comparison-images"><figure><img src={`/api/photos/${item.before.id}`} alt={`Antes: ${item.before.caption||item.f.text}`}/><figcaption>Antes · {item.before.caption||'Evidencia inicial'}</figcaption></figure><figure><img src={`/api/photos/${item.after.id}`} alt={`Después: ${item.after.caption||item.f.text}`}/><figcaption>Después · {item.after.caption||'Evidencia de cierre'}</figcaption></figure></div></article>)}</div>:<p className="metric-clear">Aún no hay pares fotográficos registrados para hallazgos cerrados de esta finca.</p>}</section>
 <section className="query-reports"><div className="page-heading"><div><div className="eyebrow">DOCUMENTOS DE LA FINCA</div><h3>Informes y aseguramientos</h3></div><span><CalendarDays size={17}/>{reports.filter(r=>r.reviewed).length} revisados</span></div>{reports.length?<div className="table-scroll"><table className="followup-table metric-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Responsable AVGUST</th><th>Indicador</th><th>Estado</th><th className="no-print">Acción</th></tr></thead><tbody>{reports.map(report=>{const reportMetric=metrics(report);return <tr key={report.id}><td>{report.date}</td><td>{report.serviceKind==='training'?'Capacitación':report.serviceKind==='calibration'?'Aforo de equipos':report.serviceKind==='followup'?'Seguimiento':'Aseguramiento'}</td><td>{report.responsible||'Sin registrar'}</td><td>{report.reviewed&&reportMetric.score!==null?`${reportMetric.score}%`:'Sin medición'}</td><td>{report.reviewed&&reportMetric.score!==null?<Status value={reportMetric.status}/>:<span className="metric-status pending">{report.reviewed?'Sin medición':'Borrador'}</span>}</td><td className="no-print"><button className="secondary" onClick={()=>onOpen(report)}>Abrir informe</button></td></tr>;})}</tbody></table></div>:<p className="empty-copy">No hay informes guardados para esta finca.</p>}</section></>}
 </section>;
}
