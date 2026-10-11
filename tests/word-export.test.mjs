import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const bundleDir = path.join(root, 'work', 'word-export');
mkdirSync(bundleDir, {recursive: true});
await build({
  entryPoints: [
    'lib/word-design.ts',
    'lib/model.ts',
    'lib/export-word.ts',
    'lib/export-metrics-word.ts',
    'lib/export-consolidated-word.ts',
    'lib/metric-analysis.ts'
  ],
  absWorkingDir: root,
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: bundleDir,
  packages: 'external'
});

async function loadModule(name) {
  return import(pathToFileURL(path.join(bundleDir, name)).href);
}

function unzip(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], {encoding: 'utf8'});
}

function xmlText(xml) {
  return xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const {cleanWordText, formatPercent, safeWordFilePart} = await loadModule('word-design.js');
const {blankVisit, catalog} = await loadModule('model.js');
const {exportWord} = await loadModule('export-word.js');
const {exportFarmMetricsWord} = await loadModule('export-metrics-word.js');
const {exportConsolidatedWord} = await loadModule('export-consolidated-word.js');
const {farmMetricHistory, consolidatedMetricAnalysis} = await loadModule('metric-analysis.js');

test('cleanWordText strips markdown markers and keeps the words', () => {
  assert.equal(cleanWordText('Revisar **boquillas** y presión'), 'Revisar boquillas y presión');
  assert.equal(cleanWordText('Texto con `código` y [enlace](https://x.test)'), 'Texto con código y enlace');
  assert.equal(cleanWordText('## Título\nsegunda línea'), 'Título segunda línea');
  assert.equal(formatPercent(92.5), '92.5%');
  assert.equal(formatPercent(100), '100%');
  assert.equal(formatPercent(null), 'Sin medición');
  assert.equal(safeWordFilePart('Finca <El> Rosal/Norte'), 'Finca El Rosal Norte');
});

test('visit, evolution and consolidated Word documents keep a professional structure', async () => {
  const downloads = [];
  globalThis.document = {
    createElement() {
      return {click() {}, set href(_value) {}, set download(value) { downloads.at(-1).name = value; }};
    }
  };
  globalThis.URL.createObjectURL = blob => {
    downloads.push({blob, name: ''});
    return 'blob:test';
  };
  globalThis.URL.revokeObjectURL = () => {};

  const visit = blankVisit();
  Object.assign(visit, {
    farm: 'Finca El Rosal',
    date: '2026-04-02',
    city: 'Madrid',
    zone: 'Cundinamarca',
    technician: 'Ana Ruiz',
    responsible: 'Wilson Castro',
    rtc: 'Laura Gómez',
    chapters: [4],
    reviewed: true,
    delivery: '2026-04-09',
    followup: '2026-05-02',
    conclusion: 'Cerrar el hallazgo de **calidad del agua** antes del seguimiento.',
    notes: {4: 'El tanque quedó **pendiente** de aforo.'},
    recommendations: {4: 'Repetir la medición de pH.'},
    measurements: {ph: '6.20', hardness: '70', conductivity: '0.35', pressure: '30'},
    answers: Object.fromEntries(catalog[3].items.map(item => [item.id, {
      value: item.id === '4.6' ? 'NO' : 'SI',
      observation: item.id === '4.6' ? 'Dureza **por encima** del estándar.' : '',
      recommendation: item.id === '4.6' ? 'Instalar **suavizador** y verificar pH.' : ''
    }])),
    actions: {
      '4.6': {owner: 'Jefe de aplicación', due: '2026-04-20', status: 'progress', closure: 'En seguimiento', beforePhotoId: '', photoId: ''}
    }
  });

  await exportWord(visit);
  const history = farmMetricHistory([visit], visit.farm);
  await exportFarmMetricsWord(history);
  const consolidated = consolidatedMetricAnalysis([visit]);
  await exportConsolidatedWord(consolidated, 'Abril 2026');

  assert.deepEqual(downloads.map(item => item.name), [
    'AVGUST CARE 360 - Informe de visita - Finca El Rosal - 2026-04-02.docx',
    'AVGUST CARE 360 - Informe de evolución - Finca El Rosal - 2026-04-02.docx',
    'AVGUST CARE 360 - Informe consolidado - Abril 2026.docx'
  ]);

  const dir = mkdtempSync(path.join(tmpdir(), 'word-export-'));
  const expectations = [
    {
      file: path.join(dir, 'visita.docx'),
      header: /INFORME DE VISITA/,
      required: [
        'Aseguramiento Aptus',
        'AVGUST',
        'CARE 360',
        'Finca El Rosal',
        '4. Preparación de mezclas',
        'Es probable que se manejen por debajo de este estandar',
        'HALLAZGO',
        'RECOMENDACIÓN',
        'Conductividad del agua',
        '0.35',
        'Revisado por el responsable técnico',
        'Wilson Castro',
        'Ana Ruiz',
        'Laura Gómez',
        'Indicador'
      ]
    },
    {
      file: path.join(dir, 'evolucion.docx'),
      header: /EVOLUCIÓN POR FINCA/,
      required: ['Aseguramiento Aptus', 'Finca El Rosal', 'HALLAZGO', 'RECOMENDACIÓN', 'Indicador']
    },
    {
      file: path.join(dir, 'consolidado.docx'),
      header: /CONSOLIDADO DE ASEGURAMIENTOS/,
      required: ['Aseguramiento Aptus', 'HALLAZGO', 'ACCIÓN RECOMENDADA', 'Finca El Rosal', 'Indicador']
    }
  ];

  for (const [index, expected] of expectations.entries()) {
    const bytes = Buffer.from(await downloads[index].blob.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    writeFileSync(expected.file, bytes);
    const documentXml = unzip(expected.file, 'word/document.xml');
    const headerXml = unzip(expected.file, 'word/header1.xml');
    const footerXml = unzip(expected.file, 'word/footer1.xml');
    const text = xmlText(documentXml);
    assert.doesNotMatch(documentXml, /\*\*/);
    assert.doesNotMatch(text, /Programa de aseguramiento del proceso MIPE/);
    assert.match(text, /\d+(?:[.,]\d+)?%/);
    for (const phrase of expected.required) assert.match(text, new RegExp(phrase));
    assert.match(headerXml, /AVGUST/);
    assert.match(headerXml, expected.header);
    assert.match(headerXml, /263E4A|00A9CE/);
    assert.match(footerXml, /Aseguramiento Aptus/);
    assert.match(footerXml, /Página /);
    assert.match(footerXml, / de /);
    assert.match(footerXml, /PAGE/);
    assert.match(documentXml, /CROP PROTECTION/);
    assert.doesNotMatch(documentXml, /AVGUSTCROP/);
  }

  const visitText = xmlText(unzip(expectations[0].file, 'word/document.xml'));
  assert.match(visitText, /por encima/);
  assert.match(visitText, /suavizador/);
  assert.match(visitText, /1 hallazgo por corregir/);
  assert.match(visitText, /1 respuesta “No”/);
  assert.doesNotMatch(visitText, /1 hallazgos|1 respuestas/);
  assert.doesNotMatch(visitText, /por encima\*\*|\*\*por encima/);
});
