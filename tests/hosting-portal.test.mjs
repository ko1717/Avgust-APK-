import test from 'node:test';
import assert from 'node:assert/strict';

const FIREBASE_HOSTING_HOSTS = [
  'gen-lang-client-0175464290.web.app',
  'gen-lang-client-0175464290.firebaseapp.com'
];

function isFirebaseHostingHostname(hostname = '') {
  return FIREBASE_HOSTING_HOSTS.includes(String(hostname).toLowerCase());
}

function isHostingPortalOnly(envFlag, hostname) {
  if (envFlag === '1') return true;
  return isFirebaseHostingHostname(hostname);
}

test('hosting hostnames are recognized as portal-only', () => {
  assert.equal(isFirebaseHostingHostname('gen-lang-client-0175464290.web.app'), true);
  assert.equal(isFirebaseHostingHostname('gen-lang-client-0175464290.firebaseapp.com'), true);
  assert.equal(isFirebaseHostingHostname('localhost'), false);
  assert.equal(isFirebaseHostingHostname('example.workers.dev'), false);
});

test('build flag forces portal-only even off Hosting hostname', () => {
  assert.equal(isHostingPortalOnly('1', 'localhost'), true);
  assert.equal(isHostingPortalOnly('', 'localhost'), false);
  assert.equal(isHostingPortalOnly('', 'gen-lang-client-0175464290.web.app'), true);
});
