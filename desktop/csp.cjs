/**
 * Content-Security-Policy shared by the Electron shell and the packaged UI
 * (Windows installer and Android WebView). Hosts come from the same applet
 * config the portal uses, so Publicar en línea reaches that Firebase project.
 *
 * Dev runs this file from desktop/, so the config is the repo-root
 * ../firebase-applet-config.json. The Windows package puts csp.cjs at the
 * asar root; that same ../ path then points at resources/ next to app.asar,
 * and the asar also contains a copy beside this file.
 */
const fs = require('node:fs');
const path = require('node:path');

function readAppletConfig() {
  const candidates = [
    path.join(__dirname, 'firebase-applet-config.json'),
    path.join(__dirname, '..', 'firebase-applet-config.json')
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const error = new Error("Cannot find module '../firebase-applet-config.json'");
  error.code = 'MODULE_NOT_FOUND';
  throw error;
}

const config = readAppletConfig();

const projectId = String(config.projectId || '');
const authDomain = String(config.authDomain || '');
const portalHost = `${projectId}.web.app`;
const portalOrigin = `https://${portalHost}`;

const connectHosts = [
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firebaseinstallations.googleapis.com',
  'https://firebase.googleapis.com',
  'https://firebasestorage.googleapis.com',
  'https://www.googleapis.com',
  'https://oauth2.googleapis.com',
  'https://accounts.google.com',
  'https://apis.google.com',
  authDomain ? `https://${authDomain}` : '',
  projectId ? portalOrigin : '',
  'https://*.googleapis.com',
  'wss://*.firebaseio.com'
].filter(Boolean);

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.googleusercontent.com https://*.gstatic.com",
  "font-src 'self'",
  `connect-src 'self' ${connectHosts.join(' ')}`,
  "object-src 'none'",
  "base-uri 'none'",
  `frame-src https://${authDomain} https://accounts.google.com https://apis.google.com https://*.google.com https://*.firebaseapp.com`
].join('; ');

function isExternalAuthUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname;
  return host === authDomain
    || host === 'accounts.google.com'
    || host === 'apis.google.com'
    || host.endsWith('.google.com')
    || host.endsWith('.gstatic.com')
    || host.endsWith('.googleusercontent.com')
    || host.endsWith('.firebaseapp.com');
}

module.exports = {CSP, portalOrigin, authDomain, projectId, isExternalAuthUrl};
