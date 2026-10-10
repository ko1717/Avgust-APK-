/**
 * Production origin for invitation / online-report links.
 * Override with PUBLIC_PORTAL_ORIGIN or NEXT_PUBLIC_PORTAL_ORIGIN
 * (e.g. https://gen-lang-client-0175464290.web.app) so WhatsApp links
 * point at Firebase Hosting even when the technician is on Sites/localhost.
 */
export function getPortalOrigin(): string {
  const envOrigin =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_PORTAL_ORIGIN || process.env.PUBLIC_PORTAL_ORIGIN)) ||
    '';
  const trimmed = typeof envOrigin === 'string' ? envOrigin.trim().replace(/\/$/, '') : '';
  if (trimmed) return trimmed;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}
