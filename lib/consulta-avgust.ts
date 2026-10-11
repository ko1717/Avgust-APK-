/**
 * Consulta AVGUST — scoped Gemini chat for the farm portal.
 * GEMINI_API_KEY / GOOGLE_API_KEY stay on the server. Never put them in NEXT_PUBLIC_*.
 */

import {isHostingPortalOnly} from './hosting-portal';

export {
  CONSULTA_AVGUST_MODEL,
  CONSULTA_AVGUST_SYSTEM_PROMPT,
  CONSULTA_MAX_HISTORY,
  CONSULTA_MAX_OUTPUT_TOKENS,
  CONSULTA_MAX_USER_CHARS,
  buildGeminiContents,
  buildGeminiRequestBody,
  clipFarmContext,
  consultaAllowOrigin,
  geminiGenerateUrl,
  normalizeConsultaMessages,
  readGeminiText,
  resolveConsultaEndpoint,
  resolveConsultaModel
} from './consulta-avgust-core.mjs';

import {resolveConsultaEndpoint} from './consulta-avgust-core.mjs';

export type ConsultaAvgustMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ConsultaAvgustFarmContext = {
  farm?: string;
  clientName?: string;
};

/** URL the browser may call. Empty on static Hosting until Kevin sets NEXT_PUBLIC_CONSULTA_AVGUST_URL. */
export function consultaAvgustEndpoint(): string {
  return resolveConsultaEndpoint({
    publicUrl: process.env.NEXT_PUBLIC_CONSULTA_AVGUST_URL,
    hostingPortalOnly: isHostingPortalOnly()
  });
}

export function consultaAvgustClientEnabled(): boolean {
  return consultaAvgustEndpoint().length > 0;
}

export function readGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
}
