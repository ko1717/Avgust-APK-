/**
 * Windows NSIS config. On Windows, reuse the Electron already installed by npm
 * (avoids a second download behind TLS-inspecting antivirus). On Linux/macOS,
 * omit electronDist so electron-builder downloads the Windows binary for the
 * target instead of packing the host build.
 */
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const appletConfig = path.join(__dirname, '..', 'firebase-applet-config.json');

const config = {
  appId: 'co.avgust.care360.desktop',
  productName: 'AVGUST CARE 360',
  electronVersion: '44.3.0',
  directories: {output: '../release'},
  files: [
    'main.cjs',
    'preload.cjs',
    'store.cjs',
    'csp.cjs',
    'generated/**',
    'ui/**',
    'icon.ico',
    'package.json',
    // Copied into desktop/ by desktop/build.cjs so it lands at the asar root.
    'firebase-applet-config.json'
  ],
  // resources/firebase-applet-config.json, which is where
  // require('../firebase-applet-config.json') resolves once csp.cjs is at the asar root.
  extraResources: [
    {from: appletConfig, to: 'firebase-applet-config.json'}
  ],
  asar: true,
  npmRebuild: false,
  win: {
    target: [{target: 'nsis', arch: ['x64']}],
    icon: 'icon.ico',
    signAndEditExecutable: false
  },
  portable: {
    artifactName: 'AVGUST-CARE-360-${version}-Windows-x64-portable.${ext}'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'AVGUST CARE 360',
    deleteAppDataOnUninstall: false,
    runAfterFinish: false,
    artifactName: 'AVGUST-CARE-360-Instalador-${version}-Windows-x64.${ext}'
  }
};

const localDist = path.join(__dirname, '..', 'node_modules', 'electron', 'dist');
if (process.platform === 'win32' && fs.existsSync(path.join(localDist, 'electron.exe'))) {
  config.electronDist = path.join('..', 'node_modules', 'electron', 'dist');
} else if (process.platform !== 'win32') {
  // NSIS finishes the uninstaller by running the installer once. On Windows
  // that is native. Elsewhere, system Wine is used when it is installed.
  // The downloaded Wine 11 toolset is only a fallback: its Linux bundle does
  // not ship the PE builtins this host needs.
  const wine = spawnSync('wine', ['--version'], {stdio: 'ignore'});
  if (wine.status !== 0) config.toolsets = {wine: '1.0.1'};
}

module.exports = config;
