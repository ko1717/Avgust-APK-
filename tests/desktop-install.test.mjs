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
  assert.ok(builder.files.includes('firebase-applet-config.json'));
  const appletPath = path.resolve('firebase-applet-config.json');
  const besideAsar = builder.extraResources.find(entry => entry && entry.to === 'firebase-applet-config.json');
  assert.ok(besideAsar, 'firebase-applet-config.json must be copied next to app.asar');
  assert.equal(path.resolve(besideAsar.from), appletPath);
  assert.match(fs.readFileSync('desktop/build.cjs', 'utf8'), /firebase-applet-config\.json/);
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
  const appDir = path.join(resources, 'app.asar');
  const devDir = path.join(root, 'desktop');
  fs.mkdirSync(appDir, {recursive: true});
  fs.mkdirSync(devDir, {recursive: true});
  const write = (file, projectId) => fs.writeFileSync(file, JSON.stringify({...applet, projectId}));
  write(path.join(appDir, 'firebase-applet-config.json'), 'from-asar');
  write(path.join(resources, 'firebase-applet-config.json'), 'from-resources');
  write(path.join(devDir, 'firebase-applet-config.json'), 'from-desktop-copy');
  write(path.join(root, 'firebase-applet-config.json'), 'from-repo-root');
  fs.copyFileSync('desktop/csp.cjs', path.join(appDir, 'csp.cjs'));
  fs.copyFileSync('desktop/csp.cjs', path.join(devDir, 'csp.cjs'));
  const load = script => {
    const fromApp = createRequire(script);
    delete fromApp.cache[script];
    return fromApp(script);
  };
  const packaged = load(path.join(appDir, 'csp.cjs'));
  assert.equal(packaged.projectId, 'from-asar');
  assert.equal(packaged.portalOrigin, 'https://from-asar.web.app');
  fs.rmSync(path.join(appDir, 'firebase-applet-config.json'));
  assert.equal(load(path.join(appDir, 'csp.cjs')).projectId, 'from-resources');
  assert.equal(load(path.join(devDir, 'csp.cjs')).projectId, 'from-repo-root');
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
