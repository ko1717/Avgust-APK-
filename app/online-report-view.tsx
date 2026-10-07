'use client';
import {useState,useEffect} from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Globe,
  MapPin,
  MessageCircle,
  ShieldAlert,
  User
} from 'lucide-react';
import {getOnlineReport,type OnlineReportData} from '@/lib/firebase';
import {catalog,metricStatusLabels,type MetricStatus} from '@/lib/model';

function StatusBadge({value}:{value:string}){
  const labels:Record<string,string>={
    healthy:'Saludable (≥95%)',
    acceptable:'Aceptable (85-94%)',
    critical:'Crítico (<85%)',
    pending:'Sin evaluar'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value as MetricStatus] || value}</span>;
}

export function StandaloneOnlineReport({reportId,onClose}:{reportId:string;onClose?:()=>void}){
  const [report,setReport]=useState<OnlineReportData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    void getOnlineReport(reportId).then(data=>{
      if(data) setReport(data);
      else setError('No se encontró el informe técnico en la nube.');
    }).catch(err=>{
      setError((err as Error).message);
    }).finally(()=>{
      setLoading(false);
    });
  },[reportId]);

  const shareUrl=typeof window!=='undefined'?`${window.location.origin}?view=online-report&id=${encodeURIComponent(reportId)}`:'';

  const copyLink=()=>{
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(()=>setCopied(false),2500);
  };

  const shareWhatsApp=()=>{
    if(!report) return;
    const msg=`*AVGUST CARE 360 · Informe Técnico en Línea*\nFinca: *${report.farm}*\nFecha: ${report.date}\nÍndice MIPE: *${report.score}%* (${report.status==='healthy'?'Saludable':report.status==='acceptable'?'Aceptable':'Crítico'})\nHallazgos: ${report.findingsCount}\n\nPuedes consultar el informe digital completo y sus evidencias en el siguiente enlace:\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,'_blank');
  };

  if(loading){
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-[#007fa3] border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-slate-800">Cargando informe técnico en línea…</h2>
        <p className="text-xs text-slate-500 mt-1">Conectando con AVGUST Cloud Platform (Firebase Firestore)</p>
      </div>
    );
  }

  if(error||!report){
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl max-w-md">
          <ShieldAlert size={36} className="text-rose-600 mx-auto mb-2"/>
          <h2 className="text-base font-bold text-slate-900 mb-1">Informe no disponible</h2>
          <p className="text-xs text-slate-600 mb-4">{error||'El enlace puede haber expirado o la visita aún no ha sido sincronizada.'}</p>
          {onClose && (
            <button className="b2b-btn b2b-btn-primary mx-auto" onClick={onClose}>
              Volver al inicio
            </button>
          )}
        </div>
      </div>
    );
  }

  const v=report.payload;
  const evaluatedCaps=catalog.filter(c=>v.chapters.includes(c.id));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="Volver">
                <ArrowLeft size={18}/>
              </button>
            )}
            <img src="/avgust-logo.svg" alt="Avgust" className="h-8"/>
            <div>
              <strong className="block text-sm font-bold text-slate-900 leading-tight">AVGUST CARE 360</strong>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Globe size={11} className="text-[#007fa3]"/> Informe Oficial en Línea (Sin Papel)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="b2b-btn b2b-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="Copiar enlace directo"
            >
              {copied?<Check size={14} className="text-emerald-600"/>:<Copy size={14}/>}
              <span>{copied?'Enlace copiado':'Copiar enlace'}</span>
            </button>
            <button
              onClick={shareWhatsApp}
              className="b2b-btn text-xs py-1.5 px-3 bg-[#25D366] text-white hover:bg-[#20ba59] border-0 flex items-center gap-1.5 font-bold shadow-xs"
              title="Compartir por WhatsApp con el responsable"
            >
              <MessageCircle size={15}/>
              <span className="hidden sm:inline">Compartir WhatsApp</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 grid gap-6">
        {/* Hero Card */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="b2b-kicker flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#78be20]"></span>
                <span>Aseguramiento Técnico de Campo · MIPE</span>
              </div>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight m-0">{report.farm}</h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <FileText size={14} className="text-[#007fa3]"/> Fecha: {report.date}
                </span>
                {(report.zone||report.city) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-slate-400"/> {[report.zone,report.city].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User size={14} className="text-slate-400"/> Responsable: {report.responsible}
                </span>
              </div>
            </div>

            {/* Score Traffic Light */}
            <div className="flex flex-col items-end">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-slate-950">{report.score!==null?`${report.score}%`:'—'}</span>
                <StatusBadge value={report.status}/>
              </div>
              <span className="text-[11px] text-slate-500 mt-1">
                {report.score!==null && report.score>=95 ? 'Meta Saludable alcanzada' : report.score!==null && report.score>=85 ? 'Nivel Aceptable (estándar ≥85%)' : 'Estado Crítico (requiere intervención)'}
              </span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Alcance</span>
              <strong className="text-base font-extrabold text-slate-900">{report.chapters.length} de 5 caps</strong>
              <small className="block text-[10px] text-slate-500 mt-0.5">{report.chapters.length===5?'Auditoría completa':'Alcance específico'}</small>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Criterios Evaluados</span>
              <strong className="text-base font-extrabold text-slate-900">{report.applicableCount}</strong>
              <small className="block text-[10px] text-slate-500 mt-0.5">Respuestas Sí / No</small>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Desviaciones</span>
              <strong className={`text-base font-extrabold ${report.findingsCount>0?'text-[#dc2626]':'text-[#78be20]'}`}>{report.findingsCount}</strong>
              <small className="block text-[10px] text-slate-500 mt-0.5">Respuestas No (hallazgos)</small>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Publicación</span>
              <strong className="text-base font-extrabold text-slate-900">En línea</strong>
              <small className="block text-[10px] text-emerald-700 mt-0.5">Sincronizado</small>
            </div>
          </div>
        </div>

        {/* Process Scope & Findings */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 m-0">Procesos Evaluados en la Visita</h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">Detalle normativo de los capítulos evaluados por AVGUST.</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              {evaluatedCaps.length} Capítulos
            </span>
          </div>

          <div className="grid gap-3">
            {evaluatedCaps.map(c=>{
              const itemsInCap=c.items;
              const capAnswers=itemsInCap.map(q=>v.answers[q.id]);
              const positiveCount=capAnswers.filter(a=>a?.value==='SI').length;
              const noCount=capAnswers.filter(a=>a?.value==='NO').length;
              const naCount=capAnswers.filter(a=>a?.value==='NA').length;
              const capApplicable=positiveCount+noCount;
              const capScore=capApplicable?Math.round((positiveCount/capApplicable)*100):null;

              return (
                <div key={c.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/60">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#007fa3] text-white flex items-center justify-center font-bold text-xs">
                        {c.id}
                      </span>
                      <strong className="text-sm font-bold text-slate-900">{c.title}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{capScore!==null?`${capScore}% MIPE`:'Sin medición'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${noCount>0?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}`}>
                        {noCount>0?`${noCount} hallazgo${noCount===1?'':'s'}`:'100% conforme'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-3 mt-1 flex-wrap">
                    <span>{positiveCount} conformes (Sí)</span>
                    <span>·</span>
                    <span>{noCount} no conformes (No)</span>
                    {naCount>0 && (
                      <>
                        <span>·</span>
                        <span>{naCount} no aplican</span>
                      </>
                    )}
                  </div>

                  {/* Deviations in this chapter */}
                  {itemsInCap.filter(q=>v.answers[q.id]?.value==='NO').length>0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide block">Desviaciones detectadas:</span>
                      {itemsInCap.filter(q=>v.answers[q.id]?.value==='NO').map(q=>{
                        const a=v.answers[q.id];
                        return (
                          <div key={q.id} className="p-2.5 bg-white border border-rose-200 rounded-lg text-xs">
                            <strong className="text-slate-900 block font-bold mb-1">{q.id}. {q.text}</strong>
                            {a?.observation && (
                              <p className="text-slate-700 m-0 mb-1"><span className="font-semibold text-rose-700">Hallazgo:</span> {a.observation}</p>
                            )}
                            {a?.recommendation && (
                              <p className="text-slate-700 m-0"><span className="font-semibold text-[#007fa3]">Recomendación AVGUST:</span> {a.recommendation}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Conclusion Card */}
        {v.conclusion && (
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-base font-extrabold text-slate-900 mb-2">Conclusiones y Plan de Seguimiento</h2>
            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed m-0">{v.conclusion}</p>
          </div>
        )}

        {/* Photographic Evidence */}
        {v.photos.length>0 && (
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-base font-extrabold text-slate-900 mb-1">Registro Fotográfico de Evidencias</h2>
            <p className="text-xs text-slate-500 mb-4">{v.photos.length} fotografía{v.photos.length===1?'':'s'} adjunta{v.photos.length===1?'':'s'}.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {v.photos.map((p,i)=>(
                <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <img src={`/api/photos/${p.id}`} alt={p.caption||`Evidencia ${i+1}`} className="w-full h-48 object-cover"/>
                  <div className="p-3 text-xs">
                    <span className="font-bold text-slate-800 block">Fotografía #{i+1} · Cap. {p.chapter}</span>
                    <p className="text-slate-600 m-0 mt-1">{p.caption||'Sin descripción registrada'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 py-4">
          <p className="m-0 font-medium">AVGUST CARE 360 · Sistema de Acompañamiento MIPE en Campo</p>
          <p className="m-0 text-[11px] text-slate-400 mt-1">Este informe digital oficial reemplaza el uso de papel y se sincroniza en la nube.</p>
        </div>
      </main>
    </div>
  );
}
