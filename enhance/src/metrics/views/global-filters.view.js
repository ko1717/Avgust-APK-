/**
 * GlobalFiltersView — Unified Global Filter Bar, Context Summary & Mobile Drawer
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Pure view function: consumes viewModel, zero calculation logic.
 * Follows enterprise design: high contrast, zero-pill discipline, responsive drawer.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360GlobalFiltersView = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function norm(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  return {
    renderGlobalFilters: renderGlobalFilters
  };
});
