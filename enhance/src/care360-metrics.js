/**
 * Tablero de métricas CARE 360 — vista simple por finca / todas las fincas,
 * con capítulos y subcapítulos (criterios).
 */
(function () {
  "use strict";

  var ROOT_ID = "c360-metrics-board";
  var CHAPTER_TITLES = {
    1: "Almacén de insumos",
    2: "Medición y dosificación",
    3: "Transporte interno",
    4: "Preparación de mezclas",
    5: "Aplicación de PPC",
  };

  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function q(sel, root) {
    return (root || document).querySelector(sel);
  }

  function onMetricsTab() {
    var tab = qa('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]').find(function (el) {
      return /Métricas/i.test(el.textContent || "");
    });
    if (!tab) return false;
    return (
      tab.getAttribute("aria-selected") === "true" ||
      tab.getAttribute("data-state") === "active" ||
      tab.classList.contains("active") ||
      !!tab.hasAttribute("data-active")
    );
  }

  function scoreStatus(score) {
    if (score === null || score === undefined || isNaN(score)) return "pending";
    if (score >= 80) return "healthy";
    if (score >= 50) return "acceptable";
    return "critical";
  }

  function statusLabel(status) {
    return (
      {
        healthy: "Saludable",
        acceptable: "Aceptable",
        critical: "Crítico",
        pending: "Sin medición",
      }[status] || status
    );
  }

  function normFarm(name) {
    return String(name || "")
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function visitUsable(v) {
    return !!(v && v.reviewed && (!v.serviceKind || v.serviceKind === "assurance"));
  }

  function answerValue(ans) {
    if (ans == null || ans === "") return "";
    var raw = typeof ans === "object" ? ans.value : ans;
    var t = String(raw == null ? "" : raw)
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!t) return "";
    if (t === "si" || t === "si cumple" || t === "cumple" || t === "yes" || t === "s") return "SI";
    if (t === "no" || t === "no cumple" || t === "incumple" || t === "n") return "NO";
    if (t === "na" || t === "n/a" || t === "no aplica" || t === "sin evaluar") return "NA";
    var up = String(raw).trim().toUpperCase();
    if (up === "SI" || up === "NO" || up === "NA") return up;
    return up;
  }

  function appBrandName() {
    return window.__C360_DEBRAND === true ? "CARE 360" : "AVGUST CARE 360";
  }

  function chapterScore(answers, chapterId, catalog) {
    var items = (catalog[chapterId] || []).filter(function (id) {
      return answers && answers[id];
    });
    var applicable = 0;
    var findings = 0;
    items.forEach(function (id) {
      var val = answerValue(answers[id]);
      if (val === "SI" || val === "NO") {
        applicable += 1;
        if (val === "NO") findings += 1;
      }
    });
    if (!applicable) return { applicable: 0, findings: 0, score: null };
    return {
      applicable: applicable,
      findings: findings,
      score: Math.round(((applicable - findings) / applicable) * 100),
    };
  }

  function buildCatalog(visits) {
    var catalog = {};
    visits.forEach(function (v) {
      Object.keys(v.answers || {}).forEach(function (id) {
        var ch = Number(String(id).split(".")[0]);
        if (!catalog[ch]) catalog[ch] = [];
        if (catalog[ch].indexOf(id) === -1) catalog[ch].push(id);
      });
    });
    Object.keys(catalog).forEach(function (ch) {
      catalog[ch].sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true });
      });
    });
    return catalog;
  }

  function aggregateAll(visits) {
    var byFarm = {};
    var byChapter = {};
    var byItem = {};
    visits.forEach(function (v) {
      if (!visitUsable(v)) return;
      var key = normFarm(v.farm);
      if (!byFarm[key]) {
        byFarm[key] = { name: v.farm, visits: [], applicable: 0, findings: 0 };
      }
      byFarm[key].visits.push(v);
      Object.keys(v.answers || {}).forEach(function (id) {
        var val = answerValue(v.answers[id]);
        if (val !== "SI" && val !== "NO") return;
        var ch = Number(String(id).split(".")[0]);
        if (!byChapter[ch]) byChapter[ch] = { id: ch, applicable: 0, findings: 0, farms: {} };
        byChapter[ch].applicable += 1;
        if (val === "NO") byChapter[ch].findings += 1;
        byChapter[ch].farms[key] = true;
        if (!byItem[id]) {
          byItem[id] = {
            id: id,
            chapter: ch,
            applicable: 0,
            findings: 0,
            text: (v.answers[id] && v.answers[id].text) || "",
          };
        }
        byItem[id].applicable += 1;
        if (val === "NO") byItem[id].findings += 1;
      });
    });

    var farms = Object.keys(byFarm)
      .map(function (key) {
        var f = byFarm[key];
        var applicable = 0;
        var findings = 0;
        f.visits.forEach(function (v) {
          Object.keys(v.answers || {}).forEach(function (id) {
            var val = answerValue(v.answers[id]);
            if (val === "SI" || val === "NO") {
              applicable += 1;
              if (val === "NO") findings += 1;
            }
          });
        });
        var score = applicable ? Math.round(((applicable - findings) / applicable) * 100) : null;
        var sortedDates = f.visits
          .map(function (v) {
            return v.date;
          })
          .filter(Boolean)
          .sort();
        return {
          name: f.name,
          visits: f.visits.length,
          applicable: applicable,
          findings: findings,
          score: score,
          status: scoreStatus(score),
          years: uniqueYears(f.visits),
          firstDate: sortedDates[0] || "",
          lastDate: sortedDates[sortedDates.length - 1] || "",
        };
      })
      .sort(function (a, b) {
        return (b.score || -1) - (a.score || -1);
      });

    var chapters = Object.keys(byChapter)
      .map(Number)
      .sort()
      .map(function (id) {
        var c = byChapter[id];
        var score = c.applicable ? Math.round(((c.applicable - c.findings) / c.applicable) * 100) : null;
        return {
          id: id,
          title: CHAPTER_TITLES[id] || "Capítulo " + id,
          applicable: c.applicable,
          findings: c.findings,
          score: score,
          status: scoreStatus(score),
          farms: Object.keys(c.farms).length,
        };
      });

    var items = Object.keys(byItem)
      .map(function (id) {
        var it = byItem[id];
        return {
          id: it.id,
          chapter: it.chapter,
          chapterTitle: CHAPTER_TITLES[it.chapter] || String(it.chapter),
          applicable: it.applicable,
          findings: it.findings,
          rate: it.applicable ? Math.round((it.findings / it.applicable) * 100) : 0,
        };
      })
      .filter(function (it) {
        return it.findings > 0;
      })
      .sort(function (a, b) {
        return b.findings - a.findings || b.rate - a.rate;
      });

    var totalApp = chapters.reduce(function (n, c) {
      return n + c.applicable;
    }, 0);
    var totalFind = chapters.reduce(function (n, c) {
      return n + c.findings;
    }, 0);

    return {
      farms: farms,
      chapters: chapters,
      items: items,
      score: totalApp ? Math.round(((totalApp - totalFind) / totalApp) * 100) : null,
      findings: totalFind,
      applicable: totalApp,
      visits: visits.filter(visitUsable).length,
      timeline: buildGlobalTimeline(visits.filter(visitUsable)),
      firstDate: farms.length
        ? farms
            .map(function (f) {
              return f.firstDate;
            })
            .filter(Boolean)
            .sort()[0]
        : "",
      lastDate: farms.length
        ? farms
            .map(function (f) {
              return f.lastDate;
            })
            .filter(Boolean)
            .sort()
            .slice(-1)[0]
        : "",
    };
  }

  var MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function buildGlobalTimeline(visits) {
    var byDate = {};
    visits.forEach(function (v) {
      if (!v.date) return;
      if (!byDate[v.date]) byDate[v.date] = [];
      byDate[v.date].push(v);
    });
    var daily = Object.keys(byDate)
      .sort()
      .map(function (date) {
        var list = byDate[date];
        var app = 0;
        var find = 0;
        list.forEach(function (v) {
          var st = visitScore(v);
          app += st.applicable;
          find += st.findings;
        });
        var score = app ? Math.round(((app - find) / app) * 100) : null;
        return {
          date: date,
          label: formatDateEs(date),
          shortLabel: formatDateShort(date),
          score: score,
          findings: find,
          visits: list.length,
          status: scoreStatus(score),
          visitRefs: list.map(function (v) {
            return {
              id: v.id || "",
              farm: v.farm || "",
              date: v.date || date,
              responsible: v.responsible || v.technician || "",
              score: visitScore(v).score,
              findings: visitScore(v).findings,
            };
          }),
        };
      });
    return bucketTimeline(daily);
  }

  function bucketTimeline(rows) {
    if (!rows || rows.length <= 10) return rows || [];
    var byMonth = {};
    rows.forEach(function (r) {
      var key = String(r.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) {
        key = r.date || "sin-fecha";
      }
      if (!byMonth[key]) {
        byMonth[key] = { date: key + "-01", scores: [], findings: 0, visits: 0, visitRefs: [] };
      }
      if (r.score != null) byMonth[key].scores.push(r.score);
      byMonth[key].findings += r.findings || 0;
      byMonth[key].visits += r.visits || 1;
      if (r.visitRefs && r.visitRefs.length) {
        byMonth[key].visitRefs = byMonth[key].visitRefs.concat(r.visitRefs);
      } else if (r.farm || r.id) {
        byMonth[key].visitRefs.push({
          id: r.id || "",
          farm: r.farm || "",
          date: r.date,
          responsible: r.responsible || "",
          score: r.score,
          findings: r.findings || 0,
        });
      }
    });
    return Object.keys(byMonth)
      .sort()
      .map(function (key) {
        var b = byMonth[key];
        var score = b.scores.length
          ? Math.round(
              b.scores.reduce(function (n, s) {
                return n + s;
              }, 0) / b.scores.length
            )
          : null;
        var m = key.match(/^(\d{4})-(\d{2})$/);
        var shortLabel = m ? MONTHS_ES[Number(m[2]) - 1] : key;
        var label = m ? MONTHS_ES[Number(m[2]) - 1] + " " + m[1] : key;
        return {
          date: b.date,
          monthKey: key,
          label: label,
          shortLabel: shortLabel,
          score: score,
          findings: b.findings,
          visits: b.visits,
          status: scoreStatus(score),
          visitRefs: b.visitRefs,
        };
      });
  }

  function formatDateShort(iso) {
    var s = String(iso || "").trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s || "—";
    return m[3] + " " + MONTHS_ES[Number(m[2]) - 1];
  }

  function timelineTrend(rows) {
    var scored = (rows || []).filter(function (r) {
      return r && r.score != null;
    });
    if (scored.length < 2) return null;
    var last = scored[scored.length - 1].score;
    var prev = scored[scored.length - 2].score;
    return last - prev;
  }

  var META_TARGET = 80;

  function chapterKpi(chapters, id) {
    var ch = null;
    (chapters || []).forEach(function (c) {
      if (c.id === id) ch = c;
    });
    if (!ch || ch.score == null) return { value: "—", tone: "pending", score: null };
    return { value: ch.score + "%", tone: scoreStatus(ch.score), score: ch.score };
  }

  function vsMetaPts(score) {
    if (score == null || isNaN(score)) return null;
    return score - META_TARGET;
  }

  function formatSignedPts(delta) {
    if (delta == null || isNaN(delta)) return "";
    return (delta > 0 ? "+" : "") + delta + " pts";
  }

  function deltaToneClass(delta, invert) {
    if (delta == null || isNaN(delta) || delta === 0) return "flat";
    if (invert) return delta > 0 ? "down" : "up";
    return delta > 0 ? "up" : "down";
  }

  function applyRangePreset(preset) {
    state.range = preset || "all";
    if (preset === "all" || !preset) {
      state.dateFrom = "";
      state.dateTo = "";
      return;
    }
    var end = new Date();
    var start = new Date();
    if (preset === "30d") start.setDate(end.getDate() - 30);
    else if (preset === "90d") start.setDate(end.getDate() - 90);
    else if (preset === "365d") start.setFullYear(end.getFullYear() - 1);
    else if (preset === "ytd") start = new Date(end.getFullYear(), 0, 1);
    function iso(d) {
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    }
    state.dateFrom = iso(start);
    state.dateTo = iso(end);
  }

  function filterUsableByRange(visits) {
    return visits.filter(function (v) {
      if (!visitUsable(v)) return false;
      return inDateRange(v.date, state.dateFrom, state.dateTo);
    });
  }

  function isoDate(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function parseIsoDate(s) {
    var m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function currentWindow() {
    var from = state.dateFrom;
    var to = state.dateTo;
    if (from && to) return { from: from, to: to };
    var end = new Date();
    var start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    return { from: isoDate(start), to: isoDate(end) };
  }

  function previousWindow(win) {
    var from = parseIsoDate(win.from);
    var to = parseIsoDate(win.to);
    if (!from || !to) return null;
    var ms = to.getTime() - from.getTime();
    if (ms < 24 * 60 * 60 * 1000) ms = 30 * 24 * 60 * 60 * 1000;
    var prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    var prevFrom = new Date(prevTo.getTime() - ms);
    return { from: isoDate(prevFrom), to: isoDate(prevTo) };
  }

  function filterByWindow(visits, win, farmName) {
    return (visits || []).filter(function (v) {
      if (!visitUsable(v)) return false;
      if (farmName && normFarm(v.farm) !== normFarm(farmName)) return false;
      return inDateRange(v.date, win.from, win.to);
    });
  }

  function deltaPts(curr, prev) {
    if (curr == null || prev == null || isNaN(curr) || isNaN(prev)) return null;
    return curr - prev;
  }

  function buildCompare(currScore, prevScore, currFindings, prevFindings, currVisits, prevVisits, win, prevWin) {
    return {
      enabled: !!state.compare,
      win: win,
      prevWin: prevWin,
      score: currScore,
      prevScore: prevScore,
      scoreDelta: deltaPts(currScore, prevScore),
      findings: currFindings,
      prevFindings: prevFindings,
      findingsDelta: currFindings - (prevFindings || 0),
      visits: currVisits,
      prevVisits: prevVisits,
      visitsDelta: currVisits - (prevVisits || 0),
    };
  }

  function renderCompareStrip(cmp) {
    if (!cmp || !cmp.enabled || !cmp.prevWin) return "";
    function chip(label, curr, prev, delta, suffix) {
      suffix = suffix || "";
      var cls = "flat";
      var sign = "";
      if (delta != null && !isNaN(delta)) {
        if (label === "Hallazgos") cls = delta > 0 ? "down" : delta < 0 ? "up" : "flat";
        else cls = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
        sign = delta > 0 ? "+" : "";
      }
      return (
        '<div class="c360-compare-chip"><span>' +
        escapeHtml(label) +
        '</span><strong>' +
        escapeHtml(String(curr == null ? "—" : curr + suffix)) +
        '</strong><em class="' +
        cls +
        '">' +
        (delta == null || isNaN(delta) ? "—" : sign + delta + (suffix === "%" ? " pts" : "")) +
        "</em></div>"
      );
    }
    var html = '<div class="c360-compare-strip" aria-label="Comparación de periodos">';
    html +=
      '<p class="c360-compare-strip-label">vs ' +
      escapeHtml(formatDateEs(cmp.prevWin.from)) +
      "–" +
      escapeHtml(formatDateEs(cmp.prevWin.to)) +
      "</p>";
    html += '<div class="c360-compare-chips">';
    html += chip("Indicador", cmp.score, cmp.prevScore, cmp.scoreDelta, "%");
    html += chip("Hallazgos", cmp.findings, cmp.prevFindings, cmp.findingsDelta, "");
    html += chip("Visitas", cmp.visits, cmp.prevVisits, cmp.visitsDelta, "");
    html += "</div></div>";
    return html;
  }

  function fileBridge() {
    var b = globalThis.AvgustFileBridge;
    return b && typeof b.begin === "function" ? b : null;
  }

  function bytesToBase64(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 8192) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(out);
  }

  async function saveBlobNative(blob, filename) {
    var bridge = fileBridge();
    if (!bridge) return false;
    var buf = new Uint8Array(await blob.arrayBuffer());
    var id = bridge.begin(filename, blob.type || "application/octet-stream");
    if (!id) throw new Error("El teléfono no pudo preparar el archivo. Libera espacio e inténtalo de nuevo.");
    var chunk = 180 * 1024;
    for (var i = 0; i < buf.length; i += chunk) {
      if (!bridge.append(id, bytesToBase64(buf.subarray(i, i + chunk)))) {
        try {
          bridge.abort(id);
        } catch (e) {}
        throw new Error("No se pudo escribir el archivo en el teléfono.");
      }
    }
    if (!bridge.finish(id)) {
      throw new Error("No se pudo abrir el menú para guardar o compartir el archivo.");
    }
    return true;
  }

  async function shareBlobIfPossible(blob, filename) {
    if (!navigator.share || !navigator.canShare) return false;
    try {
      var file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (!navigator.canShare({ files: [file] })) return false;
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err && (err.name === "AbortError" || /abort/i.test(String(err)))) return true;
      return false;
    }
  }

  function downloadBlobAnchor(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 2000);
  }

  async function saveOrDownloadBlob(blob, filename) {
    if (await saveBlobNative(blob, filename)) {
      return { via: "bridge" };
    }
    if (await shareBlobIfPossible(blob, filename)) {
      return { via: "share" };
    }
    downloadBlobAnchor(blob, filename);
    return { via: "download" };
  }

  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportStampName(ext) {
    var stamp = isoDate(new Date());
    var prefix = window.__C360_DEBRAND === true ? "CARE360" : "AVGUST-CARE360";
    return (
      prefix +
      "-metricas-" +
      (state.mode === "farm" ? normFarm(state.farm).replace(/\s+/g, "-") + "-" : "todas-") +
      stamp +
      ext
    );
  }

  function exportSnapshot() {
    var data = state._viewData;
    if (!data) return null;
    var mix = chapterKpi(data.chapters || [], 4);
    var dose = chapterKpi(data.chapters || [], 2);
    var alerts =
      state.mode === "farm" ? buildAlerts(null, data) : buildAlerts(data, null);
    var score =
      state.mode === "farm"
        ? data.timeline && data.timeline.length
          ? data.timeline[data.timeline.length - 1].score
          : null
        : data.score;
    return {
      data: data,
      cmp: state._compare,
      mix: mix,
      dose: dose,
      alerts: alerts || [],
      score: score,
      brand: appBrandName(),
      modeLabel: state.mode === "farm" ? "Por finca · " + (state.farm || "") : "Todas las fincas",
      periodFrom: formatDateEs(state.dateFrom) || "Todo",
      periodTo: formatDateEs(state.dateTo) || "Todo",
      chaptersNote:
        state.mode === "farm"
          ? "Capítulos de la última visita" +
            (data.lastDate ? " (" + formatDateEs(data.lastDate) + ")" : "")
          : "Capítulos del periodo (todas las visitas)",
      findingsNote:
        state.mode === "farm"
          ? "No cumple de la última visita (el KPI de hallazgos suma todo el periodo)"
          : "Criterios con más hallazgos en el periodo",
    };
  }

  function fmtDelta(delta, suffix) {
    if (delta == null || isNaN(delta)) return "—";
    return (delta > 0 ? "+" : "") + delta + (suffix || "");
  }

  async function exportBoardCsv() {
    var snap = exportSnapshot();
    if (!snap) {
      setNotice("No hay datos para exportar.", true);
      render();
      return;
    }
    try {
      var data = snap.data;
      var cmp = snap.cmp;
      var lines = [];
      lines.push(snap.brand + " · Informe completo de métricas");
      lines.push("Modo," + csvEscape(snap.modeLabel));
      lines.push("Periodo," + csvEscape(snap.periodFrom) + "," + csvEscape(snap.periodTo));
      lines.push(
        "KPIs,Indicador %,Mezclas %,Dosis %,Hallazgos periodo,Visitas"
      );
      lines.push(
        [
          "",
          snap.score == null ? "" : snap.score,
          snap.mix.score == null ? "" : snap.mix.score,
          snap.dose.score == null ? "" : snap.dose.score,
          data.findings || 0,
          data.visits || 0,
        ]
          .map(csvEscape)
          .join(",")
      );
      if (cmp && cmp.enabled && cmp.prevWin) {
        lines.push(
          "Periodo anterior," +
            csvEscape(formatDateEs(cmp.prevWin.from)) +
            "," +
            csvEscape(formatDateEs(cmp.prevWin.to))
        );
        lines.push(
          "Comparación,Indicador actual,Indicador anterior,Delta pts,Hallazgos actual,Hallazgos anterior,Visitas actual,Visitas anterior"
        );
        lines.push(
          [
            "",
            cmp.score,
            cmp.prevScore,
            cmp.scoreDelta,
            cmp.findings,
            cmp.prevFindings,
            cmp.visits,
            cmp.prevVisits,
          ]
            .map(csvEscape)
            .join(",")
        );
      }
      if (snap.alerts.length) {
        lines.push("");
        lines.push("Qué atender");
        lines.push("Prioridad,Título,Detalle,Finca,Capítulo");
        snap.alerts.forEach(function (a) {
          lines.push(
            [a.tone || "", a.title || "", a.text || "", a.farm || "", a.chapter || ""]
              .map(csvEscape)
              .join(",")
          );
        });
      }
      lines.push("");
      if (data.farms && data.farms.length) {
        lines.push("Resumen por finca");
        lines.push("Finca,Visitas,Indicador %,Hallazgos,Estado,Primera visita,Última visita");
        data.farms.forEach(function (f) {
          lines.push(
            [
              f.name,
              f.visits,
              f.score,
              f.findings,
              statusLabel(f.status),
              formatDateEs(f.firstDate),
              formatDateEs(f.lastDate),
            ]
              .map(csvEscape)
              .join(",")
          );
        });
        lines.push("");
      }
      if (data.timeline && data.timeline.length) {
        lines.push(state.mode === "farm" ? "Visitas por fecha" : "Evolución / visitas");
        lines.push("Fecha,Indicador %,Hallazgos,Estado,Responsable,Finca");
        data.timeline.forEach(function (r) {
          lines.push(
            [
              formatDateEs(r.date) || r.label,
              r.score,
              r.findings,
              statusLabel(r.status),
              r.responsible || "",
              r.farm || state.farm || "",
            ]
              .map(csvEscape)
              .join(",")
          );
        });
        lines.push("");
      }
      if (data.chapters && data.chapters.length) {
        lines.push(snap.chaptersNote);
        lines.push("Capítulo,Título,Indicador %,Hallazgos,Aplicables,Estado");
        data.chapters.forEach(function (c) {
          lines.push(
            [c.id, c.title, c.score, c.findings, c.applicable, statusLabel(c.status)]
              .map(csvEscape)
              .join(",")
          );
        });
        lines.push("");
      }
      if (data.items && data.items.length) {
        lines.push(snap.findingsNote);
        lines.push("Ítem,Capítulo,Hallazgos,Frecuencia %,Observación,Recomendación");
        data.items.forEach(function (it) {
          lines.push(
            [
              it.id,
              it.chapterTitle || CHAPTER_TITLES[it.chapter] || it.chapter || "",
              it.findings != null ? it.findings : 1,
              it.rate != null ? it.rate : "",
              it.observation || "",
              it.recommendation || "",
            ]
              .map(csvEscape)
              .join(",")
          );
        });
      }
      var name = exportStampName(".csv");
      var blob = new Blob(["\ufeff" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      });
      var result = await saveOrDownloadBlob(blob, name);
      if (result.via === "bridge") {
        setNotice("Excel listo: usa Guardar / Compartir para " + name, false);
      } else if (result.via === "share") {
        setNotice("Excel compartido: " + name, false);
      } else {
        setNotice("Excel/CSV descargado: " + name, false);
      }
    } catch (err) {
      setNotice(err && err.message ? err.message : "No se pudo exportar Excel.", true);
    }
    render();
  }

  function buildExportReportHtml() {
    var snap = exportSnapshot();
    if (!snap) return "";
    var data = snap.data;
    var cmp = snap.cmp;
    var title = snap.brand + " · Informe de métricas · " + snap.modeLabel;
    var body = "";
    body += "<header class='brand'>";
    body += "<div class='mark'>" + escapeHtml(snap.brand) + "</div>";
    body += "<div><h1>" + escapeHtml("Informe de métricas · " + snap.modeLabel) + "</h1>";
    body +=
      "<p class='meta'>Periodo: " +
      escapeHtml(snap.periodFrom) +
      " → " +
      escapeHtml(snap.periodTo) +
      "</p>";
    if (cmp && cmp.enabled && cmp.prevWin) {
      body +=
        "<p class='meta'>Comparado con: " +
        escapeHtml(formatDateEs(cmp.prevWin.from)) +
        " → " +
        escapeHtml(formatDateEs(cmp.prevWin.to)) +
        "</p>";
    }
    body += "</div></header>";

    body += "<div class='kpis'>";
    body +=
      "<div><b>Indicador</b><br>" +
      (snap.score == null ? "—" : snap.score + "%") +
      (cmp && cmp.enabled
        ? " <small>(" + fmtDelta(cmp.scoreDelta, " pts") + ")</small>"
        : "") +
      "</div>";
    body +=
      "<div><b>Mezclas</b><br>" +
      (snap.mix.score == null ? "—" : snap.mix.score + "%") +
      "</div>";
    body +=
      "<div><b>Dosis</b><br>" +
      (snap.dose.score == null ? "—" : snap.dose.score + "%") +
      "</div>";
    body +=
      "<div><b>Hallazgos periodo</b><br>" +
      (data.findings || 0) +
      (cmp && cmp.enabled
        ? " <small>(" + fmtDelta(cmp.findingsDelta, "") + ")</small>"
        : "") +
      "</div>";
    body +=
      "<div><b>Visitas</b><br>" +
      (data.visits || 0) +
      (cmp && cmp.enabled ? " <small>(" + fmtDelta(cmp.visitsDelta, "") + ")</small>" : "") +
      "</div>";
    body += "</div>";

    function table(headers, rows) {
      var h =
        "<table><thead><tr>" +
        headers
          .map(function (x) {
            return "<th>" + escapeHtml(x) + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>";
      rows.forEach(function (r) {
        h +=
          "<tr>" +
          r
            .map(function (c) {
              return "<td>" + escapeHtml(String(c == null ? "" : c)) + "</td>";
            })
            .join("") +
          "</tr>";
      });
      return h + "</tbody></table>";
    }

    if (snap.alerts.length) {
      body += "<h2>Qué atender</h2>";
      body += table(
        ["Prioridad", "Alerta", "Detalle"],
        snap.alerts.map(function (a) {
          return [
            a.tone === "critical" ? "Crítico" : a.tone === "healthy" ? "OK" : "Atención",
            a.title || "",
            a.text || "",
          ];
        })
      );
    }

    if (data.farms && data.farms.length) {
      body += "<h2>Resumen por finca</h2>";
      body += table(
        ["Finca", "Visitas", "Indicador", "Hallazgos", "Estado", "Primera", "Última"],
        data.farms.map(function (f) {
          return [
            f.name,
            f.visits,
            f.score == null ? "—" : f.score + "%",
            f.findings,
            statusLabel(f.status),
            formatDateEs(f.firstDate),
            formatDateEs(f.lastDate),
          ];
        })
      );
    }

    if (data.timeline && data.timeline.length) {
      body += "<h2>" + (state.mode === "farm" ? "Visitas por fecha" : "Evolución / visitas") + "</h2>";
      body += table(
        ["Fecha", "Indicador", "Hallazgos", "Estado", "Responsable", "Finca"],
        data.timeline.map(function (r) {
          return [
            r.label || formatDateEs(r.date),
            r.score == null ? "—" : r.score + "%",
            r.findings,
            statusLabel(r.status),
            r.responsible || "—",
            r.farm || state.farm || "—",
          ];
        })
      );
    }

    if (data.chapters && data.chapters.length) {
      body += "<h2>" + escapeHtml(snap.chaptersNote) + "</h2>";
      body += table(
        ["Capítulo", "Indicador", "Hallazgos", "Aplicables", "Estado"],
        data.chapters.map(function (c) {
          return [
            c.id + ". " + c.title,
            c.score == null ? "—" : c.score + "%",
            c.findings,
            c.applicable,
            statusLabel(c.status),
          ];
        })
      );
    }

    if (data.items && data.items.length) {
      body += "<h2>" + escapeHtml(snap.findingsNote) + "</h2>";
      body += table(
        ["Ítem", "Capítulo", "Hallazgos", "Frecuencia", "Observación", "Recomendación"],
        data.items.map(function (it) {
          return [
            it.id,
            it.chapterTitle || CHAPTER_TITLES[it.chapter] || it.chapter || "",
            it.findings != null ? it.findings : 1,
            it.rate != null ? it.rate + "%" : "—",
            it.observation || "—",
            it.recommendation || "—",
          ];
        })
      );
    }

    body +=
      "<p class='meta foot'>Generado " +
      escapeHtml(formatDateEs(isoDate(new Date()))) +
      " · " +
      escapeHtml(snap.brand) +
      " · Métricas completas del tablero</p>";
    return (
      "<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>" +
      escapeHtml(title) +
      "</title><style>" +
      "body{font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1c2b32;padding:24px;max-width:960px;margin:0 auto;}" +
      ".brand{display:flex;gap:16px;align-items:flex-start;margin-bottom:8px;padding-bottom:14px;border-bottom:2px solid #007fa3}" +
      ".brand .mark{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#007fa3;padding-top:4px;white-space:nowrap}" +
      "h1{font-size:20px;margin:0 0 4px;color:#1c2b32}h2{font-size:15px;margin:22px 0 8px;color:#00647f}" +
      ".meta{color:#58696d;font-size:13px;margin:4px 0}" +
      ".foot{margin-top:28px;padding-top:12px;border-top:1px solid #dbe4e8}" +
      ".kpis{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap}" +
      ".kpis>div{border:1px solid #dbe4e8;border-radius:12px;padding:12px 14px;min-width:110px;background:linear-gradient(180deg,#f3fafc,transparent)}" +
      ".kpis b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#58696d;margin-bottom:4px}" +
      "table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}" +
      "th,td{border-bottom:1px solid #dbe4e8;text-align:left;padding:8px 6px;vertical-align:top}" +
      "th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#58696d;background:#f7fbfc}" +
      "@media print{body{padding:12px}.brand{border-color:#007fa3}}" +
      "</style></head><body>" +
      body +
      "</body></html>"
    );
  }

  function printHtmlDocument(html) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(ok, reason) {
        if (done) return;
        done = true;
        resolve({ ok: !!ok, reason: reason || "" });
      }
      window.setTimeout(function () {
        finish(false, "timeout");
      }, 1200);
      try {
        var iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.cssText =
          "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
        document.body.appendChild(iframe);
        var win = iframe.contentWindow;
        var doc = win && win.document;
        if (!doc) {
          iframe.remove();
          finish(false, "iframe");
          return;
        }
        doc.open();
        doc.write(html);
        doc.close();
        var printed = false;
        function doPrint() {
          if (printed) return;
          printed = true;
          finish(true, "iframe");
          window.setTimeout(function () {
            try {
              win.focus();
              win.print();
            } catch (err) {}
            window.setTimeout(function () {
              try {
                iframe.remove();
              } catch (e) {}
            }, 2000);
          }, 60);
        }
        if (doc.readyState === "complete") {
          window.setTimeout(doPrint, 120);
        } else {
          iframe.onload = function () {
            window.setTimeout(doPrint, 120);
          };
          window.setTimeout(doPrint, 600);
        }
      } catch (err) {
        finish(false, String(err && err.message ? err.message : err));
      }
    });
  }

  async function exportBoardPrint() {
    var snap = exportSnapshot();
    if (!snap) {
      setNotice("No hay datos para exportar.", true);
      render();
      return;
    }
    try {
      var html = buildExportReportHtml();
      var name = exportStampName(".html");
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });

      if (fileBridge()) {
        await saveOrDownloadBlob(blob, name);
        setNotice(
          "Informe completo listo (" +
            name +
            "). Ábrelo y usa Imprimir → Guardar como PDF.",
          false
        );
      } else {
        var printResult = await printHtmlDocument(html);
        if (!printResult.ok) {
          var w = window.open("", "_blank", "noopener,noreferrer,width=920,height=720");
          if (w) {
            w.document.open();
            w.document.write(
              html.replace(
                "</body>",
                "<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body>"
              )
            );
            w.document.close();
            setNotice("Informe completo listo para imprimir o guardar como PDF.", false);
          } else {
            await saveOrDownloadBlob(blob, name);
            setNotice(
              "Descarga el informe (" + name + ") y ábrelo para imprimir / Guardar como PDF.",
              false
            );
          }
        } else {
          setNotice("Usa el diálogo de impresión → Guardar como PDF.", false);
        }
      }
    } catch (err) {
      setNotice(err && err.message ? err.message : "No se pudo generar el informe de métricas.", true);
    }
    render();
  }

  function formatDateEs(iso) {
    var s = String(iso || "").trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s || "—";
    return m[3] + "/" + m[2] + "/" + m[1];
  }

  function visitScore(v) {
    var applicable = 0;
    var findings = 0;
    Object.keys(v.answers || {}).forEach(function (id) {
      var val = answerValue(v.answers[id]);
      if (val === "SI" || val === "NO") {
        applicable += 1;
        if (val === "NO") findings += 1;
      }
    });
    if (!applicable) return { applicable: 0, findings: 0, score: null };
    return {
      applicable: applicable,
      findings: findings,
      score: Math.round(((applicable - findings) / applicable) * 100),
    };
  }

  function uniqueYears(visits) {
    var years = {};
    visits.forEach(function (v) {
      if (v.date && v.date.length >= 4) years[v.date.slice(0, 4)] = true;
    });
    return Object.keys(years).sort();
  }

  function inDateRange(date, from, to) {
    var d = String(date || "");
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function aggregateFarm(visits, farmName, dateFrom, dateTo) {
    var filtered = visits.filter(function (v) {
      if (!visitUsable(v)) return false;
      if (normFarm(v.farm) !== normFarm(farmName)) return false;
      return inDateRange(v.date, dateFrom, dateTo);
    });
    filtered.sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    var catalog = buildCatalog(filtered);
    var yearly = {};
    filtered.forEach(function (v) {
      var y = (v.date || "").slice(0, 4);
      if (!yearly[y]) yearly[y] = [];
      yearly[y].push(v);
    });
    var years = Object.keys(yearly)
      .sort()
      .map(function (y) {
        var list = yearly[y];
        var app = 0;
        var find = 0;
        list.forEach(function (v) {
          var st = visitScore(v);
          app += st.applicable;
          find += st.findings;
        });
        var average = app ? Math.round(((app - find) / app) * 100) : null;
        var last = list[list.length - 1];
        var closing = visitScore(last);
        return {
          year: y,
          visits: list.length,
          average: average,
          closing: closing.score,
          status: scoreStatus(average),
          firstDate: list[0].date,
          lastDate: last.date,
        };
      });

    var timeline = filtered.map(function (v) {
      var st = visitScore(v);
      return {
        id: v.id || "",
        farm: v.farm || farmName,
        date: v.date,
        label: formatDateEs(v.date),
        shortLabel: formatDateShort(v.date),
        score: st.score,
        findings: st.findings,
        visits: 1,
        status: scoreStatus(st.score),
        responsible: v.responsible || v.technician || "",
        crop: v.crop || "",
      };
    });

    var last = filtered[filtered.length - 1];
    var chapters = Object.keys(CHAPTER_TITLES)
      .map(Number)
      .map(function (id) {
        var st = last ? chapterScore(last.answers || {}, id, catalog) : { applicable: 0, findings: 0, score: null };
        return {
          id: id,
          title: CHAPTER_TITLES[id],
          applicable: st.applicable,
          findings: st.findings,
          score: st.score,
          status: scoreStatus(st.score),
        };
      })
      .filter(function (c) {
        return c.applicable > 0;
      });

    var items = [];
    if (last) {
      Object.keys(last.answers || {}).forEach(function (id) {
        if (answerValue(last.answers[id]) !== "NO") return;
        items.push({
          id: id,
          chapter: Number(String(id).split(".")[0]),
          observation: last.answers[id].observation || "",
          recommendation: last.answers[id].recommendation || "",
        });
      });
      items.sort(function (a, b) {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });
    }

    var totalFindings = timeline.reduce(function (n, row) {
      return n + (row.findings || 0);
    }, 0);

    return {
      years: years,
      timeline: timeline,
      chartTimeline: bucketTimeline(timeline),
      chapters: chapters,
      items: items,
      visits: filtered.length,
      findings: totalFindings,
      last: last,
      firstDate: filtered[0] && filtered[0].date,
      lastDate: last && last.date,
    };
  }

  function barHtml(pct, tone) {
    var w = Math.max(0, Math.min(100, pct == null ? 0 : pct));
    return (
      '<span class="c360-mbar" title="' +
      (pct == null ? "—" : pct + "%") +
      '"><i class="c360-mbar-fill tone-' +
      (tone || "brand") +
      '" style="width:' +
      w +
      '%"></i></span>'
    );
  }

  function chartLine(rows, compareRows) {
    var points = (rows || []).filter(function (r) {
      return r && r.score != null;
    });
    var compare = (compareRows || []).filter(function (r) {
      return r && r.score != null;
    });
    if (!points.length && !compare.length) {
      return (
        '<div class="c360-linechart c360-linechart-empty">' +
        "<p><strong>Sin datos de indicador</strong></p>" +
        "<p>Cuando haya visitas revisadas en el periodo, verás la tendencia frente a la meta del " +
        META_TARGET +
        "%.</p>" +
        '<div class="c360-linechart-exec" role="list" aria-label="Referencia de evolución">' +
        '<span class="c360-linechart-chip target" role="listitem"><i></i>Meta ' +
        META_TARGET +
        "%</span>" +
        '<span class="c360-linechart-chip muted" role="listitem">Sin puntos aún</span>' +
        "</div></div>"
      );
    }
    var W = 720;
    var H = 340;
    var padL = 36;
    var padR = 24;
    var padT = 42;
    var padB = 48;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    function yAt(pct) {
      return padT + innerH - (Math.max(0, Math.min(100, pct)) / 100) * innerH;
    }
    var metaY = yAt(META_TARGET);
    function toCoords(list) {
      return list.map(function (p, i) {
        var x =
          padL + (list.length === 1 ? innerW / 2 : (i / (list.length - 1)) * innerW);
        return { x: x, y: yAt(p.score), p: p };
      });
    }
    function smoothPath(list) {
      if (!list.length) return "";
      if (list.length === 1) return "M " + list[0].x + " " + list[0].y;
      var d = "M " + list[0].x + " " + list[0].y;
      for (var i = 0; i < list.length - 1; i++) {
        var a = list[i];
        var b = list[i + 1];
        var cx = (a.x + b.x) / 2;
        d += " C " + cx + " " + a.y + ", " + cx + " " + b.y + ", " + b.x + " " + b.y;
      }
      return d;
    }
    function scoreLabel(score) {
      var n = Number(score);
      if (isNaN(n)) return "—";
      return (Math.round(n * 10) / 10).toFixed(n % 1 === 0 ? 0 : 1) + "%";
    }
    var coords = toCoords(points);
    var compareCoords = toCoords(compare);
    var sparse = points.length > 0 && points.length < 3;
    var last = points.length ? points[points.length - 1] : null;
    var prev = points.length > 1 ? points[points.length - 2] : null;
    var stepDelta = last && prev ? deltaPts(last.score, prev.score) : null;
    var lastStatus = last ? scoreStatus(last.score) : "pending";
    var lastVsMeta = last ? vsMetaPts(last.score) : null;

    var exec =
      '<div class="c360-linechart-exec" role="list" aria-label="Resumen de evolución">' +
      '<span class="c360-linechart-chip target" role="listitem"><i></i>Meta ' +
      META_TARGET +
      "%</span>";
    if (last) {
      exec +=
        '<span class="c360-linechart-chip tone-' +
        lastStatus +
        '" role="listitem"><i></i>Último ' +
        scoreLabel(last.score) +
        " · " +
        escapeHtml(statusLabel(lastStatus)) +
        "</span>";
    }
    if (stepDelta != null && !isNaN(stepDelta)) {
      exec +=
        '<span class="c360-linechart-chip delta ' +
        deltaToneClass(stepDelta, false) +
        '" role="listitem">' +
        escapeHtml(formatSignedPts(stepDelta)) +
        " vs visita anterior</span>";
    }
    if (lastVsMeta != null && !isNaN(lastVsMeta)) {
      exec +=
        '<span class="c360-linechart-chip delta ' +
        deltaToneClass(lastVsMeta, false) +
        '" role="listitem">' +
        escapeHtml(formatSignedPts(lastVsMeta)) +
        " vs meta</span>";
    }
    if (compareCoords.length) {
      exec +=
        '<span class="c360-linechart-chip muted" role="listitem"><i class="compare"></i>Gris = periodo anterior</span>';
    }
    exec += "</div>";

    var html =
      '<div class="c360-linechart' +
      (sparse ? " c360-linechart-sparse" : "") +
      (points.length >= 4 ? " c360-linechart-dense" : "") +
      '">' +
      exec +
      '<svg viewBox="0 0 ' +
      W +
      " " +
      H +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolución del indicador vs meta ' +
      META_TARGET +
      '%">';

    // Soft zone bands: crítico <50, aceptable 50–meta, saludable ≥meta
    html +=
      '<rect class="c360-linechart-zone zone-critical" x="' +
      padL +
      '" y="' +
      yAt(50) +
      '" width="' +
      innerW +
      '" height="' +
      (yAt(0) - yAt(50)) +
      '" />';
    html +=
      '<rect class="c360-linechart-zone zone-acceptable" x="' +
      padL +
      '" y="' +
      metaY +
      '" width="' +
      innerW +
      '" height="' +
      (yAt(50) - metaY) +
      '" />';
    html +=
      '<rect class="c360-linechart-zone zone-healthy" x="' +
      padL +
      '" y="' +
      padT +
      '" width="' +
      innerW +
      '" height="' +
      (metaY - padT) +
      '" />';

    for (var g = 0; g <= 4; g++) {
      var gy = padT + (innerH * g) / 4;
      var gPct = 100 - g * 25;
      html +=
        '<line class="c360-linechart-grid" x1="' +
        padL +
        '" y1="' +
        gy +
        '" x2="' +
        (W - padR) +
        '" y2="' +
        gy +
        '" />';
      html +=
        '<text class="c360-linechart-ylabel" x="' +
        (padL - 8) +
        '" y="' +
        (gy + 3) +
        '" text-anchor="end">' +
        gPct +
        "</text>";
    }

    html +=
      '<line class="c360-linechart-meta" x1="' +
      padL +
      '" y1="' +
      metaY +
      '" x2="' +
      (W - padR) +
      '" y2="' +
      metaY +
      '" />';
    // Meta label lives in the HTML chip legend (never clipped by SVG/plot edges)

    if (compareCoords.length) {
      html += '<path class="c360-linechart-path compare" d="' + smoothPath(compareCoords) + '" />';
      compareCoords.forEach(function (c) {
        html +=
          '<circle class="c360-linechart-dot compare" cx="' +
          c.x +
          '" cy="' +
          c.y +
          '" r="3.5" />';
      });
    }
    if (coords.length) {
      var line = smoothPath(coords);
      var area =
        line +
        " L " +
        coords[coords.length - 1].x +
        " " +
        (padT + innerH) +
        " L " +
        coords[0].x +
        " " +
        (padT + innerH) +
        " Z";
      html += '<path class="c360-linechart-area" d="' + area + '" />';
      html += '<path class="c360-linechart-path" d="' + line + '" />';

      var placedLabels = [];
      var xStep = coords.length > 1 ? innerW / (coords.length - 1) : innerW;
      coords.forEach(function (c, idx) {
        var isLast = idx === coords.length - 1;
        var isFirst = idx === 0;
        var aboveMeta = c.y < metaY - 2;
        var nearMeta = Math.abs(c.y - metaY) < 18;
        var preferAbove = true;
        // High scores: keep label above the point (never push into the meta band)
        if (aboveMeta) preferAbove = true;
        // Scores just under meta: put label below the point to clear the meta line
        else if (nearMeta) preferAbove = false;
        // Near floor: keep above
        if (c.y > padT + innerH - 28) preferAbove = true;

        var labelY = preferAbove ? c.y - 16 : c.y + 22;
        // If above would clip the top, nudge sideways rather than into the meta line
        if (preferAbove && labelY < padT + 10) {
          if (aboveMeta || nearMeta) {
            labelY = padT + 12;
          } else {
            preferAbove = false;
            labelY = c.y + 22;
          }
        }
        if (!preferAbove && labelY > padT + innerH - 4) {
          labelY = c.y - 16;
        }
        // Neighbor collision: flip only when both are mid-band (safe room)
        if (idx > 0 && Math.abs(coords[idx - 1].y - c.y) < 22 && !aboveMeta && !nearMeta) {
          preferAbove = !preferAbove;
          labelY = preferAbove ? c.y - 16 : c.y + 22;
        }
        for (var pi = 0; pi < placedLabels.length; pi++) {
          var prevL = placedLabels[pi];
          if (Math.abs(prevL.y - labelY) < 13 && Math.abs(prevL.x - c.x) < xStep * 0.7) {
            if (aboveMeta) labelY = Math.min(labelY, c.y - 16);
            else {
              preferAbove = !preferAbove;
              labelY = preferAbove ? c.y - 16 : c.y + 22;
            }
            break;
          }
        }
        placedLabels.push({ x: c.x, y: labelY });

        var focusDate = escapeHtml(c.p.date || "");
        var focusLabel = escapeHtml(c.p.label || c.p.shortLabel || "");
        var xLabel = c.p.shortLabel || c.p.label || "";
        var xAnchor = "middle";
        var xPos = c.x;
        var valAnchor = "middle";
        var valX = c.x;
        if (coords.length >= 2 && isFirst) {
          xAnchor = "start";
          xPos = Math.max(padL, c.x - 2);
          valAnchor = "start";
          valX = Math.min(W - padR - 4, c.x + 10);
        } else if (coords.length >= 2 && isLast) {
          xAnchor = "end";
          xPos = Math.min(W - padR, c.x + 2);
          valAnchor = "end";
          valX = Math.max(padL + 4, c.x - 8);
        }
        html +=
          '<g class="c360-linechart-hit' +
          (isLast ? " is-last" : "") +
          '" data-focus-date="' +
          focusDate +
          '" data-focus-label="' +
          focusLabel +
          '" data-focus-score="' +
          c.p.score +
          '" tabindex="0" role="button" aria-label="Ver detalle ' +
          focusLabel +
          '">';
        html +=
          '<circle class="c360-linechart-dot' +
          (isLast ? " is-last" : "") +
          '" cx="' +
          c.x +
          '" cy="' +
          c.y +
          '" r="' +
          (isLast ? 8 : 6.5) +
          '" />';
        html +=
          '<circle class="c360-linechart-hitarea" cx="' +
          c.x +
          '" cy="' +
          c.y +
          '" r="18" />';
        html +=
          '<text class="c360-linechart-val' +
          (isLast ? " is-last" : "") +
          '" text-anchor="' +
          valAnchor +
          '" x="' +
          valX +
          '" y="' +
          labelY +
          '">' +
          scoreLabel(c.p.score) +
          "</text>";
        html +=
          '<text class="c360-linechart-xlabel" text-anchor="' +
          xAnchor +
          '" x="' +
          xPos +
          '" y="' +
          (H - 12) +
          '">' +
          escapeHtml(xLabel) +
          "</text></g>";
      });
    }
    html += "</svg>";
    if (sparse) {
      html +=
        '<p class="c360-linechart-sparse-note">Pocas visitas en el periodo · la tendencia se aclara con más aseguramientos.</p>';
    } else if (points.length === 1) {
      html +=
        '<p class="c360-linechart-sparse-note">Una sola visita en el corte · sumá aseguramientos para ver evolución.</p>';
    }
    html += "</div>";
    return html;
  }

  function legendHtml(kind) {
    if (kind === "score") {
      return (
        '<div class="c360-metrics-legend" role="list" aria-label="Leyenda de indicador">' +
        '<span class="c360-leg-item tone-healthy" role="listitem"><i></i>Saludable ≥80%</span>' +
        '<span class="c360-leg-item tone-acceptable" role="listitem"><i></i>Aceptable 50–79%</span>' +
        '<span class="c360-leg-item tone-critical" role="listitem"><i></i>Crítico &lt;50%</span>' +
        '<span class="c360-leg-item target" role="listitem"><i></i>Meta 80%</span>' +
        "</div>"
      );
    }
    if (kind === "findings") {
      return (
        '<div class="c360-metrics-legend" role="list" aria-label="Leyenda de hallazgos">' +
        '<span class="c360-leg-item tone-healthy" role="listitem"><i></i>Sin hallazgos</span>' +
        '<span class="c360-leg-item tone-warn" role="listitem"><i></i>Prioridad media</span>' +
        '<span class="c360-leg-item tone-critical" role="listitem"><i></i>Prioridad alta</span>' +
        '<span class="c360-leg-item hint" role="listitem"><i></i>Barra más larga = más urgente</span>' +
        "</div>"
      );
    }
    if (kind === "status") {
      return (
        '<div class="c360-metrics-legend c360-status-legend" role="list" aria-label="Leyenda de estado">' +
        '<span class="c360-leg-item tone-healthy" role="listitem"><i></i>Saludable</span>' +
        '<span class="c360-leg-item tone-acceptable" role="listitem"><i></i>Aceptable</span>' +
        '<span class="c360-leg-item tone-critical" role="listitem"><i></i>Crítico</span>' +
        '<span class="c360-leg-item tone-pending" role="listitem"><i></i>Sin medición</span>' +
        "</div>"
      );
    }
    if (kind === "alerts") {
      return (
        '<div class="c360-metrics-legend c360-alerts-legend" role="list" aria-label="Leyenda Qué atender">' +
        '<span class="c360-leg-item tone-critical" role="listitem"><i></i>Urgente</span>' +
        '<span class="c360-leg-item tone-warn" role="listitem"><i></i>Atención</span>' +
        '<span class="c360-leg-item tone-healthy" role="listitem"><i></i>Sin hallazgos</span>' +
        "</div>"
      );
    }
    return "";
  }

  function chartBars(rows, valueKey) {
    var max = valueKey === "score" ? 100 : 1;
    var any = false;
    rows.forEach(function (r) {
      var v = r[valueKey];
      if (v != null && v > 0) any = true;
      if (valueKey !== "score" && v != null && v > max) max = v;
    });
    if (!rows.length || (valueKey === "findings" && !any)) {
      return (
        '<div class="c360-linechart c360-linechart-empty"><p>' +
        (valueKey === "findings" ? "Sin hallazgos No cumple en este corte." : "Sin datos para graficar.") +
        "</p></div>"
      );
    }
    var html = '<div class="c360-hbar-chart" role="list">';
    html += legendHtml(valueKey === "score" ? "score" : "findings");
    rows.forEach(function (r) {
      var v = r[valueKey];
      var pct =
        v == null || max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((v / max) * 100)));
      var label = r.label || r.name || r.title || r.id || "";
      var tone =
        valueKey === "score"
          ? scoreStatus(v)
          : v == null || v === 0
            ? "healthy"
            : pct >= 66
              ? "critical"
              : "warn";
      var metaBits = [];
      if (valueKey === "score") {
        if (r.findings != null) metaBits.push(r.findings + " hallazgo" + (r.findings === 1 ? "" : "s"));
        if (r.applicable != null) metaBits.push(r.applicable + " aplicables");
      } else {
        if (r.score != null) metaBits.push("Indicador " + r.score + "%");
        if (r.applicable != null) metaBits.push(r.applicable + " aplicables");
      }
      var focusAttr = "";
      if (r.chapterId != null) {
        focusAttr =
          ' data-focus-chapter="' +
          r.chapterId +
          '" tabindex="0" role="listitem" aria-label="Ver capítulo ' +
          escapeHtml(String(label)) +
          '"';
      }
      html +=
        '<div class="c360-hbar-row' +
        (r.chapterId != null ? " c360-hbar-hit" : "") +
        " tone-" +
        tone +
        '"' +
        focusAttr +
        '><div class="c360-hbar-head"><strong>' +
        escapeHtml(String(label)) +
        "</strong>" +
        (metaBits.length ? '<span class="c360-hbar-meta">' + escapeHtml(metaBits.join(" · ")) + "</span>" : "") +
        '</div><div class="c360-hbar-track-wrap"><div class="c360-hbar-track"><div class="c360-hbar-fill tone-' +
        tone +
        '" style="width:' +
        (v == null || v === 0 ? 0 : Math.max(pct, 4)) +
        '%"></div>' +
        (valueKey === "score" ? '<i class="c360-hbar-target" style="left:80%" aria-hidden="true"></i>' : "") +
        '</div><strong class="c360-hbar-value">' +
        (v == null ? "—" : v + (valueKey === "score" ? "%" : "")) +
        "</strong></div></div>";
    });
    html += "</div>";
    return html;
  }

  function renderFarmCards(farms, totalFindings) {
    if (!farms || !farms.length) {
      return '<p class="muted">No hay fincas con visitas revisadas en el periodo.</p>';
    }
    var html = '<div class="c360-farm-cards">';
    farms.forEach(function (f) {
      html +=
        '<article class="c360-farm-card tone-' +
        f.status +
        '" data-open-farm="' +
        escapeHtml(f.name) +
        '" tabindex="0">';
      html += '<div class="c360-farm-card-top"><div><strong>' + escapeHtml(f.name) + "</strong>";
      html +=
        '<p>' +
        f.visits +
        " visita" +
        (f.visits === 1 ? "" : "s") +
        (f.lastDate ? " · última " + escapeHtml(formatDateEs(f.lastDate)) : "") +
        (f.firstDate && f.firstDate !== f.lastDate
          ? " · desde " + escapeHtml(formatDateEs(f.firstDate))
          : "") +
        "</p></div>";
      html +=
        '<span class="c360-mpill tone-' + f.status + '">' + statusLabel(f.status) + "</span></div>";
      html += '<div class="c360-farm-card-metrics">';
      html +=
        '<div class="c360-farm-metric"><span>Indicador</span><strong>' +
        (f.score == null ? "—" : f.score + "%") +
        "</strong>" +
        barHtml(f.score, f.status) +
        "</div>";
      html +=
        '<div class="c360-farm-metric"><span>Hallazgos</span><strong>' +
        f.findings +
        "</strong>" +
        barHtml(totalFindings ? (f.findings / totalFindings) * 100 : 0, "warn") +
        "</div>";
      html += "</div>";
      html += '<p class="c360-farm-card-cta">Ver detalle de la finca →</p>';
      html += "</article>";
    });
    html += "</div>";
    return html;
  }

  function renderFindingsList(items, limit) {
    limit = limit || 12;
    if (!items || !items.length) {
      return '<p class="muted">Sin hallazgos de No cumple en el periodo.</p>';
    }
    var html = '<div class="c360-findings-list">';
    items.slice(0, limit).forEach(function (it) {
      html +=
        '<article class="c360-finding-row" data-focus-chapter="' +
        it.chapter +
        '" tabindex="0">';
      html +=
        '<div class="c360-finding-id"><strong>' +
        escapeHtml(it.id) +
        "</strong><span>" +
        escapeHtml(it.chapter + ". " + (it.chapterTitle || CHAPTER_TITLES[it.chapter] || "")) +
        "</span></div>";
      html +=
        '<div class="c360-finding-stats"><strong>' +
        it.findings +
        "</strong><span>hallazgo" +
        (it.findings === 1 ? "" : "s") +
        '</span><div class="c360-metrics-inline">' +
        (it.rate != null ? it.rate + "%" : "") +
        (it.rate != null ? barHtml(it.rate, "warn") : "") +
        "</div></div>";
      html += "</article>";
    });
    html += "</div>";
    return html;
  }

  function kpiCard(label, value, tone, icon, deltaOrOpts, featuredMaybe) {
    var opts = {};
    if (deltaOrOpts && typeof deltaOrOpts === "object" && !Array.isArray(deltaOrOpts)) {
      opts = deltaOrOpts;
    } else {
      opts = { delta: deltaOrOpts, featured: featuredMaybe };
    }
    var featured = !!opts.featured;
    var delta = opts.delta;
    var invertDelta = !!opts.invertDelta;
    var showStatus = opts.showStatus !== false && featured;
    var scoreForMeta = opts.score != null ? opts.score : null;
    var metaDelta = opts.vsMeta != null ? opts.vsMeta : vsMetaPts(scoreForMeta);
    var note = opts.note || "";
    var status = opts.status || tone || "pending";
    var unit = opts.unit || "pts";

    var bits = [];
    if (delta != null && !isNaN(delta)) {
      var cls = deltaToneClass(delta, invertDelta);
      var sign = delta > 0 ? "+" : "";
      var deltaFull =
        unit === "count"
          ? sign + delta + " vs anterior"
          : sign + delta + " pts vs anterior";
      var deltaShort = unit === "count" ? sign + delta : sign + delta + " pts";
      bits.push(
        '<span class="c360-mkpi-delta ' +
          cls +
          '"><span class="c360-lbl-full">' +
          escapeHtml(deltaFull) +
          '</span><span class="c360-lbl-short">' +
          escapeHtml(deltaShort) +
          "</span></span>"
      );
    }
    if (metaDelta != null && !isNaN(metaDelta) && opts.hideMeta !== true) {
      var metaCls = deltaToneClass(metaDelta, false);
      var metaFull = formatSignedPts(metaDelta) + " vs meta " + META_TARGET + "%";
      var metaShort = formatSignedPts(metaDelta) + " vs meta";
      bits.push(
        '<span class="c360-mkpi-meta ' +
          metaCls +
          '"><span class="c360-lbl-full">' +
          escapeHtml(metaFull) +
          '</span><span class="c360-lbl-short">' +
          escapeHtml(metaShort) +
          "</span></span>"
      );
    }
    if (note) {
      bits.push('<span class="c360-mkpi-note">' + escapeHtml(note) + "</span>");
    }

    var statusHtml = "";
    if (showStatus && status && status !== "pending") {
      statusHtml =
        '<span class="c360-mkpi-status tone-' +
        status +
        '">' +
        escapeHtml(statusLabel(status)) +
        "</span>";
    } else if (showStatus && status === "pending") {
      statusHtml = '<span class="c360-mkpi-status tone-pending">Sin medición</span>';
    }

    var foot =
      bits.length || statusHtml
        ? '<div class="c360-mkpi-foot">' + statusHtml + bits.join("") + "</div>"
        : "";

    return (
      '<article class="c360-mkpi tone-' +
      (tone || "brand") +
      (featured ? " featured" : "") +
      '"><div class="c360-mkpi-top"><span class="c360-mkpi-label">' +
      escapeHtml(label) +
      '</span><span class="c360-mkpi-icon" aria-hidden="true">' +
      icon +
      '</span></div><strong class="c360-mkpi-value">' +
      escapeHtml(String(value)) +
      "</strong>" +
      foot +
      "</article>"
    );
  }

  function cardHead(title, subtitle) {
    return (
      '<div class="c360-metrics-card-head"><div><h3>' +
      title +
      "</h3>" +
      (subtitle ? "<p>" + subtitle + "</p>" : "") +
      "</div></div>"
    );
  }

  function td(label, content, extraClass) {
    return (
      '<td data-label="' +
      escapeHtml(label) +
      '"' +
      (extraClass ? ' class="' + extraClass + '"' : "") +
      ">" +
      content +
      "</td>"
    );
  }

  var ICONS = {
    score:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 11l3 3 7-7"/><circle cx="12" cy="12" r="9"/></svg>',
    farms:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg>',
    visits:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    findings:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.3L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z"/></svg>',
    mix:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3h8M10 3v5l-5 9a3 3 0 002.6 4.5h8.8A3 3 0 0019 17l-5-9V3"/><path d="M8.5 14h7"/></svg>',
    water:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3s6 6.2 6 10a6 6 0 11-12 0c0-3.8 6-10 6-10z"/></svg>',
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var state = {
    mode: "all",
    farm: "",
    range: "all",
    dateFrom: "",
    dateTo: "",
    visits: null,
    loading: false,
    error: "",
    openChapter: null,
    focus: null,
    compare: false,
    notice: "",
    noticeError: false,
    importExpanded: false,
    importStatus: "",
    importStatusError: false,
    importPreviewHtml: "",
    pendingVisits: null,
    boardMounted: false,
    nocumpleOpen: true,
  };

  async function loadVisits() {
    state.loading = true;
    state.error = "";
    render();
    try {
      var res = await fetch("/api/visits");
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar las visitas");
      state.visits = Array.isArray(data) ? data : data.visits || data.items || [];
    } catch (err) {
      state.error = err.message || String(err);
      state.visits = [];
    }
    state.loading = false;
    render();
  }

  function farmOptions(visits) {
    var map = {};
    visits.forEach(function (v) {
      if (!v.farm) return;
      map[normFarm(v.farm)] = v.farm;
    });
    return Object.keys(map)
      .sort()
      .map(function (k) {
        return map[k];
      });
  }

  function ensureRoot() {
    var host = q(".metrics-area") || q(".metrics-panel") || q("main") || q("#root");
    if (!host) return null;
    var root = q("#" + ROOT_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = ROOT_ID;
      root.className = "c360-metrics-board no-print";
      root.setAttribute("aria-label", "Tablero de métricas CARE 360");
      if (host.classList.contains("metrics-area")) host.insertAdjacentElement("afterbegin", root);
      else host.prepend(root);
    }
    return root;
  }

  function render() {
    if (!onMetricsTab()) {
      document.documentElement.classList.remove("c360-metrics-lite");
      var existing = q("#" + ROOT_ID);
      if (existing) existing.remove();
      state.boardMounted = false;
      return;
    }
    document.documentElement.classList.add("c360-metrics-lite");
    var root = ensureRoot();
    if (!root) return;

    if (state.visits === null && !state.loading) {
      loadVisits();
      root.innerHTML = '<p class="c360-metrics-loading">Cargando métricas…</p>';
      state.boardMounted = true;
      return;
    }
    if (state.loading) {
      root.innerHTML = '<p class="c360-metrics-loading">Cargando métricas…</p>';
      state.boardMounted = true;
      return;
    }
    if (state.error) {
      root.innerHTML =
        '<div class="c360-metrics-error"><strong>No se pudieron cargar las métricas.</strong><p>' +
        escapeHtml(state.error) +
        '</p><button type="button" data-act="reload">Reintentar</button></div>';
      bind(root);
      state.boardMounted = true;
      return;
    }

    var visits = state.visits || [];
    var win = currentWindow();
    var usable;
    if (state.compare) {
      usable = filterByWindow(visits, win, null);
    } else {
      usable = filterUsableByRange(visits);
    }
    var farms = farmOptions(usable.length ? usable : filterUsableByRange(visits));
    if (!state.farm && farms.length) state.farm = farms[0];
    if (state.mode === "farm" && farms.length && farms.indexOf(state.farm) === -1) {
      state.farm = farms[0];
    }

    var html = "";
    html += '<header class="c360-metrics-head">';
    html += '<div class="c360-metrics-head-main">';
    html += "<h2>Métricas</h2>";
    html +=
      "<p>" +
      (state.mode === "farm" && state.farm
        ? escapeHtml(state.farm)
        : "Indicador de aseguramientos por finca y periodo") +
      "</p>";
    html += "</div>";
    html += '<div class="c360-metrics-controls">';
    html += '<div class="c360-metrics-switch" role="tablist">';
    html +=
      '<button type="button" role="tab" data-mode="all" class="' +
      (state.mode === "all" ? "active" : "") +
      '"><span class="c360-lbl-full">Todas</span><span class="c360-lbl-short">Todas</span></button>';
    html +=
      '<button type="button" role="tab" data-mode="farm" class="' +
      (state.mode === "farm" ? "active" : "") +
      '"><span class="c360-lbl-full">Por finca</span><span class="c360-lbl-short">Finca</span></button>';
    html += "</div>";
    html += '<div class="c360-metrics-range" role="group" aria-label="Periodo">';
    [
      ["all", "Todo", "Todo"],
      ["30d", "30d", "30d"],
      ["90d", "90d", "90d"],
      ["365d", "12m", "12m"],
      ["ytd", "Año", "Año"],
    ].forEach(function (opt) {
      html +=
        '<button type="button" data-range="' +
        opt[0] +
        '" class="' +
        (state.range === opt[0] ? "active" : "") +
        '">' +
        opt[1] +
        "</button>";
    });
    html += "</div>";
    html += '<div class="c360-metrics-actions">';
    html +=
      '<button type="button" class="c360-action-btn' +
      (state.compare ? " active" : "") +
      '" data-act="toggle-compare" aria-pressed="' +
      (state.compare ? "true" : "false") +
      '" title="Comparar con periodo anterior">Comparar</button>';
    html +=
      '<button type="button" class="c360-action-btn" data-act="export-csv" title="Exportar Excel/CSV con todas las métricas visibles">Excel</button>';
    html +=
      '<button type="button" class="c360-action-btn primary" data-act="export-print" title="Informe completo de métricas (imprimir o guardar PDF)">Informe</button>';
    html += "</div></div>";
    if (state.compare && (!state.dateFrom || !state.dateTo || state.range === "all")) {
      html +=
        '<p class="c360-metrics-range-hint">Comparando últimos 12 meses vs previos.</p>';
    }
    if (state.range === "custom" && (state.dateFrom || state.dateTo)) {
      html +=
        '<p class="c360-metrics-range-hint">' +
        escapeHtml(formatDateEs(state.dateFrom) || "…") +
        " → " +
        escapeHtml(formatDateEs(state.dateTo) || "…") +
        "</p>";
    }
    html += "</header>";

    if (state.notice) {
      html +=
        '<div class="c360-metrics-notice' +
        (state.noticeError ? " error" : "") +
        '"><p>' +
        escapeHtml(state.notice) +
        '</p><button type="button" data-act="clear-notice" aria-label="Cerrar aviso">×</button></div>';
    }

    if (!usable.length) {
      html +=
        '<div class="c360-metrics-empty"><p>No hay visitas revisadas en este periodo. Amplía el rango, guarda un informe en Visitas o importa desde Fincas.</p></div>';
      root.innerHTML = html;
      bind(root);
      state.boardMounted = true;
      return;
    }

    var showDates = state.range === "custom" || !!state._showDates;
    html +=
      '<div class="c360-metrics-filters' +
      (state.mode === "farm" ? " has-farm" : "") +
      (showDates ? " show-dates" : " hide-dates") +
      '">';
    if (state.mode === "farm") {
      html += '<label class="c360-filter-farm">Finca<select data-field="farm">';
      farms.forEach(function (name) {
        html +=
          '<option value="' +
          escapeHtml(name) +
          '"' +
          (name === state.farm ? " selected" : "") +
          ">" +
          escapeHtml(name) +
          "</option>";
      });
      html += "</select></label>";
    } else {
      html +=
        '<p class="c360-filter-scope">' +
        farms.length +
        " finca" +
        (farms.length === 1 ? "" : "s") +
        " en el periodo</p>";
    }
    html +=
      '<label class="c360-filter-date">Desde<input data-field="dateFrom" type="date" value="' +
      escapeHtml(state.dateFrom) +
      '"></label>';
    html +=
      '<label class="c360-filter-date">Hasta<input data-field="dateTo" type="date" value="' +
      escapeHtml(state.dateTo) +
      '"></label>';
    if (!showDates) {
      html +=
        '<button type="button" class="c360-filter-dates-toggle" data-act="show-dates">Fechas</button>';
    }
    html += "</div>";

    if (state.mode === "farm") {
      var farmWin = state.compare ? win : { from: state.dateFrom, to: state.dateTo };
      html += renderFarmView(
        aggregateFarm(visits, state.farm, farmWin.from || "", farmWin.to || "")
      );
    } else {
      html += renderAllView(aggregateAll(usable));
    }

    root.innerHTML = html;
    bind(root);
    state.boardMounted = true;
  }

  function renderImportBlock() {
    return "";
  }

  function renderAllView(data) {
    state._viewData = data;
    var win = currentWindow();
    var prevWin = previousWindow(win);
    var prevVisits = prevWin ? filterByWindow(state.visits || [], prevWin, null) : [];
    var prevData = prevWin ? aggregateAll(prevVisits) : null;
    var cmp = buildCompare(
      data.score,
      prevData ? prevData.score : null,
      data.findings,
      prevData ? prevData.findings : 0,
      data.visits,
      prevData ? prevData.visits : 0,
      win,
      prevWin
    );
    state._compare = cmp;
    var trend = timelineTrend(data.timeline);
    var mix = chapterKpi(data.chapters, 4);
    var dose = chapterKpi(data.chapters, 2);
    var prevMix = prevData ? chapterKpi(prevData.chapters, 4) : { score: null };
    var prevDose = prevData ? chapterKpi(prevData.chapters, 2) : { score: null };
    var mixDelta = deltaPts(mix.score, prevMix.score);
    var doseDelta = deltaPts(dose.score, prevDose.score);
    var findingsDelta =
      prevData && prevData.visits > 0 ? data.findings - (prevData.findings || 0) : null;
    var heroDelta = cmp.scoreDelta != null ? cmp.scoreDelta : trend;
    var periodNote =
      data.visits != null
        ? data.visits +
          " visita" +
          (data.visits === 1 ? "" : "s") +
          (data.farms && data.farms.length
            ? " · " + data.farms.length + " finca" + (data.farms.length === 1 ? "" : "s")
            : "")
        : "";
    var findingsNote =
      data.visits != null
        ? "suma del periodo · " + data.visits + " visita" + (data.visits === 1 ? "" : "s")
        : "suma del periodo";
    var alerts = buildAlerts(data, null);
    var html = "";
    html += '<div class="c360-metrics-hero">';
    html += '<div class="c360-metrics-kpis">';
    html += kpiCard(
      "Indicador",
      data.score == null ? "—" : data.score + "%",
      scoreStatus(data.score),
      ICONS.score,
      {
        featured: true,
        score: data.score,
        delta: heroDelta,
        status: scoreStatus(data.score),
        note: periodNote,
      }
    );
    html += '<div class="c360-metrics-kpis-side">';
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix, {
      score: mix.score,
      delta: mixDelta,
      showStatus: false,
    });
    html += kpiCard("Dosis", dose.value, dose.tone, ICONS.water, {
      score: dose.score,
      delta: doseDelta,
      showStatus: false,
    });
    html += kpiCard(
      "Hallazgos",
      data.findings,
      data.findings ? "critical" : "healthy",
      ICONS.findings,
      {
        delta: findingsDelta,
        invertDelta: true,
        unit: "count",
        hideMeta: true,
        showStatus: false,
        note: findingsNote,
      }
    );
    html += "</div></div>";
    html += renderCompareStrip(cmp);

    html += '<section class="c360-metrics-card c360-metrics-hero-chart">';
    html += cardHead(
      "Evolución",
      data.firstDate || data.lastDate
        ? formatDateEs(data.firstDate) +
          " → " +
          formatDateEs(data.lastDate) +
          " · " +
          data.visits +
          " visitas · " +
          data.farms.length +
          " finca" +
          (data.farms.length === 1 ? "" : "s")
        : "Sin visitas en el periodo"
    );
    html += chartLine(data.timeline, state.compare && prevData ? prevData.timeline : null);
    html += "</section></div>";

    html += renderAlerts(alerts);
    html += renderFocusPanel();

    html += '<section class="c360-metrics-card c360-metrics-section">';
    html += cardHead("Resumen por finca", "Toca una finca para ver detalle.");
    html += legendHtml("status");
    html += renderFarmCards(data.farms, data.findings);
    html += "</section>";

    html += '<div class="c360-metrics-charts">';
    html += '<section class="c360-metrics-card c360-metrics-exec-chart">';
    html += cardHead(
      "Indicador por capítulo",
      "Cumplimiento del periodo. Línea de meta en 80%. Tocá un capítulo para profundizar."
    );
    html += chartBars(
      data.chapters.map(function (c) {
        return {
          label: c.id + ". " + shortTitle(c.title),
          score: c.score,
          findings: c.findings,
          applicable: c.applicable,
          chapterId: c.id,
        };
      }),
      "score"
    );
    html += "</section>";
    html += '<section class="c360-metrics-card c360-metrics-exec-chart">';
    html += cardHead(
      "Hallazgos por capítulo",
      "No cumple concentrados. Más largo = más prioridad de atención."
    );
    html += chartBars(
      data.chapters.map(function (c) {
        return {
          label: c.id + ". " + shortTitle(c.title),
          findings: c.findings,
          score: c.score,
          applicable: c.applicable,
          chapterId: c.id,
        };
      }),
      "findings"
    );
    html += "</section></div>";

    html += '<section class="c360-metrics-card c360-metrics-section">';
    html += cardHead("Subcapítulos con más hallazgos", "Criterios que más se incumplen.");
    html += renderFindingsList(data.items, 12);
    html += "</section>";
    return html;
  }

  function renderFarmView(data) {
    state._viewData = data;
    var win = currentWindow();
    var prevWin = previousWindow(win);
    var prevVisits = prevWin ? filterByWindow(state.visits || [], prevWin, state.farm) : [];
    var prevData = prevWin ? aggregateFarm(state.visits || [], state.farm, prevWin.from, prevWin.to) : null;
    var lastScore = data.timeline.length ? data.timeline[data.timeline.length - 1].score : null;
    var prevLast =
      prevData && prevData.timeline.length ? prevData.timeline[prevData.timeline.length - 1].score : null;
    var cmp = buildCompare(
      lastScore,
      prevLast,
      data.findings,
      prevData ? prevData.findings : 0,
      data.visits,
      prevData ? prevData.visits : 0,
      win,
      prevWin
    );
    state._compare = cmp;
    var trend = timelineTrend(data.timeline);
    var mix = chapterKpi(data.chapters, 4);
    var dose = chapterKpi(data.chapters, 2);
    var prevMix = prevData ? chapterKpi(prevData.chapters, 4) : { score: null };
    var prevDose = prevData ? chapterKpi(prevData.chapters, 2) : { score: null };
    var mixDelta = deltaPts(mix.score, prevMix.score);
    var doseDelta = deltaPts(dose.score, prevDose.score);
    var findingsDelta =
      prevData && prevData.visits > 0 ? data.findings - (prevData.findings || 0) : null;
    var heroDelta = cmp.scoreDelta != null ? cmp.scoreDelta : trend;
    var periodNote =
      data.visits != null
        ? data.visits + " visita" + (data.visits === 1 ? "" : "s")
        : "";
    var findingsNote =
      data.visits != null
        ? "suma del periodo · " +
          data.visits +
          " visita" +
          (data.visits === 1 ? "" : "s") +
          " (detalle = última)"
        : "suma del periodo";
    var alerts = buildAlerts(null, data);
    var html = "";
    html += '<div class="c360-metrics-hero">';
    html += '<div class="c360-metrics-kpis">';
    html += kpiCard(
      "Indicador",
      lastScore == null ? "—" : lastScore + "%",
      scoreStatus(lastScore),
      ICONS.score,
      {
        featured: true,
        score: lastScore,
        delta: heroDelta,
        status: scoreStatus(lastScore),
        note: periodNote,
      }
    );
    html += '<div class="c360-metrics-kpis-side">';
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix, {
      score: mix.score,
      delta: mixDelta,
      showStatus: false,
    });
    html += kpiCard("Dosis", dose.value, dose.tone, ICONS.water, {
      score: dose.score,
      delta: doseDelta,
      showStatus: false,
    });
    html += kpiCard(
      "Hallazgos",
      data.findings,
      data.findings ? "critical" : "healthy",
      ICONS.findings,
      {
        delta: findingsDelta,
        invertDelta: true,
        unit: "count",
        hideMeta: true,
        showStatus: false,
        note: findingsNote,
      }
    );
    html += "</div></div>";
    html += renderCompareStrip(cmp);

    html += '<section class="c360-metrics-card c360-metrics-hero-chart">';
    html += cardHead(
      "Evolución",
      data.firstDate || data.lastDate
        ? formatDateEs(data.firstDate) +
          " → " +
          formatDateEs(data.lastDate) +
          " · " +
          data.visits +
          " visitas"
        : "Sin visitas en el periodo"
    );
    html += chartLine(
      data.chartTimeline || data.timeline,
      state.compare && prevData ? prevData.chartTimeline || prevData.timeline : null
    );
    html += "</section></div>";

    html += renderAlerts(alerts);
    html += renderFocusPanel();

    html += '<section class="c360-metrics-card c360-metrics-section">';
    html += cardHead("Visitas por fecha", "Abrí la visita en Visitas para ver el informe completo.");
    html += legendHtml("status");
    if (!data.timeline.length) {
      html += '<p class="muted">No hay visitas revisadas para esta finca en el rango.</p>';
    } else {
      html += '<div class="c360-visit-cards">';
      data.timeline
        .slice()
        .reverse()
        .forEach(function (row) {
          html += '<article class="c360-visit-card tone-' + (row.status || "pending") + '">';
          html +=
            '<div class="c360-visit-card-top"><div><strong>' +
            escapeHtml(row.label || formatDateEs(row.date)) +
            "</strong><p>" +
            escapeHtml(row.responsible || "Sin responsable") +
            "</p></div>";
          html +=
            '<span class="c360-mpill tone-' +
            row.status +
            '">' +
            statusLabel(row.status) +
            "</span></div>";
          html += '<div class="c360-visit-card-metrics">';
          html +=
            '<div class="c360-farm-metric"><span>Indicador</span><strong>' +
            (row.score == null ? "—" : row.score + "%") +
            "</strong>" +
            barHtml(row.score, row.status) +
            "</div>";
          html +=
            '<div class="c360-farm-metric"><span>Hallazgos</span><strong>' +
            row.findings +
            "</strong></div>";
          html += "</div>";
          html +=
            '<button type="button" class="c360-alert-btn primary" data-open-visit="' +
            escapeHtml(row.farm || state.farm || "") +
            '" data-open-date="' +
            escapeHtml(row.date || "") +
            '">Abrir visita</button>';
          html += "</article>";
        });
      html += "</div>";
    }
    html += "</section>";

    html += '<div class="c360-metrics-charts">';
    html += '<section class="c360-metrics-card c360-metrics-exec-chart">';
    html += cardHead(
      "Capítulos · última visita",
      (data.lastDate ? "Visita del " + formatDateEs(data.lastDate) + "." : "Sin visita reciente.") +
        " Meta 80%. Tocá un capítulo para ver No cumple."
    );
    html += chartBars(
      data.chapters.map(function (c) {
        return {
          label: c.id + ". " + shortTitle(c.title),
          score: c.score,
          findings: c.findings,
          applicable: c.applicable,
          chapterId: c.id,
        };
      }),
      "score"
    );
    html += "</section>";
    html += '<section class="c360-metrics-card c360-metrics-exec-chart">';
    html += cardHead("Hallazgos por capítulo", "No cumple en la última visita · más largo = más urgente.");
    html += chartBars(
      data.chapters.map(function (c) {
        return {
          label: c.id + ". " + shortTitle(c.title),
          findings: c.findings,
          score: c.score,
          applicable: c.applicable,
          chapterId: c.id,
        };
      }),
      "findings"
    );
    html += "</section></div>";

    html += renderNocumpleDetail(data);
    return html;
  }

  function groupItemsByChapter(items) {
    var groups = [];
    var map = {};
    (items || []).forEach(function (it) {
      var ch = Number(it.chapter);
      if (!map[ch]) {
        map[ch] = {
          id: ch,
          title: CHAPTER_TITLES[ch] || "Capítulo " + ch,
          items: [],
        };
        groups.push(map[ch]);
      }
      map[ch].items.push(it);
    });
    return groups;
  }

  function renderNocumpleDetail(data) {
    var count = (data.items && data.items.length) || 0;
    if (!count) {
      return (
        '<section class="c360-metrics-card c360-metrics-section">' +
        cardHead("Detalle del informe · No cumple", "La última visita no tiene respuestas No cumple.") +
        "</section>"
      );
    }
    if (!state.nocumpleOpen) {
      return (
        '<section class="c360-metrics-card c360-metrics-section c360-nocumple-collapsed">' +
        '<div class="c360-metrics-card-head"><div><h3>Detalle del informe · No cumple</h3><p>' +
        count +
        " hallazgo" +
        (count === 1 ? " oculto" : "s ocultos") +
        ".</p></div>" +
        '<button type="button" class="c360-alert-btn primary" data-act="open-nocumple">Ver detalle</button></div>' +
        "</section>"
      );
    }
    var html = '<section class="c360-metrics-card c360-metrics-section c360-nocumple-detail" id="c360-nocumple-detail">';
    html +=
      '<div class="c360-metrics-card-head"><div><h3>Detalle del informe · No cumple</h3><p>' +
      (data.lastDate
        ? "Hallazgos y recomendaciones de la visita del " + formatDateEs(data.lastDate) + "."
        : "Hallazgos y recomendaciones de la última visita.") +
      '</p></div><button type="button" class="c360-focus-close primary" data-act="close-nocumple" aria-label="Cerrar detalle">Cerrar detalle</button></div>';
    html +=
      '<div class="c360-nocumple-toolbar"><button type="button" class="c360-alert-btn primary" data-open-visit="' +
      escapeHtml(state.farm || "") +
      '" data-open-date="' +
      escapeHtml(data.lastDate || "") +
      '">Abrir informe en Visitas</button></div>';
    html += '<div class="c360-nocumple-list">';
    groupItemsByChapter(data.items).forEach(function (group) {
      html += '<div class="c360-nocumple-group">';
      html +=
        '<header class="c360-nocumple-group-head"><strong>' +
        escapeHtml(group.id + ". " + group.title) +
        "</strong><span>" +
        group.items.length +
        " hallazgo" +
        (group.items.length === 1 ? "" : "s") +
        "</span></header>";
      group.items.forEach(function (it) {
        html += '<article class="c360-nocumple-card">';
        html +=
          '<div class="c360-nocumple-card-top"><strong class="c360-nocumple-id">' +
          escapeHtml(it.id) +
          '</strong><span class="c360-mpill tone-warn">No cumple</span></div>';
        html +=
          '<div class="c360-nocumple-block"><span>Hallazgo</span><p>' +
          escapeHtml(it.observation || "Sin observación registrada.") +
          "</p></div>";
        html +=
          '<div class="c360-nocumple-block rec"><span>Recomendación</span><p>' +
          escapeHtml(it.recommendation || "Sin recomendación registrada.") +
          "</p></div>";
        html += "</article>";
      });
      html += "</div>";
    });
    html += "</div>";
    html +=
      '<div class="c360-nocumple-footer"><button type="button" class="c360-focus-close primary" data-act="close-nocumple">Cerrar detalle</button></div>';
    html += "</section>";
    return html;
  }

  function shortTitle(title) {
    return String(title || "").replace(/^Capítulo\s+/i, "");
  }

  function setNotice(text, isError) {
    state.notice = text || "";
    state.noticeError = !!isError;
  }

  function clickModuleTab(labelRe) {
    var tabs = qa('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]');
    for (var i = 0; i < tabs.length; i++) {
      if (labelRe.test(tabs[i].textContent || "")) {
        tabs[i].click();
        return true;
      }
    }
    return false;
  }

  function clickVisibleButton(pattern) {
    var buttons = qa("button").filter(function (btn) {
      if (btn.disabled) return false;
      var r = btn.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    });
    for (var i = 0; i < buttons.length; i++) {
      if (pattern.test((buttons[i].textContent || "").trim())) {
        buttons[i].click();
        return true;
      }
    }
    return false;
  }

  function findVisitRow(farm, date) {
    var farmKey = normFarm(farm);
    var dateEs = formatDateEs(date);
    var rows = qa(".visit-row");
    for (var i = 0; i < rows.length; i++) {
      var strong = q("strong", rows[i]);
      var small = q("small", rows[i]) || rows[i];
      var name = strong ? strong.textContent : "";
      var meta = small ? small.textContent : "";
      if (normFarm(name) !== farmKey) continue;
      if (date && meta.indexOf(date) === -1 && meta.indexOf(dateEs) === -1) continue;
      return rows[i];
    }
    return null;
  }

  function openVisitInApp(farm, date) {
    if (!farm) {
      setNotice("No se pudo identificar la finca de la visita.", true);
      render();
      return;
    }
    window.__C360_OPEN_VISIT = { farm: farm, date: date || "", at: Date.now() };
    setNotice("Abriendo Visitas…", false);
    render();
    if (!clickModuleTab(/Visitas/i)) {
      setNotice("No se encontró la pestaña Visitas.", true);
      render();
      return;
    }
    var tries = 0;
    function attempt() {
      tries += 1;
      clickVisibleButton(/ver visitas guardadas/i);
      var row = findVisitRow(farm, date);
      if (row) {
        var openBtn = null;
        qa("button", row).forEach(function (btn) {
          if (/^abrir$/i.test((btn.textContent || "").trim())) openBtn = btn;
        });
        if (openBtn) {
          openBtn.click();
          setNotice(
            "Visita abierta: " + farm + (date ? " · " + formatDateEs(date) : "") + ".",
            false
          );
          return;
        }
        row.click();
        setNotice("Visita localizada en Visitas.", false);
        return;
      }
      if (tries < 12) {
        window.setTimeout(attempt, 220);
        return;
      }
      setNotice(
        "Ve a Visitas y abre “" +
          farm +
          (date ? " · " + formatDateEs(date) : "") +
          "”. No se encontró el botón Abrir automáticamente.",
        true
      );
    }
    window.setTimeout(attempt, 280);
  }

  function visitsForFocusDate(dateKey) {
    var key = String(dateKey || "");
    var monthKey = /^\d{4}-\d{2}/.test(key) ? key.slice(0, 7) : "";
    var list = filterUsableByRange(state.visits || []);
    if (state.mode === "farm" && state.farm) {
      list = list.filter(function (v) {
        return normFarm(v.farm) === normFarm(state.farm);
      });
    }
    var exact = list.filter(function (v) {
      return v.date === key;
    });
    if (exact.length) return exact;
    if (monthKey) {
      return list.filter(function (v) {
        return String(v.date || "").slice(0, 7) === monthKey;
      });
    }
    return [];
  }

  function buildAlerts(allData, farmData) {
    var alerts = [];
    if (state.mode === "all" && allData) {
      allData.farms.forEach(function (f) {
        if (f.status === "critical") {
          alerts.push({
            tone: "critical",
            title: f.name + " en crítico",
            text: "Indicador " + (f.score == null ? "—" : f.score + "%") + " · " + f.findings + " hallazgos",
            farm: f.name,
          });
        }
      });
      allData.farms.forEach(function (f) {
        if (f.status === "acceptable" && f.findings >= 3) {
          alerts.push({
            tone: "warn",
            title: f.name + " con hallazgos",
            text: f.findings + " No cumple en el periodo",
            farm: f.name,
          });
        }
      });
      allData.items.slice(0, 4).forEach(function (it) {
        if (it.findings < 2) return;
        alerts.push({
          tone: "warn",
          title: "Criterio " + it.id + " recurrente",
          text: it.findings + " hallazgos · " + it.chapterTitle,
          chapter: it.chapter,
        });
      });
    }
    if (state.mode === "farm" && farmData) {
      var trend = timelineTrend(farmData.timeline);
      if (trend != null && trend <= -10) {
        alerts.push({
          tone: "critical",
          title: "Indicador bajó " + Math.abs(trend) + " pts",
          text: "Comparado con la visita anterior de esta finca",
          farm: state.farm,
        });
      }
      farmData.items.slice(0, 4).forEach(function (it) {
        alerts.push({
          tone: "warn",
          title: "No cumple " + it.id,
          text: (CHAPTER_TITLES[it.chapter] || "Capítulo " + it.chapter) + (it.observation ? " · " + it.observation : ""),
          chapter: it.chapter,
          farm: state.farm,
          date: farmData.lastDate,
          visitId: farmData.last && farmData.last.id,
        });
      });
      if (!farmData.items.length && farmData.lastDate) {
        alerts.push({
          tone: "healthy",
          title: "Última visita sin No cumple",
          text: "Visita del " + formatDateEs(farmData.lastDate),
          farm: state.farm,
          date: farmData.lastDate,
          visitId: farmData.last && farmData.last.id,
        });
      }
    }
    var seen = {};
    return alerts
      .filter(function (a) {
        var k = a.title + "|" + (a.farm || "") + "|" + (a.chapter || "");
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      })
      .slice(0, 5);
  }

  function renderAlerts(alerts) {
    if (!alerts || !alerts.length) return "";
    var html = '<section class="c360-metrics-alerts-bar" aria-label="Qué atender">';
    html +=
      '<div class="c360-alerts-head"><div><strong>Qué atender</strong><span>' +
      alerts.length +
      "</span></div>" +
      legendHtml("alerts") +
      "</div>";
    html += '<div class="c360-alerts-grid">';
    alerts.forEach(function (a) {
      html +=
        '<article class="c360-alert-chip tone-' +
        (a.tone || "warn") +
        '"><strong>' +
        escapeHtml(a.title) +
        "</strong><p>" +
        escapeHtml(a.text || "") +
        '</p><div class="c360-alert-actions">';
      if (a.farm && state.mode !== "farm") {
        html +=
          '<button type="button" class="c360-alert-btn" data-open-farm="' +
          escapeHtml(a.farm) +
          '">Finca</button>';
      }
      if (a.chapter != null) {
        html +=
          '<button type="button" class="c360-alert-btn" data-focus-chapter="' +
          a.chapter +
          '">Capítulo</button>';
      }
      if (a.farm && a.date) {
        html +=
          '<button type="button" class="c360-alert-btn primary" data-open-visit="' +
          escapeHtml(a.farm) +
          '" data-open-date="' +
          escapeHtml(a.date) +
          '">Abrir</button>';
      }
      html += "</div></article>";
    });
    html += "</div></section>";
    return html;
  }

  function renderFocusPanel() {
    var focus = state.focus;
    if (!focus) return "";
    var html = '<section class="c360-metrics-card c360-metrics-focus" id="c360-metrics-focus">';
    html +=
      '<div class="c360-metrics-card-head"><div><h3>' +
      escapeHtml(focus.title || "Detalle") +
      "</h3><p>" +
      escapeHtml(focus.subtitle || "") +
      '</p></div><button type="button" class="c360-focus-close primary" data-act="clear-focus" aria-label="Cerrar detalle">Cerrar detalle</button></div>';

    if (focus.type === "point") {
      var refs = focus.visits || [];
      if (!refs.length) {
        html += '<p class="muted">No hay visitas en este punto del periodo.</p>';
      } else {
        html += '<div class="c360-focus-list">';
        refs.forEach(function (v) {
          var st = visitScore(v);
          html += '<article class="c360-focus-item">';
          html +=
            '<div class="c360-focus-item-main"><strong>' +
            escapeHtml(v.farm || state.farm || "Finca") +
            "</strong><p>" +
            escapeHtml(formatDateEs(v.date)) +
            (v.responsible || v.technician ? " · " + escapeHtml(v.responsible || v.technician) : "") +
            '</p><p class="c360-focus-meta">Indicador ' +
            (st.score == null ? "—" : st.score + "%") +
            " · " +
            st.findings +
            " hallazgos</p></div>";
          html += '<div class="c360-focus-actions">';
          if (v.farm) {
            html +=
              '<button type="button" class="c360-alert-btn" data-open-farm="' +
              escapeHtml(v.farm) +
              '">Ver finca</button>';
          }
          html +=
            '<button type="button" class="c360-alert-btn primary" data-open-visit="' +
            escapeHtml(v.farm || state.farm || "") +
            '" data-open-date="' +
            escapeHtml(v.date || "") +
            '">Abrir informe</button>';
          html += "</div></article>";
        });
        html += "</div>";
      }
    } else if (focus.type === "chapter") {
      var items = focus.items || [];
      var chTone = scoreStatus(focus.score);
      html +=
        '<div class="c360-focus-summary"><span class="c360-mpill tone-' +
        chTone +
        '">' +
        statusLabel(chTone) +
        '</span><p>Indicador <strong>' +
        (focus.score == null ? "—" : focus.score + "%") +
        "</strong> · <strong>" +
        (focus.findings || 0) +
        "</strong> hallazgo" +
        ((focus.findings || 0) === 1 ? "" : "s") +
        "</p></div>";
      if (!items.length) {
        html += '<p class="muted">Sin respuestas No cumple en este capítulo para el corte actual.</p>';
      } else {
        html += '<div class="c360-focus-list">';
        items.forEach(function (it) {
          html += '<article class="c360-focus-item c360-nocumple-card">';
          html +=
            '<div class="c360-nocumple-card-top"><strong class="c360-nocumple-id">' +
            escapeHtml(it.id) +
            '</strong><span class="c360-mpill tone-warn">No cumple</span></div>';
          html +=
            '<div class="c360-nocumple-block"><span>Hallazgo</span><p>' +
            escapeHtml(it.observation || "Sin observación registrada.") +
            "</p></div>";
          html +=
            '<div class="c360-nocumple-block rec"><span>Recomendación</span><p>' +
            escapeHtml(it.recommendation || "Sin recomendación registrada.") +
            "</p></div>";
          if (it.farm && it.date) {
            html +=
              '<div class="c360-focus-actions"><button type="button" class="c360-alert-btn primary" data-open-visit="' +
              escapeHtml(it.farm) +
              '" data-open-date="' +
              escapeHtml(it.date) +
              '">Abrir informe</button></div>';
          }
          html += "</article>";
        });
        html += "</div>";
      }
    }
    html +=
      '<div class="c360-nocumple-footer"><button type="button" class="c360-focus-close primary" data-act="clear-focus">Cerrar detalle</button></div>';
    html += "</section>";
    return html;
  }

  function focusPoint(dateKey, label, score) {
    var visits = visitsForFocusDate(dateKey);
    state.focus = {
      type: "point",
      title: "Detalle · " + (label || formatDateEs(dateKey) || "periodo"),
      subtitle:
        (score == null ? "Sin indicador" : "Indicador " + score + "%") +
        " · " +
        visits.length +
        " visita(s)",
      date: dateKey,
      visits: visits,
    };
    render();
    window.setTimeout(function () {
      var el = q("#c360-metrics-focus");
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 40);
  }

  function focusChapter(chapterId, contextData) {
    var ch = Number(chapterId);
    var title = CHAPTER_TITLES[ch] || "Capítulo " + ch;
    var items = [];
    var score = null;
    var findings = 0;
    if (state.mode === "farm" && contextData && contextData.last) {
      var last = contextData.last;
      Object.keys(last.answers || {}).forEach(function (id) {
        if (Number(String(id).split(".")[0]) !== ch) return;
        if (answerValue(last.answers[id]) !== "NO") return;
        items.push({
          id: id,
          observation: last.answers[id].observation || "",
          recommendation: last.answers[id].recommendation || "",
          farm: last.farm || state.farm,
          date: last.date,
        });
      });
      var chRow = null;
      (contextData.chapters || []).forEach(function (c) {
        if (c.id === ch) chRow = c;
      });
      if (chRow) {
        score = chRow.score;
        findings = chRow.findings;
      }
    } else {
      var usable = filterUsableByRange(state.visits || []);
      usable.forEach(function (v) {
        Object.keys(v.answers || {}).forEach(function (id) {
          if (Number(String(id).split(".")[0]) !== ch) return;
          if (answerValue(v.answers[id]) !== "NO") return;
          items.push({
            id: id,
            observation: v.answers[id].observation || "",
            recommendation: v.answers[id].recommendation || "",
            farm: v.farm,
            date: v.date,
          });
        });
      });
      findings = items.length;
      if (contextData && contextData.chapters) {
        var row = null;
        contextData.chapters.forEach(function (c) {
          if (c.id === ch) row = c;
        });
        if (row) score = row.score;
      }
    }
    state.focus = {
      type: "chapter",
      title: ch + ". " + title,
      subtitle: state.mode === "farm" ? "Última visita de la finca" : "Hallazgos del periodo",
      chapter: ch,
      items: items.slice(0, 20),
      score: score,
      findings: findings,
    };
    if (state.mode === "farm") state.nocumpleOpen = true;
    render();
    window.setTimeout(function () {
      var el = q("#c360-metrics-focus");
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 40);
  }

  function bind(root) {
    qa("[data-mode]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.mode = btn.getAttribute("data-mode") || "all";
        state.focus = null;
        render();
      });
    });
    qa("[data-range]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyRangePreset(btn.getAttribute("data-range") || "all");
        state._showDates = false;
        state.focus = null;
        render();
      });
    });
    qa("[data-field]", root).forEach(function (el) {
      el.addEventListener("change", function () {
        state[el.getAttribute("data-field")] = el.value;
        if (el.getAttribute("data-field") === "dateFrom" || el.getAttribute("data-field") === "dateTo") {
          state.range = "custom";
          state._showDates = true;
        }
        state.focus = null;
        render();
      });
    });
    qa("[data-open-farm]", root).forEach(function (el) {
      function openFarm() {
        state.mode = "farm";
        state.farm = el.getAttribute("data-open-farm") || "";
        state.focus = null;
        render();
      }
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openFarm();
      });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          openFarm();
        }
      });
    });
    qa("[data-focus-date]", root).forEach(function (el) {
      function go() {
        focusPoint(
          el.getAttribute("data-focus-date"),
          el.getAttribute("data-focus-label"),
          Number(el.getAttribute("data-focus-score"))
        );
      }
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        go();
      });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          go();
        }
      });
    });
    qa("[data-focus-chapter]", root).forEach(function (el) {
      function go() {
        focusChapter(el.getAttribute("data-focus-chapter"), state._viewData || null);
      }
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        go();
      });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          go();
        }
      });
    });
    qa("[data-open-visit]", root).forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openVisitInApp(btn.getAttribute("data-open-visit"), btn.getAttribute("data-open-date"));
      });
    });
    var clearFocus = q('[data-act="clear-focus"]', root);
    if (clearFocus) {
      clearFocus.addEventListener("click", function () {
        state.focus = null;
        render();
      });
    }
    qa('[data-act="close-nocumple"]', root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.nocumpleOpen = false;
        state.focus = null;
        render();
      });
    });
    var openNocumple = q('[data-act="open-nocumple"]', root);
    if (openNocumple) {
      openNocumple.addEventListener("click", function () {
        state.nocumpleOpen = true;
        render();
        window.setTimeout(function () {
          var el = q("#c360-nocumple-detail");
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 40);
      });
    }
    var clearNotice = q('[data-act="clear-notice"]', root);
    if (clearNotice) {
      clearNotice.addEventListener("click", function () {
        state.notice = "";
        state.noticeError = false;
        render();
      });
    }
    var toggleCompare = q('[data-act="toggle-compare"]', root);
    if (toggleCompare) {
      toggleCompare.addEventListener("click", function () {
        state.compare = !state.compare;
        render();
      });
    }
    var showDatesBtn = q('[data-act="show-dates"]', root);
    if (showDatesBtn) {
      showDatesBtn.addEventListener("click", function () {
        state._showDates = true;
        render();
      });
    }
    var exportCsvBtn = q('[data-act="export-csv"]', root);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportBoardCsv);
    var exportPrintBtn = q('[data-act="export-print"]', root);
    if (exportPrintBtn) exportPrintBtn.addEventListener("click", exportBoardPrint);
    var reload = q('[data-act="reload"]', root);
    if (reload) reload.addEventListener("click", loadVisits);
    wireBoardImport(root);
  }

  function wireBoardImport(root) {
    var box = q("[data-c360-board-import]", root);
    if (!box) return;
    var input = q("#c360-board-file", box) || q("input[type=file]", box);
    var status = q(".c360-import-status", box);
    var preview = q(".c360-import-preview", box);
    if (!input || !status || !preview) return;

    function setStatus(text, isError) {
      state.importStatus = text || "";
      state.importStatusError = !!isError;
      status.hidden = !text;
      status.textContent = text || "";
      status.className = "c360-import-status " + (isError ? "notice error" : "muted");
    }

    function bindConfirm() {
      var go = q(".c360-import-go", preview);
      if (!go || go.getAttribute("data-bound") === "1") return;
      go.setAttribute("data-bound", "1");
      go.addEventListener("click", async function () {
        if (!state.pendingVisits || !state.pendingVisits.visits) {
          setStatus("No hay aseguramientos pendientes por importar.", true);
          return;
        }
        if (!window.C360Import || !window.C360Import.saveVisits) {
          setStatus("El módulo de importación no está listo. Recarga la app.", true);
          return;
        }
        try {
          setStatus("Importando…", false);
          var saved = await window.C360Import.saveVisits(state.pendingVisits.visits);
          setStatus(
            saved.length +
              " informe(s) importados. Quedan en Visitas listos para editar y aquí en Métricas con su fecha.",
            false
          );
          preview.hidden = true;
          preview.innerHTML = "";
          state.importPreviewHtml = "";
          state.pendingVisits = null;
          loadVisits();
        } catch (err) {
          setStatus(err.message || String(err), true);
        }
      });
    }

    function setPreview(parsed) {
      state.pendingVisits = parsed;
      var warn = (parsed.errors || []).slice(0, 3).join(" · ");
      var html =
        "<p><strong>" +
        parsed.visits.length +
        "</strong> informe(s) completo(s) listos · " +
        parsed.rows +
        " criterios.</p>" +
        "<p class=\"muted\">Se guardarán con datos de finca y los 5 capítulos para poder editarlos en Visitas.</p>" +
        (warn ? '<p class="notice error">' + warn + "</p>" : "") +
        '<button type="button" class="primary c360-import-go">Confirmar importación</button>';
      state.importPreviewHtml = html;
      preview.hidden = false;
      preview.innerHTML = html;
      bindConfirm();
    }

    if (state.importStatus) setStatus(state.importStatus, state.importStatusError);
    if (state.importPreviewHtml) {
      preview.hidden = false;
      preview.innerHTML = state.importPreviewHtml;
      bindConfirm();
    }

    if (input.getAttribute("data-bound") === "1") return;
    input.setAttribute("data-bound", "1");
    var openTitle = q(".c360-import-open", box);
    if (openTitle && openTitle.tagName !== "SUMMARY") {
      openTitle.setAttribute("role", "button");
      openTitle.tabIndex = 0;
      openTitle.addEventListener("click", function (ev) {
        ev.preventDefault();
        try {
          input.click();
        } catch (err) {}
      });
      openTitle.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          try {
            input.click();
          } catch (err) {}
        }
      });
    }
    if (box.tagName === "DETAILS") {
      box.addEventListener("toggle", function () {
        state.importExpanded = !!box.open;
      });
    }
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!window.C360Import || !window.C360Import.handleFile) {
        setStatus("El módulo de importación no está listo. Recarga la app.", true);
        return;
      }
      window.C360Import.handleFile(file, { setStatus: setStatus, setPreview: setPreview });
      try {
        input.value = "";
      } catch (err) {}
    });
  }

  function tick() {
    var onMetrics = onMetricsTab();
    if (!onMetrics) {
      if (state.boardMounted || q("#" + ROOT_ID)) render();
      return;
    }
    if (!q("#" + ROOT_ID) || !state.boardMounted) render();
  }

  function boot() {
    tick();
    var pending = false;
    var lastOnMetrics = onMetricsTab();
    var obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var now = onMetricsTab();
        if (now !== lastOnMetrics) {
          lastOnMetrics = now;
          state.boardMounted = false;
          render();
          return;
        }
        if (now && !q("#" + ROOT_ID)) {
          state.boardMounted = false;
          render();
        }
      });
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active", "aria-selected", "data-state", "class"],
    });
    setInterval(function () {
      if (onMetricsTab() && !q("#" + ROOT_ID)) {
        state.boardMounted = false;
        render();
      }
    }, 2000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
