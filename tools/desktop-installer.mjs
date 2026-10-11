/**
 * Windows NSIS installer (falls back to the portable exe).
 * Works on Windows and on Linux/macOS. electron-builder downloads the
 * Windows Electron and NSIS. Off Windows, NSIS runs the uninstaller step
 * with system Wine when `wine` is on PATH.
 *
 *   node tools/desktop-installer.mjs
 *
 * Run `npm run desktop:build` first (npm run desktop:installer does both).
 */
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release');
const builder = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

// Windows antivirus that inspects HTTPS breaks the NSIS download unless Node
// uses the system certificate store. Some Node wrappers reject that flag in
// NODE_OPTIONS; only set it when this binary accepts it.
const withSystemCa = [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' ');
const caProbe = spawnSync(process.execPath, ['-e', 'process.exit(0)'], {
  env: {...process.env, NODE_OPTIONS: withSystemCa},
  encoding: 'utf8'
});
if (caProbe.status === 0) process.env.NODE_OPTIONS = withSystemCa;

function run(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [builder, ...args], {
      cwd: root,
      stdio: 'inherit',
      env: process.env
    });
    child.on('exit', code => resolve(code ?? 1));
  });
}

function releaseExes() {
  if (!fs.existsSync(releaseDir)) return [];
  return fs.readdirSync(releaseDir)
    .filter(name => name.endsWith('.exe') && !name.includes('__uninstaller'))
    .map(name => {
      const full = path.join(releaseDir, name);
      const stat = fs.statSync(full);
      return {full, mtime: stat.mtimeMs, size: stat.size};
    })
    .filter(file => file.size > 5 * 1024 * 1024)
    .sort((a, b) => b.mtime - a.mtime);
}

function publish(source) {
  const name = path.basename(source);
  const copies = [
    path.join(root, 'artifacts', name),
    path.join(root, 'dist', 'installers', name)
  ];
  for (const dest of copies) {
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(source, dest);
  }
  const mb = (fs.statSync(source).size / 1024 / 1024).toFixed(2);
  console.log(`Instalador listo: ${source} (${mb} MB)`);
  for (const dest of copies) console.log(`Copia: ${dest}`);
}

const winArgs = target => ['--projectDir', 'desktop', '--config', 'electron-builder.config.cjs', '--win', target, '--x64'];
let code = await run(winArgs('nsis'));
if (code !== 0) {
  console.log('NSIS no pudo terminar. Se genera el ejecutable portable.');
  code = await run(winArgs('portable'));
}
if (code !== 0) {
  console.error(`electron-builder terminó con código ${code}.`);
  process.exit(code);
}
const installers = releaseExes();
if (!installers.length) {
  console.error('electron-builder terminó sin escribir un .exe en release/.');
  process.exit(1);
}
for (const installer of installers) publish(installer.full);
