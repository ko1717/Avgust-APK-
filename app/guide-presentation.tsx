'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {
  HelpCircle,
  Play,
  ClipboardList,
  Camera,
  FileText,
  Users,
  Search,
  Calendar,
  BarChart3,
  CheckCircle,
  Home,
  ShieldCheck,
  Wifi
} from 'lucide-react';
import './presentation.css';

const SEEN_KEY = 'care360:presentacion:vista';
const SEEN_VALUE = '1';
const VERSION = '1.5.32';

export interface GuidePresentationProps {
  open: boolean;
  onClose: () => void;
}

export function GuideHelpButton({onClick}:{onClick:()=>void}){
  return (
    <button
      type="button"
      className="c360-help-btn"
      onClick={onClick}
      aria-label="Abrir guía del programa y créditos"
    >
      <HelpCircle size={15}/>
      <span>Guía</span>
    </button>
  );
}

export function GuidePresentation({open,onClose}:GuidePresentationProps){
  const [index,setIndex]=useState(0);
  const [dontShowAgain,setDontShowAgain]=useState(false);
  const touchStartX=useRef<number|null>(null);
  const bodyRef=useRef<HTMLDivElement>(null);

  const slides = [
    {
      eyebrow: 'Avgust Crop Protection',
      title: 'Bienvenido a AVGUST CARE 360',
      lead: 'La herramienta de acompañamiento en campo para el programa de aseguramiento del proceso MIPE en fincas de flores.',
      bullets: [
        {
          badge: <Play size={16}/>,
          title: 'Esta presentación dura menos de un minuto',
          text: 'Te explica para qué sirve el programa, cómo se usa y quién lo desarrolló.'
        },
        {
          badge: <Wifi size={16}/>,
          title: 'Funciona sin conexión',
          text: 'Puedes trabajar en la finca aunque no haya señal. La información queda guardada en el equipo.'
        }
      ]
    },
    {
      eyebrow: 'Para qué está hecha',
      title: 'De la visita al informe, sin papeles',
      lead: 'CARE 360 acompaña todo el ciclo del servicio técnico: lo que se observa en la finca, lo que se recomienda y lo que se cumple.',
      bullets: [
        {
          badge: <ClipboardList size={16}/>,
          title: 'Evalúa el proceso MIPE por capítulos',
          text: 'Almacén, dosificación, transporte interno, preparación de mezclas, aplicación en campo y demás criterios.'
        },
        {
          badge: <Camera size={16}/>,
          title: 'Documenta cada hallazgo',
          text: 'Registra observaciones, mediciones de campo y fotografías de antes y de cierre.'
        },
        {
          badge: <FileText size={16}/>,
          title: 'Emite el informe técnico',
          text: 'Genera el documento en Word o PDF con la imagen de AVGUST y lo prepara para enviarlo por correo.'
        },
        {
          badge: <CheckCircle size={16}/>,
          title: 'Cierra los compromisos',
          text: 'Cada acuerdo queda con responsable, fecha límite y evidencia hasta darlo por cumplido.'
        }
      ]
    },
    {
      eyebrow: 'Cómo funciona',
      title: 'Una visita en cinco pasos',
      lead: 'Al tocar "Nueva visita" el programa te guía por cinco pestañas. Puedes guardar el avance en cualquier momento y continuar después.',
      bullets: [
        {
          badge: <span className="text-xs font-bold">01</span>,
          title: 'Datos',
          text: 'Finca, fecha, representante, responsable AVGUST y los capítulos que vas a evaluar.'
        },
        {
          badge: <span className="text-xs font-bold">02</span>,
          title: 'Mediciones',
          text: 'Agua (cap. 4.6), presión (cap. 5.1), equipo e implementos de aplicación, y volumen y tiempo por cama (cap. 5.6).'
        },
        {
          badge: <span className="text-xs font-bold">03</span>,
          title: 'Evaluación',
          text: 'Responde Sí cumple, No cumple o No aplica en cada criterio. Cada "No cumple" pide su hallazgo y su recomendación.'
        },
        {
          badge: <span className="text-xs font-bold">04</span>,
          title: 'Fotos',
          text: 'Adjunta hasta 60 fotografías. Sirven como evidencia del hallazgo y del cierre.'
        },
        {
          badge: <span className="text-xs font-bold">05</span>,
          title: 'Informe',
          text: 'Revisa el documento, márcalo como revisado y descárgalo en Word o PDF. El panel de calidad te avisa si aún falta un criterio, un hallazgo o una foto.'
        }
      ]
    },
    {
      eyebrow: 'Los módulos',
      title: 'Todo el trabajo, organizado',
      lead: 'La barra de la parte superior reúne las siete funciones del programa. Puedes entrar a cualquiera desde la pantalla de Inicio.',
      bullets: [
        { badge: <Home size={16}/>, title: 'Inicio', text: 'Briefing del día: borradores, compromisos vencidos, agenda y el estado del respaldo.' },
        { badge: <Users size={16}/>, title: 'Fincas y equipo', text: 'Fincas, contactos que reciben los informes y permisos del equipo.' },
        { badge: <Search size={16}/>, title: 'Consulta de finca', text: 'El expediente completo de una finca: visitas, indicadores, hallazgos y compromisos.' },
        { badge: <Calendar size={16}/>, title: 'Solicitudes', text: 'Programación de servicios, fechas propuestas y responsables.' },
        { badge: <FileText size={16}/>, title: 'Visitas e informes', text: 'Registra la visita, sigue el avance con el panel de calidad y filtra borradores o revisadas.' },
        { badge: <BarChart3 size={16}/>, title: 'Métricas', text: 'Tablero claro por finca o consolidado: indicador anual, capítulos y subcapítulos.' },
        { badge: <CheckCircle size={16}/>, title: 'Seguimiento', text: 'Compromisos pendientes, vencidos y cerrados, con su historial por finca.' }
      ]
    },
    {
      eyebrow: 'Del hallazgo al resultado',
      title: 'El informe tiene un ciclo de vida',
      lead: 'Así se garantiza que lo que se entrega a la finca sea una versión revisada y no se modifique después.',
      bullets: [
        { badge: <span className="text-xs font-bold">1</span>, title: 'Borrador', text: 'Trabajas la visita y guardas el avance las veces que necesites.' },
        { badge: <span className="text-xs font-bold">2</span>, title: 'En revisión', text: 'Al enviarlo se congela una captura de la información de ese momento.' },
        { badge: <span className="text-xs font-bold">3</span>, title: 'Aprobado', text: 'El responsable técnico da el visto bueno sin cambiar la captura.' },
        { badge: <span className="text-xs font-bold">4</span>, title: 'Publicado', text: 'La versión queda inmutable y es la que recibe la finca.' }
      ],
      footnote: 'Si hay que corregir algo, el informe se devuelve a borrador y se crea una nueva versión: el historial anterior nunca se pierde.'
    },
    {
      eyebrow: 'Tus datos',
      title: 'La información vive en tu equipo',
      lead: 'CARE 360 no necesita internet ni cuentas de usuario para funcionar. Por eso el respaldo es importante.',
      bullets: [
        {
          badge: <ShieldCheck size={16}/>,
          title: 'Crea un respaldo completo',
          text: 'Desde Inicio, con "Crear respaldo completo". Incluye visitas, fincas, compromisos y fotografías.'
        },
        {
          badge: <Wifi size={16}/>,
          title: 'Restaura en otro equipo',
          text: 'Con "Restaurar respaldo" recuperas todo el trabajo tal como estaba.'
        },
        {
          badge: <CheckCircle size={16}/>,
          title: 'Guarda el avance seguido',
          text: 'Si cambias de pantalla sin guardar, el programa te avisa antes de perder algo.'
        }
      ]
    },
    {
      eyebrow: 'Créditos',
      title: 'Quién desarrolló este programa',
      lead: '',
      isCredits: true
    }
  ];

  const total = slides.length;
  const currentSlide = slides[index];

  const handleClose = useCallback(()=>{
    try{
      localStorage.setItem(SEEN_KEY,SEEN_VALUE);
    }catch{}
    onClose();
  },[onClose]);

  const next = useCallback(()=>{
    if(index<total-1){
      setIndex(prev=>prev+1);
    }else{
      handleClose();
    }
  },[index,total,handleClose]);

  const prev = useCallback(()=>{
    if(index>0){
      setIndex(prev=>prev-1);
    }
  },[index]);

  useEffect(()=>{
    if(!open)return;
    const handleKey = (e:KeyboardEvent)=>{
      if(e.key==='Escape'){
        e.preventDefault();
        handleClose();
      }else if(e.key==='ArrowRight'){
        next();
      }else if(e.key==='ArrowLeft'){
        prev();
      }
    };
    window.addEventListener('keydown',handleKey);
    return ()=>window.removeEventListener('keydown',handleKey);
  },[open,handleClose,next,prev]);

  useEffect(()=>{
    const el = bodyRef.current;
    if(!el || !open) return;
    let startX = 0;
    let tracking = false;
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0] || e.changedTouches[0];
      if(!t) return;
      tracking = true;
      startX = t.clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if(!tracking) return;
      tracking = false;
      const t = e.changedTouches[0] || e.touches[0];
      if(!t) return;
      const diff = t.clientX - startX;
      if(Math.abs(diff) < 40) return;
      if(diff > 40){
        prev();
      }else if(diff < -40){
        next();
      }
    };
    el.addEventListener('touchstart', handleTouchStart, {passive: true});
    el.addEventListener('touchend', handleTouchEnd, {passive: true});
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  },[open,index,prev,next]);

  const onTouchStart = (e:React.TouchEvent)=>{
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e:React.TouchEvent)=>{
    if(touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? null;
    if(endX !== null){
      const diff = endX - touchStartX.current;
      if(diff > 40){
        prev();
      }else if(diff < -40){
        next();
      }
    }
    touchStartX.current = null;
  };

  if(!open) return null;

  return (
    <div
      className="c360-intro"
      data-open={open ? '1' : '0'}
      aria-modal="true"
      aria-label="Presentación de AVGUST CARE 360"
    >
      <div className="c360-intro-card">
        <div className="c360-intro-head">
          <img src="/avgust-logo.svg" alt="Avgust Crop Protection" />
          <button
            type="button"
            className="c360-intro-skip"
            data-act="skip"
            onClick={handleClose}
          >
            Omitir
          </button>
        </div>

        <div className="c360-intro-progress">
          <i style={{width:`${Math.round(((index + 1) / total) * 100)}%`}} />
        </div>

        <div
          className="c360-intro-body"
          tabIndex={-1}
          ref={bodyRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="c360-slide" key={index}>
            <span className="c360-slide-eyebrow">{currentSlide.eyebrow}</span>
            <h2>{currentSlide.title}</h2>
            {currentSlide.lead && <p>{currentSlide.lead}</p>}

            {currentSlide.bullets && (
              <ul className="c360-list">
                {currentSlide.bullets.map((b,i)=>(
                  <li key={i}>
                    <span className="c360-badge">{b.badge}</span>
                    <div>
                      <b>{b.title}</b>
                      <span>{b.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {currentSlide.footnote && (
              <p style={{marginTop:14,fontSize:13,color:'var(--c360-ink-soft)'}}>
                {currentSlide.footnote}
              </p>
            )}

            {currentSlide.isCredits && (
              <>
                <div className="c360-credits">
                  <div className="c360-credit">
                    <small>Desarrollado por</small>
                    <strong>Kevin Villamizar</strong>
                    <p>Diseño, desarrollo y puesta en marcha de AVGUST CARE 360.</p>
                  </div>
                  <div className="c360-credit">
                    <small>Con la ayuda de</small>
                    <strong>Wilson Castro</strong>
                    <p>Este programa fue creado con la ayuda de Wilson Castro.</p>
                  </div>
                </div>
                <p className="c360-version">
                  AVGUST CARE 360 · versión {VERSION}
                  <br />
                  Si quieres volver a esta guía, usa el botón “Guía” de la barra superior.
                </p>
              </>
            )}
          </div>
        </div>

        <label className="c360-intro-again">
          <input
            type="checkbox"
            data-act="again"
            checked={dontShowAgain}
            onChange={e=>setDontShowAgain(e.target.checked)}
          />
          No volver a mostrar al abrir la aplicación
        </label>

        <div className="c360-intro-foot">
          {index > 0 ? (
            <button
              type="button"
              className="c360-nav-btn"
              data-kind="back"
              data-act="back"
              onClick={prev}
            >
              Anterior
            </button>
          ) : (
            <div style={{width:80}} />
          )}

          <div className="c360-dots">
            {slides.map((_,dotIndex)=>(
              <button
                key={dotIndex}
                type="button"
                aria-current={dotIndex === index ? 'true' : 'false'}
                aria-label={`Ir a sección ${dotIndex + 1}`}
                onClick={()=>setIndex(dotIndex)}
              />
            ))}
          </div>

          <button
            type="button"
            className="c360-nav-btn"
            data-kind="next"
            data-act="next"
            onClick={next}
          >
            {index === total - 1 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
