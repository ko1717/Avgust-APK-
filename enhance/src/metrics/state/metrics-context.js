/**
 * MetricsContext — State Management & Presentation View Model
 * AVGUST CARE 360 · Centro de Inteligencia MIPE
 *
 * Responsibilities:
 * - Maintain unified filter state (farm, lot, crop, range, auditState)
 * - Single source of truth for filtered visits: filterVisits()
 * - Calculate metadata (lastUpdated, lastAuditDate, connectivity, etc.)
 * - Provide pure viewModel to all consumer views (Zero business logic in views)
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360MetricsContext = factory();
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

  function getConnectivityState() {
    var isOnline = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;

    // Detect pending changes if stored in localStorage or window bridge
    var pendingCount = 0;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var draft = window.localStorage.getItem("c360_draft");
        if (draft) pendingCount += 1;
        var pendingQueue = window.localStorage.getItem("c360_sync_queue");
        if (pendingQueue) {
          var parsed = JSON.parse(pendingQueue);
          if (Array.isArray(parsed)) pendingCount += parsed.length;
        }
      }
    } catch (e) {
      // Local storage inaccessible
    }

    if (!isOnline) {
      return {
        online: false,
        statusText: "OFFLINE · Datos locales",
        statusClass: "offline",
        pendingCount: pendingCount
      };
    }

    if (pendingCount > 0) {
      return {
        online: true,
        statusText: pendingCount + " cambio" + (pendingCount === 1 ? "" : "s") + " pendiente" + (pendingCount === 1 ? "" : "s"),
        statusClass: "pending",
        pendingCount: pendingCount
      };
    }

    return {
      online: true,
      statusText: "ONLINE",
      statusClass: "online",
      pendingCount: 0
    };
  }

  function extractAvailableOptions(visits, selectedFarm) {
    var farmSet = new Set();
    var cropSet = new Set();
    var lotSet = new Set();

    (visits || []).forEach(function (v) {
      if (!v) return;
      if (v.farm) farmSet.add(v.farm.trim());
      if (v.crop) cropSet.add(v.crop.trim());

      var matchesFarm = !selectedFarm || norm(v.farm) === norm(selectedFarm);
      if (matchesFarm) {
        var lotVal = v.lot || v.block || v.bloque || v.lote;
        if (lotVal && typeof lotVal === "string") {
          lotSet.add(lotVal.trim());
        }
      }
    });

    return {
      availableFarms: Array.from(farmSet).sort(function (a, b) { return a.localeCompare(b, "es"); }),
      availableCrops: Array.from(cropSet).sort(function (a, b) { return a.localeCompare(b, "es"); }),
      availableLots: Array.from(lotSet).sort(function (a, b) { return a.localeCompare(b, "es"); })
    };
  }

  function buildMetricsViewModel(state, rawVisits, engine) {
    var raw = Array.isArray(rawVisits) ? rawVisits : [];
    var options = extractAvailableOptions(raw, state.farm);

    // Filter strictly via the unified engine (Single source of truth)
    var filteredVisits = engine.filterVisits(
      raw,
      state.farm,
      state.range,
      state.crop,
      state.lot,
      state.auditState
    );

    // Aggregate strictly via the validated engine
    var intel = engine.aggregateIntelligence(filteredVisits);

    var hasAudits = filteredVisits.length > 0;
    var isFullyEvaluated = intel.isFullyEvaluated;
    var evaluatedChaptersCount = intel.evaluatedChaptersCount;
    var coveragePct = intel.coveragePct;
    var officialScore = hasAudits ? intel.globalPoints : null;
    var criteriaCompliance = intel.criteriaCompliance;
    var weightedScore = intel.weightedScore;
    var totalFindings = intel.totalFindings;

    // Severity breakdown from real data
    var criticalFindings = 0;
    var highFindings = 0;
    var mediumFindings = 0;
    if (intel.criteriaStats) {
      Object.keys(intel.criteriaStats).forEach(function (cId) {
        var stat = intel.criteriaStats[cId];
        if (stat && stat.findings > 0) {
          var cat = (engine.CRITERIA_CATALOG && engine.CRITERIA_CATALOG[cId]) || {};
          if (cat.severity === "critical") criticalFindings += stat.findings;
          else if (cat.severity === "high") highFindings += stat.findings;
          else mediumFindings += stat.findings;
        }
      });
    }

    // Risk Classification (Guarded: based strictly on official MIPE rules without inventing arbitrary formula)
    var riskStatus = "unevaluated";
    var riskBadge = "— Sin datos";
    var riskTitle = "Pendiente de evaluación";
    var riskDescription = "Sin auditorías registradas en el contexto";
    if (hasAudits) {
      if (!isFullyEvaluated) {
        riskStatus = "partial";
        riskBadge = "⚠ Indeterminado";
        riskTitle = "Riesgo Indeterminado (Auditoría Parcial)";
        riskDescription = (5 - evaluatedChaptersCount) + " capítulos sin auditar (" + (Math.round((100.0 - (officialScore || 0)) * 10) / 10).toFixed(1) + " pts sin calificar)";
      } else {
        if (officialScore >= 90.0 && criticalFindings === 0) {
          riskStatus = "low";
          riskBadge = "✓ Bajo";
          riskTitle = "Bajo Riesgo Operativo";
          riskDescription = "Cumplimiento sólido del protocolo MIPE oficial";
        } else if (officialScore >= 75.0 && criticalFindings <= 2) {
          riskStatus = "medium";
          riskBadge = "⚠ Moderado";
          riskTitle = "Riesgo Moderado / Atención";
          riskDescription = totalFindings + " no conformidad" + (totalFindings === 1 ? "" : "es") + " que requieren seguimiento";
        } else {
          riskStatus = "high";
          riskBadge = "! Crítico";
          riskTitle = "Riesgo Crítico Operativo";
          riskDescription = criticalFindings + " críticas o puntaje inferior al estándar (75.0 pts)";
        }
      }
    }

    // Trend / Delta vs Previous Period (strictly from real timeline)
    var trendDelta = null;
    var trendText = "Sin tendencia disponible";
    var trendDirection = "neutral";
    var trendTimelineCount = intel.timeline ? intel.timeline.length : 0;
    if (intel.timeline && intel.timeline.length >= 2) {
      var curMonth = intel.timeline[intel.timeline.length - 1];
      var prevMonth = intel.timeline[intel.timeline.length - 2];
      if (typeof curMonth.score === "number" && typeof prevMonth.score === "number") {
        trendDelta = Math.round((curMonth.score - prevMonth.score) * 10) / 10;
        if (trendDelta > 0) {
          trendText = "↑ +" + trendDelta.toFixed(1) + " pts";
          trendDirection = "up";
        } else if (trendDelta < 0) {
          trendText = "↓ " + trendDelta.toFixed(1) + " pts";
          trendDirection = "down";
        } else {
          trendText = "= 0.0 pts (Estable)";
          trendDirection = "stable";
        }
      }
    } else if (intel.timeline && intel.timeline.length === 1) {
      trendText = "Línea base (" + intel.timeline[0].month + ")";
      trendDirection = "neutral";
    }

    // Health Score & Status
    var healthScore = officialScore; // Official MIPE points (0-100)
    var healthStatus = "unevaluated";
    var healthTitle = "Sin datos de auditoría";
    var healthBadge = "— Sin datos";
    if (hasAudits) {
      if (isFullyEvaluated) {
        if (healthScore >= 90.0) {
          healthStatus = "favorable";
          healthTitle = "Desempeño MIPE Favorable";
          healthBadge = "✓ Favorable";
        } else if (healthScore >= 75.0) {
          healthStatus = "attention";
          healthTitle = "Aseguramiento en Proceso";
          healthBadge = "⚠ Atención";
        } else {
          healthStatus = "critical";
          healthTitle = "Riesgo Crítico Operativo";
          healthBadge = "! Crítico";
        }
      } else {
        healthStatus = "partial";
        healthTitle = "Auditoría Parcial (" + evaluatedChaptersCount + "/5 Caps)";
        healthBadge = "⚠ Auditoría Parcial";
      }
    }

    // Diagnostic Statement (Fact-based from real data, zero hallucination)
    var diagnostic = "";
    if (!hasAudits) {
      diagnostic = "No existen auditorías registradas para los filtros seleccionados. Seleccione otra finca, lote o amplíe el periodo de evaluación.";
    } else if (!isFullyEvaluated) {
      var unAuditedPts = Math.round((100.0 - (officialScore || 0)) * 10) / 10;
      diagnostic = "Auditoría parcial: El desempeño registrado es de " + (officialScore != null ? officialScore.toFixed(1) : "0.0") + " pts en " + evaluatedChaptersCount + " de 5 capítulos (" + coveragePct + "% de cobertura). La información disponible aún no permite certificar el protocolo completo. Quedan " + unAuditedPts.toFixed(1) + " puntos oficiales por evaluar.";
    } else {
      if (healthScore >= 90.0) {
        diagnostic = "La finca presenta un desempeño MIPE favorable (" + healthScore.toFixed(1) + " / 100 pts), con protocolo completo (100% de cobertura) y cumplimiento consistente del " + (criteriaCompliance != null ? criteriaCompliance.toFixed(1) + "%" : "100%") + " en los 37 criterios oficiales evaluados.";
      } else if (healthScore >= 75.0) {
        diagnostic = "La finca cuenta con cobertura completa del protocolo (5/5 capítulos), pero registra " + totalFindings + " no conformidad" + (totalFindings === 1 ? "" : "es") + " que requieren acciones correctivas prioritarias para alcanzar la meta oficial de 95.0 pts.";
      } else {
        diagnostic = "Alerta operativa: La finca presenta un desempeño inferior al umbral mínimo (" + healthScore.toFixed(1) + " / 100 pts) con " + totalFindings + " desviación" + (totalFindings === 1 ? "" : "es") + " registradas (" + criticalFindings + " críticas). Se recomienda intervención técnica urgente.";
      }
    }

    var totalApplicable = Object.keys(intel.chapterPerformance).reduce(function (acc, k) { return acc + intel.chapterPerformance[k].applicable; }, 0);
    var totalPositive = Object.keys(intel.chapterPerformance).reduce(function (acc, k) { return acc + intel.chapterPerformance[k].positive; }, 0);

    // Latest audit date in filtered subset
    var lastAuditDate = "Sin datos disponibles";
    if (filteredVisits.length > 0) {
      var sortedDates = filteredVisits
        .map(function (v) { return v.date; })
        .filter(Boolean)
        .sort();
      if (sortedDates.length > 0) {
        lastAuditDate = sortedDates[sortedDates.length - 1];
      }
    }

    // Human-readable range label
    var rangeLabels = {
      "all": "Todo el historial",
      "30d": "Últimos 30 días",
      "90d": "Últimos 90 días",
      "365d": "Últimos 12 meses",
      "12m": "Últimos 12 meses",
      "year": "Año actual"
    };

    var auditStateLabels = {
      "all": "Todas las auditorías",
      "complete": "Solo completas (5/5 caps)",
      "partial": "Solo parciales (<5 caps)"
    };

    var connectivity = getConnectivityState();
    if (state.isSyncing) {
      connectivity.statusText = "↻ SINCRONIZANDO";
      connectivity.statusClass = "syncing";
    }

    var now = new Date();
    var lastUpdated = now.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }) + " " + now.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return {
      filters: {
        farm: state.farm || "",
        lot: state.lot || "",
        crop: state.crop || "",
        range: state.range || "all",
        auditState: state.auditState || "all"
      },
      availableFarms: options.availableFarms,
      availableLots: options.availableLots,
      availableCrops: options.availableCrops,
      filteredVisits: filteredVisits,
      intel: intel,
      hasAudits: hasAudits,
      connectivity: connectivity,
      metadata: {
        lastUpdated: lastUpdated,
        lastAuditDate: lastAuditDate,
        totalVisits: intel.totalVisits,
        reviewedCount: intel.reviewedCount,
        coveragePct: intel.coveragePct,
        evaluatedChaptersCount: intel.evaluatedChaptersCount,
        isFullyEvaluated: intel.isFullyEvaluated,
        dataSource: "Almacenamiento local SQLite (Offline-First)",
        rangeLabel: rangeLabels[state.range] || "Periodo seleccionado",
        auditStateLabel: auditStateLabels[state.auditState] || "Todas las auditorías"
      },
      scorecard: {
        hasAudits: hasAudits,
        isFullyEvaluated: isFullyEvaluated,
        evaluatedChaptersCount: evaluatedChaptersCount,
        coveragePct: coveragePct,
        officialScore: officialScore,
        criteriaCompliance: criteriaCompliance,
        weightedScore: weightedScore,
        totalFindings: totalFindings,
        criticalFindings: criticalFindings,
        highFindings: highFindings,
        mediumFindings: mediumFindings,
        totalApplicable: totalApplicable,
        totalPositive: totalPositive,
        riskStatus: riskStatus,
        riskBadge: riskBadge,
        riskTitle: riskTitle,
        riskDescription: riskDescription,
        trendDelta: trendDelta,
        trendText: trendText,
        trendDirection: trendDirection,
        trendTimelineCount: trendTimelineCount,
        healthScore: healthScore,
        healthStatus: healthStatus,
        healthTitle: healthTitle,
        healthBadge: healthBadge,
        diagnostic: diagnostic
      },
      mobileDrawerOpen: !!state.mobileDrawerOpen,
      subTab: state.subTab || "overview",
      selectedChapter: state.selectedChapter || 2,
      search: state.search || "",
      severityFilter: state.severityFilter || "all",
      statusFilter: state.statusFilter || "all",
      simValues: state.simValues || {},
      simTouched: !!state.simTouched
    };
  }

  return {
    norm: norm,
    escapeHtml: escapeHtml,
    getConnectivityState: getConnectivityState,
    extractAvailableOptions: extractAvailableOptions,
    buildMetricsViewModel: buildMetricsViewModel
  };
});
