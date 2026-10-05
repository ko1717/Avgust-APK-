/**
 * FarmBenchmarkView — Authoritative MIPE Benchmark, 3-Farm Comparison & Comparative Ranking
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Answers: "¿Cómo se compara con otras fincas?"
 * - Enables comparing up to 3 authorized farms simultaneously (Side-by-side comparative card).
 * - Enforces principle of comparability: complete audits prioritized over partials.
 * - Never alters score by coverage (Score * Coverage is strictly forbidden).
 * - Explicitly handles ties ("Empate") without inventing fake tiebreakers.
 * - Handles farms with insufficient audits gracefully ("Sin datos suficientes para comparación").
 * - Pure view / ViewModel builder: zero mutation of official calculation engine.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360FarmBenchmarkView = factory();
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

  function norm(str) {
    return String(str || "").trim().toLowerCase();
  }

  /**
   * Builds the Farm Benchmark ViewModel from all authorized visits and active filters.
   * Utilizes official aggregateIntelligence without formula alterations.
   */
  function buildBenchmarkViewModel(allVisits, filters, selectedCompareFarms, aggregateIntelligenceFn, availableFarmsList) {
    var visits = (allVisits || []).filter(function (v) { return !!v; });
    var activeFarm = filters && filters.farm ? filters.farm : "";
    var selectedFarms = Array.isArray(selectedCompareFarms) ? selectedCompareFarms.slice(0, 3) : [];

    // Group visits by farm
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

    // Also include authorized farms that might have 0 visits
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

    // Score each farm using official aggregation engine
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

    // Separate farms with audits from farms with insufficient data
    var evaluatedFarms = farmItems.filter(function (f) { return f.hasData && f.officialScore != null; });
    var insufficientFarms = farmItems.filter(function (f) { return !f.hasData || f.officialScore == null; });

    // Sort evaluated farms according to formal rules:
    // 1. Fully evaluated audits ALWAYS precede partial audits (Rule from Phase 1)
    // 2. Official Puntos MIPE descending
    // 3. Criteria compliance descending
    // 4. Alphabetical tiebreaker
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

    // Detect Ties and assign formal ranks
    var currentRank = 1;
    evaluatedFarms.forEach(function (f, idx) {
      var prev = idx > 0 ? evaluatedFarms[idx - 1] : null;
      var next = idx < evaluatedFarms.length - 1 ? evaluatedFarms[idx + 1] : null;

      var isTiedPrev = prev &&
        prev.isFullyEvaluated === f.isFullyEvaluated &&
        prev.officialScore === f.officialScore;
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

    // Check if comparison contains mixed scopes (complete + partial)
    var hasComplete = evaluatedFarms.some(function (f) { return f.isFullyEvaluated; });
    var hasPartial = evaluatedFarms.some(function (f) { return !f.isFullyEvaluated; });
    var isContextualBenchmark = hasComplete && hasPartial;

    // Filter compared farms objects
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

  /**
   * Helper to render mini chapter distribution bars
   */
  function renderMiniBars(chapters) {
    var html = '<div class="c360-mini-bars">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var c = chapters && chapters[chId];
      var isEval = c && c.isEvaluated && c.compliance != null;
      var col = isEval
        ? (c.compliance >= 90 ? "#16a34a" : (c.compliance >= 75 ? "#d97706" : "#dc2626"))
        : "#e2e8f0";
      var heightVal = isEval ? c.compliance : 0;
      var titleText = "Cap " + chId + ": " + (isEval ? c.compliance.toFixed(1) + "% (" + c.pointsEarned.toFixed(1) + " pts)" : "⚠️ No evaluado (0.0 pts)");

      html += '<div class="c360-mini-bar-col" title="' + escapeHtml(titleText) + '">';
      html += '<div class="c360-mini-bar-track' + (!isEval ? ' uneval' : '') + '">';
      html += '<div class="c360-mini-bar-fill" style="height: ' + heightVal + '%; background-color: ' + col + ';"></div>';
      html += '</div>';
      html += '<span class="c360-mini-bar-label' + (!isEval ? ' text-muted' : '') + '">C' + chId + '</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /**
   * Renders the Side-by-Side 3-Farm Comparative Card.
   * Allows contrasting up to 3 authorized farms directly.
   */
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

    // Multi-Column Grid (1 to 3 columns)
    html += '<div class="c360-compare-grid cols-' + compared.length + '">';
    compared.forEach(function (f) {
      var isFull = f.isFullyEvaluated;
      var hasScore = f.officialScore != null;
      var scoreClass = isFull
        ? (f.officialScore >= 90 ? "text-success" : (f.officialScore >= 75 ? "text-warning" : "text-danger"))
        : "text-muted";

      html += '<div class="c360-compare-col' + (f.isCurrentActiveFarm ? ' is-active-farm' : '') + '">';
      
      // Farm Title & Badges
      html += '<div class="c360-cmp-farm-head">';
      html += '<div class="c360-cmp-farm-name">' + escapeHtml(f.farm) + '</div>';
      html += '<div class="c360-cmp-farm-crop">' + escapeHtml(f.crop) + (f.isCurrentActiveFarm ? ' · <span class="c360-active-tag">Finca Activa</span>' : '') + '</div>';
      html += '</div>';

      // Score Value
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

      // Metric Rows
      html += '<div class="c360-cmp-metrics-list">';
      
      // Row: Cumplimiento
      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Cumplimiento Evaluado:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + (f.criteriaCompliance != null ? f.criteriaCompliance.toFixed(1) + '%' : '—') + '</strong>';
      html += '</div>';

      // Row: Cobertura
      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Cobertura Protocolo:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + (hasScore ? f.coveragePct + '% (' + f.evaluatedChaptersCount + '/5 caps)' : '—') + '</strong>';
      html += '</div>';

      // Row: Auditorías
      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Auditorías Realizadas:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + f.visitsCount + ' visitas</strong>';
      html += '</div>';

      // Row: Última Visita
      html += '<div class="c360-cmp-metric-row">';
      html += '<span class="c360-cmp-metric-label">Última Auditoría:</span>';
      html += '<strong class="c360-cmp-metric-val tabular-nums">' + (f.lastDate || "—") + '</strong>';
      html += '</div>';

      // Row: Mini Chapter Bars
      html += '<div class="c360-cmp-metric-row c360-cmp-row-bars">';
      html += '<span class="c360-cmp-metric-label">Capítulos MIPE:</span>';
      html += '<div class="c360-cmp-bars-wrap">' + renderMiniBars(f.chapters) + '</div>';
      html += '</div>';

      html += '</div>'; // End cmp-metrics-list

      // Footer Action
      html += '<div class="c360-cmp-footer">';
      if (!f.isCurrentActiveFarm) {
        html += '<button type="button" class="c360-btn-table-action" data-action="filter-farm-direct" data-farm="' + escapeHtml(f.farm) + '">Ver en Detalle</button>';
      } else {
        html += '<span class="text-xs text-muted">Contexto activo en filtros</span>';
      }
      html += '</div>';

      html += '</div>'; // End compare-col
    });
    html += '</div>'; // End compare-grid

    html += '</div>'; // End compare-card
    return html;
  }

  /**
   * Renders the complete Benchmark Table with Priority Ranking, Tie Handling, and Comparability Notes.
   */
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
      // 1. Render Evaluated Farms
      evaluated.forEach(function (fr) {
        var isFull = fr.isFullyEvaluated;
        var pts = fr.officialScore != null ? fr.officialScore : 0;
        var isChecked = selectedFarms.some(function (sf) { return norm(sf) === norm(fr.farm); });
        var scoreClass = isFull
          ? (pts >= 90 ? "text-success font-bold" : (pts >= 75 ? "text-warning font-bold" : "text-danger font-bold"))
          : "text-muted font-bold";

        html += '<tr class="' + (fr.isCurrentActiveFarm ? 'row-active-farm' : '') + '">';
        
        // Checkbox for 3-farm comparison
        html += '<td class="text-center">';
        html += '<input type="checkbox" class="c360-compare-checkbox" data-action="toggle-compare-farm" data-farm="' + escapeHtml(fr.farm) + '" ' + (isChecked ? 'checked' : '') + ' title="Seleccionar para comparar (máx 3 fincas)" />';
        html += '</td>';

        // Position with Tie Handling
        html += '<td class="tabular-nums font-bold">';
        if (fr.isTied) {
          html += '<span class="c360-rank-tied" title="Empate oficial en puntuación">' + escapeHtml(fr.rankDisplay) + '</span>';
        } else {
          html += escapeHtml(fr.rankDisplay);
        }
        html += '</td>';

        // Farm Name
        html += '<td>';
        html += '<strong>' + escapeHtml(fr.farm) + '</strong>';
        if (fr.isCurrentActiveFarm) {
          html += ' <span class="c360-active-tag">Activa</span>';
        }
        html += '</td>';

        // Crop
        html += '<td>' + escapeHtml(fr.crop) + '</td>';

        // Visits Count
        html += '<td class="tabular-nums text-center">' + fr.visitsCount + '</td>';

        // Last Date
        html += '<td class="tabular-nums text-center">' + (fr.lastDate || "—") + '</td>';

        // Coverage Badge (Never hide partial scope)
        if (isFull) {
          html += '<td class="text-center"><span class="c360-cov-badge success" title="Protocolo completo (100% de peso auditado)">✓ 5/5 Caps</span></td>';
        } else {
          html += '<td class="text-center"><span class="c360-cov-badge warning" title="Auditoría parcial: ' + fr.coveragePct + '% del peso evaluado">⚠ ' + fr.evaluatedChaptersCount + '/5 Caps (' + fr.coveragePct + '%)</span></td>';
        }

        // Mini Chapter Bars
        html += '<td>' + renderMiniBars(fr.chapters) + '</td>';

        // Official Points (NEVER multiplied by coverage!)
        html += '<td class="tabular-nums text-right font-bold ' + scoreClass + '">';
        html += pts.toFixed(1) + ' <small>/100</small>';
        if (!isFull) {
          html += ' <small class="text-warning" title="Puntos ganados en capítulos evaluados">(parcial)</small>';
        }
        html += '</td>';

        // Criteria Compliance (over evaluated criteria only)
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

        // Actions
        html += '<td class="text-center">';
        html += '<button type="button" class="c360-btn-table-action" data-action="filter-farm-direct" data-farm="' + escapeHtml(fr.farm) + '">Filtrar</button>';
        html += '</td>';

        html += '</tr>';
      });

      // 2. Render Farms with Insufficient Data
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
    html += '</div>'; // End table-wrapper

    html += '<div class="c360-table-footer-info">';
    html += '<span>Seleccione hasta 3 casillas para generar la comparación simultánea superior. Las puntuaciones mostradas corresponden estrictamente a la escala de 0 a 100 puntos oficiales calculados por el motor MIPE.</span>';
    html += '</div>';

    html += '</div>'; // End table-card
    return html;
  }

  /**
   * Main container renderer for the Farm Benchmark View.
   */
  function renderFarmBenchmarkView(benchmarkVm) {
    var html = '<section class="c360-benchmark-section" aria-label="Benchmark Comparativo de Fincas MIPE">';
    
    // Side-by-Side 3-Farm Comparative Card (if any farms are selected)
    html += renderFarmComparisonCard(benchmarkVm);

    // Complete Benchmark Table
    html += renderBenchmarkTable(benchmarkVm);

    html += '</section>';
    return html;
  }

  return {
    buildBenchmarkViewModel: buildBenchmarkViewModel,
    renderFarmComparisonCard: renderFarmComparisonCard,
    renderBenchmarkTable: renderBenchmarkTable,
    renderFarmBenchmarkView: renderFarmBenchmarkView
  };
});
