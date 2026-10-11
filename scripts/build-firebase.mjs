#!/usr/bin/env node
/**
 * Cross-platform Firebase Hosting build:
 *   vinext build (portal-only + portal origin) → stage dist/firebase-hosting
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portalOrigin =
  process.env.NEXT_PUBLIC_PORTAL_ORIGIN ||
  process.env.PUBLIC_PORTAL_ORIGIN ||
  'https://gen-lang-client-0175464290.web.app';

/** Public consult proxy URL. Empty keeps the Hosting button disabled. Never an API key. */
function consultaPublicUrl() {
  const raw = (process.env.NEXT_PUBLIC_CONSULTA_AVGUST_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  if (!/^https:\/\//.test(raw) || /AIza|GEMINI_API_KEY|GOOGLE_API_KEY|AQ\./.test(raw)) {
    throw new Error(
      'NEXT_PUBLIC_CONSULTA_AVGUST_URL must be an https endpoint. Do not put the Gemini key in it.'
    );
  }
  return raw;
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_PUBLIC_PORTAL_ORIGIN: portalOrigin,
        NEXT_PUBLIC_HOSTING_PORTAL_ONLY: '1',
        ...extraEnv
      },
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  const consultaUrl = consultaPublicUrl();
  const consultaEnv = consultaUrl ? {NEXT_PUBLIC_CONSULTA_AVGUST_URL: consultaUrl} : {};
  console.log(
    `build:firebase — NEXT_PUBLIC_PORTAL_ORIGIN=${portalOrigin} HOSTING_PORTAL_ONLY=1 CONSULTA_URL=${consultaUrl || '(unset, button stays off)'}`
  );
  await run('npx', ['vinext', 'build'], consultaEnv);
  await run('node', ['scripts/prepare-firebase-hosting.mjs'], consultaEnv);
}

main().catch(error => {
  console.error('build:firebase failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
