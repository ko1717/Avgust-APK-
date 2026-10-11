/**
 * Android SDK for `npm run android:apk`.
 * Linux/macOS: downloads command-line tools into .android-build (gitignored).
 * Windows: delegates to tools/android-toolchain.ps1 (JDK + SDK + TLS inspection).
 *
 * Needs JDK 17 or 21 already on PATH (this repo's builds use JDK 21).
 * Installs platforms;android-35 and build-tools;35.0.0.
 */
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, '.android-build');
const sdk = path.join(bundle, 'sdk');
const buildId = '16111833';
const urls = {
  linux: `https://dl.google.com/android/repository/commandlinetools-linux-${buildId}_latest.zip`,
  darwin: `https://dl.google.com/android/repository/commandlinetools-mac-${buildId}_latest.zip`,
  win32: `https://dl.google.com/android/repository/commandlinetools-win-${buildId}_latest.zip`
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.platform === 'win32') {
  const ps1 = path.join(root, 'tools', 'android-toolchain.ps1');
  const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    cwd: root,
    stdio: 'inherit'
  });
  child.on('exit', code => process.exit(code ?? 1));
} else {
  await installUnix();
}

function javaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) {
    return process.env.JAVA_HOME;
  }
  const java = spawnSync('java', ['-version'], {encoding: 'utf8'});
  if (java.status !== 0 && java.error) return '';
  try {
    const real = fs.realpathSync(spawnSync('bash', ['-lc', 'command -v java'], {encoding: 'utf8'}).stdout.trim());
    return path.resolve(path.dirname(real), '..');
  } catch {
    return '';
  }
}

function writeLocalProperties(sdkDir) {
  const props = path.join(root, 'android', 'local.properties');
  const sdkPath = sdkDir.replace(/\\/g, '/');
  fs.writeFileSync(props, `sdk.dir=${sdkPath}\n`, 'utf8');
  console.log(`android/local.properties → ${sdkPath}`);
}

async function installUnix() {
  const home = javaHome();
  if (!home) {
    fail([
      'No hay JDK. Instale JDK 21 y vuelva a ejecutar npm run android:toolchain.',
      'Ubuntu: sudo apt-get install -y openjdk-21-jdk',
      'Luego: export JAVA_HOME=$(dirname $(dirname $(readlink -f $(command -v java))))'
    ].join('\n'));
  }
  process.env.JAVA_HOME = home;
  console.log(`JDK: ${home}`);

  const sdkmanager = path.join(sdk, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');
  if (!fs.existsSync(sdkmanager)) {
    const url = urls[process.platform];
    if (!url) fail(`No hay command-line tools para ${process.platform}.`);
    fs.mkdirSync(bundle, {recursive: true});
    const zip = path.join(bundle, 'commandlinetools.zip');
    console.log(`Descargando command-line tools…\n${url}`);
    const response = await fetch(url);
    if (!response.ok) fail(`No se pudo descargar el SDK (${response.status}). URL: ${url}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(zip));
    const staging = path.join(bundle, 'sdk-staging');
    fs.rmSync(staging, {recursive: true, force: true});
    fs.mkdirSync(staging, {recursive: true});
    const unzip = spawnSync('unzip', ['-q', zip, '-d', staging], {stdio: 'inherit'});
    if (unzip.status !== 0) fail('unzip falló al extraer command-line tools.');
    fs.mkdirSync(path.join(sdk, 'cmdline-tools'), {recursive: true});
    const extracted = path.join(staging, 'cmdline-tools');
    if (!fs.existsSync(extracted)) fail('El zip del SDK no contiene cmdline-tools/.');
    fs.rmSync(path.join(sdk, 'cmdline-tools', 'latest'), {recursive: true, force: true});
    fs.renameSync(extracted, path.join(sdk, 'cmdline-tools', 'latest'));
    fs.rmSync(staging, {recursive: true, force: true});
    fs.rmSync(zip, {force: true});
  }

  const env = {...process.env, JAVA_HOME: home, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk};
  const licenses = spawnSync(sdkmanager, [`--sdk_root=${sdk}`, '--licenses'], {
    input: 'y\n'.repeat(80),
    encoding: 'utf8',
    env,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (licenses.status !== 0) fail('sdkmanager --licenses falló.');
  const packages = ['platform-tools', 'platforms;android-35', 'build-tools;35.0.0'];
  const install = spawnSync(sdkmanager, [`--sdk_root=${sdk}`, ...packages], {env, stdio: 'inherit'});
  if (install.status !== 0) fail('sdkmanager no instaló platform android-35 o build-tools 35.0.0.');
  if (!fs.existsSync(path.join(sdk, 'platforms', 'android-35'))) {
    fail('No se instaló platforms/android-35.');
  }
  writeLocalProperties(sdk);
  console.log(`Cadena de herramientas lista en ${bundle}. Construya con: npm run android:apk`);
}
