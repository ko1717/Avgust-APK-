import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const HOSTING = 'https://gen-lang-client-0175464290.web.app';
const root = fileURLToPath(new URL('..', import.meta.url));

const bundled = await build({
  entryPoints: [path.join(root, 'lib/portal-origin.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
});
const source = Buffer.from(bundled.outputFiles[0].contents).toString('base64');
const {
  getPortalOrigin,
  clientPortalEntryUrl,
  buildHostingPortalUrl,
  publishClientBlockReason,
  DEFAULT_FIREBASE_HOSTING_ORIGIN
} = await import(`data:text/javascript;base64,${source}`);

test('portal origin stays on Firebase Hosting even if env or window point elsewhere', () => {
  const previousPublic = process.env.PUBLIC_PORTAL_ORIGIN;
  const previousNext = process.env.NEXT_PUBLIC_PORTAL_ORIGIN;
  const previousWindow = globalThis.window;
  process.env.PUBLIC_PORTAL_ORIGIN = 'https://example.web.app/';
  process.env.NEXT_PUBLIC_PORTAL_ORIGIN = 'https://custom.web.app';
  globalThis.window = {location: {origin: 'http://localhost:3000'}};
  try {
    assert.equal(DEFAULT_FIREBASE_HOSTING_ORIGIN, HOSTING);
    assert.equal(getPortalOrigin(), HOSTING);
    assert.equal(clientPortalEntryUrl(), `${HOSTING}/`);
    assert.equal(clientPortalEntryUrl(`${HOSTING}/`), `${HOSTING}/`);
    assert.equal(
      buildHostingPortalUrl({invitation: 'abc123'}),
      `${HOSTING}/?invitation=abc123`
    );
    assert.equal(
      buildHostingPortalUrl({view: 'online-report', id: 'vis_01'}),
      `${HOSTING}/?view=online-report&id=vis_01`
    );
  } finally {
    if (previousPublic === undefined) delete process.env.PUBLIC_PORTAL_ORIGIN;
    else process.env.PUBLIC_PORTAL_ORIGIN = previousPublic;
    if (previousNext === undefined) delete process.env.NEXT_PUBLIC_PORTAL_ORIGIN;
    else process.env.NEXT_PUBLIC_PORTAL_ORIGIN = previousNext;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('publish blocks an empty farm name and an unreviewed visit', () => {
  assert.match(publishClientBlockReason({farm: '   ', reviewed: true}), /nombre de la finca/);
  assert.match(publishClientBlockReason({farm: 'El Rosal', reviewed: false}), /revisado/);
  assert.equal(publishClientBlockReason({farm: 'El Rosal', reviewed: true}), null);
});
