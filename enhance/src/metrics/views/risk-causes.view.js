/**
 * RiskCausesView — Technical Areas & Observed Deviation Categorization
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Answers: "¿Cuál es la causa o área técnica relacionada?"
 * - Groups non-conformities strictly by official MIPE technical chapters and functional categories.
 * - Enforces explicit semantic distinction:
 *   * "Área técnica relacionada" (según catálogo oficial) vs "Causa raíz comprobada".
 *   * "Dato observado en campo" vs "Interpretación diagnóstica".
 * - Never hallucinates unverified root causes, economic impact or pest levels.
 * - Pure view component: zero calculation mutation.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360RiskCausesView = factory();
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

  /**
   * Renders the Technical Areas & Deviation Causes view.
   */
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
      
      // Header: Chapter Icon/Title, Count & Share
      html += '<div class="c360-cause-area-header">';
      html += '<div class="c360-cause-area-title-group">';
      html += '<span class="c360-cause-area-kicker">Capítulo ' + chId + ' · Impacto Protocolo: ' + weightPct + '% (' + pointsMax.toFixed(1) + ' pts)</span>';
      html += '<h4 class="c360-cause-area-title">' + escapeHtml(area.title) + '</h4>';
      html += '</div>';
      html += '<div class="c360-cause-area-badge tabular-nums ' + (isClean ? 'badge-clean' : 'badge-deviations') + '">';
      html += isClean ? '✓ Conforme' : count + ' hallazgo' + (count === 1 ? '' : 's');
      html += '</div>';
      html += '</div>';

      // Predominant severity indicator
      html += '<div class="c360-cause-predominant text-xs">';
      html += '<span class="text-muted">Severidad predominante:</span> ';
      html += '<strong>' + escapeHtml(predSev) + '</strong>';
      html += '</div>';

      // Distribution Bar
      html += '<div class="c360-cause-progress-wrap">';
      html += '<div class="c360-cause-progress-track">';
      html += '<div class="c360-cause-progress-fill" style="width: ' + pctOfTotal + '%;"></div>';
      html += '</div>';
      html += '<span class="c360-cause-progress-label tabular-nums">' + pctOfTotal + '% del total de hallazgos</span>';
      html += '</div>';

      // Severity Breakdown pills inside area
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

        // Sample criteria affected
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

      html += '</div>'; // End cause-area-card
    });
    html += '</div>'; // End causes-grid

    html += '</div>'; // End causes-card
    return html;
  }

  return {
    renderRiskCauses: renderRiskCauses
  };
});
