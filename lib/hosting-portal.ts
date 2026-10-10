/**
 * Firebase Hosting is portal-only for farm clients.
 * Full CARE 360 technician workspace stays on Vinext / Sites / desktop.
 */

export const FIREBASE_HOSTING_HOSTS = [
  'gen-lang-client-0175464290.web.app',
  'gen-lang-client-0175464290.firebaseapp.com'
] as const;

/** Build-time flag set by `npm run build:firebase`. */
export function isHostingPortalOnlyBuild(): boolean {
  return process.env.NEXT_PUBLIC_HOSTING_PORTAL_ONLY === '1';
}

export function isFirebaseHostingHostname(hostname?: string): boolean {
  const host =
    hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '');
  if (!host) return false;
  return (FIREBASE_HOSTING_HOSTS as readonly string[]).includes(host.toLowerCase());
}

/** True when this runtime must never expose the technician workspace. */
export function isHostingPortalOnly(): boolean {
  if (isHostingPortalOnlyBuild()) return true;
  return isFirebaseHostingHostname();
}

/**
 * Ensure the public URL advertises the farm portal (keeps invitation / report query params).
 */
export function ensurePortalQueryOnHosting(): void {
  if (typeof window === 'undefined') return;
  if (!isHostingPortalOnly()) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('portal') === 'finca') return;
  url.searchParams.set('portal', 'finca');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
