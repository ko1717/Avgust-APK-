/**
 * FASE 6.1 — AUDITORÍA DE PARIDAD MATEMÁTICA, INTEGRACIÓN REAL Y NO REGRESIÓN
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 */

import assert from "node:assert/strict";
import fs from "node:fs";

console.log("=== INICIANDO FASE 6.1: AUDITORÍA DE PARIDAD & NO REGRESIÓN ===");

// Load metrics code in isolated evaluation
const code = fs.readFileSync("enhance/src/care360-metrics.js", "utf8");

// Mock standard browser environment
const globalScope = {
  window: { addEventListener: () => {}, removeEventListener: () => {} },
  document: { readyState: "complete", getElementById: () => null, addEventListener: () => {}, removeEventListener: () => {}, body: {}, querySelector: () => null, querySelectorAll: () => [] },
  MutationObserver: class { observe() {} },
  fetch: () => Promise.resolve({ json: () => Promise.resolve([]) })
};

// Instrument to extract calculation engine
const instrumented = code.replace(
  /\}\)\(\);?\s*$/,
  "; globalScope.engine = { calculateVisitScore, aggregateIntelligence, filterVisits, buildMetricsViewModel, buildTrendViewModel, buildBenchmarkViewModel, buildRiskMatrixViewModel, CHAPTER_WEIGHTS, CHAPTER_INFO, CRITERIA_CATALOG }; })()"
);

const fn = new Function("globalScope", "window", "document", "MutationObserver", "fetch", instrumented);
fn(globalScope, globalScope.window, globalScope.document, globalScope.MutationObserver, globalScope.fetch);

const core = globalScope.engine;

// Define canonical reference math for MIPE
const REF_WEIGHTS = { 1: 0.05, 2: 0.30, 3: 0.05, 4: 0.30, 5: 0.30 };
const REF_TOTAL_CRITERIA = 37;

// Helper to build canonical visit
function makeCanonicalVisit(id, answers, meta = {}) {
  return {
    id: id || "v-canonical-1",
    farm: meta.farm || "Finca La Excelencia",
    lot: meta.lot || "Bloque 1",
    crop: meta.crop || "Rosas",
    date: meta.date || "2026-03-01",
    reviewer: meta.reviewer || "Ing. Agrónomo MIPE",
    answers: answers || {}
  };
}

// ---------------------------------------------------------------------------
// TEST 1: Paridad de Ponderaciones y Catálogo
// ---------------------------------------------------------------------------
console.log("\n1. Verificando Paridad de Ponderaciones y Catálogo:");
assert.deepEqual(core.CHAPTER_WEIGHTS, REF_WEIGHTS, "CHAPTER_WEIGHTS debe coincidir exactamente con la norma oficial");
const criteriaKeys = Object.keys(core.CRITERIA_CATALOG);
assert.equal(criteriaKeys.length, REF_TOTAL_CRITERIA, `Deben existir exactamente ${REF_TOTAL_CRITERIA} criterios en el catálogo`);
console.log(`   ✓ Ponderaciones oficiales y catálogo de 37 criterios verificados.`);

// ---------------------------------------------------------------------------
// TEST 2: Caso A — Todos SI (100 pts)
// ---------------------------------------------------------------------------
console.log("\n2. Verificando Caso A (Todos SI):");
const answersAllYes = {};
criteriaKeys.forEach(k => { answersAllYes[k] = { value: "SI" }; });
const visitAllYes = makeCanonicalVisit("v-all-yes", answersAllYes);
const aggAllYes = core.aggregateIntelligence([visitAllYes]);

assert.equal(aggAllYes.globalPoints, 100.0, "Todos SI debe dar exactamente 100.0 puntos");
assert.equal(aggAllYes.criteriaCompliance, 100.0, "Todos SI debe dar 100.0% de cumplimiento");
assert.equal(aggAllYes.evaluatedChaptersCount, 5, "Deben estar 5/5 capítulos evaluados");
assert.equal(aggAllYes.isFullyEvaluated, true, "Debe ser auditoría completa");
console.log(`   ✓ Caso A validado: ${aggAllYes.globalPoints} pts, ${aggAllYes.criteriaCompliance}% compliance`);

// ---------------------------------------------------------------------------
// TEST 3: Caso B — Todos NO (0 pts)
// ---------------------------------------------------------------------------
console.log("\n3. Verificando Caso B (Todos NO):");
const answersAllNo = {};
criteriaKeys.forEach(k => { answersAllNo[k] = { value: "NO" }; });
const visitAllNo = makeCanonicalVisit("v-all-no", answersAllNo);
const aggAllNo = core.aggregateIntelligence([visitAllNo]);

assert.equal(aggAllNo.globalPoints, 0.0, "Todos NO debe dar exactamente 0.0 puntos");
assert.equal(aggAllNo.criteriaCompliance, 0.0, "Todos NO debe dar 0.0% de cumplimiento");
assert.equal(aggAllNo.isFullyEvaluated, true, "5/5 capítulos evaluados");
console.log(`   ✓ Caso B validado: ${aggAllNo.globalPoints} pts, ${aggAllNo.criteriaCompliance}% compliance`);

// ---------------------------------------------------------------------------
// TEST 4: Caso C — Mezcla SI/NO
// ---------------------------------------------------------------------------
console.log("\n4. Verificando Caso C (Mezcla SI/NO):");
const answersMix = {};
// Cap 1 (4 crit, weight 5%): 2 SI, 2 NO -> 50% * 5 = 2.5 pts
// Cap 2 (8 crit, weight 30%): 6 SI, 2 NO -> 75% * 30 = 22.5 pts
// Cap 3 (4 crit, weight 5%): 4 SI -> 100% * 5 = 5.0 pts
// Cap 4 (10 crit, weight 30%): 8 SI, 2 NO -> 80% * 30 = 24.0 pts
// Cap 5 (11 crit, weight 30%): 11 SI -> 100% * 30 = 30.0 pts
// Total esperado = 2.5 + 22.5 + 5.0 + 24.0 + 30.0 = 84.0 pts
["1.1", "1.2"].forEach(k => { answersMix[k] = { value: "SI" }; });
["1.3", "1.4"].forEach(k => { answersMix[k] = { value: "NO" }; });
["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"].forEach(k => { answersMix[k] = { value: "SI" }; });
["2.7", "2.8"].forEach(k => { answersMix[k] = { value: "NO" }; });
["3.1", "3.2", "3.3", "3.4"].forEach(k => { answersMix[k] = { value: "SI" }; });
["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8"].forEach(k => { answersMix[k] = { value: "SI" }; });
["4.9", "4.10"].forEach(k => { answersMix[k] = { value: "NO" }; });
["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11"].forEach(k => { answersMix[k] = { value: "SI" }; });

const visitMix = makeCanonicalVisit("v-mix", answersMix);
const aggMix = core.aggregateIntelligence([visitMix]);
assert.equal(aggMix.globalPoints, 84.0, "Puntos de mezcla SI/NO deben ser exactamente 84.0");
console.log(`   ✓ Caso C validado: ${aggMix.globalPoints} pts ganados.`);

// ---------------------------------------------------------------------------
// TEST 5: Caso D — Tratamiento de NA (No Aplica)
// ---------------------------------------------------------------------------
console.log("\n5. Verificando Caso D (Tratamiento de NA):");
// En Cap 1: 2 SI, 2 NA -> Applicable = 2. Compliance = 100%. Puntos = 5.0 pts
const answersNA = {
  "1.1": { value: "SI" },
  "1.2": { value: "SI" },
  "1.3": { value: "NA" },
  "1.4": { value: "NA" }
};
const visitNA = makeCanonicalVisit("v-na", answersNA);
const aggNA = core.aggregateIntelligence([visitNA]);
const cap1 = aggNA.chapterPerformance[1];
assert.equal(cap1.applicable, 2, "NA debe excluirse del denominador aplicable");
assert.equal(cap1.compliance, 100.0, "2 SI / 2 aplicables = 100.0% compliance");
assert.equal(cap1.pointsEarned, 5.0, "5% * 100% = 5.0 pts");
console.log(`   ✓ Caso D validado: NA no penaliza ni se cuenta como incumplimiento.`);

// ---------------------------------------------------------------------------
// TEST 6: Caso E — Capítulo completamente no evaluado
// ---------------------------------------------------------------------------
console.log("\n6. Verificando Caso E (Capítulo no evaluado):");
// Solo evaluamos Cap 1 (5% = 5.0 pts) y Cap 3 (5% = 5.0 pts) con SI
const answersPartial = {
  "1.1": { value: "SI" }, "1.2": { value: "SI" }, "1.3": { value: "SI" }, "1.4": { value: "SI" },
  "3.1": { value: "SI" }, "3.2": { value: "SI" }, "3.3": { value: "SI" }, "3.4": { value: "SI" }
};
const visitPartial = makeCanonicalVisit("v-partial", answersPartial);
const aggPartial = core.aggregateIntelligence([visitPartial]);
assert.equal(aggPartial.globalPoints, 10.0, "Cap 1 (5) + Cap 3 (5) = 10.0 pts");
assert.equal(aggPartial.isFullyEvaluated, false, "No debe ser auditoría completa");
assert.equal(aggPartial.evaluatedChaptersCount, 2, "2/5 capítulos evaluados");
assert.equal(aggPartial.chapterPerformance[2].isEvaluated, false, "Cap 2 no está evaluado");
assert.equal(aggPartial.chapterPerformance[2].compliance, null, "Cap 2 no evaluado debe tener compliance = null");
assert.equal(aggPartial.chapterPerformance[2].pointsEarned, 0, "Cap 2 no evaluado debe aportar 0 pts");
console.log(`   ✓ Caso E validado: Capítulos no evaluados excluidos de compliance y aportan 0 pts.`);

// ---------------------------------------------------------------------------
// TEST 7: Caso F & G — Línea Base y Comparabilidad Temporal
// ---------------------------------------------------------------------------
console.log("\n7. Verificando Caso F & G (Línea Base y Comparabilidad Temporal):");
const trendSingle = core.buildTrendViewModel([visitAllYes], { range: "all" }, core.calculateVisitScore);
assert.equal(trendSingle.count, 1, "Debe tener 1 medición");
assert.equal(trendSingle.delta, null, "Primera visita debe tener delta = null (Línea base)");
assert.equal(trendSingle.isComparable, false, "Primera visita no tiene comparación previa");

// Dos visitas con diferente alcance
const visitPrev = makeCanonicalVisit("v-prev", answersPartial, { date: "2026-01-01" });
const visitCurr = makeCanonicalVisit("v-curr", answersAllYes, { date: "2026-02-01" });
const trendDiffScope = core.buildTrendViewModel([visitPrev, visitCurr], { range: "all" }, core.calculateVisitScore);
assert.equal(trendDiffScope.scopeMismatch, true, "Debe advertir alcance no homogéneo");
console.log(`   ✓ Caso F & G validados: Línea base y control de alcance heterogéneo.`);

// ---------------------------------------------------------------------------
// TEST 8: Verificación del bug histórico de escala weightedScore
// ---------------------------------------------------------------------------
console.log("\n8. Verificando escala de weightedScore (0 a 100, nunca 0 a 10000):");
[aggAllYes, aggAllNo, aggMix, aggNA, aggPartial].forEach(agg => {
  assert.ok(agg.globalPoints >= 0 && agg.globalPoints <= 100, `globalPoints (${agg.globalPoints}) debe estar en [0, 100]`);
  if (agg.criteriaCompliance != null) {
    assert.ok(agg.criteriaCompliance >= 0 && agg.criteriaCompliance <= 100, `criteriaCompliance (${agg.criteriaCompliance}) debe estar en [0, 100]`);
  }
});
console.log(`   ✓ Bug de escala verificado: puntuaciones siempre acotadas estrictamente en [0, 100].`);

// ---------------------------------------------------------------------------
// TEST 9: Aislamiento estricto de la Capa de Riesgo
// ---------------------------------------------------------------------------
console.log("\n9. Verificando Aislamiento de Capa de Riesgo:");
const riskVm = core.buildRiskMatrixViewModel([visitMix], core.CRITERIA_CATALOG, core.CHAPTER_INFO, {}, aggMix);
assert.equal(aggMix.globalPoints, 84.0, "El cálculo de riesgos no debe mutar el score oficial");
assert.ok(riskVm.findingsList.length > 0, "Debe listar no conformidades");
assert.equal(riskVm.findingsList.length, 6, "Hay 6 no conformidades en visitMix (2 en Cap 1, 2 en Cap 2, 2 en Cap 4)");
console.log(`   ✓ Capa de riesgo aislada correctamente sin modificar el score oficial.`);

console.log("\n============================================================");
console.log("✅ TODAS LAS PRUEBAS DE PARIDAD (FASE 6.1) HAN PASADO (PASS)");
console.log("============================================================\n");
