import {
  buildGeminiRequestBody,
  clipFarmContext,
  consultaAllowOrigin,
  geminiGenerateUrl,
  normalizeConsultaMessages,
  readGeminiApiKey,
  readGeminiText,
  resolveConsultaModel
} from '@/lib/consulta-avgust';

function corsHeaders(req: Request): HeadersInit {
  const origin = consultaAllowOrigin(
    req.headers.get('origin') ?? '',
    process.env.CONSULTA_AVGUST_ORIGINS ?? ''
  );
  const headers: Record<string, string> = {'Cache-Control': 'no-store', Vary: 'Origin'};
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function json(req: Request, data: unknown, status = 200) {
  return Response.json(data, {status, headers: corsHeaders(req)});
}

export function OPTIONS(req: Request) {
  return new Response(null, {status: 204, headers: corsHeaders(req)});
}

export function GET(req: Request) {
  const key = readGeminiApiKey();
  return json(req, {
    available: Boolean(key),
    model: resolveConsultaModel(process.env.GEMINI_MODEL),
    scope: 'agriculture-avgust-care360'
  });
}

export async function POST(req: Request) {
  const key = readGeminiApiKey();
  if (!key) {
    return json(
      req,
      {
        error: 'consulta_disabled',
        message:
          'Consulta AVGUST no está configurada en el servidor. Define GEMINI_API_KEY (clave gratuita de Google AI Studio) en el proceso que sirve esta ruta. No la pongas en el JavaScript del portal. Ver docs/portal-ai.md.'
      },
      503
    );
  }

  let body: {messages?: unknown; farmContext?: {farm?: string; clientName?: string}};
  try {
    body = await req.json();
  } catch {
    return json(req, {error: 'invalid_json'}, 400);
  }

  const normalized = normalizeConsultaMessages(body.messages);
  if (!normalized.ok) {
    return json(req, {error: normalized.error}, 400);
  }

  const model = resolveConsultaModel(process.env.GEMINI_MODEL);
  const payload = buildGeminiRequestBody(normalized.messages, clipFarmContext(body.farmContext), model);

  let geminiRes: Response;
  try {
    geminiRes = await fetch(geminiGenerateUrl(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify(payload)
    });
  } catch {
    return json(
      req,
      {
        error: 'gemini_unreachable',
        message: 'No hubo conexión con la API de Gemini. Revisa la red del servidor.'
      },
      502
    );
  }

  if (!geminiRes.ok) {
    const quota = geminiRes.status === 429;
    return json(
      req,
      {
        error: quota ? 'gemini_quota' : 'gemini_error',
        status: geminiRes.status,
        message: quota
          ? 'Se alcanzó el cupo gratuito (por minuto o por día). Espera y vuelve a intentar. No actives facturación para salir de este aviso.'
          : 'No se pudo obtener respuesta del modelo. Revisa el modelo y la cuota en Google AI Studio.'
      },
      502
    );
  }

  const geminiPayload = (await geminiRes.json()) as Parameters<typeof readGeminiText>[0];
  return json(req, {reply: readGeminiText(geminiPayload), model});
}
