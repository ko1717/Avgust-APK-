#!/usr/bin/env node
/**
 * Local readiness checks for the CARE360 farm portal on Firebase
 * (project gen-lang-client-0175464290). Catches config drift before deploy —
 * missing appId, wrong .firebaserc default, rules without portalListOk, etc.
 *
 * Usage: npm run verify:firebase-portal
 * Exit 0 = ready; non-zero = gaps that would break portal hosting/auth/rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_PROJECT = 'gen-lang-client-0175464290';
const EXPECTED_FIRESTORE_DB =
  'ai-studio-avgustapk-f7ec9dbe-9fd2-41ac-9388-c71e7384bb8a';

/** @type {{ ok: string[]; fail: string[] }} */
const results = {ok: [], fail: []};

function pass(msg) {
  results.ok.push(msg);
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  results.fail.push(msg);
  console.error(`  ✗ ${msg}`);
}

function readJson(relPath) {
  const full = path.join(rootDir, relPath);
  if (!fs.existsSync(full)) {
    fail(`${relPath} missing`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    fail(`${relPath} is not valid JSON: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function readText(relPath) {
  const full = path.join(rootDir, relPath);
  if (!fs.existsSync(full)) {
    fail(`${relPath} missing`);
    return null;
  }
  return fs.readFileSync(full, 'utf8');
}

function assertTruthyString(obj, key, label) {
  const value = obj?.[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    pass(`${label}: ${key} present`);
    return true;
  }
  fail(`${label}: missing or empty required field "${key}"`);
  return false;
}

console.log(`\nverify-firebase-portal — project ${EXPECTED_PROJECT}\n`);

// ── firebase-applet-config.json ──────────────────────────────────────────
console.log('firebase-applet-config.json');
const applet = readJson('firebase-applet-config.json');
if (applet) {
  const required = [
    'projectId',
    'appId',
    'apiKey',
    'authDomain',
    'storageBucket',
    'messagingSenderId',
    'firestoreDatabaseId'
  ];
  for (const key of required) {
    assertTruthyString(applet, key, 'applet config');
  }
  if (applet.projectId === EXPECTED_PROJECT) {
    pass(`applet config: projectId is ${EXPECTED_PROJECT}`);
  } else {
    fail(`applet config: projectId is "${applet.projectId}", expected "${EXPECTED_PROJECT}"`);
  }
  if (typeof applet.appId === 'string' && applet.appId.includes(':web:')) {
    pass('applet config: appId looks like a web app id');
  } else if (applet.appId) {
    fail(`applet config: appId "${applet.appId}" does not look like a Firebase web appId`);
  }
  if (
    typeof applet.authDomain === 'string' &&
    applet.authDomain.includes(EXPECTED_PROJECT)
  ) {
    pass('applet config: authDomain matches project');
  } else if (applet.authDomain) {
    fail(`applet config: authDomain "${applet.authDomain}" does not mention ${EXPECTED_PROJECT}`);
  }
  if (applet.firestoreDatabaseId === EXPECTED_FIRESTORE_DB) {
    pass(`applet config: firestoreDatabaseId is named AI Studio DB`);
  } else {
    fail(
      `applet config: firestoreDatabaseId is "${applet.firestoreDatabaseId}", expected "${EXPECTED_FIRESTORE_DB}"`
    );
  }
  if (typeof applet.measurementId === 'string' && applet.measurementId.trim()) {
    pass('applet config: measurementId present (optional Analytics)');
  } else {
    pass('applet config: measurementId empty (Analytics optional)');
  }
}

// ── .firebaserc ──────────────────────────────────────────────────────────
console.log('\n.firebaserc');
const rc = readJson('.firebaserc');
if (rc) {
  const def = rc.projects?.default;
  if (def === EXPECTED_PROJECT) {
    pass(`.firebaserc default project is ${EXPECTED_PROJECT}`);
  } else {
    fail(`.firebaserc default is "${def ?? '(unset)'}", expected "${EXPECTED_PROJECT}"`);
  }
}

// ── firebase.json hosting ────────────────────────────────────────────────
console.log('\nfirebase.json');
const firebaseJson = readJson('firebase.json');
if (firebaseJson) {
  const publicDir = firebaseJson.hosting?.public;
  if (publicDir === 'dist/firebase-hosting') {
    pass('hosting.public is dist/firebase-hosting');
  } else {
    fail(`hosting.public is "${publicDir ?? '(unset)'}", expected "dist/firebase-hosting"`);
  }
  const rulesPath = firebaseJson.firestore?.rules;
  if (rulesPath === 'firestore.rules') {
    pass('firestore.rules path configured');
  } else {
    fail(`firestore.rules is "${rulesPath ?? '(unset)'}", expected "firestore.rules"`);
  }
  const dbId = firebaseJson.firestore?.database;
  if (dbId === EXPECTED_FIRESTORE_DB) {
    pass(`firestore.database is named AI Studio DB`);
  } else {
    fail(`firestore.database is "${dbId ?? '(unset)'}", expected "${EXPECTED_FIRESTORE_DB}"`);
  }
  const rewrite = (firebaseJson.hosting?.rewrites || []).some(
    r => r.source === '**' && r.destination === '/index.html'
  );
  if (rewrite) {
    pass('SPA rewrite ** → /index.html present');
  } else {
    fail('missing SPA rewrite ** → /index.html (portal deep links would 404)');
  }
}

// ── firestore.rules portal surface ───────────────────────────────────────
console.log('\nfirestore.rules');
const rules = readText('firestore.rules');
if (rules) {
  for (const collection of ['invitations', 'visits', 'reports', 'assuranceRequests']) {
    if (rules.includes(`match /${collection}/{`)) {
      pass(`rules cover /${collection}/{…}`);
    } else {
      fail(`rules missing match /${collection}/{…}`);
    }
  }
  if (rules.includes('portalListOk')) {
    pass('rules define portalListOk (bounded public list for invitation flow)');
  } else {
    fail('rules missing portalListOk — portal invitation-code list may break without Anonymous Auth');
  }
  if (rules.includes('isSignedIn()') || rules.includes('request.auth')) {
    pass('rules reference auth for signed-in paths');
  } else {
    fail('rules do not reference auth');
  }
}

// ── prepare / build scripts ──────────────────────────────────────────────
console.log('\nhosting prepare scripts');
for (const rel of ['scripts/prepare-firebase-hosting.mjs', 'scripts/build-firebase.mjs']) {
  if (fs.existsSync(path.join(rootDir, rel))) {
    pass(`${rel} exists`);
  } else {
    fail(`${rel} missing`);
  }
}

const pkg = readJson('package.json');
if (pkg) {
  for (const scriptName of ['build:firebase', 'deploy:firebase', 'deploy:portal']) {
    if (pkg.scripts?.[scriptName]) {
      pass(`package.json scripts.${scriptName} present`);
    } else {
      fail(`package.json missing scripts.${scriptName}`);
    }
  }
  if (typeof pkg.scripts?.['deploy:portal'] === 'string' &&
      pkg.scripts['deploy:portal'].includes(EXPECTED_PROJECT)) {
    pass('package.json deploy:portal targets expected project');
  } else {
    fail(`package.json deploy:portal does not target ${EXPECTED_PROJECT}`);
  }
}

// ── client wiring ────────────────────────────────────────────────────────
console.log('\nclient wiring');
const firebaseTs = readText('lib/firebase.ts');
if (firebaseTs) {
  if (firebaseTs.includes('firebase-applet-config.json')) {
    pass('lib/firebase.ts imports firebase-applet-config.json');
  } else {
    fail('lib/firebase.ts does not import firebase-applet-config.json');
  }
  if (firebaseTs.includes('ensurePortalAuth')) {
    pass('lib/firebase.ts exports ensurePortalAuth');
  } else {
    fail('lib/firebase.ts missing ensurePortalAuth');
  }
  if (firebaseTs.includes("'visits'") || firebaseTs.includes('"visits"')) {
    pass('lib/firebase.ts uses visits collection');
  } else {
    fail('lib/firebase.ts does not reference visits collection');
  }
  if (firebaseTs.includes("'reports'") || firebaseTs.includes('"reports"')) {
    pass('lib/firebase.ts uses reports collection');
  } else {
    fail('lib/firebase.ts does not reference reports collection');
  }
  if (firebaseTs.includes('createAssuranceRequest')) {
    pass('lib/firebase.ts exports createAssuranceRequest');
  } else {
    fail('lib/firebase.ts missing createAssuranceRequest');
  }
}

const hostingPortalTs = readText('lib/hosting-portal.ts');
if (hostingPortalTs) {
  if (hostingPortalTs.includes(EXPECTED_PROJECT) && hostingPortalTs.includes('HOSTING_PORTAL_ONLY')) {
    pass('lib/hosting-portal.ts locks Hosting to portal-only');
  } else {
    fail('lib/hosting-portal.ts missing Hosting portal-only lock');
  }
} else {
  fail('lib/hosting-portal.ts missing');
}

const pageTsx = readText('app/page.tsx');
if (pageTsx) {
  if (pageTsx.includes('FarmPortalHost') && pageTsx.includes('isHostingPortalOnlyBuild')) {
    pass('app/page.tsx mounts FarmPortalHost for Hosting builds');
  } else {
    fail('app/page.tsx does not gate Hosting to FarmPortalHost');
  }
}

const buildFirebase = readText('scripts/build-firebase.mjs');
if (buildFirebase) {
  if (buildFirebase.includes('NEXT_PUBLIC_HOSTING_PORTAL_ONLY')) {
    pass('build:firebase sets NEXT_PUBLIC_HOSTING_PORTAL_ONLY');
  } else {
    fail('build:firebase missing NEXT_PUBLIC_HOSTING_PORTAL_ONLY');
  }
}

const invitationsTs = readText('lib/invitations.ts');
if (invitationsTs) {
  if (invitationsTs.includes("'invitations'") || invitationsTs.includes('"invitations"')) {
    pass('lib/invitations.ts uses invitations collection');
  } else {
    fail('lib/invitations.ts does not reference invitations collection');
  }
}

const portalOriginTs = readText('lib/portal-origin.ts');
if (portalOriginTs) {
  if (portalOriginTs.includes(`https://${EXPECTED_PROJECT}.web.app`)) {
    pass('lib/portal-origin.ts default origin matches Hosting URL');
  } else {
    fail(`lib/portal-origin.ts default origin missing https://${EXPECTED_PROJECT}.web.app`);
  }
  if (/\breturn origin\b/.test(portalOriginTs)) {
    fail('lib/portal-origin.ts returns the window origin; links must stay on Hosting');
  } else {
    pass('lib/portal-origin.ts does not return the window origin');
  }
}

if (rules && rules.includes('isPortalInvitationCode')) {
  pass('rules accept ASEG-#### and legacy MIPE-#### invitation codes');
} else if (rules) {
  fail('rules missing isPortalInvitationCode (ASEG/MIPE format)');
}

if (firebaseTs && firebaseTs.includes('stableVisitId') && firebaseTs.includes('publishFailureMessage') && firebaseTs.includes('farmKey')) {
  pass('lib/firebase.ts publishes with a stable id, farmKey, and Spanish failure text');
} else if (firebaseTs) {
  fail('lib/firebase.ts missing stable visit id, farmKey, or Spanish publish errors');
}

// ── Cursor MCP (agent → live project after login) ────────────────────────
console.log('\nCursor Firebase MCP');
const mcp = readJson('.cursor/mcp.json');
if (mcp) {
  const firebaseMcp = mcp.mcpServers?.firebase;
  if (
    firebaseMcp?.command === 'npx' &&
    Array.isArray(firebaseMcp.args) &&
    firebaseMcp.args.includes('mcp')
  ) {
    pass('.cursor/mcp.json registers firebase MCP (npx firebase-tools mcp)');
  } else {
    fail('.cursor/mcp.json missing firebase MCP server entry');
  }
}

// ── summary ──────────────────────────────────────────────────────────────
const passed = results.ok.length;
const failed = results.fail.length;
console.log(`\n── summary: ${passed} passed, ${failed} failed ──`);
if (failed > 0) {
  console.error('\nPortal Firebase config is NOT ready. Fix the gaps above before deploy.\n');
  process.exit(1);
}
console.log(`\nPortal Firebase config looks ready for ${EXPECTED_PROJECT}.\n`);
process.exit(0);
