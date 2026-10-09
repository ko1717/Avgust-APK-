import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const baseApk = path.join(rootDir, 'tools', 'base', 'capacitor-seed.apk');
const enhanceSrcDir = path.join(rootDir, 'enhance', 'src');

console.log('--- Building AVGUST CARE 360 web distribution ---');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

if (fs.existsSync(baseApk)) {
  console.log('Extracting web assets from base APK...');
  const tempExtract = path.join(distDir, '.apk_temp');
  fs.mkdirSync(tempExtract, { recursive: true });
  try {
    execFileSync('unzip', ['-q', baseApk, 'assets/public/*', '-d', tempExtract]);
    const publicExtracted = path.join(tempExtract, 'assets', 'public');
    if (fs.existsSync(publicExtracted)) {
      fs.cpSync(publicExtracted, distDir, { recursive: true });
    }
  } catch (err) {
    console.warn('unzip command failed, falling back to python unzip...', err.message);
    const pyScript = `
import zipfile, sys
apk = sys.argv[1]
out = sys.argv[2]
with zipfile.ZipFile(apk) as z:
    for member in z.namelist():
        if member.startswith('assets/public/'):
            rel = member[len('assets/public/'):]
            if not rel: continue
            target = out + '/' + rel
            if member.endswith('/'):
                import os; os.makedirs(target, exist_ok=True)
            else:
                import os; os.makedirs(os.path.dirname(target), exist_ok=True)
                with z.open(member) as src, open(target, 'wb') as dst:
                    dst.write(src.read())
`;
    execFileSync('python3', ['-c', pyScript, baseApk, distDir]);
  } finally {
    if (fs.existsSync(tempExtract)) {
      fs.rmSync(tempExtract, { recursive: true, force: true });
    }
  }
} else {
  console.error('Base APK not found at:', baseApk);
  process.exit(1);
}

const distEnhanceDir = path.join(distDir, 'enhance');
fs.mkdirSync(distEnhanceDir, { recursive: true });
if (fs.existsSync(enhanceSrcDir)) {
  fs.cpSync(enhanceSrcDir, distEnhanceDir, { recursive: true });
}

const presFile = path.join(distEnhanceDir, 'care360-presentation.js');
if (fs.existsSync(presFile)) {
  let presCode = fs.readFileSync(presFile, 'utf-8');
  presCode = presCode.replace(/__C360_VERSION__/g, 'v1.5.32');
  fs.writeFileSync(presFile, presCode, 'utf-8');
}

const indexHtmlPath = path.join(distDir, 'index.html');
const buildVer = '2.1.0';
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf-8');
  const cacheBusterScript = '<script>if(window.caches){caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k);});});}if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.update();});});}</script>';
  const headTags = [
    cacheBusterScript,
    '<link rel="icon" href="/favicon.svg">',
    `<link rel="stylesheet" href="/enhance/care360-enhance.css?v=${buildVer}">`,
    `<link rel="stylesheet" href="/enhance/care360-presentation.css?v=${buildVer}">`,
    `<link rel="stylesheet" href="/enhance/care360-pro.css?v=${buildVer}">`,
    `<link rel="stylesheet" href="/enhance/care360-enterprise-visual.css?v=${buildVer}">`
  ].join('');

  const bodyTags = [
    `<script defer src="/enhance/colombia-geo.js?v=${buildVer}"></script>`,
    `<script defer src="/enhance/care360-experience.js?v=${buildVer}"></script>`,
    `<script defer src="/enhance/care360-ops.js?v=${buildVer}"></script>`,
    `<script defer src="/enhance/care360-import.js?v=${buildVer}"></script>`,
    `<script defer src="/enhance/care360-pro.js?v=${buildVer}"></script>`,
    `<script defer src="/enhance/care360-presentation.js?v=${buildVer}"></script>`
  ].join('');

  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' blob: data:; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' \'wasm-unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' blob: data:; font-src \'self\' data:; connect-src \'self\' blob: data:; object-src \'none\';">');

  if (!html.includes('<meta name="description"')) {
    const metaTags = '<meta name="description" content="Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en fincas de flores con registro de visitas técnicas, auditoría, mediciones y generación de informes."><meta property="og:title" content="AVGUST CARE 360"><meta property="og:description" content="Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en fincas de flores">';
    html = html.replace('<title>', `${metaTags}<title>`);
  }

  const headTagList = headTags.split(/(?=<(?:link|script)\\b)/);
  for (const tag of headTagList) {
    const match = tag.match(/(?:href|src)=\"([^\"]+)\"/);
    if (match && !html.includes(match[1].split('?')[0])) {
      html = html.replace('</head>', tag + '</head>');
    }
  }

  const bodyTagList = bodyTags.split(/(?=<script\\b)/);
  for (const tag of bodyTagList) {
    const match = tag.match(/src=\"([^\"]+)\"/);
    if (match && !html.includes(match[1].split('?')[0])) {
      html = html.replace('</body>', tag + '</body>');
    }
  }
  if (!html.includes('interactive-widget=')) {
    html = html.replace('viewport-fit=cover', 'viewport-fit=cover, interactive-widget=resizes-content');
  }
  fs.writeFileSync(indexHtmlPath, html, 'utf-8');
}

const swPath = path.join(distDir, 'sw.js');
const swContent = `const CACHE = 'avgust-care-shell-v6';
const SHELL = ['/', '/avgust-logo.svg', '/favicon.svg', '/manrope.woff2', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/enhance/') || request.destination === 'script') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && ['style', 'font', 'image'].includes(request.destination)) {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
`;
fs.writeFileSync(swPath, swContent, 'utf-8');

const patches = [
  'patch_measurements.py',
  'patch_report.py',
  'patch_import.py',
  'patch_runtime.py',
  'patch_followup.py',
  'patch_draft.py',
  'patch_crop.py',
];

for (const patch of patches) {
  const patchPath = path.join(rootDir, 'tools', patch);
  if (fs.existsSync(patchPath)) {
    console.log(`Applying patch: ${patch}`);
    const res = spawnSync('python3', [patchPath, distDir], { encoding: 'utf-8' });
    if (res.status !== 0) {
      console.warn(`Patch ${patch} returned non-zero status:`, res.stderr || res.stdout);
    } else {
      console.log(`  ✓ ${patch} succeeded`);
    }
  }
}

console.log('✅ AVGUST CARE 360 build finished successfully in dist/');
