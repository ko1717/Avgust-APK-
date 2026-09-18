#!/usr/bin/env node
/**
 * Genera CSV importables (Fincas → Importar finca e informes) a partir de
 * tools/demo/metrics/visits.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'metrics/visits.json'), 'utf8')
);

// Must match enhance/src/care360-import.js CHAPTER_ITEMS
const CHAPTER_ITEMS = {
  1: ['1.1', '1.2', '1.3', '1.4'],
  2: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'],
  3: ['3.1', '3.2', '3.3', '3.4'],
  4: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10'],
  5: ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9', '5.10', '5.11'],
};
const ALL_ITEMS = Object.values(CHAPTER_ITEMS).flat();

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
  // Full matrix: seed answers + NA for the rest (avoids import warnings; NA no cuenta en el %).
  for (const item of ALL_ITEMS) {
    const value = visit.answers[item] || 'NA';
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
