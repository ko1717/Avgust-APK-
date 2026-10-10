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
  const url = `http://${host}:${port}/?portal=finca`;
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

/** Inject early redirect so `/` and deep links always advertise portal=finca. */
function injectPortalLock(html) {
  const lockScript = `<script>(function(){try{var h=location.hostname.toLowerCase();if(h!=='gen-lang-client-0175464290.web.app'&&h!=='gen-lang-client-0175464290.firebaseapp.com')return;var u=new URL(location.href);if(u.searchParams.get('portal')==='finca')return;u.searchParams.set('portal','finca');location.replace(u.pathname+u.search+u.hash);}catch(e){}})();</script>`;
  if (html.includes('<!-- firebase-portal-lock -->')) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1><!-- firebase-portal-lock -->${lockScript}`);
  }
  return `<!-- firebase-portal-lock -->${lockScript}${html}`;
}

function writeHtml(html) {
  const locked = injectPortalLock(html);
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

async function main() {
  console.log('--- Preparing Firebase Hosting bundle (farm client portal only) ---');
  await ensureVinextBuild();
  // Prerender portal route so the static shell matches client intent.
  const html = await prerenderIndexHtml();
  copyClientAssets();
  const indexPath = writeHtml(html);
  assertPortalAssets();

  const sizeKb = Math.round(fs.statSync(indexPath).size / 1024);
  console.log(`✅ Firebase Hosting public dir ready: dist/firebase-hosting/ (index.html ${sizeKb} KB)`);
  console.log('   Portal-only URL: https://gen-lang-client-0175464290.web.app/');
  console.log('   Deploy: npm run deploy:firebase   # requires firebase login / CI token');
}

main()
  .then(() => {
    // Force-exit in case vinext left open handles after SIGTERM.
    setTimeout(() => process.exit(0), 300).unref?.();
  })
  .catch(error => {
    console.error('prepare-firebase-hosting failed:', error instanceof Error ? error.message : error);
    setTimeout(() => process.exit(1), 300).unref?.();
  });
