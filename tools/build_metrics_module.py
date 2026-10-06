#!/usr/bin/env python3
"""Build the professional Centro de Inteligencia MIPE Metrics Engine for AVGUST CARE 360."""

import sys
from pathlib import Path

METRICS_JS = r'''/**
 * Centro de Inteligencia MIPE — AVGUST CARE 360
 * Enterprise Agronomic Intelligence & Quality Assurance Engine
 *
 * Weighting Standard (100 Puntos MIPE):
 * - Cap 1: Almacén e inventarios de PPC (5%) - 4 criterios oficiales
 * - Cap 2: Medición y dosificación de PPC (30%) - 8 criterios oficiales (Crítico)
 * - Cap 3: Transporte interno de PPC (5%) - 4 criterios oficiales
 * - Cap 4: Preparación de mezclas y calidad de agua (30%) - 10 criterios oficiales (Crítico)
 * - Cap 5: Aplicación de PPC en campo y EPP (30%) - 11 criterios oficiales (Crítico)
 * Total: 100% (100 puntos máximos) · 37 criterios oficiales (Tf)
 */

(function () {
  "use strict";

  var ROOT_ID = "c360-metrics-board";

  var CHAPTER_WEIGHTS = {
    1: 0.05, // 5%
    2: 0.30, // 30%
    3: 0.05, // 5%
    4: 0.30, // 30%
    5: 0.30, // 30%
  };

  var CHAPTER_INFO = {
    1: { id: 1, title: "Almacén e inventarios de PPC", short: "Almacén", weight: 0.05, pts: 5.0, icon: "📦", critical: false, criteriaCount: 4 },
    2: { id: 2, title: "Medición y dosificación de PPC", short: "Dosificación", weight: 0.30, pts: 30.0, icon: "⚖️", critical: true, criteriaCount: 8 },
    3: { id: 3, title: "Transporte interno de PPC", short: "Transporte", weight: 0.05, pts: 5.0, icon: "🚜", critical: false, criteriaCount: 4 },
    4: { id: 4, title: "Preparación de mezclas", short: "Mezclas", weight: 0.30, pts: 30.0, icon: "🧪", critical: true, criteriaCount: 10 },
    5: { id: 5, title: "Aplicación de PPC en campo", short: "Aplicación", weight: 0.30, pts: 30.0, icon: "🌾", critical: true, criteriaCount: 11 },
  };

  var CRITERIA_CATALOG = {
    // Cap 1 (5% - 4 criterios oficiales Tf)
    "1.1": { id: "1.1", chapter: 1, text: "El producto cuenta con sello de seguridad, lote, fecha de fabricación y vencimiento, y registro ICA o INVIMA.", severity: "medium", category: "Trazabilidad" },
    "1.2": { id: "1.2", chapter: 1, text: "Las instalaciones del almacén cuentan con ficha técnica y hoja de seguridad de los productos.", severity: "medium", category: "Seguridad" },
    "1.3": { id: "1.3", chapter: 1, text: "El almacenamiento cumple con la matriz de compatibilidad.", severity: "high", category: "Almacenamiento" },
    "1.4": { id: "1.4", chapter: 1, text: "Existe información clara sobre entradas, salidas e inventarios actualizados de PPC.", severity: "medium", category: "Inventarios" },

    // Cap 2 (30% - 8 criterios oficiales Tf - Crítico)
    "2.1": { id: "2.1", chapter: 2, text: "El almacenista y dosificador cuentan con el programa de fumigación para cumplir las dosificaciones.", severity: "high", category: "Programa" },
    "2.2": { id: "2.2", chapter: 2, text: "La persona que dosifica utiliza todos los elementos de protección personal requeridos.", severity: "critical", category: "EPP & Salud" },
    "2.3": { id: "2.3", chapter: 2, text: "El almacén cuenta con kit de derrames.", severity: "high", category: "Emergencias" },
    "2.4": { id: "2.4", chapter: 2, text: "Los instrumentos para dosificación son precisos y están en buen estado.", severity: "critical", category: "Calibración" },
    "2.5": { id: "2.5", chapter: 2, text: "El sitio de dosificación cuenta con ventilación e iluminación adecuadas.", severity: "medium", category: "Infraestructura" },
    "2.6": { id: "2.6", chapter: 2, text: "La dosificación coincide con el programa de aspersión elaborado por el ingeniero MIPE.", severity: "critical", category: "Dosificación" },
    "2.7": { id: "2.7", chapter: 2, text: "El producto sale del almacén identificado con bloque, blanco biológico, dosis y cantidad total.", severity: "high", category: "Despacho" },
    "2.8": { id: "2.8", chapter: 2, text: "Cuando el producto se entrega en su envase original, se retira el sello, se tacha la etiqueta y se identifica el envase para minimizar el riesgo de pérdida.", severity: "medium", category: "Control" },

    // Cap 3 (5% - 4 criterios oficiales Tf)
    "3.1": { id: "3.1", chapter: 3, text: "La persona que recibe los productos cuenta con los elementos de protección personal.", severity: "high", category: "EPP & Salud" },
    "3.2": { id: "3.2", chapter: 3, text: "La persona que recibe los productos verifica lo entregado vs el programa de aspersión.", severity: "medium", category: "Verificación" },
    "3.3": { id: "3.3", chapter: 3, text: "Los productos son transportados en un vehiculo seguro y señalizado hasta el lugar de preparación de la mezcla.", severity: "high", category: "Transporte" },
    "3.4": { id: "3.4", chapter: 3, text: "El vehiculo de transporte interno cuenta con kit de derrames.", severity: "medium", category: "Seguridad" },

    // Cap 4 (30% - 10 criterios oficiales Tf - Crítico)
    "4.1": { id: "4.1", chapter: 4, text: "Si el producto no se pesa en almacen, se cuenta en campo con los equipos necesarios y en buen estado para la dosificación acorde a la programación.", severity: "high", category: "Equipos" },
    "4.2": { id: "4.2", chapter: 4, text: "El bombero cuenta con el programa de fumigación.", severity: "high", category: "Programa" },
    "4.3": { id: "4.3", chapter: 4, text: "El bombero cuenta con los elementos de protección personal.", severity: "critical", category: "EPP & Salud" },
    "4.4": { id: "4.4", chapter: 4, text: "Los tanques de preparación estan debidamente aforados.", severity: "high", category: "Aforo" },
    "4.5": { id: "4.5", chapter: 4, text: "El tanque cuenta con agitación que permita la homogeneidad de la mezcla al momento de la aplicación.", severity: "critical", category: "Agitación" },
    "4.6": { id: "4.6", chapter: 4, text: "La calidad del agua cuenta con los parametros adecuados para la aplicación (dureza <70ppm - pH: 5.5-6-5).", severity: "critical", category: "Calidad Agua" },
    "4.7": { id: "4.7", chapter: 4, text: "Se realiza debidamente la premezcla de los ppc´s.", severity: "high", category: "Premezcla" },
    "4.8": { id: "4.8", chapter: 4, text: "El orden de mezcla se realiza adecuadamente (corrector de dureza y pH, coadyuvantes, polvos y líquidos de mayor a menor densidad).", severity: "critical", category: "Orden Mezcla" },
    "4.9": { id: "4.9", chapter: 4, text: "Se realiza triple lavado a cada contenedor y su contenido es depositado en el tanque de mezcla perforando envases hacia centro de acopio.", severity: "high", category: "Triple Lavado" },
    "4.10": { id: "4.10", chapter: 4, text: "Se verifica dureza y pH de mezcla final para corregir en caso de ser necesario.", severity: "high", category: "Calidad Final" },

    // Cap 5 (30% - 11 criterios oficiales Tf - Crítico)
    "5.1": { id: "5.1", chapter: 5, text: "Se tiene en cuenta la presión de salida de la bomba al momento de la aplicación.", severity: "high", category: "Presión" },
    "5.2": { id: "5.2", chapter: 5, text: "¿Se realiza aforo de boquillas? ¿Cuál es la frecuencia?", severity: "critical", category: "Aforo Boquillas" },
    "5.3": { id: "5.3", chapter: 5, text: "Los implementos de aspersión se encuentran limpios, en buen estado y sin fugas o taponamientos (bomba, mangueras, filtros, boquillas, lanzas).", severity: "critical", category: "Equipos" },
    "5.4": { id: "5.4", chapter: 5, text: "Se tiene en cuenta y se registra temperatura y humedad relativa al momento de realizar la aplicación.", severity: "high", category: "Clima" },
    "5.5": { id: "5.5", chapter: 5, text: "La cuadrilla de aplicadores cuenta con los epp's requeridos para la labor y se usan adecuadamente.", severity: "critical", category: "EPP & Salud" },
    "5.6": { id: "5.6", chapter: 5, text: "Antes de comenzar la aplicación la cuadrilla recibe instrucciones respecto a la misma (productos, blancos biológicos, tiempo, volumen).", severity: "medium", category: "Instrucción" },
    "5.7": { id: "5.7", chapter: 5, text: "La tecnica de aplicación (tiempos por cama, direccionamiento de equipos, presión de salida, cubrimientos) esta acorde con lo programado.", severity: "critical", category: "Técnica" },
    "5.8": { id: "5.8", chapter: 5, text: "El area tratada esta cerrada y tiene tablero de identificación que contenga la información de los ppc's aplicados y horas de reingreso.", severity: "critical", category: "Señalización & Reingreso" },
    "5.9": { id: "5.9", chapter: 5, text: "Si sobra o falta producto en la aplicación se informa al ingeniero MIPE y se hace dosificación del producto faltante para completar la aplicación.", severity: "high", category: "Control Aplicación" },
    "5.10": { id: "5.10", chapter: 5, text: "Se asegura la limpieza de los equipos al finalizar cada aplicación con el fin de que no haya contaminación con la siguiente aplicación.", severity: "critical", category: "Limpieza Equipos" },
    "5.11": { id: "5.11", chapter: 5, text: "La aplicación se registra en el formato de aplicaciones correspondiente al bloque.", severity: "medium", category: "Registro" },
  };

  // Internal reactive state
  var state = {
    subTab: "overview", // 'overview', 'chapters', 'benchmark', 'risks', 'simulator'
    farm: "",
    lot: "",
    range: "all", // 'all', '30d', '90d', '365d', 'year'
    crop: "",
    auditState: "all", // 'all', 'complete', 'partial'
    mobileDrawerOpen: false,
    search: "",
    selectedChapter: 2,
    severityFilter: "all",
    statusFilter: "all",
    simValues: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    simTouched: false,
    expandedFindings: {},
    selectedCompareFarms: [],
    selectedFindingId: null,
    visits: [],
    loading: false,
    isSyncing: false,
    initialized: false
  };

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function norm(str) {
    return String(str || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* ------------------------------------------------------------------ *
   * Calculations Engine (Audited & Verified Formal Arithmetic)
   * ------------------------------------------------------------------ */

  function calculateVisitScore(visit) {
    if (!visit || !visit.answers) {
      return {
        pointsEarned: 0.0,
        criteriaCompliance: null,
        weightedScore: null,
        auditedWeight: 0.0,
        chapterScores: {},
        chapterPoints: {},
        evaluatedChapters: [],
        findingsCount: 0,
        applicableCount: 0,
        positiveCount: 0
      };
    }

    var selectedChapters = Array.isArray(visit.chapters) && visit.chapters.length
      ? visit.chapters.map(Number)
      : [1, 2, 3, 4, 5];

    var chapterScores = {};
    var chapterPoints = {};
    var evaluatedChapters = [];
    var totalPointsEarned = 0;
    var totalAuditedWeight = 0;
    var totalFindings = 0;
    var totalApplicable = 0;
    var totalPositive = 0;

    [1, 2, 3, 4, 5].forEach(function (chId) {
      var isIncluded = selectedChapters.includes(chId);
      var w = CHAPTER_WEIGHTS[chId] || 0;
      var applicable = 0;
      var positive = 0;
      var findings = 0;

      if (isIncluded) {
        Object.keys(CRITERIA_CATALOG).forEach(function (critId) {
          if (CRITERIA_CATALOG[critId].chapter === chId) {
            var ans = visit.answers[critId];
            var val = ans ? (typeof ans === "string" ? ans : ans.value) : null;
            if (val === "SI" || val === "NO") {
              applicable++;
              totalApplicable++;
              if (val === "SI") {
                positive++;
                totalPositive++;
              }
              if (val === "NO") {
                findings++;
                totalFindings++;
              }
            }
          }
        });
      }

      // MATHEMATICAL RULE: Evaluated if and only if chapter included AND applicable criteria > 0
      if (isIncluded && applicable > 0) {
        var pct = (positive / applicable) * 100;
        var pts = (pct / 100) * (w * 100);
        chapterScores[chId] = Math.round(pct * 10) / 10;
        chapterPoints[chId] = Math.round(pts * 10) / 10;
        evaluatedChapters.push(chId);
        totalPointsEarned += pts;
        totalAuditedWeight += w;
      } else {
        // UNEVALUATED: Never 100%, exactly 0 points earned, null compliance
        chapterScores[chId] = null;
        chapterPoints[chId] = 0.0;
      }
    });

    var criteriaCompliance = totalApplicable > 0
      ? Math.round((totalPositive / totalApplicable) * 1000) / 10
      : null;

    var weightedScore = totalAuditedWeight > 0
      ? Math.round((totalPointsEarned / totalAuditedWeight) * 10) / 10
      : null;

    return {
      pointsEarned: Math.round(totalPointsEarned * 10) / 10,
      criteriaCompliance: criteriaCompliance,
      weightedScore: weightedScore,
      auditedWeight: Math.round(totalAuditedWeight * 100) / 100,
      isFullyEvaluated: evaluatedChapters.length === 5 && totalAuditedWeight >= 0.99,
      evaluatedChaptersCount: evaluatedChapters.length,
      chapterScores: chapterScores,
      chapterPoints: chapterPoints,
      evaluatedChapters: evaluatedChapters,
      findingsCount: totalFindings,
      applicableCount: totalApplicable,
      positiveCount: totalPositive
    };
  }

  function filterVisits(visits, farm, range, crop, lot, auditState) {
    var now = new Date();
    return (visits || []).filter(function (v) {
      if (!v) return false;
      if (farm && norm(v.farm) !== norm(farm)) return false;
      if (crop && norm(v.crop) !== norm(crop)) return false;
      if (lot) {
        var vLot = v.lot || v.block || v.bloque || v.lote;
        if (!vLot || norm(vLot) !== norm(lot)) return false;
      }
      if (auditState && auditState !== "all") {
        var score = calculateVisitScore(v);
        var evalCount = score.evaluatedChapters.length;
        if (auditState === "complete" && evalCount < 5) return false;
        if (auditState === "partial" && evalCount >= 5) return false;
      }
      if (range && range !== "all") {
        if (!v.date) return false;
        var vDate = new Date(v.date + "T12:00:00");
        var diffDays = (now - vDate) / (1000 * 60 * 60 * 24);
        if (range === "30d" && diffDays > 30) return false;
        if (range === "90d" && diffDays > 90) return false;
        if ((range === "365d" || range === "12m") && diffDays > 365) return false;
        if (range === "year" && vDate.getFullYear() !== now.getFullYear()) return false;
      }
      return true;
    });
  }

  function aggregateIntelligence(filteredVisits, isSub) {
    // Defensively deduplicate visits by unique ID / farm+date (Warning W-01)
    var uniqueVisits = [];
    var seenIds = {};
    (filteredVisits || []).forEach(function (v) {
      if (!v) return;
      var vid = v.id || (v.farm + "_" + v.date + "_" + (v.responsible || ""));
      if (!seenIds[vid]) {
        seenIds[vid] = true;
        uniqueVisits.push(v);
      }
    });

    var totalVisits = uniqueVisits.length;
    var reviewedVisits = uniqueVisits.filter(function (v) { return v.reviewed !== false; });
    var scoredVisits = [];
    var chapterTotals = {
      1: { pos: 0, app: 0, findings: 0, visitsAudited: 0 },
      2: { pos: 0, app: 0, findings: 0, visitsAudited: 0 },
      3: { pos: 0, app: 0, findings: 0, visitsAudited: 0 },
      4: { pos: 0, app: 0, findings: 0, visitsAudited: 0 },
      5: { pos: 0, app: 0, findings: 0, visitsAudited: 0 }
    };
    var criteriaStats = {};

    Object.keys(CRITERIA_CATALOG).forEach(function (cid) {
      criteriaStats[cid] = { id: cid, applicable: 0, positive: 0, findings: 0, observations: [], recommendations: [] };
    });

    reviewedVisits.forEach(function (v) {
      var calc = calculateVisitScore(v);
      if (calc.criteriaCompliance != null) {
        scoredVisits.push({ visit: v, calc: calc });
      }

      var selectedChapters = Array.isArray(v.chapters) && v.chapters.length
        ? v.chapters.map(Number)
        : [1, 2, 3, 4, 5];

      [1, 2, 3, 4, 5].forEach(function (ch) {
        if (!selectedChapters.includes(ch)) return;

        var chApplicableInVisit = 0;
        Object.keys(CRITERIA_CATALOG).forEach(function (cid) {
          if (CRITERIA_CATALOG[cid].chapter !== ch) return;
          var ans = v.answers ? v.answers[cid] : null;
          var val = ans ? (typeof ans === "string" ? ans : ans.value) : null;
          var obs = ans && typeof ans === "object" ? ans.observation : "";
          var rec = ans && typeof ans === "object" ? ans.recommendation : "";

          if (val === "SI" || val === "NO") {
            chApplicableInVisit++;
            criteriaStats[cid].applicable++;
            chapterTotals[ch].app++;
            if (val === "SI") {
              criteriaStats[cid].positive++;
              chapterTotals[ch].pos++;
            }
            if (val === "NO") {
              criteriaStats[cid].findings++;
              chapterTotals[ch].findings++;
              if (obs || rec) {
                criteriaStats[cid].observations.push({
                  farm: v.farm,
                  date: v.date,
                  observation: obs,
                  recommendation: rec,
                  reviewer: v.responsible || v.reviewer || "Ing. Técnico"
                });
              }
            }
          }
        });

        if (chApplicableInVisit > 0) {
          chapterTotals[ch].visitsAudited++;
        }
      });
    });

    // Compute Chapter Performance
    var chapterPerformance = {};
    var totalPointsEarned = 0;
    var totalAuditedWeight = 0;
    var evaluatedChaptersCount = 0;
    var totalEvaluatedApp = 0;
    var totalEvaluatedPos = 0;

    [1, 2, 3, 4, 5].forEach(function (ch) {
      var cData = chapterTotals[ch];
      var w = CHAPTER_WEIGHTS[ch];
      var maxPts = w * 100;
      var isEvaluated = cData.app > 0;
      var compliance = isEvaluated ? (cData.pos / cData.app) * 100 : null;
      var pointsEarned = isEvaluated ? (compliance / 100) * maxPts : 0.0;

      if (isEvaluated) {
        evaluatedChaptersCount++;
        totalPointsEarned += pointsEarned;
        totalAuditedWeight += w;
        totalEvaluatedApp += cData.app;
        totalEvaluatedPos += cData.pos;
      }

      chapterPerformance[ch] = {
        id: ch,
        isEvaluated: isEvaluated,
        compliance: compliance != null ? Math.round(compliance * 10) / 10 : null,
        pointsEarned: Math.round(pointsEarned * 10) / 10,
        maxPoints: maxPts,
        applicable: cData.app,
        positive: cData.pos,
        findings: cData.findings,
        visitsAudited: cData.visitsAudited,
        info: CHAPTER_INFO[ch]
      };
    });

    // 1. Puntos MIPE Ganados (Escala 100.0 pts)
    var globalPoints = Math.round(totalPointsEarned * 10) / 10;
    
    // 2. Cumplimiento sobre lo Evaluado (Tasa de Criterios Conformes)
    var criteriaCompliance = totalEvaluatedApp > 0
      ? Math.round((totalEvaluatedPos / totalEvaluatedApp) * 1000) / 10
      : null;

    // 3. Desempeño Ponderado sobre lo Evaluado
    var weightedScore = totalAuditedWeight > 0
      ? Math.round((totalPointsEarned / totalAuditedWeight) * 10) / 10
      : null;

    var coveragePct = Math.round(totalAuditedWeight * 100);
    var isFullyEvaluated = evaluatedChaptersCount === 5;

    // Prioritized Risk Matrix (Strictly non-negative and deterministic)
    var rankedCriteria = Object.keys(criteriaStats).map(function (cid) {
      var item = CRITERIA_CATALOG[cid];
      var stat = criteriaStats[cid];
      var failRate = stat.applicable > 0 ? (stat.findings / stat.applicable) : 0;
      var sevWeight = item.severity === "critical" ? 3 : (item.severity === "high" ? 2 : 1);
      var chWeight = CHAPTER_WEIGHTS[item.chapter];
      var riskIndex = Math.round(failRate * sevWeight * chWeight * 1000) / 10;
      return {
        id: cid,
        item: item,
        stat: stat,
        failRate: Math.round(failRate * 100),
        riskIndex: riskIndex,
        occurrences: stat.findings
      };
    }).filter(function (x) { return x.occurrences > 0; }).sort(function (a, b) { return b.riskIndex - a.riskIndex; });

    // Timeline Aggregation (Guarded: only valid finite numbers)
    var monthlyMap = {};
    scoredVisits.forEach(function (sv) {
      var d = sv.visit.date || "";
      var monthKey = d.substring(0, 7); // YYYY-MM
      var val = sv.calc.criteriaCompliance;
      if (typeof val === "number" && !isNaN(val)) {
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = [];
        monthlyMap[monthKey].push(val);
      }
    });

    var timeline = Object.keys(monthlyMap).sort().map(function (mKey) {
      var arr = monthlyMap[mKey];
      var avg = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
      return { month: mKey, score: Math.round(avg * 10) / 10, count: arr.length };
    });

    // Farm Benchmark Ranking (Strict complete audit priority + points tiebreaker)
    var farmRanking = [];
    if (!isSub) {
      var farmMap = {};
      filteredVisits.forEach(function (v) {
        var fn = v.farm || "Sin asignar";
        if (!farmMap[fn]) farmMap[fn] = { farm: fn, crop: v.crop || "Flores", visits: [], lastDate: v.date || "" };
        farmMap[fn].visits.push(v);
        if (v.date && v.date > farmMap[fn].lastDate) farmMap[fn].lastDate = v.date;
        if (v.crop) farmMap[fn].crop = v.crop;
      });

      farmRanking = Object.keys(farmMap).map(function (fn) {
        var fObj = farmMap[fn];
        var fAgg = aggregateIntelligence(fObj.visits, true);
        return {
          farm: fn,
          crop: fObj.crop,
          visitsCount: fObj.visits.length,
          lastDate: fObj.lastDate,
          globalPoints: fAgg.globalPoints,
          criteriaCompliance: fAgg.criteriaCompliance,
          weightedScore: fAgg.weightedScore,
          evaluatedChaptersCount: fAgg.evaluatedChaptersCount,
          isFullyEvaluated: fAgg.isFullyEvaluated,
          coveragePct: fAgg.coveragePct,
          chapters: fAgg.chapterPerformance,
          findingsCount: fAgg.totalFindings
        };
      }).sort(function (a, b) {
        // 1. Fully evaluated audits ALWAYS precede partial audits
        if (a.isFullyEvaluated !== b.isFullyEvaluated) {
          return a.isFullyEvaluated ? -1 : 1;
        }
        // 2. Official MIPE points earned descending
        var sa = a.globalPoints != null ? a.globalPoints : -1;
        var sb = b.globalPoints != null ? b.globalPoints : -1;
        if (sb !== sa) return sb - sa;
        // 3. Criteria compliance descending
        var ca = a.criteriaCompliance != null ? a.criteriaCompliance : -1;
        var cb = b.criteriaCompliance != null ? b.criteriaCompliance : -1;
        if (cb !== ca) return cb - ca;
        // 4. Deterministic farm name tiebreaker
        return a.farm.localeCompare(b.farm, "es");
      });
    }

    return {
      globalPoints: globalPoints,
      criteriaCompliance: criteriaCompliance,
      weightedScore: weightedScore,
      coveragePct: coveragePct,
      evaluatedChaptersCount: evaluatedChaptersCount,
      isFullyEvaluated: isFullyEvaluated,
      totalVisits: totalVisits,
      reviewedCount: reviewedVisits.length,
      totalFindings: Object.keys(criteriaStats).reduce(function (acc, k) { return acc + criteriaStats[k].findings; }, 0),
      chapterPerformance: chapterPerformance,
      criteriaStats: criteriaStats,
      rankedCriteria: rankedCriteria,
      timeline: timeline,
      farmRanking: farmRanking
    };
  }

  /* ------------------------------------------------------------------ *
   * UI Rendering (Design Untouched · KPI Mathematical Integrity)
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * ViewModel Builder & Enterprise Architecture State
   * ------------------------------------------------------------------ */

  function getConnectivityState() {
    var isOnline = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;

    var pendingCount = 0;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var draft = window.localStorage.getItem("c360_draft");
        if (draft) pendingCount += 1;
        var pendingQueue = window.localStorage.getItem("c360_sync_queue");
        if (pendingQueue) {
          var parsed = JSON.parse(pendingQueue);
          if (Array.isArray(parsed)) pendingCount += parsed.length;
        }
      }
    } catch (e) {
      // Local storage inaccessible
    }

    if (!isOnline) {
      return {
        online: false,
        statusText: "OFFLINE · Datos locales",
        statusClass: "offline",
        pendingCount: pendingCount
      };
    }

    if (pendingCount > 0) {
      return {
        online: true,
        statusText: pendingCount + " cambio" + (pendingCount === 1 ? "" : "s") + " pendiente" + (pendingCount === 1 ? "" : "s"),
        statusClass: "pending",
        pendingCount: pendingCount
      };
    }

    return {
      online: true,
      statusText: "ONLINE",
      statusClass: "online",
      pendingCount: 0
    };
  }

  function extractAvailableOptions(visits, selectedFarm) {
    var farmSet = new Set();
    var cropSet = new Set();
    var lotSet = new Set();

    (visits || []).forEach(function (v) {
      if (!v) return;
      if (v.farm) farmSet.add(v.farm.trim());
      if (v.crop) cropSet.add(v.crop.trim());

      var matchesFarm = !selectedFarm || norm(v.farm) === norm(selectedFarm);
      if (matchesFarm) {
        var lotVal = v.lot || v.block || v.bloque || v.lote;
        if (lotVal && typeof lotVal === "string" && lotVal.trim()) {
          lotSet.add(lotVal.trim());
        }
      }
    });

    return {
      availableFarms: Array.from(farmSet).sort(function (a, b) { return a.localeCompare(b, "es"); }),
      availableCrops: Array.from(cropSet).sort(function (a, b) { return a.localeCompare(b, "es"); }),
      availableLots: Array.from(lotSet).sort(function (a, b) { return a.localeCompare(b, "es"); })
    };
  }

  /* ------------------------------------------------------------------ *
   * FASE 4: Trend ViewModel & Farm Benchmark ViewModel Builders
   * ------------------------------------------------------------------ */

  function buildTrendViewModel(filteredVisits, filters, calculateVisitScoreFn) {
    var visits = (filteredVisits || []).filter(function (v) { return !!v; });
    var filterLot = filters && filters.lot ? filters.lot : "";

    var sorted = visits.slice().sort(function (a, b) {
      var da = a.date || "";
      var db = b.date || "";
      return da.localeCompare(db);
    });

    var series = [];
    sorted.forEach(function (v) {
      var calc = v.calc;
      if (!calc && typeof calculateVisitScoreFn === "function") {
        calc = calculateVisitScoreFn(v);
      }
      if (!calc) return;

      var pts = typeof calc.pointsEarned === "number" && !isNaN(calc.pointsEarned)
        ? Math.round(calc.pointsEarned * 10) / 10
        : 0.0;
      var coverage = typeof calc.auditedWeight === "number"
        ? Math.round(calc.auditedWeight * 100)
        : 0;
      var isFull = !!calc.isFullyEvaluated;
      var evalCaps = calc.evaluatedChaptersCount || 0;

      series.push({
        id: v.id || ("v_" + Math.random().toString(36).substr(2, 9)),
        date: v.date || "Sin fecha",
        farm: v.farm || "Sin asignar",
        lot: v.lot || v.block || "General",
        crop: v.crop || "Cultivo",
        officialScore: pts,
        criteriaCompliance: calc.criteriaCompliance,
        coveragePct: coverage,
        isFullyEvaluated: isFull,
        evaluatedChaptersCount: evalCaps,
        auditState: isFull ? "complete" : (evalCaps > 0 ? "partial" : "unevaluated")
      });
    });

    var count = series.length;
    var hasData = count > 0;
    var currentPoint = hasData ? series[count - 1] : null;
    var previousPoint = count >= 2 ? series[count - 2] : null;

    var delta = null;
    var deltaText = "Sin comparación disponible";
    var deltaDirection = "neutral";
    var isComparable = false;
    var scopeMismatch = false;
    var scopeMismatchText = "";

    if (currentPoint && previousPoint) {
      var sameFarm = norm(currentPoint.farm) === norm(previousPoint.farm);
      var sameLot = !filterLot || (norm(currentPoint.lot) === norm(previousPoint.lot));

      if (sameFarm && sameLot) {
        isComparable = true;
        delta = Math.round((currentPoint.officialScore - previousPoint.officialScore) * 10) / 10;
        if (delta > 0) {
          deltaText = "↑ +" + delta.toFixed(1) + " pts";
          deltaDirection = "up";
        } else if (delta < 0) {
          deltaText = "↓ " + delta.toFixed(1) + " pts";
          deltaDirection = "down";
        } else {
          deltaText = "= 0.0 pts (Estable)";
          deltaDirection = "stable";
        }

        if (currentPoint.isFullyEvaluated !== previousPoint.isFullyEvaluated) {
          scopeMismatch = true;
          var curScope = currentPoint.isFullyEvaluated ? "Completa (100%)" : "Parcial (" + currentPoint.coveragePct + "%)";
          var prevScope = previousPoint.isFullyEvaluated ? "Completa (100%)" : "Parcial (" + previousPoint.coveragePct + "%)";
          scopeMismatchText = "Comparación con alcance diferente: Actual (" + curScope + ") vs Anterior (" + prevScope + ")";
        }
      } else {
        deltaText = "Auditorías de diferentes lotes/fincas";
        deltaDirection = "neutral";
      }
    } else if (count === 1) {
      deltaText = "Línea base (" + currentPoint.date + ")";
      deltaDirection = "neutral";
    }

    return {
      hasData: hasData,
      count: count,
      series: series,
      currentPoint: currentPoint,
      previousPoint: previousPoint,
      delta: delta,
      deltaText: deltaText,
      deltaDirection: deltaDirection,
      isComparable: isComparable,
      scopeMismatch: scopeMismatch,
      scopeMismatchText: scopeMismatchText,
      targetScore: 95.0,
      aggregationRule: "Orden cronológico de auditorías individuales evaluadas en el contexto activo (finca, lote, periodo), utilizando los Puntos MIPE oficiales (0-100 pts) calculados por el motor oficial."
    };
  }

  function buildBenchmarkViewModel(allVisits, filters, selectedCompareFarms, aggregateIntelligenceFn, availableFarmsList) {
    var visits = (allVisits || []).filter(function (v) { return !!v; });
    var activeFarm = filters && filters.farm ? filters.farm : "";
    var selectedFarms = Array.isArray(selectedCompareFarms) ? selectedCompareFarms.slice(0, 3) : [];

    var farmMap = {};
    visits.forEach(function (v) {
      var fn = v.farm || "Sin asignar";
      if (!farmMap[fn]) {
        farmMap[fn] = {
          farm: fn,
          crop: v.crop || "Flores",
          visits: [],
          lastDate: v.date || ""
        };
      }
      farmMap[fn].visits.push(v);
      if (v.date && (!farmMap[fn].lastDate || v.date > farmMap[fn].lastDate)) {
        farmMap[fn].lastDate = v.date;
      }
      if (v.crop) farmMap[fn].crop = v.crop;
    });

    if (Array.isArray(availableFarmsList)) {
      availableFarmsList.forEach(function (af) {
        if (af && !farmMap[af]) {
          farmMap[af] = {
            farm: af,
            crop: "Sin cultivo asignado",
            visits: [],
            lastDate: ""
          };
        }
      });
    }

    var farmItems = Object.keys(farmMap).map(function (fn) {
      var fObj = farmMap[fn];
      var hasVisits = fObj.visits.length > 0;
      var fAgg = hasVisits && typeof aggregateIntelligenceFn === "function"
        ? aggregateIntelligenceFn(fObj.visits, true)
        : null;

      var officialScore = fAgg && fAgg.globalPoints != null ? fAgg.globalPoints : null;
      var compliance = fAgg && fAgg.criteriaCompliance != null ? fAgg.criteriaCompliance : null;
      var isFull = fAgg ? !!fAgg.isFullyEvaluated : false;
      var evalCaps = fAgg ? fAgg.evaluatedChaptersCount : 0;
      var coverage = fAgg ? fAgg.coveragePct : 0;
      var findingsCount = fAgg ? fAgg.totalFindings : 0;
      var chapters = fAgg ? fAgg.chapterPerformance : {};

      return {
        farm: fn,
        crop: fObj.crop,
        visitsCount: fObj.visits.length,
        lastDate: fObj.lastDate,
        officialScore: officialScore,
        criteriaCompliance: compliance,
        coveragePct: coverage,
        evaluatedChaptersCount: evalCaps,
        isFullyEvaluated: isFull,
        auditState: isFull ? "complete" : (evalCaps > 0 ? "partial" : (hasVisits ? "unevaluated" : "nodata")),
        findingsCount: findingsCount,
        chapters: chapters,
        hasData: hasVisits,
        isSelectedForCompare: selectedFarms.some(function (sf) { return norm(sf) === norm(fn); }),
        isCurrentActiveFarm: norm(activeFarm) === norm(fn)
      };
    });

    var evaluatedFarms = farmItems.filter(function (f) { return f.hasData && f.officialScore != null; });
    var insufficientFarms = farmItems.filter(function (f) { return !f.hasData || f.officialScore == null; });

    evaluatedFarms.sort(function (a, b) {
      if (a.isFullyEvaluated !== b.isFullyEvaluated) {
        return a.isFullyEvaluated ? -1 : 1;
      }
      var sa = a.officialScore != null ? a.officialScore : -1;
      var sb = b.officialScore != null ? b.officialScore : -1;
      if (sb !== sa) return sb - sa;

      var ca = a.criteriaCompliance != null ? a.criteriaCompliance : -1;
      var cb = b.criteriaCompliance != null ? b.criteriaCompliance : -1;
      if (cb !== ca) return cb - ca;

      return a.farm.localeCompare(b.farm, "es");
    });

    var currentRank = 1;
    evaluatedFarms.forEach(function (f, idx) {
      var prev = idx > 0 ? evaluatedFarms[idx - 1] : null;
      var isTiedPrev = prev &&
        prev.isFullyEvaluated === f.isFullyEvaluated &&
        prev.officialScore === f.officialScore;

      var next = idx < evaluatedFarms.length - 1 ? evaluatedFarms[idx + 1] : null;
      var isTiedNext = next &&
        next.isFullyEvaluated === f.isFullyEvaluated &&
        next.officialScore === f.officialScore;

      var isTied = isTiedPrev || isTiedNext;
      f.isTied = isTied;

      if (!isTiedPrev) {
        currentRank = idx + 1;
      }
      f.rankNumber = currentRank;
      f.rankDisplay = isTied ? "#" + currentRank + " (Empate)" : "#" + currentRank;
    });

    var hasComplete = evaluatedFarms.some(function (f) { return f.isFullyEvaluated; });
    var hasPartial = evaluatedFarms.some(function (f) { return !f.isFullyEvaluated; });
    var isContextualBenchmark = hasComplete && hasPartial;

    var comparedObjects = [];
    if (selectedFarms.length > 0) {
      comparedObjects = selectedFarms.map(function (sf) {
        return farmItems.find(function (f) { return norm(f.farm) === norm(sf); }) || {
          farm: sf,
          crop: "Desconocido",
          hasData: false,
          officialScore: null,
          coveragePct: 0,
          evaluatedChaptersCount: 0,
          isFullyEvaluated: false,
          auditState: "nodata",
          chapters: {}
        };
      });
    }

    return {
      activeFarm: activeFarm,
      selectedCompareFarms: selectedFarms,
      comparedObjects: comparedObjects,
      evaluatedFarms: evaluatedFarms,
      insufficientFarms: insufficientFarms,
      totalFarmsCount: farmItems.length,
      isContextualBenchmark: isContextualBenchmark
    };
  }

  /* ------------------------------------------------------------------ *
   * FASE 5: Risk Matrix, Causes, Priorities & Actions ViewModel Builder
   * ------------------------------------------------------------------ */

  var SEVERITY_CONFIG = {
    critical: { key: "critical", label: "Crítico", badgeClass: "badge-critical", rank: 1 },
    high: { key: "high", label: "Alto", badgeClass: "badge-high", rank: 2 },
    medium: { key: "medium", label: "Medio", badgeClass: "badge-medium", rank: 3 },
    low: { key: "low", label: "Bajo", badgeClass: "badge-low", rank: 4 },
    unclassified: { key: "unclassified", label: "Sin clasificar", badgeClass: "badge-unclassified", rank: 5 }
  };

  function normalizeSeverity(raw) {
    if (!raw) return SEVERITY_CONFIG.unclassified;
    var s = String(raw).toLowerCase().trim();
    if (s === "critical" || s === "critico" || s === "crítico") return SEVERITY_CONFIG.critical;
    if (s === "high" || s === "alto" || s === "alta") return SEVERITY_CONFIG.high;
    if (s === "medium" || s === "medio" || s === "media") return SEVERITY_CONFIG.medium;
    if (s === "low" || s === "bajo" || s === "baja") return SEVERITY_CONFIG.low;
    return SEVERITY_CONFIG.unclassified;
  }

  function getPriorityTier(sevKey) {
    if (sevKey === "critical") {
      return { num: 1, label: "Prioridad 1 — Inmediata", short: "P1", badgeClass: "badge-p1" };
    }
    if (sevKey === "high") {
      return { num: 2, label: "Prioridad 2 — Correctiva Corto Plazo", short: "P2", badgeClass: "badge-p2" };
    }
    if (sevKey === "medium") {
      return { num: 3, label: "Prioridad 3 — Preventiva / Mejora", short: "P3", badgeClass: "badge-p3" };
    }
    if (sevKey === "low") {
      return { num: 4, label: "Prioridad 4 — Verificación / Auditoría", short: "P4", badgeClass: "badge-p4" };
    }
    return { num: 5, label: "Sin prioridad asignada", short: "—", badgeClass: "badge-unclassified" };
  }

  function buildRiskMatrixViewModel(filteredVisits, criteriaCatalog, chapterInfo, activeFilters, intel) {
    var visits = (filteredVisits || []).filter(function (v) { return !!v; });
    var catalog = criteriaCatalog || {};
    var chInfo = chapterInfo || {};
    var filters = activeFilters || {};

    var findingsList = [];
    var counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unclassified: 0
    };

    var matrixGrid = {
      critical: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      high: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      medium: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      low: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      unclassified: { 1: [], 2: [], 3: [], 4: [], 5: [] }
    };

    var areaStats = {
      1: { id: 1, title: chInfo[1] ? chInfo[1].title : "Almacén", short: "Almacén", findings: 0, severities: {}, findingsList: [], weightPct: 5, pointsMax: 5.0 },
      2: { id: 2, title: chInfo[2] ? chInfo[2].title : "Dosificación", short: "Dosificación", findings: 0, severities: {}, findingsList: [], weightPct: 30, pointsMax: 30.0 },
      3: { id: 3, title: chInfo[3] ? chInfo[3].title : "Transporte", short: "Transporte", findings: 0, severities: {}, findingsList: [], weightPct: 5, pointsMax: 5.0 },
      4: { id: 4, title: chInfo[4] ? chInfo[4].title : "Mezclas", short: "Mezclas", findings: 0, severities: {}, findingsList: [], weightPct: 30, pointsMax: 30.0 },
      5: { id: 5, title: chInfo[5] ? chInfo[5].title : "Aplicación", short: "Aplicación", findings: 0, severities: {}, findingsList: [], weightPct: 30, pointsMax: 30.0 }
    };

    visits.forEach(function (v) {
      if (!v || !v.answers) return;

      var selectedChapters = Array.isArray(v.chapters) && v.chapters.length
        ? v.chapters.map(Number)
        : [1, 2, 3, 4, 5];

      Object.keys(v.answers).forEach(function (cid) {
        var cat = catalog[cid];
        if (!cat) return;
        var ch = cat.chapter;
        if (!selectedChapters.includes(ch)) return;

        var ans = v.answers[cid];
        var val = ans ? (typeof ans === "string" ? ans : ans.value) : null;
        if (val !== "NO") return;

        var rawSev = (typeof ans === "object" && ans.severity) ? ans.severity : cat.severity;
        var sevObj = normalizeSeverity(rawSev);
        counts[sevObj.key] = (counts[sevObj.key] || 0) + 1;

        var obsText = "";
        var recText = "";
        var photos = [];
        var measurements = null;

        if (typeof ans === "object" && ans !== null) {
          obsText = ans.observation || ans.comment || ans.obs || "";
          recText = ans.recommendation || ans.rec || "";
          if (Array.isArray(ans.photos)) photos = ans.photos;
          else if (ans.photo) photos = [ans.photo];
          else if (ans.image) photos = [ans.image];
          measurements = ans.measurements || ans.measurement || null;
        }

        var hasEvidence = photos.length > 0 || (obsText && obsText.trim().length > 0) || measurements !== null;
        var evidenceSummary = "";
        if (photos.length > 0 && obsText) {
          evidenceSummary = photos.length + " foto(s) y observación registrada";
        } else if (photos.length > 0) {
          evidenceSummary = photos.length + " fotografía(s) adjunta(s)";
        } else if (obsText) {
          evidenceSummary = "Nota técnica registrada";
        } else if (measurements) {
          evidenceSummary = "Medición registrada en campo";
        } else {
          evidenceSummary = "Sin evidencia registrada en la auditoría.";
        }

        var actionText = "";
        if (recText && recText.trim().length > 0) {
          actionText = recText.trim();
        } else {
          actionText = "Acción requerida — pendiente de definición";
        }

        var priorityTier = getPriorityTier(sevObj.key);

        var finding = {
          id: (v.id || "vis") + "_" + cid,
          visitId: v.id,
          criterionId: cid,
          criterionText: cat.text || "Criterio " + cid,
          chapter: ch,
          chapterTitle: chInfo[ch] ? chInfo[ch].title : "Capítulo " + ch,
          chapterShort: chInfo[ch] ? chInfo[ch].short : "Cap " + ch,
          category: cat.category || "General",
          severityKey: sevObj.key,
          severityLabel: sevObj.label,
          severityClass: sevObj.badgeClass,
          severityRank: sevObj.rank,
          priorityTier: priorityTier,
          farm: v.farm || "Sin asignar",
          lot: v.lot || v.block || "General",
          crop: v.crop || "Cultivo",
          date: v.date || "Sin fecha",
          reviewer: v.responsible || v.reviewer || v.evaluator || "Sin auditor registrado",
          status: v.status || "Requiere atención",
          observation: obsText,
          recommendation: recText,
          photos: photos,
          measurements: measurements,
          hasEvidence: hasEvidence,
          evidenceSummary: evidenceSummary,
          actionText: actionText,
          followupStatus: v.followupStatus || "Sin seguimiento registrado"
        };

        findingsList.push(finding);

        if (matrixGrid[sevObj.key] && matrixGrid[sevObj.key][ch]) {
          matrixGrid[sevObj.key][ch].push(finding);
        }

        if (areaStats[ch]) {
          areaStats[ch].findings++;
          areaStats[ch].severities[sevObj.key] = (areaStats[ch].severities[sevObj.key] || 0) + 1;
          areaStats[ch].findingsList.push(finding);
        }
      });
    });

    findingsList.sort(function (a, b) {
      if (a.severityRank !== b.severityRank) {
        return a.severityRank - b.severityRank;
      }
      var da = a.date || "";
      var db = b.date || "";
      if (db !== da) return db.localeCompare(da);
      if (b.chapter !== a.chapter) return b.chapter - a.chapter;
      return a.criterionId.localeCompare(b.criterionId);
    });

    [1, 2, 3, 4, 5].forEach(function (chId) {
      var a = areaStats[chId];
      if (a.findings === 0) {
        a.predominantSeverity = "Ninguna (Conforme)";
        a.predominantKey = "none";
      } else {
        var topKey = "unclassified";
        var maxCount = -1;
        var sevOrder = ["critical", "high", "medium", "low", "unclassified"];
        sevOrder.forEach(function (k) {
          var count = a.severities[k] || 0;
          if (count > maxCount) {
            maxCount = count;
            topKey = k;
          }
        });
        a.predominantKey = topKey;
        a.predominantSeverity = SEVERITY_CONFIG[topKey] ? SEVERITY_CONFIG[topKey].label : "Sin clasificar";
      }
    });

    var isPartial = false;
    if (intel && typeof intel.isFullyEvaluated === "boolean") {
      isPartial = !intel.isFullyEvaluated;
    } else if (filters && filters.auditState === "partial") {
      isPartial = true;
    } else if (visits.length > 0) {
      var somePartial = visits.some(function (v) {
        return Array.isArray(v.chapters) && v.chapters.length < 5;
      });
      if (somePartial) isPartial = true;
    }

    var totalFindings = findingsList.length;

    return {
      totalFindings: totalFindings,
      hasFindings: totalFindings > 0,
      hasVisits: visits.length > 0,
      isPartial: isPartial,
      counts: counts,
      matrixGrid: matrixGrid,
      findingsList: findingsList,
      topRisks: findingsList.slice(0, 10),
      areaStats: areaStats,
      activeFilters: filters
    };
  }

  function buildMetricsViewModel(st, rawVisits, engine) {
    var raw = Array.isArray(rawVisits) ? rawVisits : [];
    var options = extractAvailableOptions(raw, st.farm);

    // Filter strictly via the unified engine (Single source of truth)
    var filteredVisits = engine.filterVisits(
      raw,
      st.farm,
      st.range,
      st.crop,
      st.lot,
      st.auditState
    );

    // Aggregate strictly via the validated engine
    var intel = engine.aggregateIntelligence(filteredVisits);

    var hasAudits = filteredVisits.length > 0;
    var isFullyEvaluated = intel.isFullyEvaluated;
    var evaluatedChaptersCount = intel.evaluatedChaptersCount;
    var coveragePct = intel.coveragePct;
    var officialScore = hasAudits ? intel.globalPoints : null;
    var criteriaCompliance = intel.criteriaCompliance;
    var weightedScore = intel.weightedScore;
    var totalFindings = intel.totalFindings;

    // Severity breakdown from real data
    var criticalFindings = 0;
    var highFindings = 0;
    var mediumFindings = 0;
    if (intel.criteriaStats) {
      Object.keys(intel.criteriaStats).forEach(function (cId) {
        var stat = intel.criteriaStats[cId];
        if (stat && stat.findings > 0) {
          var cat = CRITERIA_CATALOG[cId] || {};
          if (cat.severity === "critical") criticalFindings += stat.findings;
          else if (cat.severity === "high") highFindings += stat.findings;
          else mediumFindings += stat.findings;
        }
      });
    }

    // Risk Classification (Guarded: based strictly on official MIPE rules without inventing arbitrary formula)
    var riskStatus = "unevaluated";
    var riskBadge = "— Sin datos";
    var riskTitle = "Pendiente de evaluación";
    var riskDescription = "Sin auditorías registradas en el contexto";
    if (hasAudits) {
      if (!isFullyEvaluated) {
        riskStatus = "partial";
        riskBadge = "⚠ Indeterminado";
        riskTitle = "Riesgo Indeterminado (Auditoría Parcial)";
        riskDescription = (5 - evaluatedChaptersCount) + " capítulos sin auditar (" + (Math.round((100.0 - (officialScore || 0)) * 10) / 10).toFixed(1) + " pts sin calificar)";
      } else {
        if (officialScore >= 90.0 && criticalFindings === 0) {
          riskStatus = "low";
          riskBadge = "✓ Bajo";
          riskTitle = "Bajo Riesgo Operativo";
          riskDescription = "Cumplimiento sólido del protocolo MIPE oficial";
        } else if (officialScore >= 75.0 && criticalFindings <= 2) {
          riskStatus = "medium";
          riskBadge = "⚠ Moderado";
          riskTitle = "Riesgo Moderado / Atención";
          riskDescription = totalFindings + " no conformidad" + (totalFindings === 1 ? "" : "es") + " que requieren seguimiento";
        } else {
          riskStatus = "high";
          riskBadge = "! Crítico";
          riskTitle = "Riesgo Crítico Operativo";
          riskDescription = criticalFindings + " críticas o puntaje inferior al estándar (75.0 pts)";
        }
      }
    }

    // FASE 4: Trend ViewModel & Sequential Delta
    var trendVm = buildTrendViewModel(filteredVisits, st, engine.calculateVisitScore || calculateVisitScore);
    var trendDelta = trendVm.delta;
    var trendText = trendVm.deltaText;
    var trendDirection = trendVm.deltaDirection;
    var trendTimelineCount = trendVm.count;

    // FASE 4: Farm Benchmark ViewModel
    var benchmarkVm = buildBenchmarkViewModel(raw, st, st.selectedCompareFarms, engine.aggregateIntelligence, options.availableFarms);

    // FASE 5: Risk Matrix, Causes, Priorities & Actions ViewModel
    var riskMatrixVm = buildRiskMatrixViewModel(filteredVisits, CRITERIA_CATALOG, CHAPTER_INFO, st, intel);

    // Health Score & Status
    var healthScore = officialScore; // Official MIPE points (0-100)
    var healthStatus = "unevaluated";
    var healthTitle = "Sin datos de auditoría";
    var healthBadge = "— Sin datos";
    if (hasAudits) {
      if (isFullyEvaluated) {
        if (healthScore >= 90.0) {
          healthStatus = "favorable";
          healthTitle = "Desempeño MIPE Favorable";
          healthBadge = "✓ Favorable";
        } else if (healthScore >= 75.0) {
          healthStatus = "attention";
          healthTitle = "Aseguramiento en Proceso";
          healthBadge = "⚠ Atención";
        } else {
          healthStatus = "critical";
          healthTitle = "Riesgo Crítico Operativo";
          healthBadge = "! Crítico";
        }
      } else {
        healthStatus = "partial";
        healthTitle = "Auditoría Parcial (" + evaluatedChaptersCount + "/5 Caps)";
        healthBadge = "⚠ Auditoría Parcial";
      }
    }

    // Diagnostic Statement (Fact-based from real data, zero hallucination)
    var diagnostic = "";
    if (!hasAudits) {
      diagnostic = "No existen auditorías registradas para los filtros seleccionados. Seleccione otra finca, lote o amplíe el periodo de evaluación.";
    } else if (!isFullyEvaluated) {
      var unAuditedPts = Math.round((100.0 - (officialScore || 0)) * 10) / 10;
      diagnostic = "Auditoría parcial: El desempeño registrado es de " + (officialScore != null ? officialScore.toFixed(1) : "0.0") + " pts en " + evaluatedChaptersCount + " de 5 capítulos (" + coveragePct + "% de cobertura). La información disponible aún no permite certificar el protocolo completo. Quedan " + unAuditedPts.toFixed(1) + " puntos oficiales por evaluar.";
    } else {
      if (healthScore >= 90.0) {
        diagnostic = "La finca presenta un desempeño MIPE favorable (" + healthScore.toFixed(1) + " / 100 pts), con protocolo completo (100% de cobertura) y cumplimiento consistente del " + (criteriaCompliance != null ? criteriaCompliance.toFixed(1) + "%" : "100%") + " en los 37 criterios oficiales evaluados.";
      } else if (healthScore >= 75.0) {
        diagnostic = "La finca cuenta con cobertura completa del protocolo (5/5 capítulos), pero registra " + totalFindings + " no conformidad" + (totalFindings === 1 ? "" : "es") + " que requieren acciones correctivas prioritarias para alcanzar la meta oficial de 95.0 pts.";
      } else {
        diagnostic = "Alerta operativa: La finca presenta un desempeño inferior al umbral mínimo (" + healthScore.toFixed(1) + " / 100 pts) con " + totalFindings + " desviación" + (totalFindings === 1 ? "" : "es") + " registradas (" + criticalFindings + " críticas). Se recomienda intervención técnica urgente.";
      }
    }

    var totalApplicable = Object.keys(intel.chapterPerformance).reduce(function (acc, k) { return acc + intel.chapterPerformance[k].applicable; }, 0);
    var totalPositive = Object.keys(intel.chapterPerformance).reduce(function (acc, k) { return acc + intel.chapterPerformance[k].positive; }, 0);

    // Latest audit date in filtered subset
    var lastAuditDate = "Sin datos disponibles";
    if (filteredVisits.length > 0) {
      var sortedDates = filteredVisits
        .map(function (v) { return v.date; })
        .filter(Boolean)
        .sort();
      if (sortedDates.length > 0) {
        lastAuditDate = sortedDates[sortedDates.length - 1];
      }
    }

    var rangeLabels = {
      "all": "Todo el historial",
      "30d": "Últimos 30 días",
      "90d": "Últimos 90 días",
      "365d": "Últimos 12 meses",
      "12m": "Últimos 12 meses",
      "year": "Año actual"
    };

    var auditStateLabels = {
      "all": "Todas las auditorías",
      "complete": "Solo completas (5/5 caps)",
      "partial": "Solo parciales (<5 caps)"
    };

    var connectivity = getConnectivityState();
    if (st.isSyncing) {
      connectivity.statusText = "↻ SINCRONIZANDO";
      connectivity.statusClass = "syncing";
    }

    var now = new Date();
    var lastUpdated = now.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }) + " " + now.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return {
      filters: {
        farm: st.farm || "",
        lot: st.lot || "",
        crop: st.crop || "",
        range: st.range || "all",
        auditState: st.auditState || "all"
      },
      availableFarms: options.availableFarms,
      availableLots: options.availableLots,
      availableCrops: options.availableCrops,
      filteredVisits: filteredVisits,
      intel: intel,
      hasAudits: hasAudits,
      connectivity: connectivity,
      metadata: {
        lastUpdated: lastUpdated,
        lastAuditDate: lastAuditDate,
        totalVisits: intel.totalVisits,
        reviewedCount: intel.reviewedCount,
        coveragePct: intel.coveragePct,
        evaluatedChaptersCount: intel.evaluatedChaptersCount,
        isFullyEvaluated: intel.isFullyEvaluated,
        dataSource: "Almacenamiento local SQLite (Offline-First)",
        rangeLabel: rangeLabels[st.range] || "Periodo seleccionado",
        auditStateLabel: auditStateLabels[st.auditState] || "Todas las auditorías"
      },
      scorecard: {
        hasAudits: hasAudits,
        isFullyEvaluated: isFullyEvaluated,
        evaluatedChaptersCount: evaluatedChaptersCount,
        coveragePct: coveragePct,
        officialScore: officialScore,
        criteriaCompliance: criteriaCompliance,
        weightedScore: weightedScore,
        totalFindings: totalFindings,
        criticalFindings: criticalFindings,
        highFindings: highFindings,
        mediumFindings: mediumFindings,
        totalApplicable: totalApplicable,
        totalPositive: totalPositive,
        riskStatus: riskStatus,
        riskBadge: riskBadge,
        riskTitle: riskTitle,
        riskDescription: riskDescription,
        trendDelta: trendDelta,
        trendText: trendText,
        trendDirection: trendDirection,
        trendTimelineCount: trendTimelineCount,
        healthScore: healthScore,
        healthStatus: healthStatus,
        healthTitle: healthTitle,
        healthBadge: healthBadge,
        diagnostic: diagnostic
      },
      mobileDrawerOpen: !!st.mobileDrawerOpen,
      subTab: st.subTab || "overview",
      selectedChapter: st.selectedChapter || 2,
      search: st.search || "",
      severityFilter: st.severityFilter || "all",
      statusFilter: st.statusFilter || "all",
      simValues: st.simValues || {},
      simTouched: !!st.simTouched,
      trendVm: trendVm,
      benchmarkVm: benchmarkVm,
      riskMatrixVm: riskMatrixVm,
      selectedCompareFarms: Array.isArray(st.selectedCompareFarms) ? st.selectedCompareFarms : []
    };
  }

  /* ------------------------------------------------------------------ *
   * UI Views: Executive Header & Global Filters Console (Pure Views)
   * ------------------------------------------------------------------ */

  function renderExecutiveHeader(vm) {
    var meta = vm.metadata;
    var conn = vm.connectivity;
    var filters = vm.filters;

    var farmName = filters.farm ? filters.farm : "Consolidado de Todas las Fincas";
    var lotName = filters.lot ? filters.lot : "Todos los lotes";
    var cropName = filters.crop ? filters.crop : "Todos los cultivos";
    var periodName = meta.rangeLabel;

    var html = '<header class="c360-executive-header" role="banner">';
    
    // Top Row: Brand, Product & Live System Status
    html += '<div class="c360-exec-top">';
    
    html += '<div class="c360-exec-brand-group">';
    html += '<div class="c360-exec-brand">AVGUST CARE 360</div>';
    html += '<h1 class="c360-exec-title">Centro de Inteligencia MIPE</h1>';
    html += '</div>';

    html += '<div class="c360-exec-actions-group no-print">';
    
    // Connectivity status indicator (Text + Dot, never color alone)
    html += '<div class="c360-conn-badge ' + escapeHtml(conn.statusClass) + '" role="status" aria-live="polite" title="Estado de conectividad y sincronización">';
    html += '<span class="c360-conn-dot" aria-hidden="true"></span>';
    html += '<span class="c360-conn-text">' + escapeHtml(conn.statusText) + '</span>';
    html += '</div>';

    // Print / PDF Button
    html += '<button type="button" class="c360-btn-export" data-action="export-pdf" title="Exportar o imprimir informe ejecutivo">';
    html += '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    html += '<span>Exportar</span>';
    html += '</button>';

    html += '</div>'; // End exec-actions-group
    html += '</div>'; // End exec-top

    // Context & Agronomic Metadata Strip (Zero-pill discipline: typography + separators)
    html += '<div class="c360-exec-context-strip">';
    
    html += '<div class="c360-exec-context-item">';
    html += '<span class="c360-meta-kicker">Finca:</span>';
    html += '<strong class="c360-meta-val">' + escapeHtml(farmName) + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-exec-context-item">';
    html += '<span class="c360-meta-kicker">Lote:</span>';
    html += '<strong class="c360-meta-val">' + escapeHtml(lotName) + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-exec-context-item">';
    html += '<span class="c360-meta-kicker">Cultivo:</span>';
    html += '<strong class="c360-meta-val">' + escapeHtml(cropName) + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-exec-context-item">';
    html += '<span class="c360-meta-kicker">Periodo:</span>';
    html += '<strong class="c360-meta-val">' + escapeHtml(periodName) + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-exec-context-item">';
    html += '<span class="c360-meta-kicker">Última auditoría:</span>';
    html += '<strong class="c360-meta-val tabular-nums">' + escapeHtml(meta.lastAuditDate) + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-exec-context-item">';
    html += '<span class="c360-meta-kicker">Origen:</span>';
    html += '<strong class="c360-meta-val text-muted">' + escapeHtml(meta.dataSource) + '</strong>';
    html += '</div>';

    html += '</div>'; // End context-strip

    html += '</header>';
    return html;
  }

  function renderGlobalFilters(vm) {
    var f = vm.filters;
    var meta = vm.metadata;
    var farms = vm.availableFarms || [];
    var lots = vm.availableLots || [];
    var crops = vm.availableCrops || [];

    var html = '<section class="c360-filters-section" aria-label="Filtros Globales de Inteligencia MIPE">';

    // 1. Desktop & Tablet Global Filter Console
    html += '<div class="c360-filters-console no-print">';
    html += '<div class="c360-filters-eyebrow">FILTROS GLOBALES CONSOLIDADOS</div>';
    html += '<div class="c360-filters-grid">';

    // Filter 1: Finca
    html += '<div class="c360-filter-col">';
    html += '<label class="c360-filter-label" for="c360-filter-farm">Finca</label>';
    html += '<select id="c360-filter-farm" class="c360-filter-select" data-action="filter-farm">';
    html += '<option value="">🌱 Todas las fincas</option>';
    farms.forEach(function (fn) {
      var isSelected = norm(fn) === norm(f.farm);
      html += '<option value="' + escapeHtml(fn) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(fn) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Filter 2: Lote
    html += '<div class="c360-filter-col">';
    html += '<label class="c360-filter-label" for="c360-filter-lot">Lote / Bloque</label>';
    html += '<select id="c360-filter-lot" class="c360-filter-select" data-action="filter-lot"' + (lots.length === 0 && !f.lot ? ' disabled title="Sin subdivisiones registradas"' : '') + '>';
    html += '<option value="">🏷️ Todos los lotes</option>';
    lots.forEach(function (lt) {
      var isSelected = norm(lt) === norm(f.lot);
      html += '<option value="' + escapeHtml(lt) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(lt) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Filter 3: Cultivo
    html += '<div class="c360-filter-col">';
    html += '<label class="c360-filter-label" for="c360-filter-crop">Cultivo</label>';
    html += '<select id="c360-filter-crop" class="c360-filter-select" data-action="filter-crop">';
    html += '<option value="">🌸 Todos los cultivos</option>';
    crops.forEach(function (cr) {
      var isSelected = norm(cr) === norm(f.crop);
      html += '<option value="' + escapeHtml(cr) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(cr) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Filter 4: Periodo
    html += '<div class="c360-filter-col">';
    html += '<label class="c360-filter-label" for="c360-filter-range">Periodo</label>';
    html += '<select id="c360-filter-range" class="c360-filter-select" data-action="filter-range">';
    html += '<option value="all"' + (f.range === "all" ? ' selected' : '') + '>📅 Todo el historial</option>';
    html += '<option value="30d"' + (f.range === "30d" ? ' selected' : '') + '>Últimos 30 días</option>';
    html += '<option value="90d"' + (f.range === "90d" ? ' selected' : '') + '>Últimos 90 días</option>';
    html += '<option value="365d"' + (f.range === "365d" || f.range === "12m" ? ' selected' : '') + '>Últimos 12 meses</option>';
    html += '<option value="year"' + (f.range === "year" ? ' selected' : '') + '>Año actual</option>';
    html += '</select>';
    html += '</div>';

    // Filter 5: Estado de auditoría
    html += '<div class="c360-filter-col">';
    html += '<label class="c360-filter-label" for="c360-filter-audit-state">Alcance de Auditoría</label>';
    html += '<select id="c360-filter-audit-state" class="c360-filter-select" data-action="filter-audit-state">';
    html += '<option value="all"' + (f.auditState === "all" ? ' selected' : '') + '>📋 Todas las auditorías</option>';
    html += '<option value="complete"' + (f.auditState === "complete" ? ' selected' : '') + '>Solo completas (5/5 caps)</option>';
    html += '<option value="partial"' + (f.auditState === "partial" ? ' selected' : '') + '>Solo parciales (&lt;5 caps)</option>';
    html += '</select>';
    html += '</div>';

    // Filter Actions
    html += '<div class="c360-filter-actions-col">';
    html += '<button type="button" class="c360-btn-filter-clean" data-action="clear-filters" title="Restablecer todos los filtros a sus valores iniciales">Limpiar filtros</button>';
    html += '<button type="button" class="c360-btn-filter-refresh" data-action="refresh-data" title="Recargar visitas y sincronización">↻ Actualizar</button>';
    html += '</div>';

    html += '</div>'; // End filters-grid
    html += '</div>'; // End filters-console

    // 2. Active Context Bar (Desktop & Mobile summary)
    var activeFarm = f.farm ? f.farm : "Todas las fincas";
    var activeLot = f.lot ? f.lot : "Todos";
    var activeCrop = f.crop ? f.crop : "Todos";
    var activeAuditState = meta.auditStateLabel;

    html += '<div class="c360-active-context-bar">';
    
    // Desktop textual strip
    html += '<div class="c360-active-context-desktop">';
    html += '<span class="c360-ac-kicker">CONTEXTO ACTIVO:</span>';
    html += '<span class="c360-ac-part">📍 <strong>' + escapeHtml(activeFarm) + '</strong></span>';
    html += '<span class="c360-ac-sep" aria-hidden="true">·</span>';
    html += '<span class="c360-ac-part">🏷️ Lote: <strong>' + escapeHtml(activeLot) + '</strong></span>';
    html += '<span class="c360-ac-sep" aria-hidden="true">·</span>';
    html += '<span class="c360-ac-part">🌸 Cultivo: <strong>' + escapeHtml(activeCrop) + '</strong></span>';
    html += '<span class="c360-ac-sep" aria-hidden="true">·</span>';
    html += '<span class="c360-ac-part">📅 <strong>' + escapeHtml(meta.rangeLabel) + '</strong></span>';
    html += '<span class="c360-ac-sep" aria-hidden="true">·</span>';
    html += '<span class="c360-ac-part">📋 <strong>' + escapeHtml(activeAuditState) + '</strong></span>';
    html += '<span class="c360-ac-sep" aria-hidden="true">·</span>';
    html += '<span class="c360-ac-count tabular-nums">● ' + meta.totalVisits + ' auditoría' + (meta.totalVisits === 1 ? '' : 's') + ' analizada' + (meta.totalVisits === 1 ? '' : 's') + '</span>';
    html += '</div>';

    // Mobile compact context bar with dedicated [⚙ Filtros] trigger
    html += '<div class="c360-active-context-mobile no-print">';
    html += '<div class="c360-ac-mobile-info">';
    html += '<strong>' + escapeHtml(activeFarm) + '</strong>';
    html += '<small>' + escapeHtml(meta.rangeLabel) + ' · ' + meta.totalVisits + ' auditorías</small>';
    html += '</div>';
    html += '<button type="button" class="c360-btn-mobile-filter-toggle" data-action="toggle-mobile-filters" aria-expanded="' + (vm.mobileDrawerOpen ? 'true' : 'false') + '">';
    html += '<span>⚙ Filtros</span>';
    html += '</button>';
    html += '</div>';

    html += '</div>'; // End active-context-bar

    // 3. Mobile Slide-Over Filter Drawer / Modal
    if (vm.mobileDrawerOpen) {
      html += '<div class="c360-mobile-drawer-backdrop no-print" data-action="close-mobile-filters" tabindex="-1"></div>';
      html += '<div class="c360-mobile-drawer no-print" role="dialog" aria-modal="true" aria-labelledby="c360-drawer-title">';
      
      html += '<div class="c360-drawer-header">';
      html += '<h3 id="c360-drawer-title" class="c360-drawer-title">Filtros Globales MIPE</h3>';
      html += '<button type="button" class="c360-drawer-close-btn" data-action="close-mobile-filters" aria-label="Cerrar filtros">✕</button>';
      html += '</div>';

      html += '<div class="c360-drawer-body">';

      // Mobile Finca
      html += '<div class="c360-drawer-field">';
      html += '<label class="c360-filter-label" for="c360-m-farm">Finca</label>';
      html += '<select id="c360-m-farm" class="c360-filter-select" data-action="filter-farm">';
      html += '<option value="">🌱 Todas las fincas</option>';
      farms.forEach(function (fn) {
        var isSelected = norm(fn) === norm(f.farm);
        html += '<option value="' + escapeHtml(fn) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(fn) + '</option>';
      });
      html += '</select>';
      html += '</div>';

      // Mobile Lote
      html += '<div class="c360-drawer-field">';
      html += '<label class="c360-filter-label" for="c360-m-lot">Lote / Bloque</label>';
      html += '<select id="c360-m-lot" class="c360-filter-select" data-action="filter-lot"' + (lots.length === 0 && !f.lot ? ' disabled' : '') + '>';
      html += '<option value="">🏷️ Todos los lotes</option>';
      lots.forEach(function (lt) {
        var isSelected = norm(lt) === norm(f.lot);
        html += '<option value="' + escapeHtml(lt) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(lt) + '</option>';
      });
      html += '</select>';
      html += '</div>';

      // Mobile Cultivo
      html += '<div class="c360-drawer-field">';
      html += '<label class="c360-filter-label" for="c360-m-crop">Cultivo</label>';
      html += '<select id="c360-m-crop" class="c360-filter-select" data-action="filter-crop">';
      html += '<option value="">🌸 Todos los cultivos</option>';
      crops.forEach(function (cr) {
        var isSelected = norm(cr) === norm(f.crop);
        html += '<option value="' + escapeHtml(cr) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(cr) + '</option>';
      });
      html += '</select>';
      html += '</div>';

      // Mobile Periodo
      html += '<div class="c360-drawer-field">';
      html += '<label class="c360-filter-label" for="c360-m-range">Periodo</label>';
      html += '<select id="c360-m-range" class="c360-filter-select" data-action="filter-range">';
      html += '<option value="all"' + (f.range === "all" ? ' selected' : '') + '>📅 Todo el historial</option>';
      html += '<option value="30d"' + (f.range === "30d" ? ' selected' : '') + '>Últimos 30 días</option>';
      html += '<option value="90d"' + (f.range === "90d" ? ' selected' : '') + '>Últimos 90 días</option>';
      html += '<option value="365d"' + (f.range === "365d" || f.range === "12m" ? ' selected' : '') + '>Últimos 12 meses</option>';
      html += '<option value="year"' + (f.range === "year" ? ' selected' : '') + '>Año actual</option>';
      html += '</select>';
      html += '</div>';

      // Mobile Estado
      html += '<div class="c360-drawer-field">';
      html += '<label class="c360-filter-label" for="c360-m-state">Alcance de Auditoría</label>';
      html += '<select id="c360-m-state" class="c360-filter-select" data-action="filter-audit-state">';
      html += '<option value="all"' + (f.auditState === "all" ? ' selected' : '') + '>📋 Todas las auditorías</option>';
      html += '<option value="complete"' + (f.auditState === "complete" ? ' selected' : '') + '>Solo completas (5/5 caps)</option>';
      html += '<option value="partial"' + (f.auditState === "partial" ? ' selected' : '') + '>Solo parciales (&lt;5 caps)</option>';
      html += '</select>';
      html += '</div>';

      html += '</div>'; // End drawer-body

      html += '<div class="c360-drawer-footer">';
      html += '<button type="button" class="c360-btn-drawer-clean" data-action="clear-filters">Limpiar</button>';
      html += '<button type="button" class="c360-btn-drawer-apply" data-action="apply-mobile-filters">Aplicar filtros</button>';
      html += '</div>';

      html += '</div>'; // End mobile-drawer
    }

    html += '</section>';
    return html;
  }

  function renderSubNav(intel, vm) {
    var tabs = [
      { id: "overview", label: "📊 Resumen General", desc: "Puntuación ponderada y estado MIPE" },
      { id: "chapters", label: "📋 Desglose por Capítulos", desc: "Detalle técnico de los 5 capítulos" },
      { id: "benchmark", label: "📈 Benchmark y Fincas", desc: "Histórico y comparativa oficial" },
      { id: "risks", label: "⚠️ Matriz de Riesgos", desc: "No conformidades prioritarias" },
      { id: "simulator", label: "🎛️ Simulador de Impacto", desc: "Simulación de mejoras" },
    ];

    var html = '<nav class="c360-subnav" role="tablist">';
    tabs.forEach(function (t) {
      var active = state.subTab === t.id;
      html += '<button class="c360-subnav-btn' + (active ? ' active' : '') + '" role="tab" aria-selected="' + active + '" data-tab="' + t.id + '">';
      html += '<span class="c360-tab-title">' + t.label + '</span>';
      html += '</button>';
    });
    html += '</nav>';
    return html;
  }

  function render(container) {
    if (!container) return;

    var vm = buildMetricsViewModel(state, state.visits, {
      filterVisits: filterVisits,
      aggregateIntelligence: aggregateIntelligence,
      calculateVisitScore: calculateVisitScore
    });
    var intel = vm.intel;

    // Sync simulator baseline if untouched
    if (!state.simTouched) {
      [1, 2, 3, 4, 5].forEach(function (ch) {
        var p = intel.chapterPerformance[ch];
        state.simValues[ch] = p.isEvaluated && p.compliance != null ? Math.round(p.compliance) : 0;
      });
    }

    var html = '<div class="c360-mipe-container">';

    // 1. Executive Agronomic Header Bar
    html += renderExecutiveHeader(vm);

    // 2. Global Filters Console & Active Context Bar
    html += renderGlobalFilters(vm);

    // 3. Multi-Tab Navigation
    html += renderSubNav(intel, vm);

    // 4. Tab Content View
    html += '<div class="c360-mipe-body">';
    if (state.subTab === "overview") {
      html += renderOverviewTab(intel, vm);
    } else if (state.subTab === "chapters") {
      html += renderChaptersTab(intel);
    } else if (state.subTab === "benchmark") {
      html += renderBenchmarkTab(intel, vm);
    } else if (state.subTab === "risks") {
      html += renderRisksTab(intel, vm);
    } else if (state.subTab === "simulator") {
      html += renderSimulatorTab(intel);
    }
    html += '</div>';

    // FASE 5: Contextual Drill-Down Modal
    if (state.selectedFindingId && vm && vm.riskMatrixVm && Array.isArray(vm.riskMatrixVm.findingsList)) {
      var foundFinding = vm.riskMatrixVm.findingsList.find(function (f) {
        return f.id === state.selectedFindingId;
      });
      if (foundFinding) {
        html += renderRiskDetailModal(foundFinding);
      }
    }

    html += '</div>';

    container.innerHTML = html;
    bindEvents(container);
  }

  /* ------------------------------------------------------------------ *
   * MIPE Health Score Hero Component (FASE 3)
   * ------------------------------------------------------------------ */

  function renderMipeHealthHero(vm) {
    var sc = vm.scorecard;
    var hasAudits = vm.hasAudits;
    var isFull = sc.isFullyEvaluated;
    var score = sc.officialScore;
    var coveragePct = sc.coveragePct;
    var evaluatedCaps = sc.evaluatedChaptersCount;

    var statusClass = "status-" + sc.healthStatus;

    var html = '<section class="c360-card c360-health-hero ' + statusClass + '" aria-label="MIPE Health Score Executive Hero">';

    // Top Header Row
    html += '<div class="c360-hero-header">';
    html += '<div class="c360-hero-title-group">';
    html += '<span class="c360-card-eyebrow">CENTRO DE INTELIGENCIA MIPE · DIAGNÓSTICO EJECUTIVO</span>';
    html += '<h2 class="c360-hero-title">MIPE Health Score</h2>';
    html += '</div>';
    html += '<div class="c360-hero-badge-wrap">';
    html += '<span class="c360-status-indicator ' + statusClass + '">' + escapeHtml(sc.healthBadge) + '</span>';
    html += '</div>';
    html += '</div>';

    // Center Hero Box: Circular Gauge + Big Score + Status Description
    html += '<div class="c360-hero-center">';
    
    html += '<div class="c360-hero-gauge-box">';
    html += renderCircularGauge(score, coveragePct);
    html += '</div>';

    html += '<div class="c360-hero-score-box">';
    if (hasAudits && score != null) {
      html += '<div class="c360-hero-score-huge tabular-nums">' + score.toFixed(1) + '<small>/100</small></div>';
      html += '<div class="c360-hero-score-label">' + escapeHtml(sc.healthTitle) + '</div>';
      if (isFull) {
        html += '<div class="c360-hero-protocol-status text-success">✓ Protocolo oficial completo (100% auditado)</div>';
      } else {
        html += '<div class="c360-hero-protocol-status text-warning">⚠ Auditoría con alcance parcial (' + evaluatedCaps + ' de 5 capítulos auditados)</div>';
      }
    } else {
      html += '<div class="c360-hero-score-huge c360-text-nodata">Sin datos</div>';
      html += '<div class="c360-hero-score-label">Sin auditorías registradas</div>';
      html += '<div class="c360-hero-protocol-status text-muted">Ajuste los filtros para visualizar indicadores</div>';
    }
    html += '</div>';

    html += '</div>'; // End hero-center

    // Human Diagnostic Card (Derived 100% from real facts, zero hallucination)
    html += '<div class="c360-hero-diagnostic-box">';
    html += '<div class="c360-diag-header">';
    html += '<span class="c360-diag-kicker">DIAGNÓSTICO TÉCNICO EJECUTIVO</span>';
    html += '</div>';
    html += '<p class="c360-diag-text">' + escapeHtml(sc.diagnostic) + '</p>';
    html += '</div>';

    // Executive Context Strip (Zero-pill discipline: typography + separators)
    html += '<div class="c360-hero-context-strip">';
    
    html += '<div class="c360-hero-meta-item">';
    html += '<span class="c360-meta-kicker">Meta Oficial:</span>';
    html += '<strong class="c360-meta-val tabular-nums">95.0 pts</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-hero-meta-item">';
    html += '<span class="c360-meta-kicker">Cobertura Protocolo:</span>';
    html += '<strong class="c360-meta-val tabular-nums">' + (hasAudits ? coveragePct + '% (' + evaluatedCaps + '/5 caps)' : '—') + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-hero-meta-item">';
    html += '<span class="c360-meta-kicker">Cumplimiento Evaluado:</span>';
    html += '<strong class="c360-meta-val tabular-nums">' + (sc.criteriaCompliance != null ? sc.criteriaCompliance.toFixed(1) + '%' : '—') + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-hero-meta-item">';
    html += '<span class="c360-meta-kicker">Tendencia:</span>';
    html += '<strong class="c360-meta-val tabular-nums">' + escapeHtml(sc.trendText) + '</strong>';
    html += '</div>';

    html += '<span class="c360-meta-sep" aria-hidden="true">·</span>';

    html += '<div class="c360-hero-meta-item">';
    html += '<span class="c360-meta-kicker">Desviaciones:</span>';
    html += '<strong class="c360-meta-val tabular-nums ' + (sc.totalFindings > 0 ? 'text-danger' : 'text-success') + '">' + (hasAudits ? sc.totalFindings + ' hallazgos' : '—') + '</strong>';
    html += '</div>';

    html += '</div>'; // End hero-context-strip

    // Discrete Warning Banner for Partial Audits
    if (hasAudits && !isFull) {
      var unAuditedPts = Math.round((100.0 - (score || 0)) * 10) / 10;
      html += '<div class="c360-hero-partial-alert" role="note">';
      html += '<div class="c360-alert-icon" aria-hidden="true">⚠️</div>';
      html += '<div class="c360-alert-text">';
      html += '<strong>Alcance de Auditoría Parcial (' + evaluatedCaps + '/5 capítulos evaluados):</strong> ';
      html += 'Los capítulos no evaluados no aportan puntuación (0.0 pts oficiales). El cumplimiento sobre los criterios efectivamente evaluados es de ' + (sc.criteriaCompliance != null ? sc.criteriaCompliance.toFixed(1) + '%' : '—') + ', pero la puntuación acumulada es de ' + (score != null ? score.toFixed(1) : '0.0') + ' / 100 pts. Quedan ' + unAuditedPts.toFixed(1) + ' puntos sin evaluar.';
      html += '</div>';
      html += '</div>';
    }

    html += '</section>';
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Executive Scorecard Component (FASE 3)
   * ------------------------------------------------------------------ */

  function renderExecutiveScorecard(vm) {
    var sc = vm.scorecard;
    var hasAudits = vm.hasAudits;
    var isFull = sc.isFullyEvaluated;
    var officialScore = sc.officialScore;
    var compliance = sc.criteriaCompliance;
    var coveragePct = sc.coveragePct;
    var evaluatedCaps = sc.evaluatedChaptersCount;

    var html = '<div class="c360-scorecard-section" aria-label="Executive Scorecard MIPE">';

    // 1. PRIMARY DOMINANT CARD: PUNTOS MIPE OFICIALES (HERO KPI)
    var priStatusClass = "status-" + sc.healthStatus;
    html += '<div class="c360-card c360-scorecard-primary ' + priStatusClass + '">';
    
    html += '<div class="c360-sc-pri-header">';
    html += '<div class="c360-sc-kicker-group">';
    html += '<span class="c360-card-eyebrow">INDICADOR OFICIAL DE DESEMPEÑO</span>';
    html += '<h2 class="c360-sc-pri-title">Puntos MIPE Oficiales</h2>';
    html += '</div>';
    html += '<span class="c360-status-indicator ' + priStatusClass + '">' + escapeHtml(sc.healthBadge) + '</span>';
    html += '</div>';

    html += '<div class="c360-sc-pri-body">';
    if (hasAudits && officialScore != null) {
      html += '<div class="c360-sc-pri-number-row">';
      html += '<div class="c360-sc-pri-number tabular-nums">' + officialScore.toFixed(1) + '</div>';
      html += '<div class="c360-sc-pri-scale">/ 100 <span class="c360-sc-unit">pts</span></div>';
      html += '</div>';
      html += '<div class="c360-sc-pri-subtext">Puntuación ponderada sobre los 100 puntos del protocolo oficial</div>';
    } else {
      html += '<div class="c360-sc-pri-number-row">';
      html += '<div class="c360-sc-pri-number c360-text-nodata">Sin datos</div>';
      html += '</div>';
      html += '<div class="c360-sc-pri-subtext">No existen auditorías para el contexto seleccionado</div>';
    }
    html += '</div>';

    // Operational Gap / Target Analysis Footer
    html += '<div class="c360-sc-pri-footer">';
    html += '<div class="c360-sc-footer-col">';
    html += '<span class="c360-sc-footer-label">Meta Oficial</span>';
    html += '<strong class="c360-sc-footer-val tabular-nums">95.0 pts</strong>';
    html += '</div>';

    html += '<div class="c360-sc-footer-sep" aria-hidden="true"></div>';

    html += '<div class="c360-sc-footer-col">';
    if (hasAudits && isFull && officialScore != null) {
      var delta = officialScore - 95.0;
      var deltaClass = delta >= 0 ? 'text-success' : 'text-danger';
      html += '<span class="c360-sc-footer-label">Brecha vs Meta</span>';
      html += '<strong class="c360-sc-footer-val tabular-nums ' + deltaClass + '">' + (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' pts</strong>';
    } else if (hasAudits && !isFull && officialScore != null) {
      var unAuditedPts = Math.round((100.0 - officialScore) * 10) / 10;
      html += '<span class="c360-sc-footer-label">Brecha por Evaluar</span>';
      html += '<strong class="c360-sc-footer-val tabular-nums text-warning" title="Puntos oficiales pendientes de calificar por capítulos no auditados">' + unAuditedPts.toFixed(1) + ' pts sin auditar</strong>';
    } else {
      html += '<span class="c360-sc-footer-label">Brecha Operativa</span>';
      html += '<strong class="c360-sc-footer-val text-muted">Sin evaluación</strong>';
    }
    html += '</div>';

    html += '<div class="c360-sc-footer-sep" aria-hidden="true"></div>';

    html += '<div class="c360-sc-footer-col c360-sc-footer-info">';
    html += '<span class="c360-sc-footer-label">Alcance Auditado</span>';
    html += '<strong class="c360-sc-footer-val">' + (isFull ? '✓ Protocolo Completo (100%)' : (hasAudits ? '⚠ Alcance Parcial (' + coveragePct + '%)' : 'Sin datos')) + '</strong>';
    html += '</div>';

    html += '</div>'; // End sc-pri-footer
    html += '</div>'; // End scorecard-primary

    // 2. SECONDARY TRIAD: CUMPLIMIENTO, COBERTURA, RIESGO
    html += '<div class="c360-scorecard-triad">';

    // KPI 2: Cumplimiento Evaluado
    var compColor = compliance != null
      ? (isFull ? (compliance >= 90 ? 'text-success' : 'text-warning') : 'text-primary')
      : 'text-muted';
    var totalApp = sc.totalApplicable;
    var totalPos = sc.totalPositive;

    html += '<div class="c360-card c360-sc-subcard" title="Porcentaje de criterios conformes (SI) sobre el total de aplicables evaluados (excluye NA y no evaluados)">';
    html += '<div class="c360-sc-sub-header">';
    html += '<span class="c360-card-eyebrow">CONFORMIDAD CRITERIOS</span>';
    html += '<span class="c360-sc-info-icon" aria-hidden="true" title="Excluye estrictamente criterios no evaluados y no aplicables">ℹ</span>';
    html += '</div>';
    html += '<div class="c360-sc-sub-title">Cumplimiento Evaluado</div>';
    html += '<div class="c360-sc-sub-val tabular-nums ' + compColor + '">' + (compliance != null ? compliance.toFixed(1) + '%' : '—') + '</div>';
    html += '<div class="c360-sc-sub-hint">';
    if (hasAudits && totalApp > 0) {
      html += '<strong>' + totalPos + '</strong> de <strong>' + totalApp + '</strong> conformes';
      if (!isFull) {
        html += '<span class="c360-sc-partial-note text-warning"> · ⚠ Solo evaluados</span>';
      }
    } else {
      html += '<span class="text-muted">Sin criterios evaluados</span>';
    }
    html += '</div>';
    html += '</div>';

    // KPI 3: Cobertura del Protocolo
    var covColor = isFull ? 'text-success' : (evaluatedCaps > 0 ? 'text-warning' : 'text-muted');
    html += '<div class="c360-card c360-sc-subcard" title="Porcentaje del protocolo oficial efectivamente auditado en campo">';
    html += '<div class="c360-sc-sub-header">';
    html += '<span class="c360-card-eyebrow">COBERTURA PROTOCOLO</span>';
    html += '<span class="c360-sc-tag ' + (isFull ? 'full' : 'partial') + '">' + (isFull ? '✓ Completa' : (evaluatedCaps > 0 ? '⚠ Parcial' : '—')) + '</span>';
    html += '</div>';
    html += '<div class="c360-sc-sub-title">Capítulos Auditados</div>';
    html += '<div class="c360-sc-sub-val tabular-nums ' + covColor + '">' + (hasAudits ? evaluatedCaps + '<small>/5 Caps</small>' : '—') + '</div>';
    html += '<div class="c360-sc-sub-hint">';
    if (hasAudits) {
      html += '<strong>' + coveragePct + '%</strong> del peso oficial evaluado';
    } else {
      html += '<span class="text-muted">Sin auditorías registradas</span>';
    }
    html += '</div>';
    html += '</div>';

    // KPI 4: Riesgo Operativo
    var riskClass = "risk-" + sc.riskStatus;
    html += '<div class="c360-card c360-sc-subcard ' + riskClass + '" title="Clasificación de riesgo operativo basada en severidad de hallazgos y puntuación MIPE">';
    html += '<div class="c360-sc-sub-header">';
    html += '<span class="c360-card-eyebrow">GESTIÓN DE RIESGO</span>';
    html += '<span class="c360-risk-dot ' + riskClass + '" aria-hidden="true"></span>';
    html += '</div>';
    html += '<div class="c360-sc-sub-title">Riesgo Operativo</div>';
    html += '<div class="c360-sc-sub-val c360-risk-val ' + riskClass + '">' + escapeHtml(sc.riskBadge) + '</div>';
    html += '<div class="c360-sc-sub-hint">' + escapeHtml(sc.riskDescription) + '</div>';
    html += '</div>';

    html += '</div>'; // End scorecard-triad

    // 3. TERTIARY PAIR: NO CONFORMIDADES, TENDENCIA
    html += '<div class="c360-scorecard-pair">';

    // KPI 5: No Conformidades
    var totalFindings = sc.totalFindings;
    var findColor = totalFindings > 0 ? 'text-danger' : 'text-success';
    html += '<div class="c360-card c360-sc-subcard" title="Desviaciones detectadas en campo (respuesta NO en criterios aplicables)">';
    html += '<div class="c360-sc-sub-header">';
    html += '<span class="c360-card-eyebrow">HALLAZGOS DE CAMPO</span>';
    html += '<span class="c360-sc-hint-kicker">No evaluado ≠ No conforme</span>';
    html += '</div>';
    html += '<div class="c360-sc-sub-title">No Conformidades</div>';
    html += '<div class="c360-sc-sub-val tabular-nums ' + findColor + '">' + (hasAudits ? totalFindings : '—') + '</div>';
    html += '<div class="c360-sc-sub-hint">';
    if (hasAudits && totalFindings > 0) {
      html += '<strong class="text-danger">' + sc.criticalFindings + ' críticas</strong> · ' + sc.highFindings + ' altas · ' + sc.mediumFindings + ' medias';
    } else if (hasAudits) {
      html += '<span class="text-success font-semibold">✓ Cero desviaciones registradas</span>';
    } else {
      html += '<span class="text-muted">Sin datos de campo</span>';
    }
    html += '</div>';
    html += '</div>';

    // KPI 6: Tendencia / Evolución
    var trendColor = sc.trendDirection === "up"
      ? 'text-success'
      : (sc.trendDirection === "down" ? 'text-danger' : 'text-muted');
    html += '<div class="c360-card c360-sc-subcard" title="Evolución temporal calculada exclusivamente a partir del historial real">';
    html += '<div class="c360-sc-sub-header">';
    html += '<span class="c360-card-eyebrow">EVOLUCIÓN TEMPORAL</span>';
    html += '<span class="c360-sc-hint-kicker">Histórico real</span>';
    html += '</div>';
    html += '<div class="c360-sc-sub-title">Tendencia MIPE</div>';
    html += '<div class="c360-sc-sub-val tabular-nums ' + trendColor + '">' + escapeHtml(sc.trendText) + '</div>';
    html += '<div class="c360-sc-sub-hint">';
    if (sc.trendTimelineCount >= 2) {
      html += 'Comparación contra periodo inmediatamente anterior';
    } else if (sc.trendTimelineCount === 1) {
      html += 'Línea base registrada (se requiere 2do periodo para delta)';
    } else {
      html += '<span class="text-muted">Sin mediciones comparables</span>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>'; // End scorecard-pair

    html += '</div>'; // End scorecard-section
    return html;
  }

  /* ------------------------------------------------------------------ *
   * FASE 5.6: ENTERPRISE AGRONOMIC COMMAND CENTER
   * ------------------------------------------------------------------ */

  function renderMipeCommandCanvas(vm) {
    var sc = vm.scorecard;
    var trendVm = vm.trendVm;
    var hasAudits = vm.hasAudits;
    var isFull = sc.isFullyEvaluated;
    var score = sc.officialScore;
    var coveragePct = sc.coveragePct;
    var evaluatedCaps = sc.evaluatedChaptersCount;
    var statusClass = "status-" + sc.healthStatus;

    var html = '<section class="c360-command-canvas ' + statusClass + '" aria-label="Lienzo Maestro de Estado MIPE">';

    // Left Column: Dominant MIPE Health & Reliability
    html += '<div class="c360-canvas-left">';
    
    html += '<div class="c360-canvas-header">';
    html += '<div class="c360-canvas-kicker-group">';
    html += '<span class="c360-card-eyebrow">ESTADO MIPE RECTOR &amp; CONFIABILIDAD</span>';
    html += '<h2 class="c360-canvas-title">Diagnóstico de Salud MIPE</h2>';
    html += '</div>';
    html += '<span class="c360-status-indicator ' + statusClass + '">' + escapeHtml(sc.healthBadge) + '</span>';
    html += '</div>';

    html += '<div class="c360-canvas-hero-row">';
    
    html += '<div class="c360-canvas-gauge-wrap">';
    html += renderCircularGauge(score, coveragePct);
    html += '</div>';

    html += '<div class="c360-canvas-score-col">';
    if (hasAudits && score != null) {
      html += '<div class="c360-canvas-score-huge tabular-nums">' + score.toFixed(1) + '<span class="c360-canvas-score-unit">/ 100 pts</span></div>';
      html += '<div class="c360-canvas-score-title">' + escapeHtml(sc.healthTitle) + '</div>';
      if (isFull) {
        html += '<div class="c360-canvas-scope-status text-success">✓ Protocolo oficial completo (5/5 caps auditados)</div>';
      } else {
        html += '<div class="c360-canvas-scope-status text-warning">⚠️ Alcance parcial (' + evaluatedCaps + '/5 caps auditados)</div>';
      }
    } else {
      html += '<div class="c360-canvas-score-huge c360-text-nodata">Sin datos</div>';
      html += '<div class="c360-canvas-score-title">Sin auditorías registradas</div>';
      html += '<div class="c360-canvas-scope-status text-muted">Ajuste los filtros para visualizar indicadores</div>';
    }
    html += '</div>';

    html += '</div>'; // End hero-row

    // Executive Diagnostic narrative
    html += '<div class="c360-canvas-diag-wrap">';
    html += '<div class="c360-canvas-diag-kicker">DIAGNÓSTICO EJECUTIVO</div>';
    html += '<p class="c360-canvas-diag-text">' + escapeHtml(sc.diagnostic) + '</p>';
    html += '</div>';

    // Factual Satellites Strip (Zero-Pill: typography + separators)
    html += '<div class="c360-canvas-satellites-strip">';
    
    // Sat 1: Meta
    html += '<div class="c360-sat-item">';
    html += '<span class="c360-sat-kicker">Meta Oficial:</span>';
    html += '<strong class="c360-sat-val tabular-nums">95.0 pts</strong>';
    if (hasAudits && isFull && score != null) {
      var dMeta = score - 95.0;
      var dClass = dMeta >= 0 ? 'text-success' : 'text-danger';
      html += '<span class="c360-sat-sub tabular-nums ' + dClass + '">(' + (dMeta >= 0 ? '+' : '') + dMeta.toFixed(1) + ' pts)</span>';
    }
    html += '</div>';

    html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';

    // Sat 2: Cumplimiento en evaluados
    html += '<div class="c360-sat-item">';
    html += '<span class="c360-sat-kicker">Cumplimiento:</span>';
    html += '<strong class="c360-sat-val tabular-nums">' + (sc.criteriaCompliance != null ? sc.criteriaCompliance.toFixed(1) + '%' : '—') + '</strong>';
    if (hasAudits && sc.totalApplicable > 0) {
      html += '<span class="c360-sat-sub">(' + sc.totalPositive + '/' + sc.totalApplicable + ' conf.)</span>';
    }
    html += '</div>';

    html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';

    // Sat 3: Cobertura
    html += '<div class="c360-sat-item">';
    html += '<span class="c360-sat-kicker">Cobertura:</span>';
    html += '<strong class="c360-sat-val tabular-nums">' + (hasAudits ? coveragePct + '%' : '—') + '</strong>';
    html += '<span class="c360-sat-sub">(' + (hasAudits ? evaluatedCaps + '/5 caps' : '0/5') + ')</span>';
    html += '</div>';

    html += '</div>'; // End satellites-strip

    // Partial scope alert
    if (hasAudits && !isFull) {
      var unAuditedPts = Math.round((100.0 - (score || 0)) * 10) / 10;
      html += '<div class="c360-canvas-partial-banner" role="note">';
      html += '<span class="c360-banner-icon" aria-hidden="true">⚠️</span>';
      html += '<div class="c360-banner-body">';
      html += '<strong>Auditoría con alcance parcial:</strong> Quedan ' + unAuditedPts.toFixed(1) + ' puntos sin evaluar en capítulos omitidos. Los capítulos no evaluados no aportan puntuación (0.0 pts).';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // End canvas-left

    // Right Column: Timeline Trajectory & Delta
    html += '<div class="c360-canvas-right">';
    
    html += '<div class="c360-canvas-header">';
    html += '<div class="c360-canvas-kicker-group">';
    html += '<span class="c360-card-eyebrow">TRAYECTORIA &amp; EVOLUCIÓN HISTÓRICA</span>';
    html += '<h3 class="c360-canvas-title">Evolución de Puntos MIPE</h3>';
    html += '</div>';
    if (trendVm && trendVm.delta != null) {
      var dCol = trendVm.delta > 0 ? 'text-success' : (trendVm.delta < 0 ? 'text-danger' : 'text-muted');
      html += '<div class="c360-canvas-delta-badge ' + dCol + '">';
      html += '<span class="c360-delta-kicker">Delta vs Anterior:</span> ';
      html += '<strong class="tabular-nums font-bold">' + escapeHtml(trendVm.deltaText) + '</strong>';
      html += '</div>';
    }
    html += '</div>';

    if (trendVm) {
      html += renderTimelineChart(trendVm);
    }

    // Delta Callout & Comparability Note
    html += '<div class="c360-canvas-history-footer">';
    if (trendVm && trendVm.delta != null) {
      html += '<div class="c360-canvas-delta-note">';
      html += '<span>Última visita: <strong>' + (trendVm.currentScore != null ? trendVm.currentScore.toFixed(1) : '—') + ' pts</strong></span>';
      html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';
      html += '<span>Visita previa: <strong>' + (trendVm.previousScore != null ? trendVm.previousScore.toFixed(1) : '—') + ' pts</strong></span>';
      html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';
      html += '<span class="text-muted">' + escapeHtml(trendVm.summaryText || '') + '</span>';
      html += '</div>';
    } else if (trendVm && trendVm.hasAudits) {
      html += '<div class="c360-canvas-delta-note text-muted">';
      html += 'Línea base registrada (1 auditoría). Se registrará la variación en la próxima visita.';
      html += '</div>';
    } else {
      html += '<div class="c360-canvas-delta-note text-muted">';
      html += 'Sin historial suficiente para calcular la trayectoria en el periodo.';
      html += '</div>';
    }

    if (trendVm && trendVm.scopeMismatch) {
      html += '<div class="c360-canvas-mismatch-banner">';
      html += '⚠️ <strong>Alcance no homogéneo:</strong> ' + escapeHtml(trendVm.scopeMismatchText);
      html += '</div>';
    }

    html += '</div>'; // End history-footer

    html += '</div>'; // End canvas-right

    html += '</section>'; // End command-canvas
    return html;
  }

  function renderChapterGapAnalyzer(intel) {
    // Find the chapter with largest point deficit (maxPoints - pointsEarned)
    var largestGapChId = null;
    var largestGapVal = -1;

    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var lostPts = p.maxPoints - (p.isEvaluated && p.pointsEarned != null ? p.pointsEarned : 0);
      if (lostPts > largestGapVal) {
        largestGapVal = lostPts;
        largestGapChId = chId;
      }
    });

    var html = '<section class="c360-gap-analyzer-section" aria-label="Analizador de Brechas por Capítulo">';

    html += '<div class="c360-gap-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">DISTRIBUCIÓN PONDERADA &amp; ANÁLISIS DE BRECHAS</span>';
    html += '<h3 class="c360-gap-title">Aporte de Puntos y Brechas por Capítulo</h3>';
    html += '</div>';
    html += '<div class="c360-gap-score-summary tabular-nums"><strong>' + intel.globalPoints.toFixed(1) + '</strong> / 100.0 Puntos Oficiales Ganados</div>';
    html += '</div>';

    // Stacked Contribution Bar
    html += '<div class="c360-stacked-bar" role="progressbar" aria-valuenow="' + intel.globalPoints.toFixed(1) + '" aria-valuemin="0" aria-valuemax="100">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var colors = { 1: "#0284c7", 2: "#16a34a", 3: "#8b5cf6", 4: "#d97706", 5: "#059669" };
      var segColor = p.isEvaluated ? colors[chId] : "#e2e8f0";
      var tooltip = "Cap " + chId + ": " + p.info.short + (p.isEvaluated ? " (" + p.pointsEarned.toFixed(1) + " / " + p.maxPoints + " pts)" : " (⚠️ NO EVALUADO · 0.0 pts)");

      html += '<div class="c360-bar-segment' + (!p.isEvaluated ? ' is-uneval' : '') + '" style="width: ' + p.maxPoints + '%; background-color: ' + segColor + ';" title="' + tooltip + '" data-action="open-chapter" data-chapter="' + chId + '">';
      html += '<span class="c360-seg-label">Cap ' + chId + ' (' + p.maxPoints + '%)</span>';
      html += '<span class="c360-seg-val tabular-nums">' + (p.isEvaluated ? p.pointsEarned.toFixed(1) + ' pts' : 'N/E · 0 pts') + '</span>';
      html += '</div>';
    });
    html += '</div>';

    // Continuous 5-Chapter Gap Cards Strip
    html += '<div class="c360-gap-chapters-row">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var info = p.info;
      var isEval = p.isEvaluated && p.compliance != null;
      var isPrimaryGap = (chId === largestGapChId && largestGapVal > 0.1);
      var lostPts = p.maxPoints - (isEval ? p.pointsEarned : 0);

      var statusClass = isEval
        ? (p.compliance >= 90 ? "status-success" : (p.compliance >= 75 ? "status-warning" : "status-danger"))
        : "status-unevaluated";

      html += '<div class="c360-gap-chapter-card ' + statusClass + (isPrimaryGap ? ' is-primary-gap' : '') + '" data-action="open-chapter" data-chapter="' + chId + '">';
      
      html += '<div class="c360-gcc-head">';
      html += '<span class="c360-gcc-num">Cap ' + chId + ' (' + p.maxPoints + '%)</span>';
      if (isPrimaryGap) {
        html += '<span class="c360-gcc-gap-badge" title="Capítulo con la mayor pérdida de puntos en el protocolo">▲ Principal Brecha (-' + lostPts.toFixed(1) + ' pts)</span>';
      } else if (!isEval) {
        html += '<span class="c360-gcc-uneval-badge">⚠️ No Evaluado</span>';
      }
      html += '</div>';

      html += '<h4 class="c360-gcc-title">' + info.icon + ' ' + escapeHtml(info.short) + '</h4>';

      html += '<div class="c360-gcc-score-row">';
      if (isEval) {
        html += '<div class="c360-gcc-score tabular-nums">' + p.pointsEarned.toFixed(1) + ' <small>/ ' + p.maxPoints + ' pts</small></div>';
        html += '<div class="c360-gcc-pct tabular-nums ' + (p.compliance >= 90 ? 'text-success' : (p.compliance >= 75 ? 'text-warning' : 'text-danger')) + '">' + p.compliance.toFixed(1) + '%</div>';
      } else {
        html += '<div class="c360-gcc-score text-muted">0.0 <small>/ ' + p.maxPoints + ' pts</small></div>';
        html += '<div class="c360-gcc-pct text-muted">Sin evaluar</div>';
      }
      html += '</div>';

      // Mini progress bar
      html += '<div class="c360-gcc-progress-track">';
      html += '<div class="c360-gcc-progress-fill ' + statusClass + '" style="width: ' + (isEval ? p.compliance : 0) + '%;"></div>';
      html += '</div>';

      html += '<div class="c360-gcc-meta-row">';
      if (isEval) {
        html += '<span>' + p.findings + ' hallazgo' + (p.findings === 1 ? '' : 's') + '</span>';
        html += '<span class="c360-gcc-link">Ver detalle →</span>';
      } else {
        html += '<span class="text-muted">0/' + info.criteriaCount + ' evaluados</span>';
        html += '<span class="c360-gcc-link">Protocolo →</span>';
      }
      html += '</div>';

      html += '</div>'; // End gap-chapter-card
    });
    html += '</div>'; // End gap-chapters-row

    html += '</section>'; // End gap-analyzer-section
    return html;
  }

  function renderQuickInterventionZone(intel, vm) {
    var rvm = vm.riskMatrixVm;
    var findings = rvm && Array.isArray(rvm.findingsList) ? rvm.findingsList : [];
    var topFindings = findings.slice(0, 5);
    var hasAudits = vm.hasAudits;

    var html = '<section class="c360-quick-intervention-section" aria-label="Zona de Intervención Rápida">';

    html += '<div class="c360-qi-header">';
    html += '<div class="c360-qi-title-group">';
    html += '<span class="c360-card-eyebrow">INTERVENCIÓN RÁPIDA &amp; PLAN DE ACCIÓN</span>';
    html += '<h3 class="c360-qi-title">Top Desviaciones Críticas a Atender</h3>';
    html += '<p class="c360-qi-desc">Conexión directa entre el problema de campo observado, severidad, acción técnica requerida y evidencia documental.</p>';
    html += '</div>';
    if (topFindings.length > 0) {
      html += '<div class="c360-qi-count-badge tabular-nums">Mostrando ' + topFindings.length + ' de ' + findings.length + ' desviaciones</div>';
    }
    html += '</div>';

    if (topFindings.length > 0) {
      html += '<div class="c360-qi-list">';
      topFindings.forEach(function (f, idx) {
        var pInfo = f.priorityTier || f.priorityInfo || {};
        var sevLabel = f.severityLabel || (f.severityInfo && f.severityInfo.label) || f.severityKey || 'Sin clasificar';
        var critLabel = f.criterionId ? 'Criterio ' + f.criterionId : 'Hallazgo General';
        var chapName = f.chapterTitle || f.chapterName || (f.chapter ? 'Capítulo ' + f.chapter : '');
        var problemDesc = f.observation || f.problemText || f.criterionText || f.findingName || 'Desviación detectada';
        var farmName = f.farm || f.farmName || 'Sin finca';
        var lotName = f.lot || f.lotName || '';
        var dateStr = f.date || f.formattedDate || 'Sin fecha';
        var responsible = f.reviewer || f.responsible || 'Responsable de MIPE';

        html += '<div class="c360-qi-item sev-' + f.severityKey + '">';
        
        // Col 1: Priority & Severity
        html += '<div class="c360-qi-prio-col">';
        html += '<div class="c360-qi-prio-badge ' + (pInfo.badgeClass || '') + '">#' + (idx + 1) + ' · ' + escapeHtml(pInfo.label || 'Prioridad') + '</div>';
        html += '<div class="c360-qi-sev-text sev-' + f.severityKey + '">' + escapeHtml(sevLabel) + '</div>';
        html += '</div>';

        // Col 2: Problem & Context
        html += '<div class="c360-qi-problem-col">';
        html += '<div class="c360-qi-crit-head">';
        html += '<strong>' + escapeHtml(critLabel) + '</strong>';
        if (chapName) {
          html += ' <span class="c360-qi-chap-tag">(' + escapeHtml(chapName) + ')</span>';
        }
        html += '</div>';
        html += '<div class="c360-qi-problem-text">' + escapeHtml(f.criterionText || problemDesc) + '</div>';
        if (f.observation && f.observation !== f.criterionText) {
          html += '<div class="c360-qi-obs-quote">"' + escapeHtml(f.observation) + '"</div>';
        }
        html += '<div class="c360-qi-context-meta">';
        html += '<span>📍 ' + escapeHtml(farmName) + (lotName ? ' · Lote ' + escapeHtml(lotName) : '') + '</span>';
        html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';
        html += '<span class="tabular-nums">📅 ' + escapeHtml(dateStr) + '</span>';
        html += '</div>';
        html += '</div>';

        // Col 3: Action & Responsible
        html += '<div class="c360-qi-action-col">';
        html += '<div class="c360-qi-act-kicker">ACCIÓN REQUERIDA:</div>';
        html += '<div class="c360-qi-act-text">' + escapeHtml(f.actionText || 'Definir plan correctivo con el responsable de área') + '</div>';
        html += '<div class="c360-qi-act-meta">';
        html += '<span>👤 ' + escapeHtml(responsible) + '</span>';
        html += '</div>';
        html += '</div>';

        // Col 4: Direct Evidence Button
        html += '<div class="c360-qi-evidence-col">';
        var photoCount = Array.isArray(f.photos) ? f.photos.length : 0;
        if (f.hasEvidence) {
          html += '<button type="button" class="c360-btn-qi-evidence" data-action="open-risk-detail" data-finding-id="' + escapeHtml(f.id) + '" title="Ver evidencia fotográfica y trazabilidad">';
          html += '📸 Ver Evidencia' + (photoCount > 0 ? ' (' + photoCount + ')' : '');
          html += '</button>';
        } else {
          html += '<button type="button" class="c360-btn-qi-evidence is-doc" data-action="open-risk-detail" data-finding-id="' + escapeHtml(f.id) + '" title="Ver ficha técnica del hallazgo">';
          html += '🔍 Ver Detalle';
          html += '</button>';
        }
        html += '</div>';

        html += '</div>'; // End qi-item
      });
      html += '</div>'; // End qi-list
    } else {
      html += '<div class="c360-empty-risks-state">';
      html += '<div class="c360-empty-icon">✓</div>';
      if (!hasAudits) {
        html += '<div class="c360-empty-title">No hay información suficiente para establecer una prioridad</div>';
        html += '<div class="c360-empty-desc">Registre o seleccione auditorías con datos para visualizar el plan de intervención.</div>';
      } else {
        html += '<div class="c360-empty-title">Cero no conformidades activas en el periodo</div>';
        html += '<div class="c360-empty-desc">Todos los criterios evaluados cumplen satisfactoriamente el protocolo MIPE oficial.</div>';
      }
      html += '</div>';
    }

    // Bottom Navigation Shortcuts
    html += '<div class="c360-qi-footer-nav">';
    html += '<span class="c360-qi-footer-kicker">HERRAMIENTAS DE PROFUNDIDAD:</span>';
    html += '<button type="button" class="c360-btn-qi-nav" data-action="nav-tab" data-tab="chapters">📋 Ver los 37 Criterios</button>';
    html += '<button type="button" class="c360-btn-qi-nav" data-action="nav-tab" data-tab="benchmark">📈 Benchmark Comparativo</button>';
    html += '<button type="button" class="c360-btn-qi-nav" data-action="nav-tab" data-tab="risks">⚠️ Matriz 2D Completa</button>';
    html += '</div>';

    html += '</section>'; // End quick-intervention-section
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Tab 1: Overview (Agronomic Command Center)
   * ------------------------------------------------------------------ */

  function renderOverviewTab(intel, vm) {
    var html = '<div class="c360-overview-view c360-command-center">';

    // 1. Lienzo Maestro de Estado MIPE (MIPE Health Command Canvas)
    html += renderMipeCommandCanvas(vm);

    // 2. Analizador de Brechas por Capítulo & Aporte Ponderado
    html += renderChapterGapAnalyzer(intel);

    // 3. Zona de Intervención Rápida (Top Desviaciones & Acciones Vinculadas)
    html += renderQuickInterventionZone(intel, vm);

    html += '</div>';
    return html;
  }

  function renderCircularGauge(score, coverage) {
    var radius = 68;
    var circ = 2 * Math.PI * radius;
    var hasScore = score != null && score > 0;
    var val = hasScore ? Math.max(0, Math.min(100, score)) : 0;
    var offset = circ - (val / 100) * circ;
    var strokeColor = hasScore ? (score >= 90 ? "#16a34a" : (score >= 75 ? "#d97706" : "#dc2626")) : "#d5ded5";

    return '<svg class="c360-gauge-svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="#e2e8e2" stroke-width="12" stroke-dasharray="' + circ + '" />' +
      '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="' + strokeColor + '" stroke-width="12" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 80 80)" style="transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);" />' +
      '</svg>';
  }

  function renderStackedWeightStrip(intel) {
    var html = '<div class="c360-card c360-stacked-strip-card">';
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">DISTRIBUCIÓN PONDERADA DE LOS 100 PUNTOS MIPE</span>';
    html += '<h3 class="c360-card-title">Aporte de Puntos por Capítulo</h3>';
    html += '</div>';
    
    html += '<div class="c360-strip-summary tabular-nums"><strong>' + intel.globalPoints.toFixed(1) + '</strong> / 100.0 Puntos Ganados</div>';
    html += '</div>';

    html += '<div class="c360-stacked-bar">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var colors = { 1: "#0284c7", 2: "#16a34a", 3: "#8b5cf6", 4: "#d97706", 5: "#059669" };
      var segColor = p.isEvaluated ? colors[chId] : "#e5eae5";
      var tooltip = "Cap " + chId + ": " + p.info.short + (p.isEvaluated ? " (" + p.pointsEarned.toFixed(1) + " / " + p.maxPoints + " pts · " + p.compliance.toFixed(1) + "% cumplimiento)" : " (⚠️ NO EVALUADO · 0.0 pts)");
      
      html += '<div class="c360-bar-segment' + (!p.isEvaluated ? ' is-uneval' : '') + '" style="width: ' + p.maxPoints + '%; background-color: ' + segColor + ';" title="' + tooltip + '" data-action="open-chapter" data-chapter="' + chId + '">';
      html += '<span class="c360-seg-label">Cap ' + chId + ' (' + p.maxPoints + '%)</span>';
      html += '<span class="c360-seg-val tabular-nums">' + (p.isEvaluated ? p.pointsEarned.toFixed(1) + ' pts' : 'N/E · 0 pts') + '</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="c360-strip-legend">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var colors = { 1: "#0284c7", 2: "#16a34a", 3: "#8b5cf6", 4: "#d97706", 5: "#059669" };
      var dotColor = p.isEvaluated ? colors[chId] : "#9baea2";
      html += '<div class="c360-legend-item' + (!p.isEvaluated ? ' is-uneval' : '') + '" data-action="open-chapter" data-chapter="' + chId + '">';
      html += '<span class="c360-legend-dot" style="background-color: ' + dotColor + ';"></span>';
      html += '<span class="c360-legend-name">' + p.info.short + '</span>';
      html += '<span class="c360-legend-weight tabular-nums">(' + (p.isEvaluated ? p.pointsEarned.toFixed(1) + ' / ' + p.maxPoints + ' pts' : 'No evaluado · 0 pts') + ')</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderChapterCard(ch) {
    var info = ch.info;
    var isEval = ch.isEvaluated && ch.compliance != null;
    var statusClass = isEval
      ? (ch.compliance >= 90 ? "status-success" : (ch.compliance >= 75 ? "status-warning" : "status-danger"))
      : "status-unevaluated";

    var html = '<div class="c360-card c360-chapter-card ' + statusClass + '" data-action="open-chapter" data-chapter="' + info.id + '">';
    html += '<div class="c360-chap-head">';
    html += '<div class="c360-chap-badge-strip">';
    html += '<span class="c360-chap-num">Capítulo ' + info.id + '</span>';
    html += '<span class="c360-chap-weight-tag tabular-nums">Peso: ' + ch.maxPoints + '% (' + ch.maxPoints.toFixed(1) + ' pts)</span>';
    if (info.critical) {
      html += '<span class="c360-critical-tag">Crítico</span>';
    }
    if (!isEval) {
      html += '<span class="c360-uneval-tag">⚠️ No Evaluado</span>';
    }
    html += '</div>';
    html += '<h4 class="c360-chap-title">' + info.icon + ' ' + escapeHtml(info.title) + '</h4>';
    html += '</div>';

    html += '<div class="c360-chap-score-row">';
    if (isEval) {
      html += '<div class="c360-chap-big-score tabular-nums ' + (ch.compliance >= 90 ? 'text-success' : (ch.compliance >= 75 ? 'text-warning' : 'text-danger')) + '">' + ch.compliance.toFixed(1) + '%</div>';
      html += '<div class="c360-chap-pts tabular-nums">' + ch.pointsEarned.toFixed(1) + ' / ' + ch.maxPoints.toFixed(1) + ' pts ganados</div>';
    } else {
      html += '<div class="c360-chap-big-score text-muted">Sin evaluar</div>';
      html += '<div class="c360-chap-pts text-muted font-bold">0.0 / ' + ch.maxPoints.toFixed(1) + ' pts (No evaluado)</div>';
    }
    html += '</div>';

    // Progress Bar (Guaranteed: 0% fill for unevaluated chapters)
    html += '<div class="c360-progress-track">';
    if (isEval) {
      html += '<div class="c360-progress-fill ' + statusClass + '" style="width: ' + ch.compliance + '%;"></div>';
    } else {
      html += '<div class="c360-progress-fill status-unevaluated" style="width: 0%;"></div>';
    }
    html += '</div>';

    html += '<div class="c360-chap-metrics-row">';
    if (isEval) {
      html += '<div class="c360-cm-col"><span>Evaluados</span><strong class="tabular-nums">' + ch.applicable + '</strong></div>';
      html += '<div class="c360-cm-col"><span>Conformes</span><strong class="tabular-nums ' + (ch.positive > 0 ? 'text-success' : '') + '">' + ch.positive + '</strong></div>';
      html += '<div class="c360-cm-col"><span>Hallazgos</span><strong class="tabular-nums ' + (ch.findings > 0 ? 'text-danger font-bold' : '') + '">' + ch.findings + '</strong></div>';
    } else {
      html += '<div class="c360-cm-col" style="grid-column: span 3; text-align: center;"><span class="text-muted">0 de ' + info.criteriaCount + ' criterios auditados en este periodo</span></div>';
    }
    html += '</div>';

    html += '<div class="c360-chap-action-row">';
    html += '<span class="c360-chap-link">' + (isEval ? 'Ver criterios y hallazgos →' : 'Ver preguntas del protocolo (' + info.criteriaCount + ' ítems) →') + '</span>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Tab 2: Chapters & Criteria Deep Dive
   * ------------------------------------------------------------------ */

  function renderChaptersTab(intel) {
    var html = '<div class="c360-chapters-view">';

    // Chapter Pills selector
    html += '<div class="c360-chapter-nav">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var info = CHAPTER_INFO[chId];
      var p = intel.chapterPerformance[chId];
      var active = state.selectedChapter === chId;
      var isEval = p.isEvaluated && p.compliance != null;
      html += '<button class="c360-ch-pill' + (active ? ' active' : '') + (!isEval ? ' is-uneval' : '') + '" data-action="select-chapter" data-chapter="' + chId + '">';
      html += '<span class="c360-ch-pill-num">Cap ' + chId + ' (' + (info.weight * 100) + '%)</span>';
      html += '<span class="c360-ch-pill-name">' + info.short + '</span>';
      html += '<span class="c360-ch-pill-pct tabular-nums">' + (isEval ? p.compliance.toFixed(1) + '%' : 'No evaluado') + '</span>';
      html += '</button>';
    });
    html += '</div>';

    var curChapter = CHAPTER_INFO[state.selectedChapter];
    var curPerf = intel.chapterPerformance[state.selectedChapter];
    var isCurEval = curPerf.isEvaluated && curPerf.compliance != null;

    // Chapter Header Banner
    html += '<div class="c360-card c360-ch-banner' + (!isCurEval ? ' is-uneval' : '') + '">';
    html += '<div class="c360-ch-banner-left">';
    html += '<div class="c360-ch-banner-eyebrow">CAPÍTULO ' + curChapter.id + ' · PESO OFICIAL ' + curPerf.maxPoints + '% (' + curPerf.maxPoints.toFixed(1) + ' PTS MÁXIMOS) · ' + curChapter.criteriaCount + ' CRITERIOS</div>';
    html += '<h2 class="c360-ch-banner-title">' + curChapter.icon + ' ' + escapeHtml(curChapter.title) + '</h2>';
    html += '<div class="c360-ch-banner-stats">';
    if (isCurEval) {
      html += '<span>Cumplimiento: <strong class="tabular-nums ' + (curPerf.compliance >= 90 ? 'text-success' : 'text-danger') + '">' + curPerf.compliance.toFixed(1) + '%</strong></span>';
      html += '<span aria-hidden="true">·</span>';
      html += '<span>Puntos Ganados: <strong class="tabular-nums">' + curPerf.pointsEarned.toFixed(1) + ' / ' + curPerf.maxPoints.toFixed(1) + ' pts</strong></span>';
      html += '<span aria-hidden="true">·</span>';
      html += '<span>Hallazgos: <strong class="tabular-nums ' + (curPerf.findings > 0 ? 'text-danger font-bold' : 'text-success') + '">' + curPerf.findings + '</strong></span>';
      html += '<span aria-hidden="true">·</span>';
      html += '<span>Criterios calificados: <strong class="tabular-nums">' + curPerf.applicable + ' de ' + curChapter.criteriaCount + '</strong></span>';
    } else {
      html += '<span class="c360-uneval-pill-lg">⚠️ Este capítulo NO fue evaluado en las visitas seleccionadas (0 de ' + curChapter.criteriaCount + ' criterios calificados · 0.0 pts ganados)</span>';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Criteria Filter Controls
    html += '<div class="c360-filter-toolbar">';
    html += '<input type="text" class="c360-search-input" placeholder="🔍 Buscar criterio por palabra clave o código..." value="' + escapeHtml(state.search) + '" data-action="search-criteria">';
    
    html += '<select class="c360-control-select" data-action="filter-severity">';
    html += '<option value="all"' + (state.severityFilter === "all" ? ' selected' : '') + '>Todas las severidades</option>';
    html += '<option value="critical"' + (state.severityFilter === "critical" ? ' selected' : '') + '>Solo Críticos</option>';
    html += '<option value="high"' + (state.severityFilter === "high" ? ' selected' : '') + '>Solo Altos</option>';
    html += '<option value="medium"' + (state.severityFilter === "medium" ? ' selected' : '') + '>Solo Medios</option>';
    html += '</select>';

    html += '<select class="c360-control-select" data-action="filter-status">';
    html += '<option value="all"' + (state.statusFilter === "all" ? ' selected' : '') + '>Todos los estados</option>';
    html += '<option value="findings"' + (state.statusFilter === "findings" ? ' selected' : '') + '>Solo con hallazgos (NO cumple)</option>';
    html += '<option value="compliant"' + (state.statusFilter === "compliant" ? ' selected' : '') + '>Solo conformes (100% SI)</option>';
    html += '<option value="unevaluated"' + (state.statusFilter === "unevaluated" ? ' selected' : '') + '>Solo sin evaluar en campo</option>';
    html += '</select>';
    html += '</div>';

    // Criteria Cards List
    var chapterCriteria = Object.keys(CRITERIA_CATALOG).filter(function (cid) {
      return CRITERIA_CATALOG[cid].chapter === state.selectedChapter;
    });

    // Apply filters
    var filteredCriteria = chapterCriteria.filter(function (cid) {
      var item = CRITERIA_CATALOG[cid];
      var stat = intel.criteriaStats[cid];
      if (state.severityFilter !== "all" && item.severity !== state.severityFilter) return false;
      if (state.statusFilter === "findings" && stat.findings === 0) return false;
      if (state.statusFilter === "compliant" && (stat.findings > 0 || stat.applicable === 0)) return false;
      if (state.statusFilter === "unevaluated" && stat.applicable > 0) return false;
      if (state.search) {
        var query = norm(state.search);
        var matchText = norm(item.text) + " " + norm(cid) + " " + norm(item.category);
        if (matchText.indexOf(query) === -1) return false;
      }
      return true;
    });

    html += '<div class="c360-criteria-list">';
    if (filteredCriteria.length === 0) {
      html += '<div class="c360-empty-card">No se encontraron criterios que coincidan con los filtros seleccionados.</div>';
    } else {
      filteredCriteria.forEach(function (cid) {
        html += renderCriterionCard(cid, intel.criteriaStats[cid]);
      });
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderCriterionCard(cid, stat) {
    var item = CRITERIA_CATALOG[cid];
    var isEval = stat.applicable > 0;
    var compRate = isEval ? Math.round((stat.positive / stat.applicable) * 100) : null;
    var sevClass = item.severity === "critical" ? "badge-critical" : (item.severity === "high" ? "badge-high" : "badge-medium");
    var sevLabel = item.severity === "critical" ? "Crítico" : (item.severity === "high" ? "Alto" : "Medio");
    var isExpanded = !!state.expandedFindings[cid];

    var html = '<div class="c360-card c360-criterion-card' + (stat.findings > 0 ? ' has-findings' : '') + (!isEval ? ' is-unevaluated' : '') + '">';
    html += '<div class="c360-crit-top">';
    html += '<div class="c360-crit-header-left">';
    html += '<span class="c360-crit-code">' + cid + '</span>';
    html += '<span class="c360-sev-badge ' + sevClass + '">' + sevLabel + '</span>';
    html += '<span class="c360-crit-cat">' + escapeHtml(item.category) + '</span>';
    if (!isEval) {
      html += '<span class="c360-crit-uneval-tag">Sin evaluar en campo</span>';
    }
    html += '</div>';
    
    html += '<div class="c360-crit-scores tabular-nums">';
    if (isEval) {
      html += '<span>Cumplimiento: <strong class="' + (compRate >= 90 ? 'text-success' : (compRate >= 75 ? 'text-warning' : 'text-danger')) + '">' + compRate + '%</strong></span>';
      html += '<span aria-hidden="true">·</span>';
      html += '<span>Evaluaciones: <strong>' + stat.applicable + '</strong></span>';
      if (stat.findings > 0) {
        html += '<span aria-hidden="true">·</span>';
        html += '<span class="text-danger font-bold">' + stat.findings + ' No cumple</span>';
      }
    } else {
      html += '<span class="text-muted font-bold">0 evaluaciones registradas</span>';
    }
    html += '</div>';
    html += '</div>';

    html += '<p class="c360-crit-text">' + escapeHtml(item.text) + '</p>';

    if (stat.findings > 0) {
      html += '<div class="c360-crit-actions">';
      html += '<button class="c360-btn-findings-toggle' + (isExpanded ? ' expanded' : '') + '" data-action="toggle-findings" data-id="' + cid + '">';
      html += '<span>' + (isExpanded ? 'Ocultar' : 'Ver') + ' ' + stat.findings + ' hallazgos en fincas</span>';
      html += '<span class="c360-arrow-icon">' + (isExpanded ? '▲' : '▼') + '</span>';
      html += '</button>';
      html += '</div>';

      if (isExpanded) {
        html += '<div class="c360-findings-expanded">';
        if (stat.observations.length === 0) {
          html += '<div class="c360-finding-row text-muted">Registrado como No cumple sin observaciones complementarias.</div>';
        } else {
          stat.observations.forEach(function (f) {
            html += '<div class="c360-finding-row">';
            html += '<div class="c360-finding-meta">';
            html += '<strong>📍 ' + escapeHtml(f.farm) + '</strong>';
            html += '<span>📅 ' + (f.date || "Fecha no registrada") + '</span>';
            html += '<span>👤 ' + escapeHtml(f.reviewer) + '</span>';
            html += '</div>';
            if (f.observation) {
              html += '<div class="c360-finding-obs"><strong>Hallazgo:</strong> ' + escapeHtml(f.observation) + '</div>';
            }
            if (f.recommendation) {
              html += '<div class="c360-finding-rec"><strong>Recomendación:</strong> ' + escapeHtml(f.recommendation) + '</div>';
            }
            html += '</div>';
          });
        }
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Tab 3: Benchmark & Trends
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * FASE 4: MIPE Trend View & Farm Benchmark View
   * ------------------------------------------------------------------ */

  function renderTimelineChart(trendVm) {
    if (!trendVm || !trendVm.hasData || trendVm.series.length === 0) {
      return '<div class="c360-empty-chart" role="note">' +
        '<div class="c360-empty-chart-icon" aria-hidden="true">📈</div>' +
        '<div class="c360-empty-chart-text">No hay mediciones registradas en el periodo seleccionado para trazar la curva temporal.</div>' +
        '<div class="c360-empty-chart-hint">Ajuste los filtros de periodo o seleccione otra finca para visualizar el historial.</div>' +
        '</div>';
    }

    var series = trendVm.series;
    var width = 840;
    var height = 240;
    var padLeft = 55;
    var padRight = 85;
    var padTop = 25;
    var padBottom = 45;

    var chartW = width - padLeft - padRight;
    var chartH = height - padTop - padBottom;

    var minY = 0;
    var maxY = 100;

    var points = series.map(function (item, idx) {
      var x = padLeft + (series.length > 1 ? (idx / (series.length - 1)) * chartW : chartW / 2);
      var safeScore = Math.max(minY, Math.min(maxY, item.officialScore));
      var y = padTop + chartH - ((safeScore - minY) / (maxY - minY)) * chartH;
      return { x: x, y: y, item: item };
    });

    var pathD = "";
    points.forEach(function (p, i) {
      pathD += (i === 0 ? "M " : " L ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    });

    var areaD = pathD + " L " + points[points.length - 1].x.toFixed(1) + " " + (padTop + chartH) + " L " + points[0].x.toFixed(1) + " " + (padTop + chartH) + " Z";
    var targetY = padTop + chartH - ((trendVm.targetScore - minY) / (maxY - minY)) * chartH;

    var svg = '<svg class="c360-timeline-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Curva de evolución temporal de Puntos MIPE oficiales">';
    
    svg += '<defs>';
    svg += '<linearGradient id="c360-trend-grad" x1="0" y1="0" x2="0" y2="1">';
    svg += '<stop offset="0%" stop-color="#16a34a" stop-opacity="0.22"/>';
    svg += '<stop offset="100%" stop-color="#16a34a" stop-opacity="0.0"/>';
    svg += '</linearGradient>';
    svg += '</defs>';

    [0, 25, 50, 75, 90, 100].forEach(function (val) {
      var y = padTop + chartH - ((val - minY) / (maxY - minY)) * chartH;
      var isTargetLevel = val === 90;
      var strokeColor = isTargetLevel ? "#cbd5e1" : "#e2e8f0";
      svg += '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - padRight) + '" y2="' + y + '" stroke="' + strokeColor + '" stroke-width="1" stroke-dasharray="3 3" />';
      svg += '<text x="' + (padLeft - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="c360-svg-axis-text tabular-nums">' + val + ' pts</text>';
    });

    svg += '<line x1="' + padLeft + '" y1="' + targetY + '" x2="' + (width - padRight) + '" y2="' + targetY + '" stroke="#16a34a" stroke-width="1.75" stroke-dasharray="6 4" />';
    svg += '<text x="' + (width - padRight + 8) + '" y="' + (targetY + 4) + '" class="c360-svg-target-text">Meta 95 pts</text>';

    if (points.length > 1) {
      svg += '<path d="' + areaD + '" fill="url(#c360-trend-grad)" />';
      svg += '<path d="' + pathD + '" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />';
    }

    points.forEach(function (p) {
      var it = p.item;
      var isFull = it.isFullyEvaluated;
      var tooltip = it.date + "\n" +
        "Puntos MIPE: " + it.officialScore.toFixed(1) + " / 100 pts\n" +
        "Cobertura: " + it.coveragePct + "% (" + it.evaluatedChaptersCount + "/5 caps)\n" +
        "Estado: " + (isFull ? "Auditoría completa" : "Auditoría parcial") + "\n" +
        "Lote: " + it.lot + " · Cultivo: " + it.crop;

      svg += '<g class="c360-timeline-point ' + (isFull ? 'point-complete' : 'point-partial') + '" tabindex="0">';
      svg += '<title>' + escapeHtml(tooltip) + '</title>';

      if (isFull) {
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="6" fill="#16a34a" stroke="#ffffff" stroke-width="2.5" />';
      } else {
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7" fill="#ffffff" stroke="#d97706" stroke-width="2.5" />';
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="#d97706" />';
      }

      var labelY = p.y - 12;
      if (labelY < padTop) labelY = p.y + 18;
      var scoreColor = isFull ? "#143d2b" : "#b45309";
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + labelY + '" text-anchor="middle" class="c360-svg-val-text tabular-nums" fill="' + scoreColor + '">' +
        it.officialScore.toFixed(1) + (!isFull ? ' (P)' : '') +
        '</text>';

      var displayDate = it.date;
      if (displayDate.length === 10) {
        var parts = displayDate.split("-");
        if (parts.length === 3) displayDate = parts[2] + "/" + parts[1];
      }
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (padTop + chartH + 22) + '" text-anchor="middle" class="c360-svg-axis-text tabular-nums">' + escapeHtml(displayDate) + '</text>';
      svg += '</g>';
    });

    svg += '</svg>';
    return svg;
  }

  function renderDeltaCard(trendVm) {
    var html = '<div class="c360-delta-card c360-card">';

    html += '<div class="c360-delta-header">';
    html += '<div class="c360-delta-kicker-group">';
    html += '<span class="c360-card-eyebrow">ANÁLISIS COMPARATIVO SECUENCIAL</span>';
    html += '<h3 class="c360-delta-title">Delta vs Medición Anterior</h3>';
    html += '</div>';
    html += '<div class="c360-delta-badge-group">';
    if (trendVm.deltaDirection === "up") {
      html += '<span class="c360-trend-badge success">↑ Mejorando</span>';
    } else if (trendVm.deltaDirection === "down") {
      html += '<span class="c360-trend-badge danger">↓ Retroceso</span>';
    } else if (trendVm.deltaDirection === "stable") {
      html += '<span class="c360-trend-badge neutral">→ Estable</span>';
    } else {
      html += '<span class="c360-trend-badge muted">Línea base</span>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="c360-delta-grid">';

    html += '<div class="c360-delta-col">';
    html += '<div class="c360-delta-label">Medición Actual</div>';
    if (trendVm.currentPoint) {
      var cp = trendVm.currentPoint;
      html += '<div class="c360-delta-val tabular-nums">' + cp.officialScore.toFixed(1) + ' <small>/100 pts</small></div>';
      html += '<div class="c360-delta-sub">' + escapeHtml(cp.date) + ' · ' + (cp.isFullyEvaluated ? '<span class="text-success font-semibold">Completa (100%)</span>' : '<span class="text-warning font-semibold">Parcial (' + cp.coveragePct + '%)</span>') + '</div>';
    } else {
      html += '<div class="c360-delta-val text-muted">Sin datos</div>';
      html += '<div class="c360-delta-sub">No hay auditorías registradas</div>';
    }
    html += '</div>';

    html += '<div class="c360-delta-col">';
    html += '<div class="c360-delta-label">Medición Anterior</div>';
    if (trendVm.previousPoint) {
      var pp = trendVm.previousPoint;
      html += '<div class="c360-delta-val tabular-nums">' + pp.officialScore.toFixed(1) + ' <small>/100 pts</small></div>';
      html += '<div class="c360-delta-sub">' + escapeHtml(pp.date) + ' · ' + (pp.isFullyEvaluated ? '<span class="text-success font-semibold">Completa (100%)</span>' : '<span class="text-warning font-semibold">Parcial (' + pp.coveragePct + '%)</span>') + '</div>';
    } else {
      html += '<div class="c360-delta-val text-muted">Sin medición previa</div>';
      html += '<div class="c360-delta-sub">Primera auditoría del periodo</div>';
    }
    html += '</div>';

    html += '<div class="c360-delta-col c360-delta-result-col">';
    html += '<div class="c360-delta-label">Delta Oficial (Actual - Anterior)</div>';
    if (trendVm.delta != null) {
      var deltaClass = trendVm.delta > 0 ? "text-success" : (trendVm.delta < 0 ? "text-danger" : "text-muted");
      html += '<div class="c360-delta-val tabular-nums font-bold ' + deltaClass + '">' + escapeHtml(trendVm.deltaText) + '</div>';
      html += '<div class="c360-delta-sub">Diferencia directa de puntos oficiales</div>';
    } else {
      html += '<div class="c360-delta-val text-muted">Sin comparación disponible</div>';
      html += '<div class="c360-delta-sub">Se requieren al menos 2 auditorías</div>';
    }
    html += '</div>';

    html += '</div>'; // End delta-grid

    if (trendVm.scopeMismatch) {
      html += '<div class="c360-scope-mismatch-alert" role="alert">';
      html += '<div class="c360-alert-icon" aria-hidden="true">⚠️</div>';
      html += '<div class="c360-alert-body">';
      html += '<strong>Comparación con alcance diferente:</strong> ' + escapeHtml(trendVm.scopeMismatchText) + '. ';
      html += 'El delta no es completamente homogéneo porque una de las visitas evaluó una cantidad distinta de capítulos del protocolo.';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // End delta-card
    return html;
  }

  function renderMipeTrendView(trendVm) {
    var html = '<section class="c360-trend-section" aria-label="Evolución Temporal MIPE">';

    html += '<div class="c360-card c360-trend-chart-card">';
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">HISTORIAL CRONOLÓGICO DE AUDITORÍAS</span>';
    html += '<h3 class="c360-card-title">Evolución de Puntos MIPE Oficiales (0 - 100)</h3>';
    html += '</div>';
    html += '<div class="c360-trend-legend-group">';
    html += '<span class="c360-legend-item"><span class="c360-legend-dot dot-complete" aria-hidden="true">●</span> Auditoría Completa</span>';
    html += '<span class="c360-legend-item"><span class="c360-legend-dot dot-partial" aria-hidden="true">○</span> Auditoría Parcial</span>';
    html += '<span class="c360-legend-item"><span class="c360-legend-line dot-target" aria-hidden="true">┄</span> Meta Oficial 95 pts</span>';
    html += '</div>';
    html += '</div>';

    html += renderTimelineChart(trendVm);

    html += '<div class="c360-trend-footer-note">';
    html += '<span class="c360-note-kicker">Regla de agregación temporal:</span> ' + escapeHtml(trendVm.aggregationRule);
    html += '</div>';

    html += '</div>'; // End trend-chart-card

    html += renderDeltaCard(trendVm);

    html += '</section>';
    return html;
  }

  function renderMiniChapterBars(chapters) {
    var html = '<div class="c360-mini-bars">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var c = chapters && chapters[chId];
      var isEval = c && c.isEvaluated && c.compliance != null;
      var col = isEval ? (c.compliance >= 90 ? "#16a34a" : (c.compliance >= 75 ? "#d97706" : "#dc2626")) : "#e2e8f0";
      var heightVal = isEval ? c.compliance : 0;
      var titleText = "Cap " + chId + ": " + (isEval ? c.compliance.toFixed(1) + "% (" + c.pointsEarned.toFixed(1) + " pts)" : "⚠️ No evaluado (0.0 pts)");
      
      html += '<div class="c360-mini-bar-col" title="' + escapeHtml(titleText) + '">';
      html += '<div class="c360-mini-bar-track' + (!isEval ? ' uneval' : '') + '"><div class="c360-mini-bar-fill" style="height: ' + heightVal + '%; background-color: ' + col + ';"></div></div>';
      html += '<span class="c360-mini-bar-label' + (!isEval ? ' text-muted' : '') + '">C' + chId + '</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderFarmComparisonCard(benchmarkVm) {
    var compared = benchmarkVm.comparedObjects;
    if (!compared || compared.length === 0) {
      return '';
    }

    var html = '<div class="c360-compare-card c360-card" role="region" aria-label="Comparativa Directa de Fincas">';
    
    html += '<div class="c360-compare-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">COMPARATIVA SIMULTÁNEA DE FINCAS</span>';
    html += '<h3 class="c360-compare-title">Contraste de ' + compared.length + ' de hasta 3 fincas seleccionadas</h3>';
    html += '</div>';
    html += '<button type="button" class="c360-btn-clear-compare" data-action="clear-compare-farms" title="Limpiar selección comparativa">';
    html += 'Limpiar Selección (' + compared.length + '/3)';
    html += '</button>';
    html += '</div>';

    html += '<div class="c360-compare-grid cols-' + compared.length + '">';
    compared.forEach(function (f) {
      var isFull = f.isFullyEvaluated;
      var hasScore = f.officialScore != null;
      var scoreClass = isFull
        ? (f.officialScore >= 90 ? "text-success" : (f.officialScore >= 75 ? "text-warning" : "text-danger"))
        : "text-muted";

      html += '<div class="c360-compare-col' + (f.isCurrentActiveFarm ? ' is-active-farm' : '') + '">';
      
      html += '<div class="c360-cmp-farm-head">';
      html += '<div class="c360-cmp-farm-name">' + escapeHtml(f.farm) + '</div>';
      html += '<div class="c360-cmp-farm-crop">' + escapeHtml(f.crop) + (f.isCurrentActiveFarm ? ' · <span class="c360-active-tag">Finca Activa</span>' : '') + '</div>';
      html += '</div>';

      html += '<div class="c360-cmp-score-box">';
      if (hasScore) {
        html += '<div class="c360-cmp-score tabular-nums ' + scoreClass + '">' + f.officialScore.toFixed(1) + '<small>/100 pts</small></div>';
        html += '<div class="c360-cmp-score-sub">';
        if (isFull) {
          html += '<span class="text-success font-semibold">✓ Protocolo Completo (100%)</span>';
        } else {
          html += '<span class="text-warning font-semibold">⚠ Alcance Parcial (' + f.evaluatedChaptersCount + '/5 caps)</span>';
        }
        html += '</div>';
      } else {
        html += '<div class="c360-cmp-score text-muted">Sin datos</div>';
        html += '<div class="c360-cmp-score-sub text-muted">Sin auditorías registradas</div>';
      }
      html += '</div>';

      html += '<div class="c360-cmp-metrics-list">';
      
      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Cumplimiento Evaluado:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + (f.criteriaCompliance != null ? f.criteriaCompliance.toFixed(1) + '%' : '—') + '</strong>';
      html += '</div>';

      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Cobertura Protocolo:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + (hasScore ? f.coveragePct + '% (' + f.evaluatedChaptersCount + '/5 caps)' : '—') + '</strong>';
      html += '</div>';

      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Auditorías Realizadas:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + f.visitsCount + ' visitas</strong>';
      html += '</div>';

      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Última Auditoría:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + (f.lastDate || "—") + '</strong>';
      html += '</div>';

      html += '<div class="c360-cmp-metric-row c360-cmp-row-bars">';
      html += '<span class="c360-cmp-metric-label">Capítulos MIPE:</span>';
      html += '<div class="c360-cmp-bars-wrap">' + renderMiniChapterBars(f.chapters) + '</div>';
      html += '</div>';

      html += '</div>';

      html += '<div class="c360-cmp-footer">';
      if (!f.isCurrentActiveFarm) {
        html += '<button type="button" class="c360-btn-table-action" data-action="filter-farm-direct" data-farm="' + escapeHtml(f.farm) + '">Ver en Detalle</button>';
      } else {
        html += '<span class="text-xs text-muted">Contexto activo en filtros</span>';
      }
      html += '</div>';

      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderBenchmarkTable(benchmarkVm) {
    var evaluated = benchmarkVm.evaluatedFarms;
    var insufficient = benchmarkVm.insufficientFarms;
    var selectedFarms = benchmarkVm.selectedCompareFarms;

    var html = '<div class="c360-card c360-table-card" role="region" aria-label="Tabla de Benchmark MIPE">';
    
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">BENCHMARK COMPARATIVO DE FINCAS AUTORIZADAS</span>';
    html += '<h3 class="c360-card-title">' + (benchmarkVm.isContextualBenchmark ? 'Benchmark Contextual de Desempeño MIPE' : 'Ranking de Desempeño y Cumplimiento Oficial') + '</h3>';
    html += '</div>';
    html += '<div class="c360-table-count">' + evaluated.length + ' Fincas con auditorías</div>';
    html += '</div>';

    if (benchmarkVm.isContextualBenchmark) {
      html += '<div class="c360-table-context-alert" role="note">';
      html += '<span class="c360-alert-icon" aria-hidden="true">ℹ️</span>';
      html += '<span><strong>Benchmark Contextual:</strong> Se detectan auditorías completas (100% alcance) y auditorías parciales (<5 capítulos). Las auditorías completas tienen prioridad de comparabilidad. Las puntuaciones parciales no deben interpretarse como ranking absoluto sobre el total del protocolo.</span>';
      html += '</div>';
    }

    html += '<div class="c360-table-wrapper">';
    html += '<table class="c360-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th class="text-center" style="width: 45px;">Comp.</th>';
    html += '<th>Posición</th>';
    html += '<th>Finca</th>';
    html += '<th>Cultivo</th>';
    html += '<th class="tabular-nums text-center">Visitas</th>';
    html += '<th class="tabular-nums text-center">Última Auditoría</th>';
    html += '<th class="text-center">Cobertura</th>';
    html += '<th class="text-center">Desglose Capítulos</th>';
    html += '<th class="tabular-nums text-right">Puntos MIPE</th>';
    html += '<th class="tabular-nums text-right">Cumplimiento</th>';
    html += '<th class="text-center">Acción</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    if (evaluated.length === 0 && insufficient.length === 0) {
      html += '<tr><td colspan="11" class="text-center py-8 text-muted">No existen registros de visitas ni fincas autorizadas en el sistema.</td></tr>';
    } else {
      evaluated.forEach(function (fr) {
        var isFull = fr.isFullyEvaluated;
        var pts = fr.officialScore != null ? fr.officialScore : 0;
        var isChecked = selectedFarms.some(function (sf) { return norm(sf) === norm(fr.farm); });
        var scoreClass = isFull
          ? (pts >= 90 ? "text-success font-bold" : (pts >= 75 ? "text-warning font-bold" : "text-danger font-bold"))
          : "text-muted font-bold";

        html += '<tr class="' + (fr.isCurrentActiveFarm ? 'row-active-farm' : '') + '">';
        
        html += '<td class="text-center">';
        html += '<input type="checkbox" class="c360-compare-checkbox" data-action="toggle-compare-farm" data-farm="' + escapeHtml(fr.farm) + '" ' + (isChecked ? 'checked' : '') + ' title="Seleccionar para comparar (máx 3 fincas)" />';
        html += '</td>';

        html += '<td class="tabular-nums font-bold">';
        if (fr.isTied) {
          html += '<span class="c360-rank-tied" title="Empate oficial en puntuación">' + escapeHtml(fr.rankDisplay) + '</span>';
        } else {
          html += escapeHtml(fr.rankDisplay);
        }
        html += '</td>';

        html += '<td>';
        html += '<strong>' + escapeHtml(fr.farm) + '</strong>';
        if (fr.isCurrentActiveFarm) {
          html += ' <span class="c360-active-tag">Activa</span>';
        }
        html += '</td>';

        html += '<td>' + escapeHtml(fr.crop) + '</td>';
        html += '<td class="tabular-nums text-center">' + fr.visitsCount + '</td>';
        html += '<td class="tabular-nums text-center">' + (fr.lastDate || "—") + '</td>';

        if (isFull) {
          html += '<td class="text-center"><span class="c360-cov-badge success" title="Protocolo completo (100% de peso auditado)">✓ 5/5 Caps</span></td>';
        } else {
          html += '<td class="text-center"><span class="c360-cov-badge warning" title="Auditoría parcial: ' + fr.coveragePct + '% del peso evaluado">⚠ ' + fr.evaluatedChaptersCount + '/5 Caps (' + fr.coveragePct + '%)</span></td>';
        }

        html += '<td>' + renderMiniChapterBars(fr.chapters) + '</td>';

        html += '<td class="tabular-nums text-right font-bold ' + scoreClass + '">';
        html += pts.toFixed(1) + ' <small>/100</small>';
        if (!isFull) {
          html += ' <small class="text-warning" title="Puntos ganados en capítulos evaluados">(parcial)</small>';
        }
        html += '</td>';

        var compCell = "—";
        if (fr.criteriaCompliance != null) {
          if (isFull) {
            var cClass = fr.criteriaCompliance >= 90 ? "text-success font-bold" : (fr.criteriaCompliance >= 75 ? "text-warning font-bold" : "text-danger font-bold");
            compCell = '<span class="' + cClass + '">' + fr.criteriaCompliance.toFixed(1) + '%</span>';
          } else {
            compCell = '<span class="text-primary font-bold" title="Cumplimiento exclusivo sobre criterios efectivamente evaluados">' + fr.criteriaCompliance.toFixed(1) + '% <small class="text-muted font-normal">(evaluados)</small></span>';
          }
        }
        html += '<td class="tabular-nums text-right">' + compCell + '</td>';

        html += '<td class="text-center">';
        html += '<button type="button" class="c360-btn-table-action" data-action="filter-farm-direct" data-farm="' + escapeHtml(fr.farm) + '">Filtrar</button>';
        html += '</td>';

        html += '</tr>';
      });

      if (insufficient.length > 0) {
        insufficient.forEach(function (fr) {
          html += '<tr class="row-insufficient-data text-muted">';
          html += '<td class="text-center">—</td>';
          html += '<td class="font-normal">—</td>';
          html += '<td><strong>' + escapeHtml(fr.farm) + '</strong></td>';
          html += '<td>' + escapeHtml(fr.crop) + '</td>';
          html += '<td class="tabular-nums text-center">0</td>';
          html += '<td class="text-center">—</td>';
          html += '<td class="text-center"><span class="c360-cov-badge muted">Sin auditorías</span></td>';
          html += '<td class="text-center">—</td>';
          html += '<td class="text-right text-muted" colspan="2"><span class="c360-insufficient-note">Sin datos suficientes para comparación</span></td>';
          html += '<td class="text-center">—</td>';
          html += '</tr>';
        });
      }
    }

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    html += '<div class="c360-table-footer-info">';
    html += '<span>Seleccione hasta 3 casillas para generar la comparación simultánea superior. Las puntuaciones mostradas corresponden estrictamente a la escala de 0 a 100 puntos oficiales calculados por el motor MIPE.</span>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderFarmBenchmarkView(benchmarkVm) {
    var html = '<section class="c360-benchmark-section" aria-label="Benchmark Comparativo de Fincas MIPE">';
    html += renderFarmComparisonCard(benchmarkVm);
    html += renderBenchmarkTable(benchmarkVm);
    html += '</section>';
    return html;
  }

  function renderBenchmarkTab(intel, vm) {
    var html = '<div class="c360-benchmark-view">';
    html += renderMipeTrendView(vm.trendVm);
    html += renderFarmBenchmarkView(vm.benchmarkVm);
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Tab 4: Risk Matrix, Causes, Priorities & Actions (FASE 5)
   * ------------------------------------------------------------------ */

  function renderRiskCounterStrip(vm) {
    var c = vm.counts;
    var html = '<div class="c360-risk-counter-strip" role="group" aria-label="Resumen de no conformidades por severidad">';
    
    html += '<div class="c360-risk-count-item count-total">';
    html += '<span class="c360-count-label">Total No Conformidades</span>';
    html += '<strong class="c360-count-num tabular-nums">' + vm.totalFindings + '</strong>';
    html += '</div>';

    html += '<span class="c360-count-sep" aria-hidden="true"></span>';

    html += '<div class="c360-risk-count-item count-critical">';
    html += '<span class="c360-count-label">Críticos</span>';
    html += '<strong class="c360-count-num tabular-nums text-danger">' + c.critical + '</strong>';
    html += '</div>';

    html += '<span class="c360-count-sep" aria-hidden="true"></span>';

    html += '<div class="c360-risk-count-item count-high">';
    html += '<span class="c360-count-label">Altos</span>';
    html += '<strong class="c360-count-num tabular-nums text-warning">' + c.high + '</strong>';
    html += '</div>';

    html += '<span class="c360-count-sep" aria-hidden="true"></span>';

    html += '<div class="c360-risk-count-item count-medium">';
    html += '<span class="c360-count-label">Medios</span>';
    html += '<strong class="c360-count-num tabular-nums text-amber">' + c.medium + '</strong>';
    html += '</div>';

    html += '<span class="c360-count-sep" aria-hidden="true"></span>';

    html += '<div class="c360-risk-count-item count-low">';
    html += '<span class="c360-count-label">Bajos</span>';
    html += '<strong class="c360-count-num tabular-nums text-muted">' + c.low + '</strong>';
    html += '</div>';

    if (c.unclassified > 0) {
      html += '<span class="c360-count-sep" aria-hidden="true"></span>';
      html += '<div class="c360-risk-count-item count-unclassified">';
      html += '<span class="c360-count-label">Sin clasificar</span>';
      html += '<strong class="c360-count-num tabular-nums text-muted">' + c.unclassified + '</strong>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderExecutiveMatrixGrid(vm) {
    var mg = vm.matrixGrid;
    var severities = ["critical", "high", "medium", "low"];
    if (vm.counts.unclassified > 0) severities.push("unclassified");

    var chapters = [
      { id: 1, name: "Almacén" },
      { id: 2, name: "Dosificación" },
      { id: 3, name: "Transporte" },
      { id: 4, name: "Mezclas" },
      { id: 5, name: "Aplicación" }
    ];

    var html = '<div class="c360-matrix-wrapper">';
    html += '<table class="c360-matrix-table" role="grid" aria-label="Matriz de Severidad vs Área Técnica">';
    html += '<thead>';
    html += '<tr>';
    html += '<th class="c360-matrix-th-corner">Severidad / Área</th>';
    chapters.forEach(function (ch) {
      html += '<th class="c360-matrix-th-ch">Cap ' + ch.id + '<br><small>' + ch.name + '</small></th>';
    });
    html += '<th class="c360-matrix-th-total">Total</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    severities.forEach(function (sevKey) {
      var cfg = SEVERITY_CONFIG[sevKey];
      var rowTotal = 0;

      html += '<tr class="matrix-row-' + sevKey + '">';
      html += '<td class="c360-matrix-td-sev">';
      html += '<span class="c360-sev-badge ' + cfg.badgeClass + '">' + cfg.label + '</span>';
      html += '</td>';

      chapters.forEach(function (ch) {
        var items = mg[sevKey][ch.id] || [];
        var count = items.length;
        rowTotal += count;

        var cellClass = count > 0 ? "cell-has-findings sev-" + sevKey : "cell-empty";
        html += '<td class="c360-matrix-td-cell ' + cellClass + ' text-center tabular-nums">';
        if (count > 0) {
          html += '<button type="button" class="c360-matrix-cell-btn" data-action="filter-risk-cell" data-severity="' + sevKey + '" data-chapter="' + ch.id + '" title="' + count + ' hallazgo(s) ' + cfg.label + ' en ' + ch.name + '">';
          html += '<strong>' + count + '</strong>';
          html += '</button>';
        } else {
          html += '<span class="text-muted text-xs">—</span>';
        }
        html += '</td>';
      });

      html += '<td class="c360-matrix-td-total tabular-nums text-center font-bold">' + rowTotal + '</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    return html;
  }

  function renderTopRisksList(vm) {
    var list = vm.topRisks;
    var html = '<div class="c360-card c360-top-risks-card">';
    
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">PRIORIZACIÓN OPERATIVA DE CAMPO</span>';
    html += '<h3 class="c360-card-title">Top Riesgos y Desviaciones a Atender</h3>';
    html += '</div>';
    html += '<div class="c360-top-meta-note">';
    html += '<span class="text-xs text-muted">Ordenado por severidad técnica y antigüedad</span>';
    html += '</div>';
    html += '</div>';

    if (!vm.hasFindings) {
      html += '<div class="c360-empty-risks-state">';
      html += '<div class="c360-empty-icon">✓</div>';
      if (!vm.hasVisits) {
        html += '<div class="c360-empty-title">No hay información suficiente para establecer una prioridad.</div>';
        html += '<div class="c360-empty-desc">No existen auditorías registradas para los filtros seleccionados.</div>';
      } else {
        html += '<div class="c360-empty-title">Sin no conformidades registradas</div>';
        html += '<div class="c360-empty-desc">No se registran no conformidades en las auditorías evaluadas para este periodo.</div>';
      }
      html += '</div>';
      html += '</div>';
      return html;
    }

    html += '<div class="c360-risks-list">';
    list.forEach(function (r, idx) {
      html += '<div class="c360-risk-item sev-' + r.severityKey + '">';
      
      html += '<div class="c360-risk-item-top">';
      html += '<div class="c360-risk-id-group">';
      html += '<span class="c360-risk-rank tabular-nums font-bold">#' + (idx + 1) + '</span>';
      html += '<span class="c360-sev-badge ' + r.severityClass + '">' + r.severityLabel + '</span>';
      html += '<strong class="c360-risk-crit-id">Criterio ' + r.criterionId + '</strong>';
      html += '<span class="c360-risk-crit-cat">· ' + escapeHtml(r.category) + '</span>';
      html += '</div>';

      html += '<div class="c360-risk-item-meta text-xs text-muted tabular-nums">';
      html += '<span>' + escapeHtml(r.date) + '</span>';
      html += '<span>·</span>';
      html += '<span>' + escapeHtml(r.farm) + ' (' + escapeHtml(r.lot) + ')</span>';
      html += '</div>';
      html += '</div>';

      html += '<div class="c360-risk-text">' + escapeHtml(r.criterionText) + '</div>';

      if (r.observation) {
        html += '<div class="c360-risk-obs-box">';
        html += '<span class="c360-obs-label">Hallazgo observado:</span> ';
        html += '<span class="c360-obs-content">' + escapeHtml(r.observation) + '</span>';
        html += '</div>';
      }

      html += '<div class="c360-risk-item-bottom">';
      html += '<div class="c360-risk-area-badge">';
      html += '<span class="text-xs text-muted">Área relacionada:</span> ';
      html += '<strong>Cap ' + r.chapter + ' (' + escapeHtml(r.chapterShort) + ')</strong>';
      html += '</div>';

      html += '<div class="c360-risk-evidence-tag' + (r.hasEvidence ? ' has-ev' : ' no-ev') + '">';
      html += (r.hasEvidence ? '📸 ' : '— ') + escapeHtml(r.evidenceSummary);
      html += '</div>';

      html += '<div class="c360-risk-action-wrap">';
      html += '<button type="button" class="c360-btn-drill-down" data-action="open-risk-detail" data-finding-id="' + escapeHtml(r.id) + '" title="Ver trazabilidad completa y evidencia">';
      html += 'Ver Detalle y Evidencia →';
      html += '</button>';
      html += '</div>';

      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderRiskMatrix(vm) {
    var html = '<div class="c360-risk-matrix-section" aria-label="Matriz Ejecutiva de Riesgo MIPE">';

    if (vm.isPartial) {
      html += '<div class="c360-partial-scope-alert" role="alert">';
      html += '<span class="c360-alert-icon">⚠</span>';
      html += '<div class="c360-alert-text">';
      html += '<strong>Atención:</strong> Vista basada en auditoría parcial. Los riesgos identificados corresponden únicamente a los capítulos evaluados.';
      html += '</div>';
      html += '</div>';
    }

    html += renderRiskCounterStrip(vm);

    html += '<div class="c360-card c360-matrix-card">';
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">MATRIZ BIDIMENSIONAL DE RIESGO</span>';
    html += '<h3 class="c360-card-title">Distribución de Severidad por Área Técnica Oficial</h3>';
    html += '</div>';
    html += '<div class="c360-matrix-data-rule">';
    html += '<span class="text-xs text-muted">Principio: No evaluado ≠ No conforme · NA excluido estrictamente</span>';
    html += '</div>';
    html += '</div>';

    html += renderExecutiveMatrixGrid(vm);
    html += '</div>';

    html += renderTopRisksList(vm);
    html += '</div>';
    return html;
  }

  function renderRiskCauses(riskMatrixVm) {
    var areaStats = riskMatrixVm.areaStats;
    var totalFindings = riskMatrixVm.totalFindings;

    var html = '<div class="c360-card c360-causes-card" role="region" aria-label="Desglose por Áreas Técnicas MIPE">';
    
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">DISTRIBUCIÓN TÉCNICA OPERATIVA</span>';
    html += '<h3 class="c360-card-title">Áreas Relacionadas con Desviaciones MIPE</h3>';
    html += '</div>';
    html += '<div class="c360-causes-disclaimer text-xs text-muted">';
    html += '<span>Dato observado: clasificado según el capítulo normativo del criterio oficial (no se asume causa raíz no verificada)</span>';
    html += '</div>';
    html += '</div>';

    if (!riskMatrixVm.hasFindings) {
      html += '<div class="c360-empty-risks-state">';
      html += '<div class="c360-empty-icon">✓</div>';
      html += '<div class="c360-empty-title">Sin áreas técnicas comprometidas</div>';
      html += '<div class="c360-empty-desc">No se registran no conformidades en las auditorías evaluadas para este periodo.</div>';
      html += '</div>';
      html += '</div>';
      return html;
    }

    html += '<div class="c360-causes-grid">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var area = areaStats[chId];
      if (!area) return;

      var count = area.findings;
      var pctOfTotal = totalFindings > 0 ? Math.round((count / totalFindings) * 100) : 0;
      var sevMap = area.severities;
      var isClean = count === 0;
      var weightPct = area.weightPct || (chId === 1 || chId === 3 ? 5 : 30);
      var pointsMax = area.pointsMax || (chId === 1 || chId === 3 ? 5.0 : 30.0);
      var predSev = area.predominantSeverity || (isClean ? "Ninguna (Conforme)" : "Sin clasificar");

      html += '<div class="c360-cause-area-card' + (isClean ? ' is-clean' : '') + '">';
      
      html += '<div class="c360-cause-area-header">';
      html += '<div class="c360-cause-area-title-group">';
      html += '<span class="c360-cause-area-kicker">Capítulo ' + chId + ' · Impacto Protocolo: ' + weightPct + '% (' + pointsMax.toFixed(1) + ' pts)</span>';
      html += '<h4 class="c360-cause-area-title">' + escapeHtml(area.title) + '</h4>';
      html += '</div>';
      html += '<div class="c360-cause-area-badge tabular-nums ' + (isClean ? 'badge-clean' : 'badge-deviations') + '">';
      html += isClean ? '✓ Conforme' : count + ' hallazgo' + (count === 1 ? '' : 's');
      html += '</div>';
      html += '</div>';

      html += '<div class="c360-cause-predominant text-xs">';
      html += '<span class="text-muted">Severidad predominante:</span> ';
      html += '<strong>' + escapeHtml(predSev) + '</strong>';
      html += '</div>';

      html += '<div class="c360-cause-progress-wrap">';
      html += '<div class="c360-cause-progress-track">';
      html += '<div class="c360-cause-progress-fill" style="width: ' + pctOfTotal + '%;"></div>';
      html += '</div>';
      html += '<span class="c360-cause-progress-label tabular-nums">' + pctOfTotal + '% del total de hallazgos</span>';
      html += '</div>';

      if (!isClean) {
        html += '<div class="c360-cause-sev-strip">';
        if (sevMap.critical) {
          html += '<span class="c360-sev-mini-pill text-danger">● ' + sevMap.critical + ' crítico(s)</span>';
        }
        if (sevMap.high) {
          html += '<span class="c360-sev-mini-pill text-warning">● ' + sevMap.high + ' alto(s)</span>';
        }
        if (sevMap.medium) {
          html += '<span class="c360-sev-mini-pill text-amber">● ' + sevMap.medium + ' medio(s)</span>';
        }
        if (sevMap.low) {
          html += '<span class="c360-sev-mini-pill text-muted">● ' + sevMap.low + ' bajo(s)</span>';
        }
        if (sevMap.unclassified) {
          html += '<span class="c360-sev-mini-pill text-muted">● ' + sevMap.unclassified + ' sin clasificar</span>';
        }
        html += '</div>';

        html += '<div class="c360-cause-criteria-samples">';
        html += '<span class="text-xs text-muted">Criterios con desviación:</span> ';
        var uniqueCritIds = Array.from(new Set(area.findingsList.map(function (f) { return f.criterionId; })));
        uniqueCritIds.forEach(function (cid, i) {
          html += '<strong class="text-xs">' + cid + '</strong>' + (i < uniqueCritIds.length - 1 ? ', ' : '');
        });
        html += '</div>';
      } else {
        html += '<div class="c360-cause-clean-note text-xs text-success">';
        html += '✓ 100% de conformidad en los criterios evaluados de esta área (' + pointsMax.toFixed(1) + ' pts asegurados).';
        html += '</div>';
      }

      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderPriorityActions(riskMatrixVm) {
    var findings = riskMatrixVm.findingsList;

    var html = '<div class="c360-card c360-actions-card" role="region" aria-label="Plan de Acciones Prioritarias MIPE">';
    
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">PLAN DE INTERVENCIÓN TÉCNICA</span>';
    html += '<h3 class="c360-card-title">Acciones Prioritarias y Seguimiento de Campo</h3>';
    html += '</div>';
    html += '<div class="c360-actions-rule text-xs text-muted">';
    html += '<span>Trazabilidad: Problema → Severidad → Acción requerida → Responsable</span>';
    html += '</div>';
    html += '</div>';

    if (!riskMatrixVm.hasFindings) {
      html += '<div class="c360-empty-risks-state">';
      html += '<div class="c360-empty-icon">✓</div>';
      html += '<div class="c360-empty-title">Sin acciones correctivas pendientes</div>';
      html += '<div class="c360-empty-desc">No se registran no conformidades en las auditorías evaluadas para este periodo.</div>';
      html += '</div>';
      html += '</div>';
      return html;
    }

    html += '<div class="c360-actions-table-wrap">';
    html += '<table class="c360-actions-table" role="grid">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="width: 130px;">Prioridad</th>';
    html += '<th style="width: 90px;">Severidad</th>';
    html += '<th>Desviación / Criterio</th>';
    html += '<th>Acción Recomendada</th>';
    html += '<th style="width: 140px;">Responsable</th>';
    html += '<th style="width: 110px;" class="text-center">Estado</th>';
    html += '<th style="width: 90px;" class="text-center">Evidencia</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    findings.forEach(function (f, idx) {
      var isCritical = f.severityKey === "critical";
      var isHigh = f.severityKey === "high";
      var pt = f.priorityTier || { num: 5, label: "Sin prioridad asignada", short: "—", badgeClass: "badge-unclassified" };

      html += '<tr class="action-row sev-' + f.severityKey + '">';
      
      html += '<td>';
      html += '<div class="c360-pt-badge ' + pt.badgeClass + ' font-bold text-xs">' + escapeHtml(pt.label) + '</div>';
      html += '<div class="text-xs text-muted tabular-nums">Orden #' + (idx + 1) + '</div>';
      html += '</td>';

      html += '<td><span class="c360-sev-badge ' + f.severityClass + '">' + f.severityLabel + '</span></td>';

      html += '<td>';
      html += '<div class="c360-act-crit-head"><strong>Criterio ' + f.criterionId + '</strong> · <span class="text-xs text-muted">' + escapeHtml(f.chapterShort) + '</span></div>';
      html += '<div class="c360-act-crit-text text-xs">' + escapeHtml(f.criterionText) + '</div>';
      if (f.observation) {
        html += '<div class="c360-act-obs text-xs"><span class="text-muted">Hallazgo:</span> ' + escapeHtml(f.observation) + '</div>';
      }
      html += '<div class="c360-act-meta text-xs text-muted">' + escapeHtml(f.farm) + ' (' + escapeHtml(f.lot) + ') · ' + escapeHtml(f.date) + '</div>';
      html += '</td>';

      html += '<td>';
      if (f.actionText === "Acción requerida — pendiente de definición") {
        html += '<span class="c360-act-pending-def font-medium text-amber">' + escapeHtml(f.actionText) + '</span>';
      } else {
        html += '<strong class="c360-act-text">' + escapeHtml(f.actionText) + '</strong>';
      }
      html += '</td>';

      html += '<td class="text-xs">' + escapeHtml(f.reviewer) + '</td>';

      html += '<td class="text-center">';
      var statusBadgeClass = isCritical ? 'badge-status-urgent' : (isHigh ? 'badge-status-attention' : 'badge-status-pending');
      html += '<span class="c360-act-status ' + statusBadgeClass + '">' + escapeHtml(f.status) + '</span>';
      html += '</td>';

      html += '<td class="text-center">';
      html += '<button type="button" class="c360-btn-act-evidence" data-action="open-risk-detail" data-finding-id="' + escapeHtml(f.id) + '" title="' + escapeHtml(f.evidenceSummary) + '">';
      html += f.hasEvidence ? '📸 Ver' : 'ℹ️ Info';
      html += '</button>';
      html += '</td>';

      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    html += '<div class="c360-actions-footer-info">';
    html += '<span>Las acciones recomendadas reflejan las indicaciones asentadas en las auditorías de campo. Cuando no se registre instrucción específica, se clasifica como pendiente de definición para evitar prescripciones fitosanitarias infundadas.</span>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderRiskDetailModal(finding) {
    if (!finding) return '';

    var html = '<div class="c360-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="c360-modal-title">';
    html += '<div class="c360-modal-container">';

    html += '<div class="c360-modal-header">';
    html += '<div>';
    html += '<div class="c360-modal-kicker">TRAZABILIDAD Y EVIDENCIA DE NO CONFORMIDAD</div>';
    html += '<h2 id="c360-modal-title" class="c360-modal-title">Criterio ' + escapeHtml(finding.criterionId) + ' · ' + escapeHtml(finding.category) + '</h2>';
    html += '</div>';
    html += '<button type="button" class="c360-modal-close-btn" data-action="close-risk-detail" aria-label="Cerrar detalle">✕</button>';
    html += '</div>';

    html += '<div class="c360-modal-body">';

    html += '<div class="c360-modal-context-bar">';
    html += '<div><strong>Finca:</strong> ' + escapeHtml(finding.farm) + '</div>';
    html += '<span>·</span>';
    html += '<div><strong>Lote:</strong> ' + escapeHtml(finding.lot) + '</div>';
    html += '<span>·</span>';
    html += '<div><strong>Cultivo:</strong> ' + escapeHtml(finding.crop) + '</div>';
    html += '<span>·</span>';
    html += '<div><strong>Fecha:</strong> ' + escapeHtml(finding.date) + '</div>';
    html += '<span>·</span>';
    html += '<div><span class="c360-sev-badge ' + finding.severityClass + '">' + finding.severityLabel + '</span></div>';
    html += '</div>';

    html += '<div class="c360-modal-section">';
    html += '<h4 class="c360-modal-sec-title">1. Criterio Oficial del Protocolo MIPE</h4>';
    html += '<div class="c360-modal-card-box">';
    html += '<div class="c360-modal-crit-meta text-xs text-muted">Capítulo ' + finding.chapter + ': ' + escapeHtml(finding.chapterTitle) + '</div>';
    html += '<div class="c360-modal-crit-text"><strong>' + escapeHtml(finding.criterionId) + '</strong> ' + escapeHtml(finding.criterionText) + '</div>';
    html += '<div class="c360-modal-eval-status text-danger font-semibold">✕ Calificación en campo: NO CONFORME (NO)</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="c360-modal-section">';
    html += '<h4 class="c360-modal-sec-title">2. Evidencia y Observaciones de Campo</h4>';
    html += '<div class="c360-modal-card-box">';
    
    html += '<div class="c360-modal-obs-group">';
    html += '<span class="c360-modal-sublabel">Observación del Técnico Auditor:</span>';
    if (finding.observation) {
      html += '<div class="c360-modal-obs-text">' + escapeHtml(finding.observation) + '</div>';
    } else {
      html += '<div class="text-muted text-xs italic">Sin evidencia registrada en la auditoría.</div>';
    }
    html += '</div>';

    html += '<div class="c360-modal-photos-group">';
    html += '<span class="c360-modal-sublabel">Registro Fotográfico / Documental:</span>';
    if (finding.photos && finding.photos.length > 0) {
      html += '<div class="c360-modal-photo-gallery">';
      finding.photos.forEach(function (ph, i) {
        var src = typeof ph === "string" ? ph : (ph.url || ph.src || "");
        html += '<div class="c360-modal-photo-item">';
        html += '<img src="' + escapeHtml(src) + '" alt="Evidencia fotográfica ' + (i + 1) + '" class="c360-modal-photo-img" loading="lazy" />';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="c360-no-photo-badge">— Sin fotografías adjuntas en la auditoría</div>';
    }
    html += '</div>';

    if (finding.measurements) {
      html += '<div class="c360-modal-meas-group">';
      html += '<span class="c360-modal-sublabel">Mediciones Instrumentales:</span>';
      html += '<div class="c360-modal-meas-val tabular-nums">' + escapeHtml(JSON.stringify(finding.measurements)) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    html += '<div class="c360-modal-section">';
    html += '<h4 class="c360-modal-sec-title">3. Plan de Acción y Responsabilidad</h4>';
    html += '<div class="c360-modal-card-box">';
    html += '<div class="c360-modal-action-row">';
    html += '<span class="c360-modal-sublabel">Acción Requerida:</span> ';
    html += '<strong>' + escapeHtml(finding.actionText) + '</strong>';
    html += '</div>';

    html += '<div class="c360-modal-action-row">';
    html += '<span class="c360-modal-sublabel">Responsable Asignado:</span> ';
    html += '<span>' + escapeHtml(finding.reviewer) + '</span>';
    html += '</div>';

    html += '<div class="c360-modal-action-row">';
    html += '<span class="c360-modal-sublabel">Estado de Seguimiento:</span> ';
    html += '<span class="c360-act-status badge-status-attention">' + escapeHtml(finding.followupStatus) + '</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    html += '<div class="c360-modal-footer">';
    html += '<button type="button" class="c360-btn-filter-direct" data-action="filter-farm-direct" data-farm="' + escapeHtml(finding.farm) + '">';
    html += 'Filtrar Contexto por esta Finca';
    html += '</button>';
    html += '<button type="button" class="c360-btn-modal-close" data-action="close-risk-detail">';
    html += 'Cerrar';
    html += '</button>';
    html += '</div>';

    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderRisksTab(intel, vm) {
    var rvm = (vm && vm.riskMatrixVm) ? vm.riskMatrixVm : buildRiskMatrixViewModel(state.visits, CRITERIA_CATALOG, CHAPTER_INFO, state, intel);
    var html = '<div class="c360-risks-view">';
    html += renderRiskMatrix(rvm);
    html += renderRiskCauses(rvm);
    html += renderPriorityActions(rvm);
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Tab 5: What-If Simulator
   * ------------------------------------------------------------------ */

  function renderSimulatorTab(intel) {
    var sim = state.simValues || {};
    var getSimVal = function (ch) {
      var raw = sim[ch] != null ? Number(sim[ch]) : 0;
      return isNaN(raw) ? 0 : Math.max(0, Math.min(100, Math.round(raw)));
    };
    var s1 = getSimVal(1);
    var s2 = getSimVal(2);
    var s3 = getSimVal(3);
    var s4 = getSimVal(4);
    var s5 = getSimVal(5);
    var simScore = (s1 * 0.05) + (s2 * 0.30) + (s3 * 0.05) + (s4 * 0.30) + (s5 * 0.30);
    simScore = Math.max(0, Math.min(100, Math.round(simScore * 10) / 10));
    var currentScore = intel.globalPoints;
    var diff = Math.round((simScore - currentScore) * 10) / 10;

    var html = '<div class="c360-simulator-view">';

    // Top Result Comparison Card
    html += '<div class="c360-card c360-sim-hero-card">';
    html += '<div class="c360-sim-hero-col">';
    html += '<span class="c360-card-eyebrow">PUNTUACIÓN ACTUAL</span>';
    html += '<div class="c360-sim-score-box tabular-nums text-muted">' + currentScore.toFixed(1) + '<small>/100</small></div>';
    html += '<div class="c360-sim-hint">' + (intel.isFullyEvaluated ? '5/5 Capítulos' : intel.evaluatedChaptersCount + '/5 evaluados') + '</div>';
    html += '</div>';

    html += '<div class="c360-sim-arrow">➔</div>';

    html += '<div class="c360-sim-hero-col">';
    html += '<span class="c360-card-eyebrow">PUNTUACIÓN SIMULADA</span>';
    html += '<div class="c360-sim-score-box tabular-nums text-success font-bold">' + simScore.toFixed(1) + '<small>/100</small></div>';
    html += '<div class="c360-sim-hint">' + (simScore >= 95 ? '🏆 Certificación MIPE' : 'Meta: 95.0 pts') + '</div>';
    html += '</div>';

    html += '<div class="c360-sim-hero-col c360-sim-delta-col">';
    html += '<span class="c360-card-eyebrow">IMPACTO PROYECTADO</span>';
    html += '<div class="c360-sim-delta tabular-nums ' + (diff >= 0 ? 'text-success' : 'text-danger') + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' pts</div>';
    html += '<div class="c360-sim-hint">' + (diff > 0 ? 'Mejora en certificación' : 'Sin cambios') + '</div>';
    html += '</div>';

    html += '<div class="c360-sim-reset-col">';
    html += '<button class="c360-btn-reset-sim" data-action="reset-simulator">Restablecer a Valores Reales</button>';
    html += '</div>';
    html += '</div>';

    // Interactive Sliders Grid
    html += '<div class="c360-card c360-sliders-card">';
    html += '<div class="c360-card-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">PALANCAS DE MEJORA OPERATIVA</span>';
    html += '<h3 class="c360-card-title">Ajuste de Cumplimiento por Capítulo MIPE</h3>';
    html += '</div>';
    html += '</div>';

    html += '<div class="c360-sliders-list">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var info = CHAPTER_INFO[chId];
      var p = intel.chapterPerformance[chId];
      var val = getSimVal(chId);
      var pts = (val / 100) * (info.weight * 100);

      html += '<div class="c360-slider-row">';
      html += '<div class="c360-slider-info">';
      html += '<div class="c360-slider-title-row">';
      html += '<strong>Cap ' + chId + ': ' + escapeHtml(info.title) + '</strong>';
      html += '<span class="c360-slider-weight-badge">Peso: ' + (info.weight * 100) + '%</span>';
      if (info.critical) {
        html += '<span class="c360-critical-tag">Alto Impacto</span>';
      }
      if (!p.isEvaluated) {
        html += '<span class="c360-uneval-tag">⚠️ Sin evaluar en campo (0.0 pts base)</span>';
      }
      html += '</div>';
      html += '<div class="c360-slider-pts tabular-nums">Aporte simulado: <strong>' + pts.toFixed(1) + ' / ' + (info.weight * 100).toFixed(1) + ' pts</strong></div>';
      html += '</div>';

      html += '<div class="c360-slider-ctrl">';
      html += '<input type="range" min="0" max="100" value="' + val + '" class="c360-range-input" data-action="slider-change" data-chapter="' + chId + '">';
      var sliderValLabel = !p.isEvaluated && val === 0 ? '0% (sin evaluar)' : val + '%';
      html += '<span class="c360-slider-val tabular-nums font-bold' + (!p.isEvaluated && val === 0 ? ' text-muted' : '') + '">' + sliderValLabel + '</span>';
      html += '</div>';

      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    // Strategic Insights Card
    html += '<div class="c360-card c360-insights-card">';
    html += '<h4 class="c360-insights-title">💡 Recomendaciones Estratégicas de Alto Apalancamiento</h4>';
    html += '<ul class="c360-insights-list">';
    html += '<li><strong>Capítulos Clave (Dosificación, Mezclas, Aplicación):</strong> Concentran el <strong>90%</strong> del puntaje de certificación. Si un capítulo crítico no fue auditado, la finca no podrá alcanzar la meta de 95.0 pts sin evaluarlo.</li>';
    html += '<li><strong>Capítulos de Soporte (Almacén, Transporte):</strong> Aportan el <strong>10%</strong>. Aseguran el cumplimiento legal y de bioseguridad preventiva.</li>';
    html += '<li><strong>Prioridad Inmediata:</strong> Resolver desviaciones en EPP químico y calibración de boquillas para asegurar el pase directo al nivel de Excelencia ($\ge 90\%$).</li>';
    html += '</ul>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Event Handlers
   * ------------------------------------------------------------------ */

  function bindEvents(container) {
    // 1. SubNav Tabs
    container.querySelectorAll(".c360-subnav-btn, [data-action=\"nav-tab\"]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tabId = btn.getAttribute("data-tab");
        if (tabId) {
          state.subTab = tabId;
          render(container);
          if (btn.hasAttribute("data-action")) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      });
    });

    // 2. Farm Selector (Desktop & Mobile)
    container.querySelectorAll('[data-action="filter-farm"]').forEach(function (select) {
      select.addEventListener("change", function () {
        state.farm = select.value;
        // Verify if active lot is valid for selected farm
        var options = extractAvailableOptions(state.visits, state.farm);
        if (state.lot && !options.availableLots.some(function (l) { return norm(l) === norm(state.lot); })) {
          state.lot = "";
        }
        render(container);
      });
    });

    // 3. Lot Selector (Desktop & Mobile)
    container.querySelectorAll('[data-action="filter-lot"]').forEach(function (select) {
      select.addEventListener("change", function () {
        state.lot = select.value;
        render(container);
      });
    });

    // 4. Crop Selector (Desktop & Mobile)
    container.querySelectorAll('[data-action="filter-crop"]').forEach(function (select) {
      select.addEventListener("change", function () {
        state.crop = select.value;
        render(container);
      });
    });

    // 5. Range Selector (Desktop & Mobile)
    container.querySelectorAll('[data-action="filter-range"]').forEach(function (select) {
      select.addEventListener("change", function () {
        state.range = select.value;
        render(container);
      });
    });

    // 6. Audit State Scope Selector (Desktop & Mobile)
    container.querySelectorAll('[data-action="filter-audit-state"]').forEach(function (select) {
      select.addEventListener("change", function () {
        state.auditState = select.value;
        render(container);
      });
    });

    // 7. Clear Filters Action
    container.querySelectorAll('[data-action="clear-filters"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.farm = "";
        state.lot = "";
        state.crop = "";
        state.range = "all";
        state.auditState = "all";
        state.mobileDrawerOpen = false;
        render(container);
      });
    });

    // 8. Refresh / Sync Action
    container.querySelectorAll('[data-action="refresh-data"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.isSyncing = true;
        render(container);
        setTimeout(function () {
          loadDataAndMount();
          state.isSyncing = false;
        }, 300);
      });
    });

    // 9. Mobile Filter Drawer Toggle / Close / Apply
    container.querySelectorAll('[data-action="toggle-mobile-filters"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.mobileDrawerOpen = !state.mobileDrawerOpen;
        render(container);
      });
    });

    container.querySelectorAll('[data-action="close-mobile-filters"]').forEach(function (el) {
      el.addEventListener("click", function () {
        state.mobileDrawerOpen = false;
        render(container);
      });
    });

    container.querySelectorAll('[data-action="apply-mobile-filters"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.mobileDrawerOpen = false;
        render(container);
      });
    });

    // 10. Close mobile drawer on Escape key
    if (state.mobileDrawerOpen) {
      var onEscKey = function (e) {
        if (e.key === "Escape") {
          state.mobileDrawerOpen = false;
          window.removeEventListener("keydown", onEscKey);
          render(container);
        }
      };
      window.addEventListener("keydown", onEscKey);
    }

    // 5. Open Chapter Action
    container.querySelectorAll('[data-action="open-chapter"]').forEach(function (el) {
      el.addEventListener("click", function () {
        var ch = Number(el.getAttribute("data-chapter"));
        if (ch) {
          state.selectedChapter = ch;
          state.subTab = "chapters";
          render(container);
        }
      });
    });

    // 6. Select Chapter in Chapters tab
    container.querySelectorAll('[data-action="select-chapter"]').forEach(function (el) {
      el.addEventListener("click", function () {
        var ch = Number(el.getAttribute("data-chapter"));
        if (ch) {
          state.selectedChapter = ch;
          render(container);
        }
      });
    });

    // 7. Search criteria
    var searchInput = container.querySelector('[data-action="search-criteria"]');
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.search = searchInput.value;
        render(container);
        var newSearch = container.querySelector('[data-action="search-criteria"]');
        if (newSearch) {
          newSearch.focus();
          newSearch.selectionStart = newSearch.selectionEnd = newSearch.value.length;
        }
      });
    }

    // 8. Severity Filter
    var sevSelect = container.querySelector('[data-action="filter-severity"]');
    if (sevSelect) {
      sevSelect.addEventListener("change", function () {
        state.severityFilter = sevSelect.value;
        render(container);
      });
    }

    // 9. Status Filter
    var statSelect = container.querySelector('[data-action="filter-status"]');
    if (statSelect) {
      statSelect.addEventListener("change", function () {
        state.statusFilter = statSelect.value;
        render(container);
      });
    }

    // 10. Toggle findings
    container.querySelectorAll('[data-action="toggle-findings"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        if (id) {
          state.expandedFindings[id] = !state.expandedFindings[id];
          render(container);
        }
      });
    });

    // 11. Farm direct filter from benchmark table
    container.querySelectorAll('[data-action="filter-farm-direct"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var fn = btn.getAttribute("data-farm");
        if (fn) {
          state.farm = fn;
          state.subTab = "overview";
          render(container);
        }
      });
    });

    // 11b. Toggle compare farm checkbox (max 3 farms)
    container.querySelectorAll('[data-action="toggle-compare-farm"]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        var fn = cb.getAttribute("data-farm");
        if (!fn) return;
        if (!Array.isArray(state.selectedCompareFarms)) state.selectedCompareFarms = [];
        if (cb.checked) {
          if (state.selectedCompareFarms.length < 3) {
            if (!state.selectedCompareFarms.includes(fn)) {
              state.selectedCompareFarms.push(fn);
            }
          } else {
            cb.checked = false;
            return;
          }
        } else {
          state.selectedCompareFarms = state.selectedCompareFarms.filter(function (x) { return x !== fn; });
        }
        render(container);
      });
    });

    // 11c. Clear compare farms selection
    container.querySelectorAll('[data-action="clear-compare-farms"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.selectedCompareFarms = [];
        render(container);
      });
    });

    // 12. Simulator sliders
    container.querySelectorAll('[data-action="slider-change"]').forEach(function (slider) {
      slider.addEventListener("input", function () {
        var ch = Number(slider.getAttribute("data-chapter"));
        var rawVal = Number(slider.value);
        var val = isNaN(rawVal) ? 0 : Math.max(0, Math.min(100, Math.round(rawVal)));
        if (ch) {
          state.simTouched = true;
          state.simValues[ch] = val;
          render(container);
        }
      });
    });

    // 13. Reset simulator
    var resetBtn = container.querySelector('[data-action="reset-simulator"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        state.simTouched = false;
        var intel = aggregateIntelligence(filterVisits(state.visits, state.farm, state.range, state.crop));
        [1, 2, 3, 4, 5].forEach(function (ch) {
          var p = intel.chapterPerformance[ch];
          state.simValues[ch] = p.isEvaluated && p.compliance != null ? Math.max(0, Math.min(100, Math.round(p.compliance))) : 0;
        });
        render(container);
      });
    }

    // 14. Export PDF / Print
    var exportBtn = container.querySelector('[data-action="export-pdf"]');
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        window.print();
      });
    }

    // 15. Open Risk Detail Modal (FASE 5)
    container.querySelectorAll('[data-action="open-risk-detail"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var findingId = btn.getAttribute("data-finding-id");
        if (findingId) {
          state.selectedFindingId = findingId;
          render(container);
        }
      });
    });

    // 16. Close Risk Detail Modal (FASE 5)
    container.querySelectorAll('[data-action="close-risk-detail"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.selectedFindingId = null;
        render(container);
      });
    });

    // 17. Close modal when clicking overlay background (FASE 5)
    var modalOverlay = container.querySelector('.c360-modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener("click", function (e) {
        if (e.target === modalOverlay) {
          state.selectedFindingId = null;
          render(container);
        }
      });
    }

    // 18. Filter by risk cell (Severity x Chapter) (FASE 5)
    container.querySelectorAll('[data-action="filter-risk-cell"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ch = btn.getAttribute("data-chapter");
        var sev = btn.getAttribute("data-severity");
        if (ch) state.selectedChapter = Number(ch);
        if (sev) state.severityFilter = sev;
        var topRisksCard = container.querySelector('.c360-top-risks-card');
        if (topRisksCard && typeof topRisksCard.scrollIntoView === 'function') {
          topRisksCard.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Data Loading & Initialization
   * ------------------------------------------------------------------ */

  function loadDataAndMount() {
    var board = document.getElementById(ROOT_ID);
    if (!board) return;

    // Check if visits already available synchronously from React state
    if (Array.isArray(window.__c360_visits) && window.__c360_visits.length > 0) {
      state.visits = window.__c360_visits;
      render(board);
      return;
    }

    fetch("/api/visits")
      .then(function (res) { return res.json(); })
      .then(function (visits) {
        if (Array.isArray(visits)) {
          state.visits = visits;
          window.__c360_visits = visits;
        }
        render(board);
      })
      .catch(function (err) {
        console.warn("Could not load /api/visits:", err);
        render(board);
      });
  }

  // Public bridge for React and other modules
  window.Care360Metrics = {
    setVisits: function (visits) {
      if (Array.isArray(visits)) {
        state.visits = visits;
        window.__c360_visits = visits;
        var board = document.getElementById(ROOT_ID);
        if (board) render(board);
      }
    },
    refresh: function () {
      loadDataAndMount();
    }
  };

  function init() {
    loadDataAndMount();

    var observer = new MutationObserver(function () {
      var board = document.getElementById(ROOT_ID);
      if (board && !board.hasAttribute("data-mounted")) {
        board.setAttribute("data-mounted", "true");
        loadDataAndMount();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("c360:visit-saved", loadDataAndMount);
    window.addEventListener("c360:data-changed", loadDataAndMount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
'''

def build():
    dest = Path("enhance/src/care360-metrics.js")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(METRICS_JS, encoding="utf-8")
    print(f"✓ Generated {dest} ({len(METRICS_JS)} bytes)")

if __name__ == "__main__":
    build()
