/**
 * Invitation and online-report links always use Firebase Hosting.
 * The technician shell (localhost, Sites, firebaseapp.com, or an env override)
 * must not leak into WhatsApp or the client URL.
 */
import {getPortalOrigin as resolvePortalOrigin, PORTAL_ORIGIN} from './portal-match.mjs';

export const DEFAULT_FIREBASE_HOSTING_ORIGIN =
  'https://gen-lang-client-0175464290.web.app';

export function getPortalOrigin(): string {
  return resolvePortalOrigin() || DEFAULT_FIREBASE_HOSTING_ORIGIN || PORTAL_ORIGIN;
}

function normalizeOrigin(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

/**
 * Public farm portal on Firebase Hosting (portal-only build).
 * Legacy `/?portal=finca` still opens the same shell; new links omit it.
 */
export function clientPortalEntryUrl(origin = getPortalOrigin()): string {
  return `${normalizeOrigin(origin)}/`;
}

/**
 * Query-string links on the Hosting origin (`/`, `/finca`, or custom domain).
 * Omits `portal=finca` — Hosting is portal-only at build time.
 */
export function buildHostingPortalUrl(
  params?: Record<string, string | undefined | null>
): string {
  const base = `${normalizeOrigin(getPortalOrigin())}/`;
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Technician preview in the full app still uses `?portal=finca` on localhost / Sites.
 */
export function technicianPortalPreviewUrl(origin?: string): string {
  const base = normalizeOrigin(origin ?? (typeof window !== 'undefined' ? window.location.origin : getPortalOrigin()));
  return `${base}/?portal=finca`;
}

/**
 * Blocks a technician publish that the live portal cannot show.
 * Empty farm names cannot match an invitation. Unreviewed visits are hidden.
 */
export function publishClientBlockReason(visit: {farm: string; reviewed: boolean}): string | null {
  if (!visit.farm.trim()) {
    return 'Escribe el nombre de la finca antes de publicar. Sin ese nombre el Portal Finca no puede emparejar la invitación.';
  }
  if (!visit.reviewed) {
    return 'Marca el informe como revisado antes de publicar. Una visita sin revisar no aparece en el Portal Finca.';
  }
  return null;
}
