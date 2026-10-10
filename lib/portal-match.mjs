/**
 * Pure portal contract shared by the CARE 360 app and the Hosting client.
 * No Firebase, no network. Invitation matching and publish ids stay stable.
 */

export const PORTAL_ORIGIN = 'https://gen-lang-client-0175464290.web.app';

/** Links always open Firebase Hosting, never the technician shell. */
export function getPortalOrigin() {
  return PORTAL_ORIGIN;
}

export function canonicalFarmName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

/** Same key the portal uses to decide which visits belong to an invitation. */
export function farmKey(name) {
  return canonicalFarmName(name).toLocaleLowerCase('es');
}

export function sameFarm(a, b) {
  const left = farmKey(a);
  const right = farmKey(b);
  return left.length > 0 && left === right;
}

/** Firestore rejects undefined. Drop those keys without changing stored values. */
export function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(item => omitUndefined(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = omitUndefined(item);
    }
    return out;
  }
  return value;
}

/**
 * Firestore document id for a visit. A valid id is kept so republish merges.
 * Missing or illegal ids fall back to a hash of farm + date (not revision).
 */
export function stableVisitId(visit) {
  const raw = String(visit?.id ?? '').trim();
  if (/^[A-Za-z0-9_-]{1,128}$/.test(raw)) return raw;
  const basis = `${farmKey(visit?.farm || 'finca')}|${String(visit?.date ?? '').trim()}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `vis_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const INVITATION_CODE = /^(ASEG|MIPE)-(\d{4})$/;

/** ASEG-#### for new codes. MIPE-#### stays valid for invitations already stored. */
export function normalizeInvitationCode(input) {
  const compact = String(input ?? '').trim().toUpperCase().replace(/[\s_]+/g, '');
  const match = compact.match(/^(ASEG|MIPE)-?(\d{4})$/);
  if (match) return `${match[1]}-${match[2]}`;
  return String(input ?? '').trim();
}

export function isInvitationCode(input) {
  return INVITATION_CODE.test(normalizeInvitationCode(input));
}

export function formatInvitationCode(num) {
  const n = Math.floor(Number(num));
  if (!Number.isInteger(n) || n < 1000 || n > 9999) {
    throw new Error('El código de invitación debe ser ASEG-#### (1000 a 9999).');
  }
  return `ASEG-${n}`;
}

export function generateInvitationCode() {
  return formatInvitationCode(Math.floor(1000 + Math.random() * 9000));
}

const PUBLISH_PREFIX = 'No se pudo publicar el informe en el portal';

/**
 * Technician-facing publish failure. Says the report did not reach the portal.
 * Already-Spanish messages are returned unchanged.
 */
export function publishFailureMessage(error) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  if (message.startsWith(PUBLISH_PREFIX)) return message;

  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code || '')
    : '';
  const blob = `${code} ${message}`.toLowerCase();

  if (/network-request-failed|unavailable|deadline-exceeded|offline|failed to fetch|client is offline|timeout|auth\/network/.test(blob)) {
    return `${PUBLISH_PREFIX}: no hay conexión con Firebase. El cliente no verá este informe hasta que vuelvas a publicarlo.`;
  }
  if (/permission-denied|unauthenticated|unauthorized|insufficient permissions|auth\/invalid|auth\/user-token|auth\/admin-restricted/.test(blob)) {
    return `${PUBLISH_PREFIX}: la sesión no tiene permiso. El informe no llegó a Firebase. Entra en Acceso Nube e inténtalo de nuevo.`;
  }
  return `${PUBLISH_PREFIX}. La actualización no llegó a Firebase Hosting. Revisa la conexión e inténtalo de nuevo.`;
}
