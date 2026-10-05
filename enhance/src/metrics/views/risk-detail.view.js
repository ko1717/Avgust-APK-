/**
 * RiskDetailView — Drill-Down Contextual Modal & Evidence Traceability
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Navigates from Executive View → Risk → Finding → Criterion → Audit → Evidence.
 * - Preserves all active context (Farm, Lot, Date, Authorized User).
 * - Full Evidence Display (Photos, Technical Observations, Numerical Measurements).
 * - Pure view component: zero calculation mutation.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360RiskDetailView = factory();
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
   * Renders the Drill-Down Modal for a selected finding.
   */
  function renderRiskDetailModal(finding) {
    if (!finding) return '';

    var html = '<div class="c360-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="c360-modal-title">';
    html += '<div class="c360-modal-container">';

    // Header
    html += '<div class="c360-modal-header">';
    html += '<div>';
    html += '<div class="c360-modal-kicker">TRAZABILIDAD Y EVIDENCIA DE NO CONFORMIDAD</div>';
    html += '<h2 id="c360-modal-title" class="c360-modal-title">Criterio ' + escapeHtml(finding.criterionId) + ' · ' + escapeHtml(finding.category) + '</h2>';
    html += '</div>';
    html += '<button type="button" class="c360-modal-close-btn" data-action="close-risk-detail" aria-label="Cerrar detalle">✕</button>';
    html += '</div>';

    // Body
    html += '<div class="c360-modal-body">';

    // Context Strip
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

    // Section 1: Criterio Oficial Afectado
    html += '<div class="c360-modal-section">';
    html += '<h4 class="c360-modal-sec-title">1. Criterio Oficial del Protocolo MIPE</h4>';
    html += '<div class="c360-modal-card-box">';
    html += '<div class="c360-modal-crit-meta text-xs text-muted">Capítulo ' + finding.chapter + ': ' + escapeHtml(finding.chapterTitle) + '</div>';
    html += '<div class="c360-modal-crit-text"><strong>' + escapeHtml(finding.criterionId) + '</strong> ' + escapeHtml(finding.criterionText) + '</div>';
    html += '<div class="c360-modal-eval-status text-danger font-semibold">✕ Calificación en campo: NO CONFORME (NO)</div>';
    html += '</div>';
    html += '</div>';

    // Section 2: Hallazgo Observado y Evidencia
    html += '<div class="c360-modal-section">';
    html += '<h4 class="c360-modal-sec-title">2. Evidencia y Observaciones de Campo</h4>';
    html += '<div class="c360-modal-card-box">';
    
    // Technical Observation
    html += '<div class="c360-modal-obs-group">';
    html += '<span class="c360-modal-sublabel">Observación del Técnico Auditor:</span>';
    if (finding.observation) {
      html += '<div class="c360-modal-obs-text">' + escapeHtml(finding.observation) + '</div>';
    } else {
      html += '<div class="text-muted text-xs italic">Sin evidencia registrada en la auditoría.</div>';
    }
    html += '</div>';

    // Photographic Evidence
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

    // Numerical Measurements
    if (finding.measurements) {
      html += '<div class="c360-modal-meas-group">';
      html += '<span class="c360-modal-sublabel">Mediciones Instrumentales:</span>';
      html += '<div class="c360-modal-meas-val tabular-nums">' + escapeHtml(JSON.stringify(finding.measurements)) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    // Section 3: Acción Correctiva y Seguimiento
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

    html += '</div>'; // End modal-body

    // Footer
    html += '<div class="c360-modal-footer">';
    html += '<button type="button" class="c360-btn-filter-direct" data-action="filter-farm-direct" data-farm="' + escapeHtml(finding.farm) + '">';
    html += 'Filtrar Contexto por esta Finca';
    html += '</button>';
    html += '<button type="button" class="c360-btn-modal-close" data-action="close-risk-detail">';
    html += 'Cerrar';
    html += '</button>';
    html += '</div>';

    html += '</div>'; // End modal-container
    html += '</div>'; // End modal-overlay
    return html;
  }

  return {
    renderRiskDetailModal: renderRiskDetailModal
  };
});
