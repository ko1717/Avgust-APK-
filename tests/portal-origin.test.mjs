import test from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_FIREBASE_HOSTING_ORIGIN = 'https://gen-lang-client-0175464290.web.app';

/** Mirror of lib/portal-origin.ts for unit coverage without a TS loader. */
function getPortalOrigin(env = {}, windowOrigin = '') {
  const envOrigin = env.NEXT_PUBLIC_PORTAL_ORIGIN || env.PUBLIC_PORTAL_ORIGIN || '';
  const trimmed = typeof envOrigin === 'string' ? envOrigin.trim().replace(/\/$/, '') : '';
  if (trimmed) return trimmed;
  if (windowOrigin) {
    const origin = windowOrigin.replace(/\/$/, '');
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|chatgpt\.com|openai\.com|workers\.dev|pages\.dev/i.test(origin)) {
      return DEFAULT_FIREBASE_HOSTING_ORIGIN;
    }
    return origin;
  }
  return DEFAULT_FIREBASE_HOSTING_ORIGIN;
}

test('portal origin prefers PUBLIC_PORTAL_ORIGIN without trailing slash', () => {
  assert.equal(
    getPortalOrigin({PUBLIC_PORTAL_ORIGIN: 'https://example.web.app/'}, 'http://localhost:3000'),
    'https://example.web.app'
  );
});

test('portal origin falls back to NEXT_PUBLIC_PORTAL_ORIGIN', () => {
  assert.equal(
    getPortalOrigin({NEXT_PUBLIC_PORTAL_ORIGIN: 'https://custom.web.app'}, ''),
    'https://custom.web.app'
  );
});

test('portal origin uses Firebase Hosting when window is localhost', () => {
  assert.equal(getPortalOrigin({}, 'http://localhost:3000'), DEFAULT_FIREBASE_HOSTING_ORIGIN);
});

test('portal origin uses Firebase Hosting when env and window are unset', () => {
  assert.equal(getPortalOrigin({}, ''), DEFAULT_FIREBASE_HOSTING_ORIGIN);
});

test('portal origin keeps production Hosting origin as-is', () => {
  assert.equal(
    getPortalOrigin({}, 'https://gen-lang-client-0175464290.web.app'),
    'https://gen-lang-client-0175464290.web.app'
  );
});
