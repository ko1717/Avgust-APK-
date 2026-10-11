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
 * On portal-only Hosting, strip legacy `?portal=finca` so the bar stays clean.
 * Invitation / online-report query params are preserved.
 */
export function ensurePortalQueryOnHosting(): void {
  if (typeof window === 'undefined') return;
  if (!isHostingPortalOnly()) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('portal') !== 'finca') return;
  url.searchParams.delete('portal');
  const qs = url.searchParams.toString();
  window.history.replaceState(
    {},
    '',
    `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`
  );
}
