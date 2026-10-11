'use client';

import {useEffect, useId, useRef, useState, type SubmitEvent} from 'react';
import {Leaf, Send, X} from 'lucide-react';
import {getClientSession} from '@/lib/invitations';
import {
  consultaAvgustClientEnabled,
  consultaAvgustEndpoint,
  type ConsultaAvgustMessage
} from '@/lib/consulta-avgust';
import './farm-portal-ai.css';

type ChatLine = ConsultaAvgustMessage & {id: string};

const DISABLED_HINT =
  'Esta consulta no está conectada. Firebase Hosting solo entrega el portal estático y la clave de Gemini no puede ir en el navegador.';

/**
 * Scoped agriculture consult. Hidden until a farm invitation session exists.
 * On Hosting it stays disabled unless NEXT_PUBLIC_CONSULTA_AVGUST_URL was set at build time.
 */
export default function FarmPortalAi() {
  const [farm, setFarm] = useState('');
  const [clientName, setClientName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => {
      const session = getClientSession();
      if (!session || session.status === 'revoked') {
        setFarm('');
        setClientName('');
      } else {
        setFarm(session.farm || '');
        setClientName(session.clientName || '');
      }
      setReady(true);
    };
    read();
    const id = window.setInterval(read, 1200);
    window.addEventListener('focus', read);
    window.addEventListener('storage', read);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  if (!ready || !farm || !consultaAvgustClientEnabled()) return null;
  return <ConsultaDock farm={farm} clientName={clientName} />;
}

function ConsultaDock({farm, clientName}: {farm: string; clientName: string}) {
  const endpoint = consultaAvgustEndpoint();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(endpoint ? null : false);
  const [notice, setNotice] = useState(endpoint ? '' : DISABLED_HINT);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    fetch(endpoint, {headers: {Accept: 'application/json'}})
      .then(async response => {
        const data = (await response.json().catch(() => null)) as {available?: boolean; message?: string} | null;
        if (cancelled) return;
        const ok = Boolean(response.ok && data?.available);
        setAvailable(ok);
        if (!ok) {
          setNotice(
            data?.message ||
              'El servidor de consulta no tiene GEMINI_API_KEY. El botón sigue visible, pero no llama a Gemini.'
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAvailable(false);
        setNotice('No se pudo contactar el servicio de consulta. Revisa la URL configurada en el build del portal.');
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  useEffect(() => {
    listRef.current?.scrollTo({top: listRef.current.scrollHeight});
  }, [lines, busy, open]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || !endpoint || available === false) return;
    const next: ChatLine[] = [...lines, {id: crypto.randomUUID(), role: 'user', content: text}];
    setLines(next);
    setDraft('');
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: next.map(({role, content}) => ({role, content})),
          farmContext: {farm, clientName}
        })
      });
      const data = (await response.json().catch(() => null)) as {reply?: string; message?: string} | null;
      if (!response.ok || !data?.reply) {
        setNotice(data?.message || 'No hubo respuesta. Intenta de nuevo en un momento.');
        return;
      }
      setLines(current => [...current, {id: crypto.randomUUID(), role: 'assistant', content: data.reply!}]);
    } catch {
      setNotice('Sin conexión con el servicio de consulta.');
    } finally {
      setBusy(false);
    }
  }

  const live = Boolean(endpoint) && available === true;
  const checking = Boolean(endpoint) && available === null;

  return (
    <div className="fp-ai no-print">
      {open && (
        <dialog className="fp-ai-panel" open aria-labelledby={titleId}>
          <header className="fp-ai-head">
            <div>
              <p className="fp-ai-kicker">AVGUST CARE 360</p>
              <h2 id={titleId}>Consulta AVGUST</h2>
              <p className="fp-ai-farm">{farm}</p>
            </div>
            <button type="button" className="fp-ai-close" onClick={() => setOpen(false)} aria-label="Cerrar consulta">
              <X size={16} aria-hidden />
            </button>
          </header>

          <p className="fp-ai-disclaimer">
            Orientación general de agricultura y del programa. No reemplaza la etiqueta, el registro ICA ni al ingeniero
            AVGUST. No indica dosis.
          </p>

          {checking && <p className="fp-ai-empty">Comprobando si la consulta está activa…</p>}

          {!live && !checking && (
            <div className="fp-ai-off">
              <p>{notice || DISABLED_HINT}</p>
              <details>
                <summary>Cómo la activa Kevin</summary>
                <ol>
                  <li>Crea una clave gratuita en Google AI Studio, sin facturación de Gemini.</li>
                  <li>En el servidor: GEMINI_API_KEY y npm run consulta:listen. Nunca en el portal.</li>
                  <li>
                    web.app necesita la función consultaAvgust. Hoy el proyecto no está en Blaze, así que no se
                    publica. Tras Blaze, el build usa NEXT_PUBLIC_CONSULTA_AVGUST_URL.
                  </li>
                </ol>
                <p>Pasos y límites del tier gratuito: docs/portal-ai.md.</p>
              </details>
            </div>
          )}

          {live && (
            <>
              <div className="fp-ai-log" ref={listRef}>
                {lines.length === 0 && (
                  <p className="fp-ai-empty">
                    Pregunta sobre manejo del cultivo, capítulos del aseguramiento o qué preparar para la visita.
                  </p>
                )}
                {lines.map(line => (
                  <p key={line.id} className={`fp-ai-line is-${line.role}`}>
                    {line.content}
                  </p>
                ))}
                {busy && <p className="fp-ai-line is-assistant">Consultando…</p>}
              </div>
              {notice && <p className="fp-ai-notice">{notice}</p>}
              <form className="fp-ai-form" onSubmit={submit}>
                <label className="fp-ai-sr" htmlFor="fp-ai-draft">
                  Pregunta agronómica
                </label>
                <textarea
                  id="fp-ai-draft"
                  value={draft}
                  maxLength={2000}
                  rows={2}
                  placeholder="Ej.: ¿qué debo tener listo para la visita de aseguramiento?"
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" disabled={busy || !draft.trim()} aria-label="Enviar pregunta">
                  <Send size={16} aria-hidden />
                </button>
              </form>
            </>
          )}
        </dialog>
      )}

      <button
        type="button"
        className="fp-ai-launcher"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Leaf size={16} aria-hidden />
        Consulta
      </button>
    </div>
  );
}
