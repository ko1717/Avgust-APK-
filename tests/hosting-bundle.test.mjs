import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  collectReachableStatic,
  pruneUnreachableStatic,
  staticRefsIn
} from '../scripts/prepare-firebase-hosting.mjs';

test('static refs include absolute and relative chunk urls', () => {
  const text = `
    import x from "./rolldown-runtime-abc.js";
    const deps = ["_next/static/chunks/workspace-DEAD.js","/_next/static/css/farm-portal-view.abc.css"];
    const local = import("./farm-portal-host-abc.js");
  `;
  const refs = staticRefsIn(text, '_next/static/chunks/page.js');
  assert.equal(refs.has('_next/static/chunks/rolldown-runtime-abc.js'), true);
  assert.equal(refs.has('_next/static/chunks/workspace-DEAD.js'), true);
  assert.equal(refs.has('_next/static/css/farm-portal-view.abc.css'), true);
  assert.equal(refs.has('_next/static/chunks/farm-portal-host-abc.js'), true);
});

test('prune drops console chunks the portal shell does not import', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-bundle-'));
  const chunks = path.join(dir, '_next', 'static', 'chunks');
  const css = path.join(dir, '_next', 'static', 'css');
  fs.mkdirSync(chunks, {recursive: true});
  fs.mkdirSync(css, {recursive: true});
  fs.mkdirSync(path.join(dir, 'portal'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'portal', 'field.jpg'), 'jpg');

  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<link rel="stylesheet" href="/_next/static/css/index.css"><script src="/_next/static/chunks/page.js" type="module"></script>'
  );
  fs.writeFileSync(path.join(dir, '404.html'), '<script src="/_next/static/chunks/page.js"></script>');
  fs.writeFileSync(
    path.join(chunks, 'page.js'),
    'import "./portal-host.js"; const deps=["_next/static/css/portal.css"];'
  );
  fs.writeFileSync(path.join(chunks, 'portal-host.js'), 'export const portal = true;');
  fs.writeFileSync(path.join(css, 'index.css'), '.a{color:red}');
  fs.writeFileSync(path.join(css, 'portal.css'), '.b{color:green}');
  fs.writeFileSync(path.join(chunks, 'workspace-BIG.js'), 'export const consoleApp = true;');
  fs.writeFileSync(path.join(css, 'workspace.css'), '.console{display:block}');

  const before = collectReachableStatic(dir);
  assert.equal(before.has('_next/static/chunks/workspace-BIG.js'), false);
  assert.equal(before.has('_next/static/chunks/portal-host.js'), true);

  const {removed} = pruneUnreachableStatic(dir);
  const names = removed.map(item => item.rel).sort();
  assert.deepEqual(names, [
    '_next/static/chunks/workspace-BIG.js',
    '_next/static/css/workspace.css'
  ]);
  assert.equal(fs.existsSync(path.join(chunks, 'portal-host.js')), true);
  assert.equal(fs.existsSync(path.join(chunks, 'page.js')), true);
  assert.equal(fs.existsSync(path.join(dir, 'portal', 'field.jpg')), true);
  assert.equal(fs.existsSync(path.join(chunks, 'workspace-BIG.js')), false);

  fs.rmSync(dir, {recursive: true, force: true});
});
