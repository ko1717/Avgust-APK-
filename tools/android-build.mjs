/**
 * Debug APK after `npm run desktop:build` and `cap sync android`.
 * Uses .android-build/sdk when present, otherwise JAVA_HOME and ANDROID_HOME.
 *
 *   node tools/android-build.mjs
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, '.android-build');
const androidDir = path.join(root, 'android');
const apkRel = path.join('app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function existingDir(dir) {
  return dir && fs.existsSync(dir) ? dir : '';
}

function javaBin(home) {
  const name = process.platform === 'win32' ? 'java.exe' : 'java';
  return path.join(home, 'bin', name);
}

const bundledJdk = existingDir(path.join(bundle, 'jdk'));
const bundledSdk = existingDir(path.join(bundle, 'sdk'));
let javaHome = '';
if (bundledJdk && fs.existsSync(javaBin(bundledJdk))) javaHome = bundledJdk;
else if (process.env.JAVA_HOME && fs.existsSync(javaBin(process.env.JAVA_HOME))) javaHome = process.env.JAVA_HOME;
else {
  const which = spawnSync('bash', ['-lc', 'command -v java'], {encoding: 'utf8'});
  if (which.status === 0 && which.stdout.trim()) {
    try {
      javaHome = path.resolve(path.dirname(fs.realpathSync(which.stdout.trim())), '..');
    } catch { /* system java missing */ }
  }
}
if (!javaHome || !fs.existsSync(javaBin(javaHome))) {
  fail([
    'No hay JDK. Ejecute: npm run android:toolchain',
    'o instale JDK 21 y defina JAVA_HOME.'
  ].join('\n'));
}

const sdk = bundledSdk
  || existingDir(process.env.ANDROID_HOME)
  || existingDir(process.env.ANDROID_SDK_ROOT);
if (!sdk || !fs.existsSync(path.join(sdk, 'platforms', 'android-35'))) {
  fail([
    'Falta el Android SDK (platform android-35).',
    'Ejecute: npm run android:toolchain',
    'Eso descarga cmdline-tools, platforms;android-35 y build-tools;35.0.0 en .android-build/.',
    'En el PC de Kevin también vale Android Studio con esas piezas y ANDROID_HOME apuntando al SDK.',
    'Luego: npm run android:apk'
  ].join('\n'));
}

const sdkPath = sdk.replace(/\\/g, '/');
fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${sdkPath}\n`, 'utf8');

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk
};
const command = process.platform === 'win32'
  ? {cmd: 'cmd', args: ['/c', 'gradlew.bat', 'assembleDebug']}
  : {cmd: 'bash', args: ['gradlew', 'assembleDebug']};
const build = spawnSync(command.cmd, command.args, {cwd: androidDir, env, stdio: 'inherit'});
if (build.status !== 0) fail(`Gradle terminó con código ${build.status ?? 1}.`);

const apk = path.join(androidDir, apkRel);
if (!fs.existsSync(apk)) fail(`Gradle no escribió ${apk}`);
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const named = `AVGUST-CARE-360-${version}-debug.apk`;
const copies = [
  path.join(root, 'artifacts', named),
  path.join(root, 'dist', 'installers', named)
];
for (const dest of copies) {
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(apk, dest);
}
const mb = (fs.statSync(apk).size / 1024 / 1024).toFixed(2);
console.log(`APK listo: ${apk} (${mb} MB)`);
for (const dest of copies) console.log(`Copia: ${dest}`);
