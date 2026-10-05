/**
 * CommandCenterView — Enterprise Agronomic Intelligence & Command Center
 * AVGUST CARE 360 · Centro de Inteligencia MIPE (FASE 5.6)
 *
 * Provides:
 * 1. renderMipeCommandCanvas: Unified authoritative health & trajectory surface
 * 2. renderChapterGapAnalyzer: 5-chapter weighted contribution & critical gap identifier
 * 3. renderQuickInterventionZone: Direct link between finding, severity, action & evidence
 *
 * Follows zero-pill discipline, tabular numerals, high contrast and responsive layout.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Care360CommandCenterView = factory();
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

    return '<svg class="c360-gauge-svg" width="130" height="130" viewBox="0 0 160 160" role="img" aria-label="Indicador gráfico de puntuación MIPE">' +
      '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-dasharray="' + circ + '" />' +
      '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="' + strokeColor + '" stroke-width="12" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 80 80)" style="transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);" />' +
      '</svg>';
  }

  function renderTimelineSparkline(trendVm) {
    if (!trendVm || !trendVm.hasAudits || !trendVm.timeline || trendVm.timeline.length === 0) {
      return '<div class="c360-trend-empty-state"><div class="c360-empty-desc">Sin auditorías registradas en el periodo</div></div>';
    }

    var timeline = trendVm.timeline;
    var width = 460;
    var height = 150;
    var padLeft = 40;
    var padRight = 24;
    var padTop = 20;
    var padBottom = 30;

    var chartW = width - padLeft - padRight;
    var chartH = height - padTop - padBottom;

    var n = timeline.length;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var item = timeline[i];
      var x = n === 1 ? padLeft + chartW / 2 : padLeft + (i / (n - 1)) * chartW;
      var y = padTop + chartH - ((item.score || 0) / 100.0) * chartH;
      pts.push({ x: x, y: y, item: item, idx: i });
    }

    var polylinePoints = pts.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
    var targetY = padTop + chartH - (95.0 / 100.0) * chartH;

    var svg = '<div class="c360-timeline-svg-wrap">';
    svg += '<svg class="c360-timeline-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="Gráfico cronológico de evolución MIPE">';

    // Grid lines
    [0, 50, 75, 100].forEach(function (tickVal) {
      var yTick = padTop + chartH - (tickVal / 100.0) * chartH;
      svg += '<line x1="' + padLeft + '" y1="' + yTick + '" x2="' + (width - padRight) + '" y2="' + yTick + '" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,3" />';
      svg += '<text x="' + (padLeft - 6) + '" y="' + (yTick + 3.5) + '" font-size="10" fill="#94a3b8" text-anchor="end" font-family="sans-serif">' + tickVal + '</text>';
    });

    // 95.0 Target Line
    svg += '<line x1="' + padLeft + '" y1="' + targetY + '" x2="' + (width - padRight) + '" y2="' + targetY + '" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,4" />';
    svg += '<text x="' + (width - padRight) + '" y="' + (targetY - 4) + '" font-size="9.5" font-weight="bold" fill="#16a34a" text-anchor="end" font-family="sans-serif">Meta 95 pts</text>';

    // Sparkline path
    if (pts.length >= 2) {
      svg += '<polyline points="' + polylinePoints + '" fill="none" stroke="#007fa3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />';
    }

    // Circles for data points
    pts.forEach(function (p) {
      var isCurrent = p.idx === n - 1;
      var fillCol = p.item.isPartial ? "#ffffff" : "#007fa3";
      var strokeCol = p.item.isPartial ? "#d97706" : "#007fa3";
      var r = isCurrent ? 5.5 : 4;
      var sw = isCurrent ? 2.5 : 2;

      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '" fill="' + fillCol + '" stroke="' + strokeCol + '" stroke-width="' + sw + '">';
      svg += '<title>' + escapeHtml(p.item.dateLabel) + ': ' + (p.item.score != null ? p.item.score.toFixed(1) : '0.0') + ' pts (' + (p.item.isPartial ? 'Parcial ' + p.item.coveragePct + '%' : 'Completa') + ')</title>';
      svg += '</circle>';

      // Date labels on X axis
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (height - 8) + '" font-size="9" fill="#64748b" text-anchor="middle" font-family="sans-serif">' + escapeHtml(p.item.dateShort || p.item.dateLabel) + '</text>';
    });

    svg += '</svg>';
    svg += '</div>';
    return svg;
  }

  function renderMipeCommandCanvas(vm) {
    var sc = vm.scorecard;
    var trendVm = vm.trendVm;
    var hasAudits = vm.hasAudits;
    var isFull = sc.isFullyEvaluated;
    var score = sc.officialScore;
    var coveragePct = sc.coveragePct;
    var evaluatedCaps = sc.evaluatedChaptersCount;
    var statusClass = "status-" + sc.healthStatus;

    var html = '<section class="c360-command-canvas ' + statusClass + '" aria-label="Lienzo Maestro de Estado MIPE">';

    // Left Column: Dominant MIPE Health & Reliability
    html += '<div class="c360-canvas-left">';
    
    html += '<div class="c360-canvas-header">';
    html += '<div class="c360-canvas-kicker-group">';
    html += '<span class="c360-card-eyebrow">ESTADO MIPE RECTOR &amp; CONFIABILIDAD</span>';
    html += '<h2 class="c360-canvas-title">Diagnóstico de Salud MIPE</h2>';
    html += '</div>';
    html += '<span class="c360-status-indicator ' + statusClass + '">' + escapeHtml(sc.healthBadge) + '</span>';
    html += '</div>';

    html += '<div class="c360-canvas-hero-row">';
    
    html += '<div class="c360-canvas-gauge-wrap">';
    html += renderCircularGauge(score, coveragePct);
    html += '</div>';

    html += '<div class="c360-canvas-score-col">';
    if (hasAudits && score != null) {
      html += '<div class="c360-canvas-score-huge tabular-nums">' + score.toFixed(1) + '<span class="c360-canvas-score-unit">/ 100 pts</span></div>';
      html += '<div class="c360-canvas-score-title">' + escapeHtml(sc.healthTitle) + '</div>';
      if (isFull) {
        html += '<div class="c360-canvas-scope-status text-success">✓ Protocolo oficial completo (5/5 caps auditados)</div>';
      } else {
        html += '<div class="c360-canvas-scope-status text-warning">⚠️ Alcance parcial (' + evaluatedCaps + '/5 caps auditados)</div>';
      }
    } else {
      html += '<div class="c360-canvas-score-huge c360-text-nodata">Sin datos</div>';
      html += '<div class="c360-canvas-score-title">Sin auditorías registradas</div>';
      html += '<div class="c360-canvas-scope-status text-muted">Ajuste los filtros para visualizar indicadores</div>';
    }
    html += '</div>';

    html += '</div>'; // End hero-row

    // Executive Diagnostic narrative
    html += '<div class="c360-canvas-diag-wrap">';
    html += '<div class="c360-canvas-diag-kicker">DIAGNÓSTICO EJECUTIVO</div>';
    html += '<p class="c360-canvas-diag-text">' + escapeHtml(sc.diagnostic) + '</p>';
    html += '</div>';

    // Factual Satellites Strip (Zero-Pill: typography + separators)
    html += '<div class="c360-canvas-satellites-strip">';
    
    // Sat 1: Meta
    html += '<div class="c360-sat-item">';
    html += '<span class="c360-sat-kicker">Meta Oficial:</span>';
    html += '<strong class="c360-sat-val tabular-nums">95.0 pts</strong>';
    if (hasAudits && isFull && score != null) {
      var dMeta = score - 95.0;
      var dClass = dMeta >= 0 ? 'text-success' : 'text-danger';
      html += '<span class="c360-sat-sub tabular-nums ' + dClass + '">(' + (dMeta >= 0 ? '+' : '') + dMeta.toFixed(1) + ' pts)</span>';
    }
    html += '</div>';

    html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';

    // Sat 2: Cumplimiento en evaluados
    html += '<div class="c360-sat-item">';
    html += '<span class="c360-sat-kicker">Cumplimiento:</span>';
    html += '<strong class="c360-sat-val tabular-nums">' + (sc.criteriaCompliance != null ? sc.criteriaCompliance.toFixed(1) + '%' : '—') + '</strong>';
    if (hasAudits && sc.totalApplicable > 0) {
      html += '<span class="c360-sat-sub">(' + sc.totalPositive + '/' + sc.totalApplicable + ' conf.)</span>';
    }
    html += '</div>';

    html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';

    // Sat 3: Cobertura
    html += '<div class="c360-sat-item">';
    html += '<span class="c360-sat-kicker">Cobertura:</span>';
    html += '<strong class="c360-sat-val tabular-nums">' + (hasAudits ? coveragePct + '%' : '—') + '</strong>';
    html += '<span class="c360-sat-sub">(' + (hasAudits ? evaluatedCaps + '/5 caps' : '0/5') + ')</span>';
    html += '</div>';

    html += '</div>'; // End satellites-strip

    // Partial scope alert
    if (hasAudits && !isFull) {
      var unAuditedPts = Math.round((100.0 - (score || 0)) * 10) / 10;
      html += '<div class="c360-canvas-partial-banner" role="note">';
      html += '<span class="c360-banner-icon" aria-hidden="true">⚠️</span>';
      html += '<div class="c360-banner-body">';
      html += '<strong>Auditoría con alcance parcial:</strong> Quedan ' + unAuditedPts.toFixed(1) + ' puntos sin evaluar en capítulos omitidos. Los capítulos no evaluados no aportan puntuación (0.0 pts).';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // End canvas-left

    // Right Column: Timeline Trajectory & Delta
    html += '<div class="c360-canvas-right">';
    
    html += '<div class="c360-canvas-header">';
    html += '<div class="c360-canvas-kicker-group">';
    html += '<span class="c360-card-eyebrow">TRAYECTORIA &amp; EVOLUCIÓN HISTÓRICA</span>';
    html += '<h3 class="c360-canvas-title">Evolución de Puntos MIPE</h3>';
    html += '</div>';
    if (trendVm && trendVm.delta != null) {
      var dCol = trendVm.delta > 0 ? 'text-success' : (trendVm.delta < 0 ? 'text-danger' : 'text-muted');
      html += '<div class="c360-canvas-delta-badge ' + dCol + '">';
      html += '<span class="c360-delta-kicker">Delta vs Anterior:</span> ';
      html += '<strong class="tabular-nums font-bold">' + escapeHtml(trendVm.deltaText) + '</strong>';
      html += '</div>';
    }
    html += '</div>';

    if (trendVm) {
      html += renderTimelineSparkline(trendVm);
    }

    // Delta Callout & Comparability Note
    html += '<div class="c360-canvas-history-footer">';
    if (trendVm && trendVm.delta != null) {
      html += '<div class="c360-canvas-delta-note">';
      html += '<span>Última visita: <strong>' + (trendVm.currentScore != null ? trendVm.currentScore.toFixed(1) : '—') + ' pts</strong></span>';
      html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';
      html += '<span>Visita previa: <strong>' + (trendVm.previousScore != null ? trendVm.previousScore.toFixed(1) : '—') + ' pts</strong></span>';
      html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';
      html += '<span class="text-muted">' + escapeHtml(trendVm.summaryText || '') + '</span>';
      html += '</div>';
    } else if (trendVm && trendVm.hasAudits) {
      html += '<div class="c360-canvas-delta-note text-muted">';
      html += 'Línea base registrada (1 auditoría). Se registrará la variación en la próxima visita.';
      html += '</div>';
    } else {
      html += '<div class="c360-canvas-delta-note text-muted">';
      html += 'Sin historial suficiente para calcular la trayectoria en el periodo.';
      html += '</div>';
    }

    if (trendVm && trendVm.scopeMismatch) {
      html += '<div class="c360-canvas-mismatch-banner">';
      html += '⚠️ <strong>Alcance no homogéneo:</strong> ' + escapeHtml(trendVm.scopeMismatchText);
      html += '</div>';
    }

    html += '</div>'; // End history-footer

    html += '</div>'; // End canvas-right

    html += '</section>'; // End command-canvas
    return html;
  }

  function renderChapterGapAnalyzer(intel) {
    var largestGapChId = null;
    var largestGapVal = -1;

    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var lostPts = p.maxPoints - (p.isEvaluated && p.pointsEarned != null ? p.pointsEarned : 0);
      if (lostPts > largestGapVal) {
        largestGapVal = lostPts;
        largestGapChId = chId;
      }
    });

    var html = '<section class="c360-gap-analyzer-section" aria-label="Analizador de Brechas por Capítulo">';

    html += '<div class="c360-gap-header">';
    html += '<div>';
    html += '<span class="c360-card-eyebrow">DISTRIBUCIÓN PONDERADA &amp; ANÁLISIS DE BRECHAS</span>';
    html += '<h3 class="c360-gap-title">Aporte de Puntos y Brechas por Capítulo</h3>';
    html += '</div>';
    html += '<div class="c360-gap-score-summary tabular-nums"><strong>' + intel.globalPoints.toFixed(1) + '</strong> / 100.0 Puntos Oficiales Ganados</div>';
    html += '</div>';

    // Stacked Contribution Bar
    html += '<div class="c360-stacked-bar" role="progressbar" aria-valuenow="' + intel.globalPoints.toFixed(1) + '" aria-valuemin="0" aria-valuemax="100">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var colors = { 1: "#0284c7", 2: "#16a34a", 3: "#8b5cf6", 4: "#d97706", 5: "#059669" };
      var segColor = p.isEvaluated ? colors[chId] : "#e2e8f0";
      var tooltip = "Cap " + chId + ": " + p.info.short + (p.isEvaluated ? " (" + p.pointsEarned.toFixed(1) + " / " + p.maxPoints + " pts)" : " (⚠️ NO EVALUADO · 0.0 pts)");

      html += '<div class="c360-bar-segment' + (!p.isEvaluated ? ' is-uneval' : '') + '" style="width: ' + p.maxPoints + '%; background-color: ' + segColor + ';" title="' + tooltip + '" data-action="open-chapter" data-chapter="' + chId + '">';
      html += '<span class="c360-seg-label">Cap ' + chId + ' (' + p.maxPoints + '%)</span>';
      html += '<span class="c360-seg-val tabular-nums">' + (p.isEvaluated ? p.pointsEarned.toFixed(1) + ' pts' : 'N/E · 0 pts') + '</span>';
      html += '</div>';
    });
    html += '</div>';

    // Continuous 5-Chapter Gap Cards Strip
    html += '<div class="c360-gap-chapters-row">';
    [1, 2, 3, 4, 5].forEach(function (chId) {
      var p = intel.chapterPerformance[chId];
      var info = p.info;
      var isEval = p.isEvaluated && p.compliance != null;
      var isPrimaryGap = (chId === largestGapChId && largestGapVal > 0.1);
      var lostPts = p.maxPoints - (isEval ? p.pointsEarned : 0);

      var statusClass = isEval
        ? (p.compliance >= 90 ? "status-success" : (p.compliance >= 75 ? "status-warning" : "status-danger"))
        : "status-unevaluated";

      html += '<div class="c360-gap-chapter-card ' + statusClass + (isPrimaryGap ? ' is-primary-gap' : '') + '" data-action="open-chapter" data-chapter="' + chId + '">';
      
      html += '<div class="c360-gcc-head">';
      html += '<span class="c360-gcc-num">Cap ' + chId + ' (' + p.maxPoints + '%)</span>';
      if (isPrimaryGap) {
        html += '<span class="c360-gcc-gap-badge" title="Capítulo con la mayor pérdida de puntos en el protocolo">▲ Principal Brecha (-' + lostPts.toFixed(1) + ' pts)</span>';
      } else if (!isEval) {
        html += '<span class="c360-gcc-uneval-badge">⚠️ No Evaluado</span>';
      }
      html += '</div>';

      html += '<h4 class="c360-gcc-title">' + info.icon + ' ' + escapeHtml(info.short) + '</h4>';

      html += '<div class="c360-gcc-score-row">';
      if (isEval) {
        html += '<div class="c360-gcc-score tabular-nums">' + p.pointsEarned.toFixed(1) + ' <small>/ ' + p.maxPoints + ' pts</small></div>';
        html += '<div class="c360-gcc-pct tabular-nums ' + (p.compliance >= 90 ? 'text-success' : (p.compliance >= 75 ? 'text-warning' : 'text-danger')) + '">' + p.compliance.toFixed(1) + '%</div>';
      } else {
        html += '<div class="c360-gcc-score text-muted">0.0 <small>/ ' + p.maxPoints + ' pts</small></div>';
        html += '<div class="c360-gcc-pct text-muted">Sin evaluar</div>';
      }
      html += '</div>';

      // Mini progress bar
      html += '<div class="c360-gcc-progress-track">';
      html += '<div class="c360-gcc-progress-fill ' + statusClass + '" style="width: ' + (isEval ? p.compliance : 0) + '%;"></div>';
      html += '</div>';

      html += '<div class="c360-gcc-meta-row">';
      if (isEval) {
        html += '<span>' + p.findings + ' hallazgo' + (p.findings === 1 ? '' : 's') + '</span>';
        html += '<span class="c360-gcc-link">Ver detalle →</span>';
      } else {
        html += '<span class="text-muted">0/' + info.criteriaCount + ' evaluados</span>';
        html += '<span class="c360-gcc-link">Protocolo →</span>';
      }
      html += '</div>';

      html += '</div>';
    });
    html += '</div>';

    html += '</section>';
    return html;
  }

  function renderQuickInterventionZone(intel, vm) {
    var rvm = vm.riskMatrixVm;
    var findings = rvm && Array.isArray(rvm.findingsList) ? rvm.findingsList : [];
    var topFindings = findings.slice(0, 5);
    var hasAudits = vm.hasAudits;

    var html = '<section class="c360-quick-intervention-section" aria-label="Zona de Intervención Rápida">';

    html += '<div class="c360-qi-header">';
    html += '<div class="c360-qi-title-group">';
    html += '<span class="c360-card-eyebrow">INTERVENCIÓN RÁPIDA &amp; PLAN DE ACCIÓN</span>';
    html += '<h3 class="c360-qi-title">Top Desviaciones Críticas a Atender</h3>';
    html += '<p class="c360-qi-desc">Conexión directa entre el problema de campo observado, severidad, acción técnica requerida y evidencia documental.</p>';
    html += '</div>';
    if (topFindings.length > 0) {
      html += '<div class="c360-qi-count-badge tabular-nums">Mostrando ' + topFindings.length + ' de ' + findings.length + ' desviaciones</div>';
    }
    html += '</div>';

    if (topFindings.length > 0) {
      html += '<div class="c360-qi-list">';
      topFindings.forEach(function (f, idx) {
        var pInfo = f.priorityTier || f.priorityInfo || {};
        var sevLabel = f.severityLabel || (f.severityInfo && f.severityInfo.label) || f.severityKey || 'Sin clasificar';
        var critLabel = f.criterionId ? 'Criterio ' + f.criterionId : 'Hallazgo General';
        var chapName = f.chapterTitle || f.chapterName || (f.chapter ? 'Capítulo ' + f.chapter : '');
        var problemDesc = f.observation || f.problemText || f.criterionText || f.findingName || 'Desviación detectada';
        var farmName = f.farm || f.farmName || 'Sin finca';
        var lotName = f.lot || f.lotName || '';
        var dateStr = f.date || f.formattedDate || 'Sin fecha';
        var responsible = f.reviewer || f.responsible || 'Responsable de MIPE';

        html += '<div class="c360-qi-item sev-' + f.severityKey + '">';
        
        // Col 1: Priority & Severity
        html += '<div class="c360-qi-prio-col">';
        html += '<div class="c360-qi-prio-badge ' + (pInfo.badgeClass || '') + '">#' + (idx + 1) + ' · ' + escapeHtml(pInfo.label || 'Prioridad') + '</div>';
        html += '<div class="c360-qi-sev-text sev-' + f.severityKey + '">' + escapeHtml(sevLabel) + '</div>';
        html += '</div>';

        // Col 2: Problem & Context
        html += '<div class="c360-qi-problem-col">';
        html += '<div class="c360-qi-crit-head">';
        html += '<strong>' + escapeHtml(critLabel) + '</strong>';
        if (chapName) {
          html += ' <span class="c360-qi-chap-tag">(' + escapeHtml(chapName) + ')</span>';
        }
        html += '</div>';
        html += '<div class="c360-qi-problem-text">' + escapeHtml(f.criterionText || problemDesc) + '</div>';
        if (f.observation && f.observation !== f.criterionText) {
          html += '<div class="c360-qi-obs-quote">"' + escapeHtml(f.observation) + '"</div>';
        }
        html += '<div class="c360-qi-context-meta">';
        html += '<span>📍 ' + escapeHtml(farmName) + (lotName ? ' · Lote ' + escapeHtml(lotName) : '') + '</span>';
        html += '<span class="c360-sat-sep" aria-hidden="true">·</span>';
        html += '<span class="tabular-nums">📅 ' + escapeHtml(dateStr) + '</span>';
        html += '</div>';
        html += '</div>';

        // Col 3: Action & Responsible
        html += '<div class="c360-qi-action-col">';
        html += '<div class="c360-qi-act-kicker">ACCIÓN REQUERIDA:</div>';
        html += '<div class="c360-qi-act-text">' + escapeHtml(f.actionText || 'Definir plan correctivo con el responsable de área') + '</div>';
        html += '<div class="c360-qi-act-meta">';
        html += '<span>👤 ' + escapeHtml(responsible) + '</span>';
        html += '</div>';
        html += '</div>';

        // Col 4: Direct Evidence Button
        html += '<div class="c360-qi-evidence-col">';
        var photoCount = Array.isArray(f.photos) ? f.photos.length : 0;
        if (f.hasEvidence) {
          html += '<button type="button" class="c360-btn-qi-evidence" data-action="open-risk-detail" data-finding-id="' + escapeHtml(f.id) + '" title="Ver evidencia fotográfica y trazabilidad">';
          html += '📸 Ver Evidencia' + (photoCount > 0 ? ' (' + photoCount + ')' : '');
          html += '</button>';
        } else {
          html += '<button type="button" class="c360-btn-qi-evidence is-doc" data-action="open-risk-detail" data-finding-id="' + escapeHtml(f.id) + '" title="Ver ficha técnica del hallazgo">';
          html += '🔍 Ver Detalle';
          html += '</button>';
        }
        html += '</div>';

        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="c360-empty-risks-state">';
      html += '<div class="c360-empty-icon">✓</div>';
      if (!hasAudits) {
        html += '<div class="c360-empty-title">No hay información suficiente para establecer una prioridad</div>';
        html += '<div class="c360-empty-desc">Registre o seleccione auditorías con datos para visualizar el plan de intervención.</div>';
      } else {
        html += '<div class="c360-empty-title">Cero no conformidades activas en el periodo</div>';
        html += '<div class="c360-empty-desc">Todos los criterios evaluados cumplen satisfactoriamente el protocolo MIPE oficial.</div>';
      }
      html += '</div>';
    }

    // Bottom Navigation Shortcuts
    html += '<div class="c360-qi-footer-nav">';
    html += '<span class="c360-qi-footer-kicker">HERRAMIENTAS DE PROFUNDIDAD:</span>';
    html += '<button type="button" class="c360-btn-qi-nav" data-action="nav-tab" data-tab="chapters">📋 Ver los 37 Criterios</button>';
    html += '<button type="button" class="c360-btn-qi-nav" data-action="nav-tab" data-tab="benchmark">📈 Benchmark Comparativo</button>';
    html += '<button type="button" class="c360-btn-qi-nav" data-action="nav-tab" data-tab="risks">⚠️ Matriz 2D Completa</button>';
    html += '</div>';

    html += '</section>';
    return html;
  }

  function renderOverviewTab(intel, vm) {
    var html = '<div class="c360-overview-view c360-command-center">';
    html += renderMipeCommandCanvas(vm);
    html += renderChapterGapAnalyzer(intel);
    html += renderQuickInterventionZone(intel, vm);
    html += '</div>';
    return html;
  }

  return {
    renderOverviewTab: renderOverviewTab,
    renderMipeCommandCanvas: renderMipeCommandCanvas,
    renderChapterGapAnalyzer: renderChapterGapAnalyzer,
    renderQuickInterventionZone: renderQuickInterventionZone,
    renderCircularGauge: renderCircularGauge,
    renderTimelineSparkline: renderTimelineSparkline
  };
});
