/**
 * MipeHealthHeroView — Authoritative MIPE Health Score Hero Component
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Answers in < 10 seconds: "¿Cómo está la finca MIPEMENTE?"
 * Derives health score strictly from official Puntos MIPE (0 - 100).
 * Reuses SVG circular gauge, provides factual diagnostic interpretation without hallucination.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360MipeHealthHeroView = factory();
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

  function renderCircularGauge(score, coverage) {
    var radius = 68;
    var circ = 2 * Math.PI * radius;
    var hasScore = score != null && score > 0;
    var val = hasScore ? Math.max(0, Math.min(100, score)) : 0;
    var offset = circ - (val / 100) * circ;
    var strokeColor = hasScore
      ? (score >= 90 ? "#16a34a" : (score >= 75 ? "#d97706" : "#dc2626"))
      : "#cbd5e1";

    return '<svg class="c360-gauge-svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Indicador gráfico de puntuación MIPE">' +
      '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-dasharray="' + circ + '" />' +
      '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="' + strokeColor + '" stroke-width="12" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 80 80)" style="transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);" />' +
      '</svg>';
  }

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

  return {
    renderMipeHealthHero: renderMipeHealthHero,
    renderCircularGauge: renderCircularGauge
  };
});
