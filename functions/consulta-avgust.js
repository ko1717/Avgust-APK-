/**
 * HTTP handler for Consulta AVGUST.
 *
 * Cloud Function entry: functions/index.js exports `consultaAvgust`.
 * GEMINI_API_KEY is a Cloud Functions secret (or the process env for local listen).
 * Never written into Hosting, NEXT_PUBLIC_*, or firebase-applet-config.json.
 *
 * Local check without a key (expects available:false / POST 503):
 *   node functions/consulta-avgust.js --listen
 *   curl -s http://127.0.0.1:8787/api/consulta-avgust
 *
 * The deploy bundle copies lib/consulta-avgust-core.mjs beside this file
 * (scripts/stage-consulta-function.mjs). From the repo, the lib/ path is used.
 */
import {existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';

const coreUrl = existsSync(new URL('./consulta-avgust-core.mjs', import.meta.url))
  ? new URL('./consulta-avgust-core.mjs', import.meta.url)
  : new URL('../lib/consulta-avgust-core.mjs', import.meta.url);

const {
  buildGeminiRequestBody,
  clipFarmContext,
  consultaAllowOrigin,
  geminiGenerateUrl,
  normalizeConsultaMessages,
  readGeminiText,
  resolveConsultaModel
} = await import(coreUrl.href);

function send(res, status, body, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export async function consultaAvgustHandler(req, res) {
  const origin = consultaAllowOrigin(req.headers.origin || '', process.env.CONSULTA_AVGUST_ORIGINS || '');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      Vary: 'Origin',
      ...(origin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        : {})
    });
    res.end();
    return;
  }

  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
  const model = resolveConsultaModel(process.env.GEMINI_MODEL);

  if (req.method === 'GET') {
    send(res, 200, {available: Boolean(key), model, scope: 'agriculture-avgust-care360'}, origin);
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, {error: 'method_not_allowed'}, origin);
    return;
  }

  if (!key) {
    send(
      res,
      503,
      {
        error: 'consulta_disabled',
        message:
          'Consulta AVGUST no está configurada. Define GEMINI_API_KEY en el entorno de la función. Ver docs/portal-ai.md.'
      },
      origin
    );
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    send(res, 400, {error: 'invalid_json'}, origin);
    return;
  }

  const normalized = normalizeConsultaMessages(body.messages);
  if (!normalized.ok) {
    send(res, 400, {error: normalized.error}, origin);
    return;
  }

  const payload = buildGeminiRequestBody(normalized.messages, clipFarmContext(body.farmContext), model);
  let geminiRes;
  try {
    geminiRes = await fetch(geminiGenerateUrl(model), {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-goog-api-key': key},
      body: JSON.stringify(payload)
    });
  } catch {
    send(res, 502, {error: 'gemini_unreachable', message: 'No hubo conexión con la API de Gemini.'}, origin);
    return;
  }

  if (!geminiRes.ok) {
    const quota = geminiRes.status === 429;
    send(
      res,
      502,
      {
        error: quota ? 'gemini_quota' : 'gemini_error',
        status: geminiRes.status,
        message: quota
          ? 'Cupo gratuito agotado. Espera. No actives facturación por este aviso.'
          : 'Gemini no respondió. Revisa el modelo en Google AI Studio.'
      },
      origin
    );
    return;
  }

  const payloadJson = await geminiRes.json();
  send(res, 200, {reply: readGeminiText(payloadJson), model}, origin);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun && process.argv.includes('--listen')) {
  const port = Number(process.env.PORT || 8787);
  createServer((req, res) => {
    consultaAvgustHandler(req, res).catch(error => {
      send(res, 500, {error: 'handler_error', message: error instanceof Error ? error.message : 'error'}, '');
    });
  }).listen(port, '127.0.0.1');
}
