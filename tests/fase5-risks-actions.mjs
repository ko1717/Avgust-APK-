/**
 * Suite de Pruebas FASE 5 — Matriz de Riesgo, Causas, Prioridades y Acciones
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Valida los 10 Requisitos Obligatorios de la FASE 5:
 * 1. Criterio "No evaluado" NO genera riesgo ni no conformidad.
 * 2. Criterio "NA" NO genera riesgo.
 * 3. Criterio "NO" genera no conformidad con severidad correcta.
 * 4. Criterio "NO" sin severidad se etiqueta como "Sin clasificar".
 * 5. Orden de prioridad respeta: Crítico > Alto > Medio > Bajo > Sin clasificar.
 * 6. Agrupación por área/causa refleja fielmente los capítulos/categorías oficiales.
 * 7. Auditoría parcial muestra advertencia de alcance y no infiere riesgos en capítulos no auditados.
 * 8. Drill-down de un riesgo muestra exactamente los datos registrados sin inventar campos.
 * 9. Periodo sin hallazgos muestra mensaje oficial de no registros.
 * 10. Filtro por finca y lote aísla los riesgos correspondientes sin mezclar datos.
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

// Instrument to extract calculation engine and FASE 5 builders
const instrumented = code.replace(
  /\}\)\(\);?\s*$/,
  "; globalScope.engine = { calculateVisitScore, aggregateIntelligence, filterVisits, buildRiskMatrixViewModel, renderRiskMatrix, renderRiskCauses, renderPriorityActions, renderRiskDetailModal, renderTopRisksList, CRITERIA_CATALOG, CHAPTER_INFO }; })()"
);

const fn = new Function("globalScope", "window", "document", "MutationObserver", "fetch", instrumented);
fn(globalScope, globalScope.window, globalScope.document, globalScope.MutationObserver, globalScope.fetch);

const {
  calculateVisitScore,
  aggregateIntelligence,
  filterVisits,
  buildRiskMatrixViewModel,
  renderRiskMatrix,
  renderRiskCauses,
  renderPriorityActions,
  renderRiskDetailModal,
  renderTopRisksList,
  CRITERIA_CATALOG,
  CHAPTER_INFO
} = globalScope.engine;

console.log("=== INICIANDO VALIDACIÓN FORMAL DE FASE 5 (RIESGOS, CAUSAS Y ACCIONES) ===");

// --------------------------------------------------------------------------
// TEST 1: Criterio "No evaluado" NO genera riesgo ni no conformidad
// --------------------------------------------------------------------------
console.log("Test 1: Criterio 'No evaluado' NO genera riesgo");
{
  // Visit where only Chapter 1 is audited, but criterion 1.1 is SI and 1.2 is unevaluated (missing). Chapters 2-5 are not in chapters list.
  const visit = {
    id: "v-test-1",
    farm: "Finca Las Flores",
    lot: "Lote 1",
    crop: "Rosas",
    date: "2026-03-01",
    chapters: [1],
    answers: {
      "1.1": { value: "SI" }
      // 1.2, 1.3, 1.4 missing / null
    }
  };

  const intel = aggregateIntelligence([visit]);
  const rvm = buildRiskMatrixViewModel([visit], CRITERIA_CATALOG, CHAPTER_INFO, {}, intel);

  assert.equal(rvm.totalFindings, 0, "No debe haber ningún hallazgo generado por criterios no evaluados");
  assert.equal(rvm.hasFindings, false, "hasFindings debe ser false");
  assert.equal(rvm.counts.critical, 0, "Criterios no evaluados no deben aumentar severidad crítica");
  assert.equal(rvm.counts.high, 0);
  assert.equal(rvm.counts.medium, 0);
  assert.equal(rvm.counts.low, 0);
  assert.equal(rvm.counts.unclassified, 0);
  console.log("   ✓ Test 1 superado: Criterios no evaluados no generan riesgos ni no conformidades.");
}

// --------------------------------------------------------------------------
// TEST 2: Criterio "NA" (No Aplica) NO genera riesgo
// --------------------------------------------------------------------------
console.log("Test 2: Criterio 'NA' NO genera riesgo");
{
  const visit = {
    id: "v-test-2",
    farm: "Finca El Paraíso",
    lot: "Lote A",
    crop: "Claveles",
    date: "2026-03-05",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "1.1": { value: "SI" },
      "1.2": { value: "NA" },
      "2.1": { value: "NA" },
      "3.1": { value: "NA" }
    }
  };

  const intel = aggregateIntelligence([visit]);
  const rvm = buildRiskMatrixViewModel([visit], CRITERIA_CATALOG, CHAPTER_INFO, {}, intel);

  assert.equal(rvm.totalFindings, 0, "Criterios con NA no deben registrarse como no conformidad");
  assert.equal(rvm.findingsList.length, 0, "findingsList debe estar vacío");
  console.log("   ✓ Test 2 superado: Criterio NA excluido estrictamente del inventario de riesgos.");
}

// --------------------------------------------------------------------------
// TEST 3: Criterio "NO" genera no conformidad con severidad correcta
// --------------------------------------------------------------------------
console.log("Test 3: Criterio 'NO' genera no conformidad con severidad correcta");
{
  // 2.2 in CRITERIA_CATALOG is Chapter 2, severity "critical" (EPP & Salud)
  const visit = {
    id: "v-test-3",
    farm: "Finca Aurora",
    lot: "Lote 4",
    crop: "Hortensias",
    date: "2026-03-10",
    responsible: "Ing. Laura P.",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "2.2": {
        value: "NO",
        observation: "Dosificador sin máscara de protección respiratoria",
        photos: ["https://example.com/p1.jpg"]
      }
    }
  };

  const intel = aggregateIntelligence([visit]);
  const rvm = buildRiskMatrixViewModel([visit], CRITERIA_CATALOG, CHAPTER_INFO, {}, intel);

  assert.equal(rvm.totalFindings, 1, "Debe registrarse exactamente 1 no conformidad");
  assert.equal(rvm.counts.critical, 1, "El conteo crítico debe ser 1");
  const finding = rvm.findingsList[0];
  assert.equal(finding.criterionId, "2.2");
  assert.equal(finding.severityKey, "critical");
  assert.equal(finding.severityLabel, "Crítico");
  assert.equal(finding.severityRank, 1);
  assert.equal(finding.priorityTier.num, 1);
  assert.equal(finding.priorityTier.label, "Prioridad 1 — Inmediata");
  assert.equal(finding.hasEvidence, true);
  console.log("   ✓ Test 3 superado: Criterio NO mapeado correctamente a severidad Crítica y Prioridad 1.");
}

// --------------------------------------------------------------------------
// TEST 4: Criterio "NO" sin severidad se etiqueta como "Sin clasificar"
// --------------------------------------------------------------------------
console.log("Test 4: Criterio 'NO' sin severidad se etiqueta como 'Sin clasificar'");
{
  // Catalog with a criterion without severity
  const customCatalog = {
    "9.9": {
      chapter: 1,
      text: "Criterio experimental sin severidad",
      category: "Especial",
      severity: null // No severity assigned
    }
  };

  const visit = {
    id: "v-test-4",
    farm: "Finca Experimental",
    lot: "Lote X",
    crop: "Crisantemos",
    date: "2026-03-12",
    chapters: [1],
    answers: {
      "9.9": { value: "NO", observation: "Desviación en protocolo de prueba" }
    }
  };

  const rvm = buildRiskMatrixViewModel([visit], customCatalog, CHAPTER_INFO, {}, { isFullyEvaluated: false });

  assert.equal(rvm.totalFindings, 1);
  assert.equal(rvm.counts.unclassified, 1, "Debe sumarse en unclassified");
  assert.equal(rvm.counts.critical, 0);
  assert.equal(rvm.counts.low, 0, "No debe inventarse que es Bajo");
  const f = rvm.findingsList[0];
  assert.equal(f.severityKey, "unclassified");
  assert.equal(f.severityLabel, "Sin clasificar");
  assert.equal(f.priorityTier.label, "Sin prioridad asignada");
  console.log("   ✓ Test 4 superado: Severidad no informada se etiqueta limpiamente como 'Sin clasificar'.");
}

// --------------------------------------------------------------------------
// TEST 5: Orden de prioridad respeta: Crítico > Alto > Medio > Bajo > Sin clasificar
// --------------------------------------------------------------------------
console.log("Test 5: Orden de prioridad estricto");
{
  const customCatalog = {
    "c-low": { chapter: 1, text: "Crit Bajo", severity: "low" },
    "c-crit": { chapter: 2, text: "Crit Crítico", severity: "critical" },
    "c-uncl": { chapter: 3, text: "Crit Sin Clasificar", severity: "" },
    "c-med": { chapter: 4, text: "Crit Medio", severity: "medium" },
    "c-high": { chapter: 5, text: "Crit Alto", severity: "high" }
  };

  const visit = {
    id: "v-test-5",
    farm: "Finca Integral",
    lot: "Lote Central",
    date: "2026-03-15",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "c-low": { value: "NO" },
      "c-crit": { value: "NO" },
      "c-uncl": { value: "NO" },
      "c-med": { value: "NO" },
      "c-high": { value: "NO" }
    }
  };

  const rvm = buildRiskMatrixViewModel([visit], customCatalog, CHAPTER_INFO, {}, { isFullyEvaluated: true });

  assert.equal(rvm.findingsList.length, 5);
  const severitiesOrder = rvm.findingsList.map(f => f.severityKey);
  assert.deepEqual(severitiesOrder, ["critical", "high", "medium", "low", "unclassified"], "El orden debe ser estrictamente Crítico > Alto > Medio > Bajo > Sin clasificar");
  console.log("   ✓ Test 5 superado: Jerarquía formal de prioridad técnica verificada sin alteraciones.");
}

// --------------------------------------------------------------------------
// TEST 6: Agrupación por área/causa refleja fielmente los capítulos/categorías oficiales
// --------------------------------------------------------------------------
console.log("Test 6: Agrupación oficial por áreas técnicas");
{
  const visit = {
    id: "v-test-6",
    farm: "Finca Sabana",
    lot: "Lote 2",
    date: "2026-03-18",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "1.1": { value: "NO" }, // Cap 1: Almacén
      "2.1": { value: "NO" }, // Cap 2: Dosificación (Critical)
      "2.2": { value: "NO" }, // Cap 2: Dosificación (High)
      "4.1": { value: "NO" }  // Cap 4: Mezclas
    }
  };

  const intel = aggregateIntelligence([visit]);
  const rvm = buildRiskMatrixViewModel([visit], CRITERIA_CATALOG, CHAPTER_INFO, {}, intel);

  // Check area 1
  assert.equal(rvm.areaStats[1].short, "Almacén");
  assert.ok(rvm.areaStats[1].title.includes("Almacén"));
  assert.equal(rvm.areaStats[1].findings, 1);
  assert.equal(rvm.areaStats[1].weightPct, 5);
  assert.equal(rvm.areaStats[1].pointsMax, 5.0);

  // Check area 2
  assert.equal(rvm.areaStats[2].short, "Dosificación");
  assert.equal(rvm.areaStats[2].title, "Medición y dosificación de PPC");
  assert.equal(rvm.areaStats[2].findings, 2);
  assert.equal(rvm.areaStats[2].weightPct, 30);
  assert.equal(rvm.areaStats[2].pointsMax, 30.0);

  // Check area 3 (clean)
  assert.equal(rvm.areaStats[3].short, "Transporte");
  assert.ok(rvm.areaStats[3].title.includes("Transporte"));
  assert.equal(rvm.areaStats[3].findings, 0);
  assert.equal(rvm.areaStats[3].predominantSeverity, "Ninguna (Conforme)");

  // Check HTML causes output contains both chapters
  const htmlCauses = renderRiskCauses(rvm);
  assert.ok(htmlCauses.includes("Almacén"), "Debe mostrar Almacén");
  assert.ok(htmlCauses.toLowerCase().includes("dosificación"), "Debe mostrar dosificación");
  assert.ok(htmlCauses.includes("Impacto Protocolo: 30% (30.0 pts)"), "Debe mostrar peso oficial de protocolo");
  console.log("   ✓ Test 6 superado: Desglose por áreas técnicas respeta capítulos oficiales y ponderaciones normativas.");
}

// --------------------------------------------------------------------------
// TEST 7: Auditoría parcial muestra advertencia de alcance y no infiere riesgos en capítulos no auditados
// --------------------------------------------------------------------------
console.log("Test 7: Auditoría parcial y advertencia de alcance");
{
  const visit = {
    id: "v-test-7",
    farm: "Finca Parcial",
    lot: "Lote P",
    date: "2026-03-20",
    chapters: [1, 2], // Only 2 of 5 chapters evaluated
    answers: {
      "1.1": { value: "NO" }
    }
  };

  const intel = aggregateIntelligence([visit]);
  const rvm = buildRiskMatrixViewModel([visit], CRITERIA_CATALOG, CHAPTER_INFO, { auditState: "partial" }, intel);

  assert.equal(rvm.isPartial, true, "isPartial debe ser true para auditoría parcial");
  assert.equal(rvm.areaStats[3].findings, 0, "Capítulo 3 no evaluado no debe tener hallazgos inferidos");
  assert.equal(rvm.areaStats[4].findings, 0, "Capítulo 4 no evaluado no debe tener hallazgos inferidos");
  assert.equal(rvm.areaStats[5].findings, 0, "Capítulo 5 no evaluado no debe tener hallazgos inferidos");

  const matrixHtml = renderRiskMatrix(rvm);
  assert.ok(
    matrixHtml.includes("Vista basada en auditoría parcial. Los riesgos identificados corresponden únicamente a los capítulos evaluados."),
    "Debe mostrar la advertencia textual explícita de auditoría parcial"
  );
  console.log("   ✓ Test 7 superado: Advertencia de alcance parcial verificada y sin inferencia en áreas no evaluadas.");
}

// --------------------------------------------------------------------------
// TEST 8: Drill-down de un riesgo muestra exactamente los datos registrados sin inventar campos
// --------------------------------------------------------------------------
console.log("Test 8: Drill-down de trazabilidad y evidencia");
{
  const findingWithEvidence = {
    id: "vis_123_2.1",
    visitId: "vis_123",
    criterionId: "2.1",
    criterionText: "Los manómetros de los equipos de aplicación deben estar calibrados",
    chapter: 2,
    chapterTitle: "Dosificación y Calibración",
    category: "Equipos",
    severityKey: "critical",
    severityLabel: "Crítico",
    severityClass: "badge-critical",
    farm: "Finca Bella Vista",
    lot: "Bloque 12",
    crop: "Rosas Freedom",
    date: "2026-03-22",
    reviewer: "Ing. Andrés Gómez",
    status: "Requiere atención inmediata",
    observation: "Manómetro de bomba fija con error de +15 PSI sobre patrón oficial",
    recommendation: "Reemplazar manómetro y verificar calibración con manómetro patrón",
    photos: ["https://cdn.example.com/manometro-falla.jpg"],
    measurements: { errorPsi: 15, patron: 40, medido: 55 },
    actionText: "Reemplazar manómetro y verificar calibración con manómetro patrón",
    followupStatus: "Abierto / En revisión"
  };

  const modalHtml = renderRiskDetailModal(findingWithEvidence);

  assert.ok(modalHtml.includes("Finca Bella Vista"), "Debe contener el nombre de la finca");
  assert.ok(modalHtml.includes("Bloque 12"), "Debe contener el lote registrado");
  assert.ok(modalHtml.includes("Rosas Freedom"), "Debe contener el cultivo");
  assert.ok(modalHtml.includes("2026-03-22"), "Debe contener la fecha");
  assert.ok(modalHtml.includes("Ing. Andrés Gómez"), "Debe contener el auditor real registrado");
  assert.ok(modalHtml.includes("Criterio 2.1"), "Debe contener el código oficial");
  assert.ok(modalHtml.includes("NO CONFORME (NO)"), "Debe certificar la condición observada");
  assert.ok(modalHtml.includes("Manómetro de bomba fija con error de +15 PSI"), "Debe contener la observación técnica real");
  assert.ok(modalHtml.includes("https://cdn.example.com/manometro-falla.jpg"), "Debe renderizar la foto registrada");

  // Also test empty evidence finding
  const findingNoEvidence = {
    id: "vis_124_1.1",
    criterionId: "1.1",
    chapter: 1,
    chapterTitle: "Almacén",
    category: "General",
    severityKey: "low",
    severityLabel: "Bajo",
    severityClass: "badge-low",
    farm: "Finca Silvestre",
    lot: "General",
    crop: "Flores",
    date: "2026-03-23",
    reviewer: "Sin auditor registrado",
    status: "Requiere atención",
    observation: "",
    recommendation: "",
    photos: [],
    actionText: "Acción requerida — pendiente de definición",
    followupStatus: "Sin seguimiento registrado"
  };

  const modalEmptyHtml = renderRiskDetailModal(findingNoEvidence);
  assert.ok(modalEmptyHtml.includes("Sin evidencia registrada en la auditoría."), "Debe mostrar el mensaje estándar oficial cuando no hay notas");
  assert.ok(modalEmptyHtml.includes("Sin fotografías adjuntas en la auditoría"), "Debe indicar ausencia de fotografías");
  assert.ok(modalEmptyHtml.includes("Sin auditor registrado"), "No debe inventar auditores ficticios");
  console.log("   ✓ Test 8 superado: Drill-down muestra con fidelidad documental la evidencia registrada sin alucinaciones.");
}

// --------------------------------------------------------------------------
// TEST 9: Periodo sin hallazgos muestra mensaje oficial de no registros
// --------------------------------------------------------------------------
console.log("Test 9: Periodo sin hallazgos y mensaje oficial de no registros");
{
  const cleanVisit = {
    id: "v-clean",
    farm: "Finca Modelo",
    lot: "Lote M",
    date: "2026-03-25",
    chapters: [1, 2, 3, 4, 5],
    answers: {
      "1.1": { value: "SI" },
      "2.1": { value: "SI" },
      "3.1": { value: "SI" },
      "4.1": { value: "SI" },
      "5.1": { value: "SI" }
    }
  };

  const intel = aggregateIntelligence([cleanVisit]);
  const rvm = buildRiskMatrixViewModel([cleanVisit], CRITERIA_CATALOG, CHAPTER_INFO, {}, intel);

  const topRisksHtml = renderTopRisksList(rvm);
  const actionsHtml = renderPriorityActions(rvm);

  assert.ok(
    topRisksHtml.includes("No se registran no conformidades en las auditorías evaluadas para este periodo."),
    "Top riesgos debe incluir el mensaje oficial exacto cuando no hay desviaciones"
  );
  assert.ok(
    actionsHtml.includes("No se registran no conformidades en las auditorías evaluadas para este periodo."),
    "Acciones prioritarias debe incluir el mensaje oficial exacto"
  );

  // Test empty audits list
  const emptyRvm = buildRiskMatrixViewModel([], CRITERIA_CATALOG, CHAPTER_INFO, {}, { isFullyEvaluated: false });
  const emptyHtml = renderTopRisksList(emptyRvm);
  assert.ok(
    emptyHtml.includes("No hay información suficiente para establecer una prioridad."),
    "Si no hay auditorías debe indicar falta de información suficiente"
  );
  console.log("   ✓ Test 9 superado: Manejo de estados sin desviaciones o sin auditorías cumple con la semántica oficial.");
}

// --------------------------------------------------------------------------
// TEST 10: Filtro por finca y lote aísla los riesgos correspondientes sin mezclar datos
// --------------------------------------------------------------------------
console.log("Test 10: Aislamiento estricto por finca y lote");
{
  const visits = [
    {
      id: "v-fincaA-lote1",
      farm: "Finca A",
      lot: "Lote 1",
      crop: "Rosas",
      date: "2026-03-26",
      chapters: [1, 2],
      answers: { "1.1": { value: "NO" } }
    },
    {
      id: "v-fincaA-lote2",
      farm: "Finca A",
      lot: "Lote 2",
      crop: "Rosas",
      date: "2026-03-27",
      chapters: [1, 2],
      answers: { "2.1": { value: "NO" } }
    },
    {
      id: "v-fincaB-lote1",
      farm: "Finca B",
      lot: "Lote 1",
      crop: "Claveles",
      date: "2026-03-28",
      chapters: [1, 2],
      answers: { "1.2": { value: "NO" } }
    }
  ];

  // Filter only Finca A, Lote 1
  const filteredVisits = filterVisits(visits, "Finca A", "all", "", "Lote 1");
  assert.equal(filteredVisits.length, 1, "Solo debe quedar 1 visita filtrada");
  assert.equal(filteredVisits[0].id, "v-fincaA-lote1");

  const intel = aggregateIntelligence(filteredVisits);
  const rvm = buildRiskMatrixViewModel(filteredVisits, CRITERIA_CATALOG, CHAPTER_INFO, { farm: "Finca A", lot: "Lote 1" }, intel);

  assert.equal(rvm.totalFindings, 1);
  assert.equal(rvm.findingsList[0].criterionId, "1.1");
  assert.equal(rvm.findingsList[0].farm, "Finca A");
  assert.equal(rvm.findingsList[0].lot, "Lote 1");

  // Ensure no contamination from Finca A Lote 2 or Finca B
  const criteriaFound = rvm.findingsList.map(f => f.criterionId);
  assert.ok(!criteriaFound.includes("2.1"), "No debe contaminar con hallazgos de Lote 2");
  assert.ok(!criteriaFound.includes("1.2"), "No debe contaminar con hallazgos de Finca B");
  console.log("   ✓ Test 10 superado: Filtros de contexto (finca y lote) aíslan de forma hermética los riesgos.");
}

console.log("============================================================");
console.log("✅ LOS 10 TESTS OBLIGATORIOS DE FASE 5 HAN PASADO EXITOSAMENTE");
console.log("============================================================");
