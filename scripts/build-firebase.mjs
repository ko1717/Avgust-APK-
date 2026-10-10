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
  console.log(
    `build:firebase — NEXT_PUBLIC_PORTAL_ORIGIN=${portalOrigin} HOSTING_PORTAL_ONLY=1`
  );
  await run('npx', ['vinext', 'build']);
  await run('node', ['scripts/prepare-firebase-hosting.mjs']);
}

main().catch(error => {
  console.error('build:firebase failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
