#!/usr/bin/env node
/**
 * Genera CSV importables (Fincas → Importar finca e informes) a partir de
 * tools/metrics-demo-4-informes/visits.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../metrics-demo-4-informes/visits.json'), 'utf8')
);

const HEADER = [
  'finca',
  'fecha',
  'capitulo',
  'item',
  'respuesta',
  'responsable avgust',
  'hallazgo observacion',
  'recomendacion',
];

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function answerLabel(value) {
  if (value === 'SI') return 'Sí cumple';
  if (value === 'NO') return 'No cumple';
  if (value === 'NA') return 'No aplica';
  return value;
}

function rowsForVisit(visit) {
  const rows = [];
  for (const [item, value] of Object.entries(visit.answers)) {
    const chapter = Number(String(item).split('.')[0]);
    const isNo = value === 'NO';
    rows.push([
      DATA.farm,
      visit.date,
      chapter,
      item,
      answerLabel(value),
      visit.responsible,
      isNo
        ? `Hallazgo en criterio ${item}: incumplimiento observado en campo durante la visita.`
        : '',
      isNo
        ? `Corregir el incumplimiento de ${item}. Verificar evidencia, EPP y registro antes de la siguiente visita de acompañamiento.`
        : '',
    ]);
  }
  return rows;
}

function writeCsv(filePath, rows) {
  const lines = [HEADER.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  console.log('Wrote', filePath, `(${rows.length} filas)`);
}

const allRows = [];
for (const visit of DATA.visits) {
  const rows = rowsForVisit(visit);
  allRows.push(...rows);
  const safeDate = visit.date;
  const safeFarm = 'finca-san-isidro';
  writeCsv(path.join(__dirname, `${safeDate}_${safeFarm}.csv`), rows);
}

writeCsv(path.join(__dirname, 'finca-san-isidro_4-informes.csv'), allRows);
console.log('OK', DATA.visits.length, 'informes → CSV listos en', __dirname);
