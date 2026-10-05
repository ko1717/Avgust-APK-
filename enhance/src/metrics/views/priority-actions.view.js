/**
 * PriorityActionsView — Operational Action Plan & Corrective Follow-Up
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Answers: "¿Qué debe atenderse primero?", "¿Qué requiere seguimiento?"
 * - Connects: Problema → Prioridad → Acción recomendada → Responsable → Fecha límite → Estado → Seguimiento.
 * - Strict Data Integrity:
 *   * Uses real observations/recommendations recorded by technicians or official catalog.
 *   * If no recommendation exists: explicitly displays "Acción requerida — pendiente de definición" (never invents recipes).
 *   * Respects priority order based on severity and date.
 * - Pure view component: zero calculation mutation.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360PriorityActionsView = factory();
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
   * Renders the Priority Actions view.
   */
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
      
      // Col 1: Priority Tier
      html += '<td>';
      html += '<div class="c360-pt-badge ' + pt.badgeClass + ' font-bold text-xs">' + escapeHtml(pt.label) + '</div>';
      html += '<div class="text-xs text-muted tabular-nums">Orden #' + (idx + 1) + '</div>';
      html += '</td>';

      // Col 2: Severity Badge
      html += '<td><span class="c360-sev-badge ' + f.severityClass + '">' + f.severityLabel + '</span></td>';

      // Col 3: Problem / Criterion Description
      html += '<td>';
      html += '<div class="c360-act-crit-head"><strong>Criterio ' + f.criterionId + '</strong> · <span class="text-xs text-muted">' + escapeHtml(f.chapterShort) + '</span></div>';
      html += '<div class="c360-act-crit-text text-xs">' + escapeHtml(f.criterionText) + '</div>';
      if (f.observation) {
        html += '<div class="c360-act-obs text-xs"><span class="text-muted">Hallazgo:</span> ' + escapeHtml(f.observation) + '</div>';
      }
      html += '<div class="c360-act-meta text-xs text-muted">' + escapeHtml(f.farm) + ' (' + escapeHtml(f.lot) + ') · ' + escapeHtml(f.date) + '</div>';
      html += '</td>';

      // Col 4: Recommended Action
      html += '<td>';
      if (f.actionText === "Acción requerida — pendiente de definición") {
        html += '<span class="c360-act-pending-def font-medium text-amber">' + escapeHtml(f.actionText) + '</span>';
      } else {
        html += '<strong class="c360-act-text">' + escapeHtml(f.actionText) + '</strong>';
      }
      html += '</td>';

      // Col 5: Responsible Person
      html += '<td class="text-xs">' + escapeHtml(f.reviewer) + '</td>';

      // Col 6: Status
      html += '<td class="text-center">';
      var statusBadgeClass = isCritical ? 'badge-status-urgent' : (isHigh ? 'badge-status-attention' : 'badge-status-pending');
      html += '<span class="c360-act-status ' + statusBadgeClass + '">' + escapeHtml(f.status) + '</span>';
      html += '</td>';

      // Col 7: Evidence & Detail Link
      html += '<td class="text-center">';
      html += '<button type="button" class="c360-btn-act-evidence" data-action="open-risk-detail" data-finding-id="' + escapeHtml(f.id) + '" title="' + escapeHtml(f.evidenceSummary) + '">';
      html += f.hasEvidence ? '📸 Ver' : 'ℹ️ Info';
      html += '</button>';
      html += '</td>';

      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>'; // End table-wrap

    html += '<div class="c360-actions-footer-info">';
    html += '<span>Las acciones recomendadas reflejan las indicaciones asentadas en las auditorías de campo. Cuando no se registre instrucción específica, se clasifica como pendiente de definición para evitar prescripciones fitosanitarias infundadas.</span>';
    html += '</div>';

    html += '</div>'; // End actions-card
    return html;
  }

  return {
    renderPriorityActions: renderPriorityActions
  };
});
