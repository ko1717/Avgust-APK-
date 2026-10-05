/**
 * Suite de Pruebas FASE 4 — Evolución Temporal, Delta y Benchmark de Fincas
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Valida los 10 Requisitos Obligatorios de la FASE 4:
 * 1. Una sola auditoría (Línea base, sin delta anterior)
 * 2. Dos auditorías (Delta exacto = Actual - Anterior)
 * 3. Mes sin auditoría (Sin datos, nunca inventa 0)
 * 4. Auditoría parcial (Punto diferenciado, cobertura visible)
 * 5. Finca sin datos ("Sin datos suficientes para comparación")
 * 6. Dos fincas comparables (Benchmark válido y clasificado)
 * 7. Finca completa vs parcial (Advertencia de comparabilidad de alcance)
 * 8. Empate en puntuación (Tratamiento limpio con etiqueta "Empate")
 * 9. Filtro por lote (Aislamiento estricto de lote)
 * 10. Filtro por periodo (Respeto estricto del rango de fechas)
 */

import assert from "node:assert/strict";
import fs from "node:fs";

// Load metrics code in isolated evaluation
const code = fs.readFileSync("enhance/src/care360-metrics.js", "utf8");

// Mock standard browser environment
const globalScope = {
  window: { addEventListener: () => {} },
  document: { readyState: "complete", getElementById: () => null, addEventListener: () => {}, body: {} },
  MutationObserver: class { observe() {} },
  fetch: () => Promise.resolve({ json: () => Promise.resolve([]) })
};

// Instrument to extract calculation engine and FASE 4 builders
const instrumented = code.replace(
  /\}\)\(\);?\s*$/,
  "; globalScope.engine = { calculateVisitScore, aggregateIntelligence, filterVisits, buildTrendViewModel, buildBenchmarkViewModel, renderTimelineChart, renderDeltaCard, renderFarmComparisonCard, renderBenchmarkTable }; })()"
);

const fn = new Function("globalScope", "window", "document", "MutationObserver", "fetch", instrumented);
fn(globalScope, globalScope.window, globalScope.document, globalScope.MutationObserver, globalScope.fetch);

const {
  calculateVisitScore,
  aggregateIntelligence,
  filterVisits,
  buildTrendViewModel,
  buildBenchmarkViewModel,
  renderTimelineChart,
  renderDeltaCard,
  renderFarmComparisonCard,
  renderBenchmarkTable
} = globalScope.engine;

console.log("=== INICIANDO VALIDACIÓN FORMAL DE FASE 4 (TREND & BENCHMARK) ===\n");

// Helper to make a full audit visit
function makeVisit(id, farm, date, lot, isFull, scoreSI) {
  const answers = {};
  const chapters = isFull ? [1, 2, 3, 4, 5] : [1, 3]; // Full has all 5, partial has 1 and 3 (10 pts total)
  
  if (isFull) {
    // Fill all chapters
    [1, 2, 3, 4, 5].forEach(ch => {
      answers[`${ch}.1`] = { value: scoreSI ? "SI" : "NO" };
    });
  } else {
    // Fill only ch 1 and 3
    [1, 3].forEach(ch => {
      answers[`${ch}.1`] = { value: scoreSI ? "SI" : "NO" };
    });
  }

  const v = {
    id: id,
    farm: farm,
    date: date,
    lot: lot || "Lote 1",
    crop: "Flores",
    chapters: chapters,
    answers: answers,
    reviewed: true
  };
  v.calc = calculateVisitScore(v);
  return v;
}

// -------------------------------------------------------------------------
// Test 1: Una sola auditoría
// -------------------------------------------------------------------------
console.log("Test 1: Una sola auditoría");
{
  const v1 = makeVisit("v1", "Finca Aurora", "2026-03-01", "Lote A", true, true);
  const trendVm = buildTrendViewModel([v1], { farm: "Finca Aurora", lot: "Lote A" }, calculateVisitScore);

  assert.equal(trendVm.count, 1, "Debe registrar exactamente 1 medición");
  assert.equal(trendVm.delta, null, "No debe existir delta numérico");
  assert.ok(trendVm.deltaText.includes("Línea base"), "Debe indicar que es Línea base");
  assert.equal(trendVm.isComparable, false, "No es comparable al no tener punto previo");

  const deltaHtml = renderDeltaCard(trendVm);
  assert.ok(deltaHtml.includes("Sin medición previa") || deltaHtml.includes("Línea base"), "Debe advertir que es la primera auditoría");
  console.log("   ✓ Test 1 superado: Una sola medición registrada como línea base sin delta previo.");
}

// -------------------------------------------------------------------------
// Test 2: Dos auditorías (Delta exacto = Actual - Anterior)
// -------------------------------------------------------------------------
console.log("\nTest 2: Dos auditorías consecutivas");
{
  const v1 = makeVisit("v1", "Finca Aurora", "2026-01-10", "Lote A", true, false); // 0.0 pts
  const v2 = makeVisit("v2", "Finca Aurora", "2026-02-15", "Lote A", true, true);  // 100.0 pts
  const trendVm = buildTrendViewModel([v1, v2], { farm: "Finca Aurora", lot: "Lote A" }, calculateVisitScore);

  assert.equal(trendVm.count, 2, "Debe registrar 2 mediciones");
  assert.equal(trendVm.currentPoint.officialScore, 100.0, "Score actual debe ser 100.0");
  assert.equal(trendVm.previousPoint.officialScore, 0.0, "Score anterior debe ser 0.0");
  assert.equal(trendVm.delta, 100.0, "Delta oficial debe ser exactamente +100.0 pts");
  assert.equal(trendVm.deltaDirection, "up", "Dirección debe ser 'up'");
  assert.ok(trendVm.deltaText.includes("+100.0 pts"), "Texto delta debe indicar +100.0 pts");
  console.log("   ✓ Test 2 superado: Delta calculado correctamente como Actual - Anterior (+100.0 pts).");
}

// -------------------------------------------------------------------------
// Test 3: Periodo sin auditoría (Sin datos, jamás 0)
// -------------------------------------------------------------------------
console.log("\nTest 3: Periodo sin auditorías");
{
  const trendVm = buildTrendViewModel([], { farm: "Finca Aurora" }, calculateVisitScore);
  assert.equal(trendVm.hasData, false, "hasData debe ser false");
  assert.equal(trendVm.count, 0, "count debe ser 0");

  const chartHtml = renderTimelineChart(trendVm);
  assert.ok(!chartHtml.includes("<circle"), "No debe dibujar círculos");
  assert.ok(chartHtml.includes("No hay mediciones registradas"), "Debe mostrar estado Sin datos amigable");
  console.log("   ✓ Test 3 superado: Ausencia de datos se muestra como 'Sin datos', nunca inventa ceros.");
}

// -------------------------------------------------------------------------
// Test 4: Auditoría parcial (Punto diferenciado y cobertura visible)
// -------------------------------------------------------------------------
console.log("\nTest 4: Auditoría parcial");
{
  const vPartial = makeVisit("v_part", "Finca Aurora", "2026-03-20", "Lote A", false, true); // Ch 1 + 3 = 10 pts
  const trendVm = buildTrendViewModel([vPartial], { farm: "Finca Aurora" }, calculateVisitScore);

  assert.equal(trendVm.series[0].isFullyEvaluated, false, "Debe ser clasificada como parcial");
  assert.equal(trendVm.series[0].officialScore, 10.0, "Puntos oficiales deben ser 10.0");
  assert.equal(trendVm.series[0].coveragePct, 10, "Cobertura debe ser 10% (5% + 5%)");

  const chartHtml = renderTimelineChart(trendVm);
  assert.ok(chartHtml.includes("point-partial"), "Debe tener clase SVG point-partial");
  assert.ok(chartHtml.includes("Auditoría parcial"), "Tooltip debe identificar Auditoría parcial");
  console.log("   ✓ Test 4 superado: Auditoría parcial diferenciada en SVG y tooltip con su cobertura real.");
}

// -------------------------------------------------------------------------
// Test 5: Finca sin datos suficientes
// -------------------------------------------------------------------------
console.log("\nTest 5: Finca sin auditorías en Benchmark");
{
  const visits = [makeVisit("v1", "Finca Activa", "2026-03-01", "Lote 1", true, true)];
  const benchmarkVm = buildBenchmarkViewModel(visits, {}, [], aggregateIntelligence, ["Finca Activa", "Finca Inactiva"]);

  assert.equal(benchmarkVm.insufficientFarms.length, 1, "Debe registrar 1 finca insuficiente");
  assert.equal(benchmarkVm.insufficientFarms[0].farm, "Finca Inactiva", "Finca inactiva identificada");

  const tableHtml = renderBenchmarkTable(benchmarkVm);
  assert.ok(tableHtml.includes("Sin datos suficientes para comparación"), "Debe contener mensaje explicativo sin calificarla en 0");
  console.log("   ✓ Test 5 superado: Finca sin auditorías tratada con mensaje de datos insuficientes sin penalización arbitraria.");
}

// -------------------------------------------------------------------------
// Test 6: Dos fincas comparables
// -------------------------------------------------------------------------
console.log("\nTest 6: Dos fincas comparables en Benchmark");
{
  const v1 = makeVisit("v1", "Finca A", "2026-03-01", "Lote 1", true, true);  // 100 pts
  const v2 = makeVisit("v2", "Finca B", "2026-03-01", "Lote 1", true, false); // 0 pts
  const benchmarkVm = buildBenchmarkViewModel([v1, v2], {}, [], aggregateIntelligence, ["Finca A", "Finca B"]);

  assert.equal(benchmarkVm.evaluatedFarms.length, 2, "2 fincas evaluadas");
  assert.equal(benchmarkVm.evaluatedFarms[0].farm, "Finca A", "Finca A debe ser #1 con 100 pts");
  assert.equal(benchmarkVm.evaluatedFarms[1].farm, "Finca B", "Finca B debe ser #2 con 0 pts");
  assert.equal(benchmarkVm.evaluatedFarms[0].rankNumber, 1);
  assert.equal(benchmarkVm.evaluatedFarms[1].rankNumber, 2);
  console.log("   ✓ Test 6 superado: Dos fincas comparables ordenadas correctamente por puntuación oficial.");
}

// -------------------------------------------------------------------------
// Test 7: Finca completa vs parcial (Comparabilidad advertida)
// -------------------------------------------------------------------------
console.log("\nTest 7: Comparabilidad entre Finca Completa y Finca Parcial");
{
  const vFull = makeVisit("vf", "Finca Completa", "2026-03-01", "Lote 1", true, true); // 100 pts, completa
  const vPart = makeVisit("vp", "Finca Parcial", "2026-03-01", "Lote 1", false, true); // 10 pts, parcial
  const benchmarkVm = buildBenchmarkViewModel([vFull, vPart], {}, [], aggregateIntelligence, ["Finca Completa", "Finca Parcial"]);

  assert.equal(benchmarkVm.isContextualBenchmark, true, "Debe marcarse como benchmark contextual");
  assert.equal(benchmarkVm.evaluatedFarms[0].farm, "Finca Completa", "Auditoría completa debe preceder a parcial");

  const tableHtml = renderBenchmarkTable(benchmarkVm);
  assert.ok(tableHtml.includes("Benchmark Contextual"), "Tabla debe mostrar advertencia de benchmark contextual");
  console.log("   ✓ Test 7 superado: Comparabilidad de alcance advertida explícitamente y prioridad de auditoría completa respetada.");
}

// -------------------------------------------------------------------------
// Test 8: Empate en puntuación
// -------------------------------------------------------------------------
console.log("\nTest 8: Empate entre fincas con idéntica puntuación");
{
  const v1 = makeVisit("v1", "Finca Alfa", "2026-03-01", "Lote 1", true, true); // 100 pts
  const v2 = makeVisit("v2", "Finca Beta", "2026-03-01", "Lote 1", true, true); // 100 pts
  const benchmarkVm = buildBenchmarkViewModel([v1, v2], {}, [], aggregateIntelligence, ["Finca Alfa", "Finca Beta"]);

  assert.equal(benchmarkVm.evaluatedFarms[0].isTied, true, "Finca Alfa debe marcarse como empatada");
  assert.equal(benchmarkVm.evaluatedFarms[1].isTied, true, "Finca Beta debe marcarse como empatada");
  assert.equal(benchmarkVm.evaluatedFarms[0].rankNumber, 1);
  assert.equal(benchmarkVm.evaluatedFarms[1].rankNumber, 1);
  assert.ok(benchmarkVm.evaluatedFarms[0].rankDisplay.includes("Empate"), "Display debe indicar Empate");

  const tableHtml = renderBenchmarkTable(benchmarkVm);
  assert.ok(tableHtml.includes("Empate"), "Tabla debe renderizar badge o texto de empate");
  console.log("   ✓ Test 8 superado: Empate de puntuación (#1 Empate) reflejado fielmente sin inventar desempates.");
}

// -------------------------------------------------------------------------
// Test 9: Filtro por lote (Aislamiento de lote)
// -------------------------------------------------------------------------
console.log("\nTest 9: Filtro por lote");
{
  const vA = makeVisit("va", "Finca Flores", "2026-03-01", "Bloque Norte", true, true);
  const vB = makeVisit("vb", "Finca Flores", "2026-03-02", "Bloque Sur", true, false);

  const filtered = filterVisits([vA, vB], "Finca Flores", "all", "", "Bloque Norte");
  assert.equal(filtered.length, 1, "Debe devolver únicamente 1 visita");
  assert.equal(filtered[0].lot, "Bloque Norte", "Solo debe incluir Bloque Norte");

  const trendVm = buildTrendViewModel(filtered, { farm: "Finca Flores", lot: "Bloque Norte" }, calculateVisitScore);
  assert.equal(trendVm.count, 1, "El gráfico solo debe contener 1 medición");
  assert.equal(trendVm.series[0].lot, "Bloque Norte", "Medición aislada al bloque norte");
  console.log("   ✓ Test 9 superado: Filtro por lote aísla rigurosamente los datos sin contaminar con otros lotes.");
}

// -------------------------------------------------------------------------
// Test 10: Filtro por periodo
// -------------------------------------------------------------------------
console.log("\nTest 10: Filtro por periodo");
{
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // 400 days ago

  const vRecent = makeVisit("vr", "Finca Flores", todayStr, "Lote 1", true, true);
  const vOld = makeVisit("vo", "Finca Flores", oldDate, "Lote 1", true, true);

  const filtered30d = filterVisits([vRecent, vOld], "", "30d");
  assert.equal(filtered30d.length, 1, "Solo debe incluir la visita reciente de 30 días");
  assert.equal(filtered30d[0].id, "vr", "Visita antigua excluida");

  const trendVm = buildTrendViewModel(filtered30d, { range: "30d" }, calculateVisitScore);
  assert.equal(trendVm.count, 1, "El gráfico temporal respeta el periodo de 30 días");
  console.log("   ✓ Test 10 superado: Filtro por periodo aplicado con precisión temporal.");
}

console.log("\n============================================================");
console.log("✅ LOS 10 TESTS OBLIGATORIOS DE FASE 4 HAN PASADO EXITOSAMENTE");
console.log("============================================================\n");
