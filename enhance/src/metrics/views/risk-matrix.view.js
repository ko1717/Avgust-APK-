/**
 * RiskMatrixView — Executive Risk Matrix & Prioritized Deviation Intelligence
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Answers: "¿Dónde está el problema?", "¿Qué tan importante es?"
 * - Builds riskMatrixViewModel exclusively from real verified findings.
 * - Strict Data Integrity:
 *   * No evaluado ≠ No conforme
 *   * Sin datos ≠ 0
 *   * NA ≠ Riesgo
 *   * Sin evidencia ≠ Evidencia negativa
 *   * Sin clasificar if severity is missing (never hallucinate severity)
 * - Priority Ordering:
 *   1. Severidad (Crítico > Alto > Medio > Bajo > Sin clasificar)
 *   2. Fecha más reciente
 *   3. Reincidencia / Impacto por capítulo
 * - Pure view / ViewModel builder: zero modification of official calculation engine.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360RiskMatrixView = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  var SEVERITY_CONFIG = {
    critical: { key: "critical", label: "Crítico", badgeClass: "badge-critical", rank: 1 },
    high: { key: "high", label: "Alto", badgeClass: "badge-high", rank: 2 },
    medium: { key: "medium", label: "Medio", badgeClass: "badge-medium", rank: 3 },
    low: { key: "low", label: "Bajo", badgeClass: "badge-low", rank: 4 },
    unclassified: { key: "unclassified", label: "Sin clasificar", badgeClass: "badge-unclassified", rank: 5 }
  };

  /**
   * Normalizes raw severity string into standardized config without fabricating severities.
   */
  function normalizeSeverity(raw) {
    if (!raw) return SEVERITY_CONFIG.unclassified;
    var s = String(raw).toLowerCase().trim();
    if (s === "critical" || s === "critico" || s === "crítico") return SEVERITY_CONFIG.critical;
    if (s === "high" || s === "alto" || s === "alta") return SEVERITY_CONFIG.high;
    if (s === "medium" || s === "medio" || s === "media") return SEVERITY_CONFIG.medium;
    if (s === "low" || s === "bajo" || s === "baja") return SEVERITY_CONFIG.low;
    return SEVERITY_CONFIG.unclassified;
  }

  /**
   * Determines operational priority tier based strictly on severity.
   */
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

  /**
   * Builds the Risk Matrix ViewModel from active filtered visits and official criteria catalog.
   */
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

    // 2D Matrix grid: [severityKey][chapterId] = array of findings
    var matrixGrid = {
      critical: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      high: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      medium: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      low: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      unclassified: { 1: [], 2: [], 3: [], 4: [], 5: [] }
    };

    // Area / Chapter breakdown
    var areaStats = {
      1: { id: 1, title: chInfo[1] ? chInfo[1].title : "Almacén", short: "Almacén", findings: 0, severities: {}, findingsList: [], weightPct: 5, pointsMax: 5.0 },
      2: { id: 2, title: chInfo[2] ? chInfo[2].title : "Dosificación", short: "Dosificación", findings: 0, severities: {}, findingsList: [], weightPct: 30, pointsMax: 30.0 },
      3: { id: 3, title: chInfo[3] ? chInfo[3].title : "Transporte", short: "Transporte", findings: 0, severities: {}, findingsList: [], weightPct: 5, pointsMax: 5.0 },
      4: { id: 4, title: chInfo[4] ? chInfo[4].title : "Mezclas", short: "Mezclas", findings: 0, severities: {}, findingsList: [], weightPct: 30, pointsMax: 30.0 },
      5: { id: 5, title: chInfo[5] ? chInfo[5].title : "Aplicación", short: "Aplicación", findings: 0, severities: {}, findingsList: [], weightPct: 30, pointsMax: 30.0 }
    };

    // Scan visits for real non-conformities (value === "NO")
    visits.forEach(function (v) {
      if (!v || !v.answers) return;

      var selectedChapters = Array.isArray(v.chapters) && v.chapters.length
        ? v.chapters.map(Number)
        : [1, 2, 3, 4, 5];

      Object.keys(v.answers).forEach(function (cid) {
        var cat = catalog[cid];
        if (!cat) return;
        var ch = cat.chapter;
        if (!selectedChapters.includes(ch)) return; // Un-audited chapter: strictly ignored

        var ans = v.answers[cid];
        var val = ans ? (typeof ans === "string" ? ans : ans.value) : null;
        if (val !== "NO") return; // Only true findings (NO). Excludes SI, NA, and unevaluated.

        var rawSev = (typeof ans === "object" && ans.severity) ? ans.severity : cat.severity;
        var sevObj = normalizeSeverity(rawSev);
        counts[sevObj.key] = (counts[sevObj.key] || 0) + 1;

        // Evidence extraction
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

        // Action text determination: never invent agronomic recipes
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

        // Add to matrix grid
        if (matrixGrid[sevObj.key] && matrixGrid[sevObj.key][ch]) {
          matrixGrid[sevObj.key][ch].push(finding);
        }

        // Add to area stats
        if (areaStats[ch]) {
          areaStats[ch].findings++;
          areaStats[ch].severities[sevObj.key] = (areaStats[ch].severities[sevObj.key] || 0) + 1;
          areaStats[ch].findingsList.push(finding);
        }
      });
    });

    // Priority ordering rule:
    // 1. Severity rank: Crítico (1) > Alto (2) > Medio (3) > Bajo (4) > Sin clasificar (5)
    // 2. Date descending (newest first)
    // 3. Chapter official weight descending
    // 4. Criterion ID ascending
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

    // Compute predominant severity for each area
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
      topRisks: findingsList.slice(0, 10), // Top 10 prioritized risks
      areaStats: areaStats,
      activeFilters: filters
    };
  }

  /**
   * Renders the Executive Risk Counter Strip (Zero-pill enterprise discipline).
   */
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

  /**
   * Renders the 2D Executive Risk Matrix (Severidad × Área Técnica).
   */
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

  /**
   * Renders the TOP RIESGOS A ATENDER prioritized list.
   */
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
      
      // Top row: Priority Rank, Severity, Criterion ID, Chapter
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

      // Middle: Descriptive text
      html += '<div class="c360-risk-text">' + escapeHtml(r.criterionText) + '</div>';

      // Finding Observation if recorded
      if (r.observation) {
        html += '<div class="c360-risk-obs-box">';
        html += '<span class="c360-obs-label">Hallazgo observado:</span> ';
        html += '<span class="c360-obs-content">' + escapeHtml(r.observation) + '</span>';
        html += '</div>';
      }

      // Bottom Row: Area relacionada, Evidence indicator & Drill-down button
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

      html += '</div>'; // End risk-item-bottom

      html += '</div>'; // End risk-item
    });
    html += '</div>'; // End risks-list

    html += '</div>'; // End top-risks-card
    return html;
  }

  /**
   * Main container renderer for the Risk Matrix View.
   */
  function renderRiskMatrix(vm) {
    var html = '<div class="c360-risk-matrix-section" aria-label="Matriz Ejecutiva de Riesgo MIPE">';

    // Scope warning for partial audits (Prompt Requirement 10)
    if (vm.isPartial) {
      html += '<div class="c360-partial-scope-alert" role="alert">';
      html += '<span class="c360-alert-icon">⚠</span>';
      html += '<div class="c360-alert-text">';
      html += '<strong>Atención:</strong> Vista basada en auditoría parcial. Los riesgos identificados corresponden únicamente a los capítulos evaluados.';
      html += '</div>';
      html += '</div>';
    }

    // 1. Resumen superior de conteo de no conformidades
    html += renderRiskCounterStrip(vm);

    // 2. Matriz Ejecutiva 2D
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

    // 3. Top Riesgos Priorizados
    html += renderTopRisksList(vm);

    html += '</div>';
    return html;
  }

  return {
    buildRiskMatrixViewModel: buildRiskMatrixViewModel,
    renderRiskCounterStrip: renderRiskCounterStrip,
    renderExecutiveMatrixGrid: renderExecutiveMatrixGrid,
    renderTopRisksList: renderTopRisksList,
    renderRiskMatrix: renderRiskMatrix
  };
});
