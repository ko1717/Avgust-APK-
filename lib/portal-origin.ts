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

/**
 * Gate the farm client opens on Firebase Hosting.
 * Invitation links keep this prefix and add `&invitation=`.
 */
export function clientPortalEntryUrl(origin = getPortalOrigin()): string {
  return `${origin.replace(/\/$/, '')}?portal=finca`;
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
