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

const {blankAction, blankVisit} = await loadModule('lib/model.ts');
const {filterRecordsByRange, seriesStats, seriesToCsv, toTrendPoints} = await loadModule('lib/trend-series.ts');

function visitWithFindings(id, date, closures) {
  const visit = blankVisit();
  visit.id = id;
  visit.date = date;
  visit.farm = 'Inverpalmas';
  visit.chapters = [1];
  visit.reviewed = true;
  visit.responsible = 'Equipo AVGUST';
  visit.answers = {};
  visit.actions = {};
  closures.forEach((status, index) => {
    const itemId = `1.${index + 1}`;
    visit.answers[itemId] = {value: 'NO', observation: 'Hallazgo', recommendation: 'Corregir'};
    visit.actions[itemId] = {...blankAction(), status};
  });
  return visit;
}

function record(id, date, score, closures) {
  return {
    visit: visitWithFindings(id, date, closures),
    score,
    status: score >= 95 ? 'healthy' : score >= 80 ? 'acceptable' : 'critical',
    applicable: closures.length,
    positive: 0,
    findings: closures.length,
    date,
    responsible: 'Equipo AVGUST',
    weightedScore: score,
    pointsEarned: score,
    criteriaCompliance: score,
    weightedCoveragePct: 5,
    evaluatedChapters: 1
  };
}

const history = [
  record('a', '2025-11-02', 80, ['closed']),
  record('b', '2026-09-20', 84, ['pending']),
  record('c', '2026-10-01', 84, ['closed', 'progress', 'cancelled'])
];

test('rolling ranges count back from the latest reading and leave gaps empty', () => {
  assert.deepEqual(
    filterRecordsByRange(history, '7d').map(item => item.date),
    ['2026-10-01']
  );
  assert.deepEqual(
    filterRecordsByRange(history, '30d').map(item => item.date),
    ['2026-09-20', '2026-10-01']
  );
  assert.deepEqual(
    filterRecordsByRange(history, 'year').map(item => item.date),
    ['2026-09-20', '2026-10-01']
  );
  assert.deepEqual(
    filterRecordsByRange(history, '12m').map(item => item.visit.id),
    ['a', 'b', 'c']
  );
  assert.deepEqual(filterRecordsByRange([], '30d'), []);
});

test('series stats are derived from stored scores and action status', () => {
  const stats = seriesStats(history);
  assert.equal(stats.count, 3);
  assert.equal(stats.min, 80);
  assert.equal(stats.max, 84);
  assert.equal(stats.average, 82.7);
  assert.equal(stats.spanDelta, 4);
  assert.deepEqual(stats.closures, {open: 1, closed: 1, cancelled: 1});
  assert.equal(seriesStats([]).average, null);
});

test('chart points keep one key per visit and do not invent scores', () => {
  const points = toTrendPoints(filterRecordsByRange(history, '30d'));
  assert.deepEqual(
    points.map(point => [point.chartKey, point.score, point.isLatest]),
    [
      ['2026-09-20|b', 84, false],
      ['2026-10-01|c', 84, true]
    ]
  );
});

test('csv exports the stored readings with a spreadsheet separator', () => {
  const csv = seriesToCsv([history[2]]);
  assert.match(csv, /^\uFEFFfecha;indice_oficial;estado;hallazgos/);
  assert.match(csv, /2026-10-01;84;Alerta;3;3;Equipo AVGUST/);
});
