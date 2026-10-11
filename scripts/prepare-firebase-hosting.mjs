#!/usr/bin/env node
/**
 * Stages a static Firebase Hosting bundle from a vinext production build.
 *
 * Flow:
 *   1. Requires `dist/client` from `vinext build` (or runs it).
 *   2. Boots `vinext start` briefly to prerender `/` (SSR HTML shell).
 *   3. Copies client assets + index.html into dist/firebase-hosting.
 *
 * Firebase Hosting serves this statically as the **farm client portal only**.
 * Portal clients use Firestore/Auth in the browser. The technician CARE 360
 * workspace is not mounted on Hosting (NEXT_PUBLIC_HOSTING_PORTAL_ONLY=1).
 * D1/R2 API routes are not available — keep Vinext / Sites / desktop for the
 * full authenticated app.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'dist', 'client');
const outDir = path.join(rootDir, 'dist', 'firebase-hosting');
const port = Number(process.env.FIREBASE_HOSTING_PRERENDER_PORT || 4179);
const host = '127.0.0.1';

function exists(filePath) {
  return fs.existsSync(filePath);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: options.stdio ?? 'inherit',
      env: {...process.env, ...options.env},
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function ensureVinextBuild() {
  if (exists(path.join(clientDir, '_next'))) return;
  console.log('dist/client missing — running vinext build…');
  await run('npx', ['vinext', 'build'], {
    env: {
      NEXT_PUBLIC_PORTAL_ORIGIN:
        process.env.NEXT_PUBLIC_PORTAL_ORIGIN ||
        process.env.PUBLIC_PORTAL_ORIGIN ||
        'https://gen-lang-client-0175464290.web.app',
      NEXT_PUBLIC_HOSTING_PORTAL_ONLY: '1'
    }
  });
  if (!exists(path.join(clientDir, '_next'))) {
    throw new Error('vinext build finished but dist/client/_next was not produced');
  }
}

function waitForHttp(url, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, res => {
        res.resume();
        if ((res.statusCode || 500) < 500) {
          resolve();
          return;
        }
        retry(new Error(`HTTP ${res.statusCode}`));
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry(new Error('timeout'));
      });
    };
    const retry = err => {
      if (Date.now() - started > timeoutMs) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      setTimeout(attempt, 400);
    };
    attempt();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`GET ${url} → ${res.statusCode}`));
            return;
          }
          resolve(body);
        });
      })
      .on('error', reject);
  });
}

async function prerenderIndexHtml() {
  const url = `http://${host}:${port}/`;
  console.log(`Starting vinext start on ${url} to capture portal SSR shell…`);
  // Detached process group so we can SIGKILL workerd grandchildren on cleanup.
  const child = spawn('npx', ['vinext', 'start', '--port', String(port), '--hostname', host], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      NEXT_PUBLIC_PORTAL_ORIGIN:
        process.env.NEXT_PUBLIC_PORTAL_ORIGIN ||
        process.env.PUBLIC_PORTAL_ORIGIN ||
        'https://gen-lang-client-0175464290.web.app',
      NEXT_PUBLIC_HOSTING_PORTAL_ONLY: '1'
    },
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32'
  });

  let logs = '';
  child.stdout?.on('data', chunk => {
    logs += chunk.toString();
  });
  child.stderr?.on('data', chunk => {
    logs += chunk.toString();
  });

  const stop = () => {
    const pid = child.pid;
    if (!pid) return;
    try {
      if (process.platform !== 'win32') {
        process.kill(-pid, 'SIGKILL');
      } else {
        child.kill('SIGKILL');
      }
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
  };

  try {
    await waitForHttp(url);
    const html = await fetchText(url);
    if (!html.includes('<!DOCTYPE html') && !html.includes('<html')) {
      throw new Error('Prerender response did not look like HTML');
    }
    if (!html.includes('/_next/static/')) {
      throw new Error('Prerendered HTML is missing /_next/static asset references');
    }
    return html;
  } catch (error) {
    console.error(logs.slice(-4000));
    throw error;
  } finally {
    stop();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

function copyClientAssets() {
  if (exists(outDir)) {
    fs.rmSync(outDir, {recursive: true, force: true});
  }
  fs.mkdirSync(outDir, {recursive: true});
  fs.cpSync(clientDir, outDir, {recursive: true});

  // Drop Cloudflare / Vite bookkeeping that Hosting should not publish.
  for (const name of ['.assetsignore', '.vite', 'vinext-client-entry-manifest.json', '_headers']) {
    const target = path.join(outDir, name);
    if (exists(target)) fs.rmSync(target, {recursive: true, force: true});
  }
}

/** Strip legacy `?portal=finca` on Hosting hostnames (portal-only; keeps other query params). */
function injectPortalLegacyCleanup(html) {
  const cleanupScript = `<script>(function(){try{var h=location.hostname.toLowerCase();if(h!=='gen-lang-client-0175464290.web.app'&&h!=='gen-lang-client-0175464290.firebaseapp.com')return;var u=new URL(location.href);if(u.searchParams.get('portal')!=='finca')return;u.searchParams.delete('portal');var q=u.searchParams.toString();location.replace(u.pathname+(q?'?'+q:'')+u.hash);}catch(e){}})();</script>`;
  if (html.includes('<!-- firebase-portal-legacy-cleanup -->')) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /<head([^>]*)>/i,
      `<head$1><!-- firebase-portal-legacy-cleanup -->${cleanupScript}`
    );
  }
  return `<!-- firebase-portal-legacy-cleanup -->${cleanupScript}${html}`;
}

function writeHtml(html) {
  const locked = injectPortalLegacyCleanup(html);
  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, locked, 'utf8');
  // Firebase uses 404.html as SPA fallback when a path is missing.
  fs.writeFileSync(path.join(outDir, '404.html'), locked, 'utf8');
  return indexPath;
}

function assertPortalAssets() {
  const required = [
    'index.html',
    'favicon.svg',
    'avgust-logo.svg',
    'portal/field.jpg',
    'portal/greenhouse.jpg',
    'portal/ornamental.jpg',
    'manrope.woff2'
  ];
  const missing = required.filter(rel => !exists(path.join(outDir, rel)));
  if (missing.length) {
    throw new Error(`Firebase Hosting bundle missing required assets: ${missing.join(', ')}`);
  }
}

function normalizeRel(rel) {
  const clean = String(rel)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .split('?')[0]
    .split('#')[0];
  const parts = [];
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** Static and dynamic chunk URLs referenced by an HTML, JS, or CSS file. */
export function staticRefsIn(text, fromRel = '') {
  const refs = new Set();
  const add = rel => {
    const norm = normalizeRel(rel);
    if (norm) refs.add(norm);
  };
  const abs = text.match(/\/_next\/static\/[A-Za-z0-9_./-]+\.(?:js|css|woff2)/g) || [];
  for (const ref of abs) add(ref);
  const bare = text.match(/(?:^|[^A-Za-z0-9_/])(_next\/static\/[A-Za-z0-9_./-]+\.(?:js|css|woff2))/g) || [];
  for (const ref of bare) {
    const match = ref.match(/_next\/static\/[A-Za-z0-9_./-]+\.(?:js|css|woff2)/);
    if (match) add(match[0]);
  }
  const relative = text.match(/(?:^|[^A-Za-z0-9_])\.\/[A-Za-z0-9_./-]+\.(?:js|css)/g) || [];
  const baseDir = fromRel ? path.posix.dirname(fromRel) : '';
  for (const ref of relative) {
    const match = ref.match(/\.\/[A-Za-z0-9_./-]+\.(?:js|css)/);
    if (!match) continue;
    add(baseDir ? path.posix.join(baseDir, match[0]) : match[0]);
  }
  return refs;
}

/**
 * Files reachable from the Hosting HTML shell. Console chunks that the
 * portal-only build no longer imports are absent from this set.
 */
export function collectReachableStatic(dir) {
  const reachable = new Set();
  const queue = [];
  const enqueue = rel => {
    const norm = normalizeRel(rel);
    if (!norm || reachable.has(norm)) return;
    if (!exists(path.join(dir, norm))) return;
    reachable.add(norm);
    queue.push(norm);
  };

  for (const seed of ['index.html', '404.html', 'sw.js', 'manifest.webmanifest']) enqueue(seed);

  while (queue.length) {
    const rel = queue.shift();
    if (!/\.(html|js|css|webmanifest|json)$/.test(rel)) continue;
    let text = '';
    try {
      const stat = fs.statSync(path.join(dir, rel));
      if (!stat.isFile() || stat.size > 8_000_000) continue;
      text = fs.readFileSync(path.join(dir, rel), 'utf8');
    } catch {
      continue;
    }
    for (const ref of staticRefsIn(text, rel)) enqueue(ref);
  }
  return reachable;
}

/** Drop `_next/static` files the portal shell never loads (console weight). */
export function pruneUnreachableStatic(dir) {
  const reachable = collectReachableStatic(dir);
  const staticRoot = path.join(dir, '_next', 'static');
  const removed = [];
  if (!exists(staticRoot)) return {removed, reachable};

  const walk = current => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      const rel = path.relative(dir, abs).split(path.sep).join('/');
      if (reachable.has(rel)) continue;
      const size = fs.statSync(abs).size;
      fs.rmSync(abs);
      removed.push({rel, size});
    }
  };
  walk(staticRoot);

  const emptyDirs = [];
  const sweep = current => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const abs = path.join(current, entry.name);
      sweep(abs);
      if (!fs.readdirSync(abs).length) emptyDirs.push(abs);
    }
  };
  sweep(staticRoot);
  for (const abs of emptyDirs) fs.rmSync(abs, {recursive: true, force: true});
  return {removed, reachable};
}

function assertHtmlReferencesExist(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(match =>
    normalizeRel(match[1])
  );
  const missing = refs.filter(rel => rel && !exists(path.join(dir, rel)));
  if (missing.length) {
    throw new Error(`Hosting HTML references missing files: ${missing.join(', ')}`);
  }
}

async function main() {
  console.log('--- Preparing Firebase Hosting bundle (farm client portal only) ---');
  await ensureVinextBuild();
  // Prerender portal route so the static shell matches client intent.
  const html = await prerenderIndexHtml();
  copyClientAssets();
  const indexPath = writeHtml(html);
  const {removed, reachable} = pruneUnreachableStatic(outDir);
  assertPortalAssets();
  assertHtmlReferencesExist(outDir);
  const workspaceLeft = [...reachable].filter(rel =>
    /(?:^|\/)(?:workspace|technician-shell)[^/]*\.(?:js|css)$/.test(rel)
  );
  if (workspaceLeft.length) {
    throw new Error(
      `Portal Hosting bundle still reaches console chunks: ${workspaceLeft.join(', ')}`
    );
  }

  const prunedKb = Math.round(removed.reduce((sum, item) => sum + item.size, 0) / 1024);
  if (removed.length) {
    console.log(`Pruned ${removed.length} unreachable static files (${prunedKb} KB)`);
    for (const item of removed.slice(0, 24)) {
      console.log(`   - ${item.rel} (${Math.round(item.size / 1024)} KB)`);
    }
    if (removed.length > 24) console.log(`   - … ${removed.length - 24} more`);
  }

  const sizeKb = Math.round(fs.statSync(indexPath).size / 1024);
  console.log(`✅ Firebase Hosting public dir ready: dist/firebase-hosting/ (index.html ${sizeKb} KB)`);
  console.log('   Portal-only URL: https://gen-lang-client-0175464290.web.app/');
  console.log('   Optional path alias: /finca');
  console.log('   Invitation example: https://gen-lang-client-0175464290.web.app/?invitation=TOKEN');
  console.log('   Deploy: npm run deploy:firebase   # requires firebase login / CI token');
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .then(() => {
      // Force-exit in case vinext left open handles after SIGTERM.
      setTimeout(() => process.exit(0), 300).unref?.();
    })
    .catch(error => {
      console.error('prepare-firebase-hosting failed:', error instanceof Error ? error.message : error);
      setTimeout(() => process.exit(1), 300).unref?.();
    });
}
