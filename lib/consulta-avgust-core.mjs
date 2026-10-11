/**
 * Consulta AVGUST — pure helpers (no API key, safe to import from the browser bundle).
 * Server routes and the optional Cloud Function hold GEMINI_API_KEY.
 */

export const CONSULTA_AVGUST_MODEL = 'gemini-3.5-flash-lite';

export const CONSULTA_MAX_USER_CHARS = 2000;
export const CONSULTA_MAX_HISTORY = 12;
export const CONSULTA_MAX_OUTPUT_TOKENS = 768;

export const CONSULTA_DEFAULT_ORIGINS = [
  'https://gen-lang-client-0175464290.web.app',
  'https://gen-lang-client-0175464290.firebaseapp.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

export const CONSULTA_AVGUST_SYSTEM_PROMPT = `Eres "Consulta AVGUST", asistente del portal de finca AVGUST CARE 360 (protección de cultivos, aseguramiento, fitosanidad y buenas prácticas agrícolas en Colombia y Latinoamérica).

ALCANCE (solo responde dentro de esto):
- Interpretación general de indicadores del programa CARE 360 y capítulos del aseguramiento.
- Buenas prácticas de manejo agronómico, sanidad vegetal, rotación, MIP, registro de aplicaciones, EPP y cumplimiento básico.
- Orientación sobre qué información preparar para una visita de aseguramiento o para contactar al técnico AVGUST.
- Productos y líneas AVGUST solo a nivel informativo.

FUERA DE ALCANCE (rechaza con cortesía y en una o dos frases):
- Temas no agrícolas (política, finanzas personales, medicina humana, entretenimiento, programación, etc.).
- Diagnósticos definitivos sin evidencia de campo; sugiere validación con el técnico AVGUST.
- Dosis, mezclas, caldos o prescripciones de fitosanitarios: remite a la etiqueta, al registro ICA y al ingeniero responsable. No inventes números de dosis.

ESTILO: español claro, breve, profesional. Si la finca comparte contexto (nombre), úsalo sin inventar datos que no estén en el mensaje. No pidas cédula, teléfono, correo ni el texto completo de un informe.`;

export function resolveConsultaModel(envModel) {
  const custom = typeof envModel === 'string' ? envModel.trim() : '';
  return custom || CONSULTA_AVGUST_MODEL;
}

/**
 * @param {{ publicUrl?: string, hostingPortalOnly?: boolean }} input
 * Empty string means the static portal must show the disabled shell.
 */
export function resolveConsultaEndpoint(input = {}) {
  const fromEnv = typeof input.publicUrl === 'string' ? input.publicUrl.trim() : '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (input.hostingPortalOnly) return '';
  return '/api/consulta-avgust';
}

export function consultaAllowOrigin(origin, extraCsv = '') {
  if (!origin || typeof origin !== 'string') return '';
  const extras = String(extraCsv)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const allow = new Set([...CONSULTA_DEFAULT_ORIGINS, ...extras]);
  return allow.has(origin) ? origin : '';
}

export function normalizeConsultaMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const trimmed = list
    .filter(
      message =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string'
    )
    .slice(-CONSULTA_MAX_HISTORY)
    .map(message => ({
      role: message.role,
      content: message.content.trim().slice(0, CONSULTA_MAX_USER_CHARS)
    }))
    .filter(message => message.content.length > 0);

  if (!trimmed.length || trimmed[trimmed.length - 1].role !== 'user') {
    return {ok: false, error: 'messages_required', messages: []};
  }
  return {ok: true, messages: trimmed};
}

export function clipFarmContext(farmContext) {
  const clip = value => (typeof value === 'string' ? value.trim().slice(0, 120) : '');
  const farm = clip(farmContext?.farm);
  const clientName = clip(farmContext?.clientName);
  if (!farm && !clientName) return undefined;
  return {farm, clientName};
}

export function buildGeminiContents(history, farmContext) {
  const context = clipFarmContext(farmContext);
  const prefix = context
    ? `Contexto de sesión (portal): finca "${context.farm || '—'}", invitado "${context.clientName || '—'}".\n\n`
    : '';
  return history.map((message, index) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [
      {
        text: index === 0 && message.role === 'user' ? `${prefix}${message.content}` : message.content
      }
    ]
  }));
}

export function buildGeminiRequestBody(messages, farmContext, _model) {
  return {
    systemInstruction: {parts: [{text: CONSULTA_AVGUST_SYSTEM_PROMPT}]},
    contents: buildGeminiContents(messages, farmContext),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: CONSULTA_MAX_OUTPUT_TOKENS
    }
  };
}

export function geminiGenerateUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolveConsultaModel(model))}:generateContent`;
}

export function readGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text ?? '')
    .join('')
    .trim();
  return (
    text ||
    'No pude generar una respuesta. Intenta reformular tu pregunta agronómica o consúltala con el técnico AVGUST.'
  );
}
