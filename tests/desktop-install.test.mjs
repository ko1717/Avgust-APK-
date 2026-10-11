import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {CSP, portalOrigin, projectId} = require('../desktop/csp.cjs');
const builder = require('../desktop/electron-builder.config.cjs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const html = fs.readFileSync('desktop/index.html', 'utf8');
const main = fs.readFileSync('desktop/main.cjs', 'utf8');
const capacitor = fs.readFileSync('capacitor.config.ts', 'utf8');
const applet = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

test('desktop CSP matches the Firebase project used by Hosting', () => {
  const meta = html.match(/Content-Security-Policy" content="([^"]+)"/);
  assert.ok(meta, 'index.html is missing the CSP meta tag');
  assert.equal(meta[1], CSP);
  assert.match(CSP, /https:\/\/firestore\.googleapis\.com/);
  assert.match(CSP, new RegExp(projectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(CSP, /wasm-unsafe-eval/);
  assert.equal(portalOrigin, 'https://gen-lang-client-0175464290.web.app');
  assert.match(main, /require\('\.\/csp\.cjs'\)/);
});

test('packaging scripts run on Windows and Linux', () => {
  assert.match(pkg.scripts['desktop:installer'], /node tools\/desktop-installer\.mjs/);
  assert.match(pkg.scripts['android:toolchain'], /node tools\/android-toolchain\.mjs/);
  assert.match(pkg.scripts['android:apk'], /cap sync android && node tools\/android-build\.mjs/);
  assert.equal(builder.win.target[0].target, 'nsis');
  assert.equal(builder.nsis.artifactName, 'AVGUST-CARE-360-Instalador-${version}-Windows-x64.${ext}');
  assert.ok(builder.files.includes('csp.cjs'));
  const appletPath = path.resolve('firebase-applet-config.json');
  const packed = builder.files.find(entry => entry && entry.to === 'firebase-applet-config.json');
  assert.ok(packed, 'firebase-applet-config.json must be packed into the asar');
  assert.equal(path.resolve(packed.from), appletPath);
  const besideAsar = builder.extraResources.find(entry => entry && entry.to === 'firebase-applet-config.json');
  assert.ok(besideAsar, 'firebase-applet-config.json must be copied next to app.asar');
  assert.equal(path.resolve(besideAsar.from), appletPath);
  if (process.platform !== 'win32') {
    assert.equal(builder.electronDist, undefined);
    const systemWine = spawnSync('wine', ['--version'], {stdio: 'ignore'}).status === 0;
    if (systemWine) assert.equal(builder.toolsets, undefined);
    else assert.equal(builder.toolsets.wine, '1.0.1');
  }
});

test('packaged csp resolves firebase-applet-config.json beside the script and next to the asar', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'care360-asar-'));
  const resources = path.join(root, 'resources');
  const appDir = path.join(resources, 'app');
  fs.mkdirSync(appDir, {recursive: true});
  fs.copyFileSync('firebase-applet-config.json', path.join(appDir, 'firebase-applet-config.json'));
  fs.copyFileSync('firebase-applet-config.json', path.join(resources, 'firebase-applet-config.json'));
  const script = path.join(appDir, 'csp.cjs');
  fs.copyFileSync('desktop/csp.cjs', script);
  const load = () => {
    const fromApp = createRequire(script);
    delete fromApp.cache[script];
    return fromApp(script);
  };
  const packaged = load();
  assert.equal(packaged.projectId, applet.projectId);
  assert.equal(packaged.portalOrigin, `https://${applet.projectId}.web.app`);
  fs.rmSync(path.join(appDir, 'firebase-applet-config.json'));
  const fromResources = load();
  assert.equal(fromResources.projectId, applet.projectId);
  fs.rmSync(root, {recursive: true, force: true});
});

test('Android shell loads the desktop UI and the portal Firebase project', () => {
  assert.match(capacitor, /webDir:\s*'desktop\/ui'/);
  assert.match(capacitor, /androidScheme:\s*'https'/);
  assert.match(capacitor, /hostname:\s*'localhost'/);
  assert.match(capacitor, new RegExp(applet.authDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(capacitor, new RegExp(`${applet.projectId}\\.web\\.app`));
  assert.equal(projectId, applet.projectId);
});

test('Hosting deploy scripts stay on the portal project', () => {
  assert.equal(
    pkg.scripts['deploy:portal'],
    'firebase use gen-lang-client-0175464290 && npm run deploy:firebase'
  );
  assert.match(pkg.scripts['deploy:firebase'], /firebase deploy --only hosting,firestore/);
  assert.match(pkg.scripts['build:firebase'], /node scripts\/build-firebase\.mjs/);
});
