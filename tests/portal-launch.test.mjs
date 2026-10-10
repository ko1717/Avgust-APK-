import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTAL_ORIGIN,
  canonicalFarmName,
  farmKey,
  formatInvitationCode,
  generateInvitationCode,
  getPortalOrigin,
  isInvitationCode,
  normalizeInvitationCode,
  publishFailureMessage,
  sameFarm,
  stableVisitId
} from '../lib/portal-match.mjs';

const HOSTING = 'https://gen-lang-client-0175464290.web.app';

test('farm key matches an invitation despite case and extra spaces', () => {
  assert.equal(farmKey('  Finca   Prueba Portal AVGUST '), 'finca prueba portal avgust');
  assert.equal(canonicalFarmName('  Finca   Prueba Portal AVGUST '), 'Finca Prueba Portal AVGUST');
  assert.equal(sameFarm('Finca Prueba Portal AVGUST', '  finca   prueba portal avgust '), true);
  assert.equal(sameFarm('Otra Finca', 'Finca Prueba Portal AVGUST'), false);
  assert.equal(sameFarm('   ', '   '), false);
});

test('portal origin is always the Firebase Hosting URL', () => {
  assert.equal(PORTAL_ORIGIN, HOSTING);
  assert.equal(getPortalOrigin(), HOSTING);
});

test('invitation codes are ASEG-#### and legacy MIPE codes still normalize', () => {
  assert.equal(formatInvitationCode(3601), 'ASEG-3601');
  assert.equal(normalizeInvitationCode('aseg-3601'), 'ASEG-3601');
  assert.equal(normalizeInvitationCode('ASEG 3601'), 'ASEG-3601');
  assert.equal(normalizeInvitationCode('mipe1234'), 'MIPE-1234');
  assert.equal(isInvitationCode('ASEG-3601'), true);
  assert.equal(isInvitationCode('MIPE-9999'), true);
  assert.equal(isInvitationCode('abc123token'), false);
  assert.match(generateInvitationCode(), /^ASEG-\d{4}$/);
  assert.throws(() => formatInvitationCode(12), /ASEG-####/);
});

test('visit id stays stable so a republish merges the same document', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(stableVisitId({id, farm: 'Finca', date: '2026-01-01'}), id);
  const first = stableVisitId({id: '', farm: '  Finca   Prueba Portal AVGUST ', date: '2026-04-01'});
  const second = stableVisitId({farm: 'finca prueba portal avgust', date: '2026-04-01'});
  assert.equal(first, second);
  assert.match(first, /^vis_[a-f0-9]+$/);
  assert.notEqual(first, stableVisitId({farm: 'finca prueba portal avgust', date: '2026-04-02'}));
});

test('publish failures tell the technician in Spanish that the portal did not receive the report', () => {
  const network = publishFailureMessage({code: 'unavailable', message: 'client is offline'});
  const auth = publishFailureMessage({code: 'permission-denied', message: 'Missing or insufficient permissions.'});
  const generic = publishFailureMessage(new Error('boom'));
  assert.match(network, /No se pudo publicar el informe en el portal/);
  assert.match(network, /conex/i);
  assert.match(auth, /permiso/i);
  assert.match(auth, /no llegó/i);
  assert.match(generic, /no llegó a Firebase Hosting/i);
  assert.equal(publishFailureMessage(new Error(network)), network);
});
