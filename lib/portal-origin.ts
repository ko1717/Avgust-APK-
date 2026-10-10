/**
 * Production origin for invitation / online-report links.
 *
 * Override with PUBLIC_PORTAL_ORIGIN or NEXT_PUBLIC_PORTAL_ORIGIN
 * (e.g. https://gen-lang-client-0175464290.web.app) so WhatsApp links
 * point at Firebase Hosting even when the technician is on Sites/localhost.
 */
export const DEFAULT_FIREBASE_HOSTING_ORIGIN =
  'https://gen-lang-client-0175464290.web.app';

function isDevOrSitesShell(origin: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|chatgpt\.com|openai\.com|workers\.dev|pages\.dev/i.test(
    origin
  );
}

export function getPortalOrigin(): string {
  const envOrigin =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_PORTAL_ORIGIN || process.env.PUBLIC_PORTAL_ORIGIN)) ||
    '';
  const trimmed = typeof envOrigin === 'string' ? envOrigin.trim().replace(/\/$/, '') : '';
  if (trimmed) return trimmed;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    // Invitation links must reach Firebase Hosting, not ChatGPT Sites login or local shells.
    if (isDevOrSitesShell(origin)) return DEFAULT_FIREBASE_HOSTING_ORIGIN;
    return origin;
  }

  return DEFAULT_FIREBASE_HOSTING_ORIGIN;
}
