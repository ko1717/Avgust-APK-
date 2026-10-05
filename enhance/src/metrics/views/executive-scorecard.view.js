/**
 * ExecutiveScorecardView — Structured 6-KPI Hierarchical Scorecard
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Pure view component: receives prepared ViewModel, zero arithmetic calculation.
 * Follows enterprise zero-pill discipline, domain-native typography, and high accessibility.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360ExecutiveScorecardView = factory();
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

  function renderExecutiveScorecard(vm) {
    var intel = vm.intel;
    var sc = vm.scorecard;
    var hasAudits = vm.hasAudits;
    var isFull = sc.isFullyEvaluated;
    var officialScore = sc.officialScore;
    var compliance = sc.criteriaCompliance;
    var coveragePct = sc.coveragePct;
    var evaluatedCaps = sc.evaluatedChaptersCount;

    var html = '<div class="c360-scorecard-section" aria-label="Executive Scorecard MIPE">';

    // =========================================================================
    // 1. PRIMARY DOMINANT CARD: PUNTOS MIPE OFICIALES (HERO KPI)
    // =========================================================================
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

    // =========================================================================
    // 2. SECONDARY TRIAD: CUMPLIMIENTO, COBERTURA, RIESGO
    // =========================================================================
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

    // =========================================================================
    // 3. TERTIARY PAIR: NO CONFORMIDADES, TENDENCIA
    // =========================================================================
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

  return {
    renderExecutiveScorecard: renderExecutiveScorecard
  };
});
