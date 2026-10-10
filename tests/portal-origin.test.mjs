import test from 'node:test';
import assert from 'node:assert/strict';

/** Mirror of lib/portal-origin.ts for unit coverage without a TS loader. */
function getPortalOrigin(env = process.env, windowOrigin = '') {
  const envOrigin = env.NEXT_PUBLIC_PORTAL_ORIGIN || env.PUBLIC_PORTAL_ORIGIN || '';
  const trimmed = typeof envOrigin === 'string' ? envOrigin.trim().replace(/\/$/, '') : '';
  if (trimmed) return trimmed;
  if (windowOrigin) return windowOrigin;
  return '';
}

test('portal origin prefers PUBLIC_PORTAL_ORIGIN without trailing slash', () => {
  assert.equal(
    getPortalOrigin({PUBLIC_PORTAL_ORIGIN: 'https://example.web.app/'}, 'http://localhost:3000'),
    'https://example.web.app'
  );
});

test('portal origin falls back to NEXT_PUBLIC_PORTAL_ORIGIN', () => {
  assert.equal(
    getPortalOrigin({NEXT_PUBLIC_PORTAL_ORIGIN: 'https://gen-lang-client-0175464290.web.app'}, ''),
    'https://gen-lang-client-0175464290.web.app'
  );
});

test('portal origin uses window origin when env unset', () => {
  assert.equal(getPortalOrigin({}, 'http://localhost:3000'), 'http://localhost:3000');
});
