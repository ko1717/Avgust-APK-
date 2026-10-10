import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

async function loadModule(entry) {
  const result = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false
  });
  const code = Buffer.from(result.outputFiles[0].contents).toString('base64');
  return import(`data:text/javascript;base64,${code}`);
}

const {stripMarkdownLite, portalActionPresentation} = await loadModule('lib/portal-format.ts');

test('stripMarkdownLite removes bold markers and keeps text', () => {
  assert.equal(stripMarkdownLite('Revisar **boquillas** y presión'), 'Revisar boquillas y presión');
  assert.equal(
    stripMarkdownLite('Texto con `código` y [enlace](https://x.test)'),
    'Texto con código y enlace'
  );
  assert.equal(stripMarkdownLite(''), '');
  assert.equal(stripMarkdownLite(null), '');
});

test('portalActionPresentation uses clear Spanish fallbacks when data is thin', () => {
  const copy = portalActionPresentation({
    observation: '',
    recommendation: '**Ajustar** volumen',
    action: {owner: '', due: '', status: 'proposed'}
  });
  assert.match(copy.observation, /desviación/i);
  assert.equal(copy.recommendation, 'Ajustar volumen');
  assert.match(copy.owner, /Pendiente de asignar/i);
  assert.match(copy.due, /acordar/i);
  assert.match(copy.statusLabel, /formalizar/i);
  assert.equal(copy.thin, true);
});

test('portalActionPresentation keeps assigned action details', () => {
  const copy = portalActionPresentation({
    observation: 'Fuga en manguera',
    recommendation: 'Reemplazar tramo',
    action: {owner: 'Juan Pérez', due: '2026-10-20', status: 'progress'}
  });
  assert.equal(copy.observation, 'Fuga en manguera');
  assert.equal(copy.owner, 'Juan Pérez');
  assert.equal(copy.due, '2026-10-20');
  assert.equal(copy.statusLabel, 'En proceso');
  assert.equal(copy.thin, false);
});
