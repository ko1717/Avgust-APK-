/**
 * ExecutiveHeaderView — Enterprise Header & Connectivity Console
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Pure view function: consumes viewModel, zero calculation logic.
 * Follows enterprise design: high contrast, zero-pill discipline, discrete indicators.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360ExecutiveHeaderView = factory();
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
    
    // Connectivity status indicator (Text + Icon/Dot, never color alone)
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

  return {
    renderExecutiveHeader: renderExecutiveHeader
  };
});
