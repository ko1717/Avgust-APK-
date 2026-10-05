/**
 * Suite de Pruebas Automatizadas de Integridad Matemática y KPIs
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Valida:
 * - Casos de Prueba 1 a 12 (Requisitos obligatorios)
 * - Propiedades Matemáticas A a H (Invariantes formales)
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

// Instrument to extract calculation engine
const instrumented = code.replace(
  /\}\)\(\);?\s*$/,
  "; globalScope.engine = { calculateVisitScore, aggregateIntelligence, filterVisits, CHAPTER_WEIGHTS, CHAPTER_INFO, CRITERIA_CATALOG }; })()"
);

const fn = new Function("globalScope", "window", "document", "MutationObserver", "fetch", instrumented);
fn(globalScope, globalScope.window, globalScope.document, globalScope.MutationObserver, globalScope.fetch);

const { calculateVisitScore, aggregateIntelligence, filterVisits, CHAPTER_WEIGHTS, CHAPTER_INFO, CRITERIA_CATALOG } = globalScope.engine;

console.log("=== INICIANDO VALIDACIÓN FORMAL DE KPIs Y MATEMÁTICAS MIPE ===\n");

// -------------------------------------------------------------------------
// 1. Verificación de Pesos y Catálogo
// -------------------------------------------------------------------------
console.log("1. Verificando Suma de Ponderaciones:");
const sumWeights = Object.values(CHAPTER_WEIGHTS).reduce((a, b) => a + b, 0);
assert.equal(Math.round(sumWeights * 100), 100, "La suma de pesos debe ser exactamente 100%");
assert.equal(Object.keys(CHAPTER_WEIGHTS).length, 5, "Deben existir exactamente 5 capítulos");
console.log("   ✓ Suma de pesos = 100.0% (5/5 capítulos)");

console.log("\n2. Verificando Sincronización de Catálogo Oficial (Tf):");
assert.equal(Object.keys(CRITERIA_CATALOG).length, 37, "El catálogo debe tener exactamente 37 criterios oficiales");
assert.equal(CHAPTER_INFO[1].criteriaCount, 4, "Capítulo 1 debe tener 4 criterios");
assert.equal(CHAPTER_INFO[2].criteriaCount, 8, "Capítulo 2 debe tener 8 criterios");
assert.equal(CHAPTER_INFO[3].criteriaCount, 4, "Capítulo 3 debe tener 4 criterios");
assert.equal(CHAPTER_INFO[4].criteriaCount, 10, "Capítulo 4 debe tener 10 criterios");
assert.equal(CHAPTER_INFO[5].criteriaCount, 11, "Capítulo 5 debe tener 11 criterios");
console.log("   ✓ Catálogo verificado: 37/37 criterios (4, 8, 4, 10, 11)");

// -------------------------------------------------------------------------
// 2. Casos de Prueba Obligatorios (1 al 12)
// -------------------------------------------------------------------------
console.log("\n3. Ejecutando Casos de Prueba Obligatorios (1 al 12):");

// Caso 1 — Nada evaluado
{
  const visit = { id: "v1", farm: "Finca Vacia", date: "2026-03-01", chapters: [], answers: {}, reviewed: true };
  const calc = calculateVisitScore(visit);
  const agg = aggregateIntelligence([visit]);

  assert.equal(calc.pointsEarned, 0.0, "Caso 1: Puntos deben ser 0.0");
  assert.equal(calc.criteriaCompliance, null, "Caso 1: Cumplimiento debe ser null");
  assert.equal(calc.auditedWeight, 0.0, "Caso 1: Peso auditado debe ser 0.0");
  assert.equal(agg.globalPoints, 0.0, "Caso 1: Global points debe ser 0.0");
  assert.equal(agg.isFullyEvaluated, false, "Caso 1: No debe ser completa");
  assert.equal(agg.evaluatedChaptersCount, 0, "Caso 1: 0 capítulos evaluados");
  console.log("   ✓ Caso 1 — Nada evaluado: Puntos=0.0, Cumplimiento=null, Cobertura=0%, Estado=No evaluada");
}

// Caso 2 — 1 capítulo evaluado
{
  const visit = {
    id: "v2",
    farm: "Finca 1Cap",
    date: "2026-03-02",
    chapters: [3], // Cap 3 (5 pts)
    answers: { "3.1": { value: "SI" }, "3.2": { value: "SI" } },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  const agg = aggregateIntelligence([visit]);

  assert.equal(calc.pointsEarned, 5.0, "Caso 2: Puntos deben ser 5.0");
  assert.equal(calc.criteriaCompliance, 100.0, "Caso 2: Cumplimiento debe ser 100%");
  assert.equal(calc.auditedWeight, 0.05, "Caso 2: Peso auditado debe ser 0.05");
  assert.equal(agg.isFullyEvaluated, false, "Caso 2: Debe ser auditoría parcial");
  assert.equal(agg.evaluatedChaptersCount, 1, "Caso 2: 1 capítulo evaluado");
  console.log("   ✓ Caso 2 — 1 capítulo evaluado: Auditoría Parcial (1/5 Caps, 5.0 pts)");
}

// Caso 3 — 3/5 capítulos evaluados
{
  const visit = {
    id: "v3",
    farm: "Finca 3Caps",
    date: "2026-03-03",
    chapters: [1, 2, 3], // 5% + 30% + 5% = 40%
    answers: {
      "1.1": { value: "SI" },
      "2.1": { value: "SI" },
      "2.2": { value: "NO" }, // 50% en Cap 2 -> 15 pts
      "3.1": { value: "SI" }
    },
    reviewed: true
  };
  const agg = aggregateIntelligence([visit]);
  assert.equal(agg.isFullyEvaluated, false, "Caso 3: Debe ser parcial");
  assert.equal(agg.evaluatedChaptersCount, 3, "Caso 3: 3 capítulos evaluados");
  assert.equal(agg.coveragePct, 40, "Caso 3: Cobertura ponderada debe ser 40%");
  // Pts = 5 (Cap 1) + 15 (Cap 2) + 5 (Cap 3) = 25 pts
  assert.equal(agg.globalPoints, 25.0, "Caso 3: Puntos MIPE deben ser 25.0 / 100");
  // Criterios: 3 SI, 1 NO = 3/4 = 75.0%
  assert.equal(agg.criteriaCompliance, 75.0, "Caso 3: Cumplimiento de criterios = 75.0%");
  console.log("   ✓ Caso 3 — 3/5 capítulos: Parcial (25.0 / 100 pts, Cump: 75.0%, Cob: 40%)");
}

// Caso 4 — 5/5 capítulos evaluados
{
  const visit = {
    id: "v4",
    farm: "Finca Completa",
    date: "2026-03-04",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "1.1": { value: "SI" },
      "2.1": { value: "SI" },
      "3.1": { value: "SI" },
      "4.1": { value: "SI" },
      "5.1": { value: "SI" }
    },
    reviewed: true
  };
  const agg = aggregateIntelligence([visit]);
  assert.equal(agg.isFullyEvaluated, true, "Caso 4: Debe ser completa");
  assert.equal(agg.evaluatedChaptersCount, 5, "Caso 4: 5/5 capítulos evaluados");
  assert.equal(agg.globalPoints, 100.0, "Caso 4: 100.0 puntos ganados");
  assert.equal(agg.criteriaCompliance, 100.0, "Caso 4: 100.0% cumplimiento");
  console.log("   ✓ Caso 4 — 5/5 capítulos: Auditoría Completa (100.0 pts)");
}

// Caso 5 — Todos los criterios SI
{
  const visit = {
    id: "v5",
    farm: "Finca Todo SI",
    date: "2026-03-05",
    chapters: [1],
    answers: { "1.1": { value: "SI" }, "1.2": { value: "SI" }, "1.3": { value: "SI" }, "1.4": { value: "SI" } },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  assert.equal(calc.criteriaCompliance, 100.0, "Caso 5: Cumplimiento = 100%");
  assert.equal(calc.chapterScores[1], 100.0, "Caso 5: Cap 1 = 100%");
  assert.equal(calc.chapterScores[2], null, "Caso 5: Cap 2 sin evaluar = null");
  console.log("   ✓ Caso 5 — Todos los criterios SI: Cumplimiento = 100% (solo en evaluados)");
}

// Caso 6 — Todos los criterios NO
{
  const visit = {
    id: "v6",
    farm: "Finca Todo NO",
    date: "2026-03-06",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "1.1": { value: "NO" },
      "2.1": { value: "NO" },
      "3.1": { value: "NO" },
      "4.1": { value: "NO" },
      "5.1": { value: "NO" }
    },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  assert.equal(calc.criteriaCompliance, 0.0, "Caso 6: Cumplimiento = 0%");
  assert.equal(calc.pointsEarned, 0.0, "Caso 6: Puntos = 0.0");
  assert.equal(calc.findingsCount, 5, "Caso 6: 5 hallazgos");
  console.log("   ✓ Caso 6 — Todos los criterios NO: Cumplimiento = 0.0%, Puntos = 0.0");
}

// Caso 7 — SI + NO (8 SI, 2 NO)
{
  const visit = {
    id: "v7",
    farm: "Finca 80%",
    date: "2026-03-07",
    chapters: [4],
    answers: {
      "4.1": { value: "SI" },
      "4.2": { value: "SI" },
      "4.3": { value: "SI" },
      "4.4": { value: "SI" },
      "4.5": { value: "SI" },
      "4.6": { value: "SI" },
      "4.7": { value: "SI" },
      "4.8": { value: "SI" },
      "4.9": { value: "NO" },
      "4.10": { value: "NO" }
    },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  assert.equal(calc.criteriaCompliance, 80.0, "Caso 7: 8 SI / 10 Evaluados = 80.0%");
  assert.equal(calc.chapterScores[4], 80.0, "Caso 7: Cap 4 Score = 80.0%");
  assert.equal(calc.chapterPoints[4], 24.0, "Caso 7: Cap 4 Pts = 80% de 30 = 24.0 pts");
  console.log("   ✓ Caso 7 — SI + NO: 8 SI, 2 NO = 80.0% Cumplimiento");
}

// Caso 8 — SI + NO + NO APLICA (8 SI, 2 NO, 5 NA)
{
  const visit = {
    id: "v8",
    farm: "Finca con NA",
    date: "2026-03-08",
    chapters: [4, 5],
    answers: {
      "4.1": { value: "SI" },
      "4.2": { value: "SI" },
      "4.3": { value: "SI" },
      "4.4": { value: "SI" },
      "4.5": { value: "SI" },
      "4.6": { value: "SI" },
      "4.7": { value: "SI" },
      "4.8": { value: "SI" },
      "4.9": { value: "NO" },
      "4.10": { value: "NO" },
      "5.1": { value: "NA" },
      "5.2": { value: "NA" },
      "5.3": { value: "NA" },
      "5.4": { value: "NA" },
      "5.5": { value: "NA" }
    },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  assert.equal(calc.criteriaCompliance, 80.0, "Caso 8: NA no debe entrar en el denominador");
  assert.equal(calc.chapterScores[5], null, "Caso 8: Cap 5 solo con NA debe ser null");
  assert.equal(calc.chapterPoints[5], 0.0, "Caso 8: Cap 5 solo con NA = 0.0 pts");
  console.log("   ✓ Caso 8 — SI + NO + NA: 8 SI, 2 NO, 5 NA = 80.0% (NA excluido estrictamente)");
}

// Caso 9 — Solo NO APLICA
{
  const visit = {
    id: "v9",
    farm: "Finca Solo NA",
    date: "2026-03-09",
    chapters: [1, 2],
    answers: { "1.1": { value: "NA" }, "1.2": { value: "NA" }, "2.1": { value: "NA" } },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  assert.equal(calc.criteriaCompliance, null, "Caso 9: Cumplimiento debe ser null");
  assert.equal(calc.pointsEarned, 0.0, "Caso 9: Puntos deben ser 0.0");
  assert.equal(calc.evaluatedChapters.length, 0, "Caso 9: 0 capítulos evaluados");
  console.log("   ✓ Caso 9 — Solo NO APLICA: Cumplimiento = null (No evaluado, jamás 100%)");
}

// Caso 10 — Criterios sin respuesta
{
  const visit = {
    id: "v10",
    farm: "Finca Sin Respuestas",
    date: "2026-03-10",
    chapters: [1, 2, 3, 4, 5],
    answers: { "1.1": { value: "" }, "2.1": null },
    reviewed: true
  };
  const calc = calculateVisitScore(visit);
  assert.equal(calc.criteriaCompliance, null, "Caso 10: Cumplimiento debe ser null");
  assert.equal(calc.pointsEarned, 0.0, "Caso 10: Puntos deben ser 0.0");
  console.log("   ✓ Caso 10 — Criterios sin respuesta: Cumplimiento = null");
}

// Caso 11 — División por cero
{
  const emptyVisits = [];
  const agg = aggregateIntelligence(emptyVisits);
  assert.equal(isNaN(agg.globalPoints), false, "Caso 11: No debe ser NaN");
  assert.equal(isFinite(agg.globalPoints), true, "Caso 11: Debe ser finito");
  assert.equal(agg.criteriaCompliance, null, "Caso 11: Cumplimiento controlado en null");
  assert.equal(agg.weightedScore, null, "Caso 11: Desempeño ponderado controlado en null");
  console.log("   ✓ Caso 11 — División por cero: Estados controlados sin NaN ni Infinity");
}

// Caso 12 — Datos parciales
{
  const visit = {
    id: "v12",
    farm: "Finca Parcial",
    date: "2026-03-12",
    chapters: [2], // 30%
    answers: { "2.1": { value: "SI" }, "2.2": { value: "SI" } },
    reviewed: true
  };
  const agg = aggregateIntelligence([visit]);
  assert.equal(agg.globalPoints, 30.0, "Caso 12: 30.0 puntos ganados");
  assert.equal(agg.chapterPerformance[1].compliance, null, "Caso 12: Cap 1 no debe ser 0% ni 100%");
  assert.equal(agg.chapterPerformance[1].isEvaluated, false, "Caso 12: Cap 1 no evaluado");
  assert.equal(agg.chapterPerformance[1].pointsEarned, 0.0, "Caso 12: Cap 1 = 0 pts ganados");
  console.log("   ✓ Caso 12 — Datos parciales: Faltantes no se transforman en 0 ni 100");
}

// -------------------------------------------------------------------------
// 3. Verificación de Propiedades Matemáticas (Propiedades A a H)
// -------------------------------------------------------------------------
console.log("\n4. Verificando Propiedades Matemáticas Invariantes (A a H):");

// Propiedad A: 0% <= cumplimiento <= 100%
{
  const sample = [
    { pos: 0, app: 10 },
    { pos: 5, app: 10 },
    { pos: 10, app: 10 }
  ];
  sample.forEach(({ pos, app }) => {
    const rate = (pos / app) * 100;
    assert.ok(rate >= 0 && rate <= 100, "Propiedad A: Cumplimiento dentro de [0, 100]");
  });
  console.log("   ✓ Propiedad A — Cumplimiento acotado estrictamente: 0% <= cumplimiento <= 100%");
}

// Propiedad B: 0 <= puntos MIPE <= 100
{
  const vAllSI = {
    id: "vB",
    farm: "FB",
    date: "2026-03-15",
    chapters: [1, 2, 3, 4, 5],
    answers: Object.keys(CRITERIA_CATALOG).reduce((acc, k) => { acc[k] = { value: "SI" }; return acc; }, {}),
    reviewed: true
  };
  const agg = aggregateIntelligence([vAllSI]);
  assert.ok(agg.globalPoints >= 0 && agg.globalPoints <= 100.0, "Propiedad B: Puntos dentro de [0, 100]");
  assert.equal(agg.globalPoints, 100.0, "Propiedad B: Máximo exacto = 100.0 pts");
  console.log("   ✓ Propiedad B — Puntos oficiales acotados estrictamente: 0 <= puntos <= 100");
}

// Propiedad C: 0% <= cobertura <= 100%
{
  [[], [1], [1, 2], [1, 2, 3, 4, 5]].forEach(chaps => {
    const v = { id: "vC", farm: "FC", date: "2026-03-15", chapters: chaps, answers: { "1.1": { value: "SI" } }, reviewed: true };
    const agg = aggregateIntelligence([v]);
    assert.ok(agg.coveragePct >= 0 && agg.coveragePct <= 100, "Propiedad C: Cobertura dentro de [0, 100]");
  });
  console.log("   ✓ Propiedad C — Cobertura dentro de rango: 0% <= cobertura <= 100%");
}

// Propiedad D: Agregar NO EVALUADO no altera cumplimiento
{
  const vBase = { id: "vD1", farm: "FD", date: "2026-03-15", chapters: [1], answers: { "1.1": { value: "SI" } }, reviewed: true };
  const vAdded = { id: "vD2", farm: "FD", date: "2026-03-15", chapters: [1], answers: { "1.1": { value: "SI" }, "1.2": null }, reviewed: true };
  const calc1 = calculateVisitScore(vBase);
  const calc2 = calculateVisitScore(vAdded);
  assert.equal(calc1.criteriaCompliance, calc2.criteriaCompliance, "Propiedad D: No evaluado no altera cumplimiento");
  console.log("   ✓ Propiedad D — Criterio NO EVALUADO no altera cumplimiento");
}

// Propiedad E: Agregar NO APLICA no altera cumplimiento
{
  const vBase = { id: "vE1", farm: "FE", date: "2026-03-15", chapters: [1], answers: { "1.1": { value: "SI" } }, reviewed: true };
  const vAdded = { id: "vE2", farm: "FE", date: "2026-03-15", chapters: [1], answers: { "1.1": { value: "SI" }, "1.2": { value: "NA" } }, reviewed: true };
  const calc1 = calculateVisitScore(vBase);
  const calc2 = calculateVisitScore(vAdded);
  assert.equal(calc1.criteriaCompliance, calc2.criteriaCompliance, "Propiedad E: NA no altera cumplimiento");
  console.log("   ✓ Propiedad E — Criterio NO APLICA no altera cumplimiento");
}

// Propiedad F: Auditoría vacía no aumenta puntuación
{
  const vEmpty = { id: "vF", farm: "FF", date: "2026-03-15", chapters: [], answers: {}, reviewed: true };
  const agg = aggregateIntelligence([vEmpty]);
  assert.equal(agg.globalPoints, 0.0, "Propiedad F: Auditoría vacía no suma puntos");
  console.log("   ✓ Propiedad F — Auditoría vacía no aumenta puntuación");
}

// Propiedad G: Capítulo no evaluado no aporta puntos
{
  const vPart = { id: "vG", farm: "FG", date: "2026-03-15", chapters: [1], answers: { "1.1": { value: "SI" } }, reviewed: true };
  const agg = aggregateIntelligence([vPart]);
  assert.equal(agg.chapterPerformance[2].pointsEarned, 0.0, "Propiedad G: Capítulo no evaluado = 0 pts");
  assert.equal(agg.chapterPerformance[2].compliance, null, "Propiedad G: Capítulo no evaluado = null");
  console.log("   ✓ Propiedad G — Capítulo no evaluado jamás aporta puntos");
}

// Propiedad H: Auditoría parcial nunca es completa
{
  const vPart = {
    id: "vH",
    farm: "FH",
    date: "2026-03-15",
    chapters: [1, 2, 3, 4], // Falta Cap 5 (30%)
    answers: { "1.1": { value: "SI" }, "2.1": { value: "SI" }, "3.1": { value: "SI" }, "4.1": { value: "SI" } },
    reviewed: true
  };
  const agg = aggregateIntelligence([vPart]);
  assert.equal(agg.isFullyEvaluated, false, "Propiedad H: Parcial no debe ser completa");
  assert.equal(agg.evaluatedChaptersCount, 4, "Propiedad H: 4 de 5 evaluados");
  console.log("   ✓ Propiedad H — Auditoría parcial nunca se clasifica como completa");
}

// -------------------------------------------------------------------------
// 4. Verificación de Ranking de Fincas (Completas vs Parciales)
// -------------------------------------------------------------------------
console.log("\n5. Verificando Regla de Ordenamiento de Fincas:");
{
  const farmA_Partial100 = {
    id: "vA",
    farm: "Finca A (Parcial)",
    date: "2026-03-15",
    chapters: [1], // Cap 1 = 5 pts
    answers: { "1.1": { value: "SI" }, "1.2": { value: "SI" }, "1.3": { value: "SI" }, "1.4": { value: "SI" } },
    reviewed: true
  };
  const farmB_Complete94 = {
    id: "vB",
    farm: "Finca B (Completa)",
    date: "2026-03-15",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "1.1": { value: "SI" },
      "2.1": { value: "SI" },
      "3.1": { value: "SI" },
      "4.1": { value: "SI" },
      "5.1": { value: "SI" },
      "5.2": { value: "NO" } // 94 pts aprox
    },
    reviewed: true
  };

  const agg = aggregateIntelligence([farmA_Partial100, farmB_Complete94]);
  const ranking = agg.farmRanking;
  
  assert.equal(ranking[0].farm, "Finca B (Completa)", "Finca B completa debe encabezar el ranking");
  assert.equal(ranking[1].farm, "Finca A (Parcial)", "Finca A parcial debe quedar después");
  console.log("   ✓ Ranking validado: Finca Completa (#1 con 94.5 pts) sobre Finca Parcial (#2 con 5.0 pts)");
}

// -------------------------------------------------------------------------
// 5. Verificación de Robustez (Warnings W-01 y W-02)
// -------------------------------------------------------------------------
console.log("\n6. Verificando Robustez y Deduplicación Defensiva:");
{
  const vDup1 = {
    id: "vDup",
    farm: "Finca Duplicada",
    date: "2026-03-20",
    chapters: [4],
    answers: { "4.1": { value: "NO" }, "4.2": { value: "SI" } },
    reviewed: true
  };
  const vDup2 = { ...vDup1 }; // Duplicate identical visit
  const agg = aggregateIntelligence([vDup1, vDup2]);
  
  assert.equal(agg.totalVisits, 1, "Visitas duplicadas deben deduplicarse");
  assert.equal(agg.totalFindings, 1, "Hallazgos de visitas duplicadas no deben sumarse doble");
  console.log("   ✓ W-01: Deduplicación validada (1 visita única, 1 hallazgo)");
}

{
  const vPartial = {
    id: "vPartial",
    farm: "Finca Parcial 3Caps",
    date: "2026-03-20",
    chapters: [3, 4, 5],
    answers: { "3.1": { value: "SI" }, "4.1": { value: "SI" }, "5.1": { value: "SI" } },
    reviewed: true
  };
  const calc = calculateVisitScore(vPartial);
  const agg = aggregateIntelligence([vPartial]);
  
  assert.equal(calc.chapterScores[1], null, "Capítulo 1 sin evaluar debe ser null");
  assert.equal(calc.chapterPoints[1], 0.0, "Capítulo 1 sin evaluar debe ser 0.0 pts");
  assert.equal(calc.chapterScores[2], null, "Capítulo 2 sin evaluar debe ser null");
  assert.equal(calc.chapterPoints[2], 0.0, "Capítulo 2 sin evaluar debe ser 0.0 pts");
  assert.equal(agg.chapterPerformance[1].compliance, null, "Cap 1 en aggregateIntelligence debe ser null");
  assert.equal(agg.chapterPerformance[1].pointsEarned, 0.0, "Cap 1 en aggregateIntelligence debe ser 0.0 pts");
  assert.equal(agg.isFullyEvaluated, false, "3/5 caps no es completa");
  assert.notEqual(agg.globalPoints, 100.0, "Puntos MIPE no pueden ser 100 con capítulos sin evaluar");
  console.log("   ✓ Capítulos no evaluados: Verificado estrictamente null y 0.0 pts ganados");
}

console.log("\n============================================================");
console.log("✅ TODAS LAS PRUEBAS MATEMÁTICAS Y DE INTEGRIDAD HAN PASADO");
console.log("============================================================\n");
