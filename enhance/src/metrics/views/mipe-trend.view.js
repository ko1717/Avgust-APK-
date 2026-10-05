/**
 * MipeTrendView — Temporal Evolution, Delta vs Previous Period & Protocol History
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Answers: "¿La finca está mejorando o empeorando?", "¿Cómo ha evolucionado su desempeño MIPE?"
 * - Plots official Puntos MIPE (0 - 100), NOT criteria compliance as main score.
 * - Reference line at official target (95.0 pts).
 * - Distinguishes complete audits (●) vs partial audits (○).
 * - Never invents zeros for missing months/periods ("Sin datos").
 * - Calculates rigorous delta (Actual - Anterior) with scope mismatch warnings.
 * - Pure view / ViewModel builder: zero mutation of official calculation engine.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360MipeTrendView = factory();
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
   * Builds the Trend ViewModel from filtered visits in current active context.
   * Maintains strict mathematical isolation (uses official pointsEarned from calculateVisitScore).
   */
  function buildTrendViewModel(filteredVisits, filters, calculateVisitScoreFn) {
    var visits = (filteredVisits || []).filter(function (v) { return !!v; });
    var filterFarm = filters && filters.farm ? filters.farm : "";
    var filterLot = filters && filters.lot ? filters.lot : "";

    // 1. Sort visits chronologically ascending
    var sorted = visits.slice().sort(function (a, b) {
      var da = a.date || "";
      var db = b.date || "";
      return da.localeCompare(db);
    });

    // 2. Score each visit individually with official engine
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

    // 3. Compute Delta and Comparability
    var delta = null;
    var deltaText = "Sin comparación disponible";
    var deltaDirection = "neutral";
    var isComparable = false;
    var scopeMismatch = false;
    var scopeMismatchText = "";

    if (currentPoint && previousPoint) {
      // Comparability checks:
      // Same farm? If farm filter is active or both visits share the same farm
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
          deltaText = "→ 0.0 pts (Estable)";
          deltaDirection = "stable";
        }

        // Scope mismatch check: one complete, one partial?
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

  /**
   * Renders the SVG Timeline Chart.
   * Strictly renders official Puntos MIPE on Y-axis (0 to 100).
   * Meta line at 95.0 pts.
   * Differentiates complete audits (●, solid green) vs partial audits (○, hollow ring).
   * Does NOT plot zeros for missing periods.
   */
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

    // Y Axis: Official MIPE points scale (0 to 100)
    var minY = 0;
    var maxY = 100;

    var points = series.map(function (item, idx) {
      var x = padLeft + (series.length > 1 ? (idx / (series.length - 1)) * chartW : chartW / 2);
      var safeScore = Math.max(minY, Math.min(maxY, item.officialScore));
      var y = padTop + chartH - ((safeScore - minY) / (maxY - minY)) * chartH;
      return {
        x: x,
        y: y,
        item: item
      };
    });

    var pathD = "";
    points.forEach(function (p, i) {
      pathD += (i === 0 ? "M " : " L ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    });

    // Shaded area
    var areaD = pathD + " L " + points[points.length - 1].x.toFixed(1) + " " + (padTop + chartH) + " L " + points[0].x.toFixed(1) + " " + (padTop + chartH) + " Z";

    // Target Line Y position (95.0 pts)
    var targetY = padTop + chartH - ((trendVm.targetScore - minY) / (maxY - minY)) * chartH;

    var svg = '<svg class="c360-timeline-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Curva de evolución temporal de Puntos MIPE oficiales">';
    
    // Definitions: Gradients
    svg += '<defs>';
    svg += '<linearGradient id="c360-trend-grad" x1="0" y1="0" x2="0" y2="1">';
    svg += '<stop offset="0%" stop-color="#16a34a" stop-opacity="0.22"/>';
    svg += '<stop offset="100%" stop-color="#16a34a" stop-opacity="0.0"/>';
    svg += '</linearGradient>';
    svg += '</defs>';

    // Horizontal Grid Lines & Labels
    [0, 25, 50, 75, 90, 100].forEach(function (val) {
      var y = padTop + chartH - ((val - minY) / (maxY - minY)) * chartH;
      var isTargetLevel = val === 90;
      var strokeColor = isTargetLevel ? "#cbd5e1" : "#e2e8f0";
      svg += '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - padRight) + '" y2="' + y + '" stroke="' + strokeColor + '" stroke-width="1" stroke-dasharray="3 3" />';
      svg += '<text x="' + (padLeft - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="c360-svg-axis-text tabular-nums">' + val + ' pts</text>';
    });

    // Reference Line: Meta Técnica 95.0 pts
    svg += '<line x1="' + padLeft + '" y1="' + targetY + '" x2="' + (width - padRight) + '" y2="' + targetY + '" stroke="#16a34a" stroke-width="1.75" stroke-dasharray="6 4" />';
    svg += '<text x="' + (width - padRight + 8) + '" y="' + (targetY + 4) + '" class="c360-svg-target-text">Meta 95 pts</text>';

    // Shaded Area (only if multiple points)
    if (points.length > 1) {
      svg += '<path d="' + areaD + '" fill="url(#c360-trend-grad)" />';
      svg += '<path d="' + pathD + '" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />';
    }

    // Data Points (Distinguish Complete ● vs Partial ○)
    points.forEach(function (p) {
      var it = p.item;
      var isFull = it.isFullyEvaluated;
      var tooltip = it.date + "\n" +
        "Puntos MIPE: " + it.officialScore.toFixed(1) + " / 100 pts\n" +
        "Cobertura: " + it.coveragePct + "% (" + it.evaluatedChaptersCount + "/5 caps)\n" +
        "Estado: " + (isFull ? "Auditoría completa" : "Auditoría parcial") + "\n" +
        "Lote: " + it.lot + " · Cultivo: " + it.crop;

      // Outer point group with accessibility
      svg += '<g class="c360-timeline-point ' + (isFull ? 'point-complete' : 'point-partial') + '" tabindex="0">';
      svg += '<title>' + escapeHtml(tooltip) + '</title>';

      if (isFull) {
        // Complete Audit: Solid Green Circle ●
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="6" fill="#16a34a" stroke="#ffffff" stroke-width="2.5" />';
      } else {
        // Partial Audit: Hollow Circle with double ring ○
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7" fill="#ffffff" stroke="#d97706" stroke-width="2.5" />';
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="#d97706" />';
      }

      // Point Score Label
      var labelY = p.y - 12;
      if (labelY < padTop) labelY = p.y + 18;
      var scoreColor = isFull ? "#143d2b" : "#b45309";
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + labelY + '" text-anchor="middle" class="c360-svg-val-text tabular-nums" fill="' + scoreColor + '">' +
        it.officialScore.toFixed(1) + (!isFull ? ' (P)' : '') +
        '</text>';

      // X-Axis Date Label
      var displayDate = it.date;
      if (displayDate.length === 10) {
        // Format YYYY-MM-DD to DD/MM
        var parts = displayDate.split("-");
        if (parts.length === 3) displayDate = parts[2] + "/" + parts[1];
      }
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (padTop + chartH + 22) + '" text-anchor="middle" class="c360-svg-axis-text tabular-nums">' + escapeHtml(displayDate) + '</text>';
      svg += '</g>';
    });

    svg += '</svg>';
    return svg;
  }

  /**
   * Renders the Delta vs Previous Period Card.
   * Explicitly shows Actual, Anterior, Delta, and Scope Mismatch Warning when applicable.
   */
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

    // 3-Column Comparative Grid: Actual | Anterior | Delta
    html += '<div class="c360-delta-grid">';

    // Column 1: Medición Actual
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

    // Column 2: Medición Anterior
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

    // Column 3: Delta de Variación
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

    // Scope Mismatch Alert
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

  /**
   * Main container renderer for the MIPE Trend View.
   */
  function renderMipeTrendView(trendVm) {
    var html = '<section class="c360-trend-section" aria-label="Evolución Temporal MIPE">';

    // Top Card: Evolution Chart
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

    // SVG Chart
    html += renderTimelineChart(trendVm);

    // Aggregation Rule note
    html += '<div class="c360-trend-footer-note">';
    html += '<span class="c360-note-kicker">Regla de agregación temporal:</span> ' + escapeHtml(trendVm.aggregationRule);
    html += '</div>';

    html += '</div>'; // End trend-chart-card

    // Sequential Delta Card
    html += renderDeltaCard(trendVm);

    html += '</section>';
    return html;
  }

  return {
    buildTrendViewModel: buildTrendViewModel,
    renderTimelineChart: renderTimelineChart,
    renderDeltaCard: renderDeltaCard,
    renderMipeTrendView: renderMipeTrendView
  };
});
