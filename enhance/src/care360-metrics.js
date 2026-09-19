/**
 * Tablero de métricas CARE 360 — vista simple por finca / todas las fincas,
 * con capítulos y subcapítulos (criterios).
 */
(function () {
  "use strict";

  var ROOT_ID = "c360-metrics-board";
  var CHAPTER_TITLES = {
    1: "Almacenamiento y manejo de inventario",
    2: "Mediciones y pesaje de PPC's",
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

  function visitFarmId(v) {
    if (!v) return "";
    return String(v.farmId || v.farm_id || "").trim();
  }

  /** Claves normalizadas de una finca (con/sin prefijo «finca»). */
  function farmKeys(name) {
    var n = normFarm(name);
    if (!n) return [];
    var keys = [n];
    if (n.indexOf("finca ") === 0) {
      var stripped = n.slice(6).trim();
      if (stripped) keys.push(stripped);
    } else {
      keys.push("finca " + n);
    }
    return keys;
  }

  /**
   * Misma finca solo por nombre (con alias «finca …»).
   * El farmId no puede meter visitas de otro nombre.
   * Nunca usa responsable/técnico como nombre de finca.
   */
  function sameFarm(visit, farmName, farmId) {
    if (!visit) return false;
    var wantKeys = farmKeys(farmName);
    if (!wantKeys.length) return false;
    var got = normFarm(visit.farm);
    // Defensa: si el campo farm parece un responsable, no emparejar por nombre.
    var resp = normFarm(visit.responsible || visit.technician || "");
    if (got && resp && got === resp) return false;
    if (got) {
      for (var i = 0; i < wantKeys.length; i++) {
        if (got === wantKeys[i]) return true;
      }
      return false;
    }
    // Visita sin nombre: solo si el id coincide y hay id seleccionado.
    var wantId = String(farmId || "").trim();
    var gotId = visitFarmId(visit);
    return !!(wantId && gotId && wantId === gotId);
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

  /**
   * Subcapítulos: promedio no ponderado del cumplimiento por criterio
   * a lo largo de todas las visitas del periodo (peso igual por criterio).
   * Así puede divergir del indicador del capítulo (ponderado / última visita).
   */
  function periodItemAverageScore(visits, chapterId, catalog) {
    var items = (catalog && catalog[chapterId]) || [];
    if (!items.length) {
      var seen = {};
      (visits || []).forEach(function (v) {
        Object.keys(v.answers || {}).forEach(function (id) {
          if (Number(String(id).split(".")[0]) !== Number(chapterId)) return;
          seen[id] = true;
        });
      });
      items = Object.keys(seen).sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true });
      });
    }
    var rates = [];
    items.forEach(function (iid) {
      var app = 0;
      var find = 0;
      (visits || []).forEach(function (v) {
        if (!visitUsable(v)) return;
        var ans = v.answers && v.answers[iid];
        if (!ans) return;
        var val = answerValue(ans);
        if (val === "SI" || val === "NO") {
          app += 1;
          if (val === "NO") find += 1;
        }
      });
      if (app > 0) rates.push(Math.round(((app - find) / app) * 100));
    });
    if (!rates.length) return null;
    return Math.round(
      rates.reduce(function (n, s) {
        return n + s;
      }, 0) / rates.length
    );
  }

  function seriesLabels(mode) {
    if (mode === "farm") {
      return {
        cap: "Última visita",
        sub: "Periodo",
        title: "Cumplimiento por capítulo",
        note:
          "Si el naranja va más alto, la última visita salió más floja que el resto del periodo. Si el azul va más alto, esa visita mejoró.",
      };
    }
    return {
      cap: "Periodo",
      sub: "Por ítem",
      title: "Cumplimiento por capítulo",
      note:
        "Azul junta todas las respuestas del capítulo. Naranja promedia cada ítem con el mismo peso.",
    };
  }

  function capSubDefinitionNote(mode) {
    return seriesLabels(mode).note;
  }

  function snapChaptersLead(mode, data) {
    if (mode === "farm") {
      return (
        "Azul: última visita" +
        (data && data.lastDate ? " (" + formatDateEs(data.lastDate) + ")" : "") +
        " · Naranja: cómo vienen los ítems en el periodo"
      );
    }
    return "Azul: todas las respuestas del periodo · Naranja: promedio de cada ítem";
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
        // Capítulos: cumplimiento ponderado del periodo (todas las respuestas).
        var score = c.applicable ? Math.round(((c.applicable - c.findings) / c.applicable) * 100) : null;
        // Subcapítulos: promedio no ponderado por criterio (peso igual).
        var itemScores = Object.keys(byItem)
          .map(function (iid) {
            return byItem[iid];
          })
          .filter(function (it) {
            return it.chapter === id && it.applicable > 0;
          })
          .map(function (it) {
            return Math.round(((it.applicable - it.findings) / it.applicable) * 100);
          });
        var subScore = itemScores.length
          ? Math.round(
              itemScores.reduce(function (n, s) {
                return n + s;
              }, 0) / itemScores.length
            )
          : null;
        return {
          id: id,
          title: CHAPTER_TITLES[id] || "Capítulo " + id,
          applicable: c.applicable,
          findings: c.findings,
          score: score,
          subScore: subScore,
          subCount: itemScores.length,
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
        var visitRefs = list.map(function (v) {
          return {
            id: v.id || "",
            farm: String(v.farm || "").trim(),
            date: v.date || date,
            responsible: v.responsible || v.technician || "",
            score: visitScore(v).score,
            findings: visitScore(v).findings,
          };
        });
        return {
          date: date,
          label: formatDateEs(date),
          shortLabel: formatDateShort(date),
          score: score,
          findings: find,
          visits: list.length,
          status: scoreStatus(score),
          farm: timelineFarmLabel(visitRefs),
          responsible:
            visitRefs.length === 1 ? visitRefs[0].responsible || "" : "",
          visitRefs: visitRefs,
        };
      });
    return bucketTimeline(daily);
  }

  /** Nombre(s) de finca desde visitRefs — nunca cae al farm del filtro UI. */
  function timelineFarmLabel(visitRefs) {
    var names = [];
    var seen = {};
    (visitRefs || []).forEach(function (vr) {
      var n = String((vr && vr.farm) || "").trim();
      if (!n) return;
      var key = n.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      names.push(n);
    });
    if (!names.length) return "";
    if (names.length === 1) return names[0];
    if (names.length <= 3) return names.join(", ");
    return names.length + " fincas";
  }

  /** Filas del informe: una por visita cuando hay visitRefs (finca correcta). */
  function expandTimelineForReport(timeline) {
    var out = [];
    (timeline || []).forEach(function (r) {
      if (r && r.visitRefs && r.visitRefs.length) {
        r.visitRefs.forEach(function (vr) {
          var score = vr.score != null ? vr.score : r.score;
          out.push({
            date: vr.date || r.date,
            label: formatDateEs(vr.date || r.date),
            shortLabel: formatDateShort(vr.date || r.date),
            score: score,
            findings: vr.findings != null ? vr.findings : r.findings,
            status: scoreStatus(score),
            responsible: vr.responsible || "",
            farm: vr.farm || "",
          });
        });
        return;
      }
      out.push({
        date: r.date,
        label: r.label || formatDateEs(r.date),
        shortLabel: r.shortLabel || formatDateShort(r.date),
        score: r.score,
        findings: r.findings,
        status: r.status || scoreStatus(r.score),
        responsible: r.responsible || "",
        farm: r.farm || "",
      });
    });
    return out;
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
          farm: timelineFarmLabel(b.visitRefs),
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
      if (farmName && !sameFarm(v, farmName, state.farmId)) return false;
      return inDateRange(v.date, win && win.from, win && win.to);
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
      chaptersNote: snapChaptersLead(state.mode, data),
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
        if (state.mode === "farm") {
          lines.push("Fecha,Indicador %,Hallazgos,Estado,Responsable");
          data.timeline.forEach(function (r) {
            lines.push(
              [
                formatDateEs(r.date) || r.label,
                r.score,
                r.findings,
                statusLabel(r.status),
                r.responsible || "",
              ]
                .map(csvEscape)
                .join(",")
            );
          });
        } else {
          lines.push("Fecha,Indicador %,Hallazgos,Estado,Responsable,Finca");
          data.timeline.forEach(function (r) {
            lines.push(
              [
                formatDateEs(r.date) || r.label,
                r.score,
                r.findings,
                statusLabel(r.status),
                r.responsible || "",
                r.farm || timelineFarmLabel(r.visitRefs) || "",
              ]
                .map(csvEscape)
                .join(",")
            );
          });
        }
        lines.push("");
      }
      if (data.chapters && data.chapters.length) {
        lines.push(snap.chaptersNote);
        var series = seriesLabels(state.mode);
        lines.push(
          "Capítulo,Título," +
            series.cap +
            " %," +
            series.sub +
            " %,Hallazgos,Aplicables,Estado"
        );
        data.chapters.forEach(function (c) {
          lines.push(
            [
              c.id,
              c.title,
              c.score,
              c.subScore != null ? c.subScore : "",
              c.findings,
              c.applicable,
              statusLabel(c.status),
            ]
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

  function reportToneClass(status) {
    if (status === "healthy") return "ok";
    if (status === "acceptable") return "mid";
    if (status === "critical") return "bad";
    return "mute";
  }

  function reportScoreTone(score) {
    return reportToneClass(scoreStatus(score));
  }

  /**
   * SVG de Evolución para el informe HTML/PDF (auto-contenido, print-friendly).
   * Misma lectura que chartLine del tablero: meta 80%, puntos, etiquetas, chips.
   */
  function reportLineChart(rows) {
    var points = (rows || []).filter(function (r) {
      return r && r.score != null;
    });
    if (!points.length) {
      return (
        "<div class='linechart empty'><div class='linechart-exec'>" +
        "<span class='chip-line target'><i></i>Meta " +
        META_TARGET +
        "%</span>" +
        "<span class='chip-line mute'>Sin puntos aún</span></div>" +
        "<p class='muted'>Cuando haya visitas revisadas en el periodo, verás la tendencia frente a la meta.</p></div>"
      );
    }

    var W = 720;
    var H = 300;
    var padL = 36;
    var padR = 24;
    var padT = 36;
    var padB = 44;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    function yAt(pct) {
      return padT + innerH - (Math.max(0, Math.min(100, pct)) / 100) * innerH;
    }
    function scoreLabel(score) {
      var n = Number(score);
      if (isNaN(n)) return "—";
      return (Math.round(n * 10) / 10).toFixed(n % 1 === 0 ? 0 : 1) + "%";
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

    var coords = points.map(function (p, i) {
      var x =
        padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
      return { x: x, y: yAt(p.score), p: p };
    });
    var metaY = yAt(META_TARGET);
    var last = points[points.length - 1];
    var prev = points.length > 1 ? points[points.length - 2] : null;
    var stepDelta = last && prev ? deltaPts(last.score, prev.score) : null;
    var lastStatus = scoreStatus(last.score);
    var lastVsMeta = vsMetaPts(last.score);
    var sparse = points.length < 3;
    var lineColor = "#1f8a5b";
    var metaColor = "#007fa3";

    var exec =
      "<div class='linechart-exec' role='list' aria-label='Resumen de evolución'>" +
      "<span class='chip-line target' role='listitem'><i></i>Meta " +
      META_TARGET +
      "%</span>" +
      "<span class='chip-line tone-" +
      reportToneClass(lastStatus) +
      "' role='listitem'><i></i>Último " +
      scoreLabel(last.score) +
      " · " +
      escapeHtml(statusLabel(lastStatus)) +
      "</span>";
    if (stepDelta != null && !isNaN(stepDelta)) {
      exec +=
        "<span class='chip-line delta' role='listitem'>" +
        escapeHtml(formatSignedPts(stepDelta)) +
        " vs visita anterior</span>";
    }
    if (lastVsMeta != null && !isNaN(lastVsMeta)) {
      exec +=
        "<span class='chip-line delta' role='listitem'>" +
        escapeHtml(formatSignedPts(lastVsMeta)) +
        " vs meta</span>";
    }
    exec += "</div>";

    var svg =
      '<svg viewBox="0 0 ' +
      W +
      " " +
      H +
      '" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolución del indicador vs meta ' +
      META_TARGET +
      '%">';

    for (var g = 0; g <= 4; g++) {
      var gy = padT + (innerH * g) / 4;
      var gPct = 100 - g * 25;
      svg +=
        '<line x1="' +
        padL +
        '" y1="' +
        gy +
        '" x2="' +
        (W - padR) +
        '" y2="' +
        gy +
        '" stroke="#e8eef1" stroke-width="1"/>';
      svg +=
        '<text x="' +
        (padL - 8) +
        '" y="' +
        (gy + 3) +
        '" text-anchor="end" font-size="11" fill="#5b6f76" font-family="Segoe UI,Helvetica Neue,sans-serif">' +
        gPct +
        "</text>";
    }

    svg +=
      '<line x1="' +
      padL +
      '" y1="' +
      metaY +
      '" x2="' +
      (W - padR) +
      '" y2="' +
      metaY +
      '" stroke="' +
      metaColor +
      '" stroke-width="1.75" stroke-dasharray="6 5"/>';

    var path = smoothPath(coords);
    if (coords.length >= 2) {
      var area =
        path +
        " L " +
        coords[coords.length - 1].x +
        " " +
        (padT + innerH) +
        " L " +
        coords[0].x +
        " " +
        (padT + innerH) +
        " Z";
      svg += '<path d="' + area + '" fill="rgba(31,138,91,0.06)"/>';
    }
    svg +=
      '<path d="' +
      path +
      '" fill="none" stroke="' +
      lineColor +
      '" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>';

    coords.forEach(function (c, idx) {
      var isLast = idx === coords.length - 1;
      var isFirst = idx === 0;
      var aboveMeta = c.y < metaY - 2;
      var nearMeta = Math.abs(c.y - metaY) < 18;
      var preferAbove = true;
      if (nearMeta && !aboveMeta) preferAbove = false;
      if (c.y > padT + innerH - 28) preferAbove = true;
      var labelY = preferAbove ? c.y - 14 : c.y + 20;
      if (preferAbove && labelY < padT + 10) labelY = padT + 12;

      var xLabel = c.p.shortLabel || c.p.label || formatDateShort(c.p.date);
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

      svg +=
        '<circle cx="' +
        c.x +
        '" cy="' +
        c.y +
        '" r="' +
        (isLast ? 7 : 6) +
        '" fill="#fff" stroke="' +
        lineColor +
        '" stroke-width="' +
        (isLast ? 3 : 2.5) +
        '"/>';
      svg +=
        '<text x="' +
        valX +
        '" y="' +
        labelY +
        '" text-anchor="' +
        valAnchor +
        '" font-size="13" font-weight="700" fill="#14262c" font-family="Segoe UI,Helvetica Neue,sans-serif">' +
        scoreLabel(c.p.score) +
        "</text>";
      svg +=
        '<text x="' +
        xPos +
        '" y="' +
        (H - 10) +
        '" text-anchor="' +
        xAnchor +
        '" font-size="11" fill="#5b6f76" font-family="Segoe UI,Helvetica Neue,sans-serif">' +
        escapeHtml(xLabel) +
        "</text>";
    });

    svg += "</svg>";

    var note = "";
    if (points.length === 1) {
      note = "<p class='linechart-note'>Una sola visita · sumá aseguramientos para ver evolución.</p>";
    } else if (sparse) {
      note = "<p class='linechart-note'>Pocas visitas · la tendencia se aclara con más datos.</p>";
    }

    return "<div class='linechart'>" + exec + svg + note + "</div>";
  }

  function buildExportReportHtml() {
    var snap = exportSnapshot();
    if (!snap) return "";
    var data = snap.data;
    var cmp = snap.cmp;
    var debrand = window.__C360_DEBRAND === true;
    var title = snap.brand + " · Informe de métricas · " + snap.modeLabel;
    var generated = formatDateEs(isoDate(new Date()));
    var accent = debrand ? "#1e7a3c" : "#007fa3";
    var accentDeep = debrand ? "#14532d" : "#005f7a";
    var accentSoft = debrand ? "#e7f3ea" : "#e8f6fa";

    function pill(text, tone) {
      return (
        "<span class='pill tone-" +
        (tone || "mute") +
        "'>" +
        escapeHtml(String(text == null ? "—" : text)) +
        "</span>"
      );
    }

    function scoreCell(score) {
      if (score == null || score === "") return "<span class='muted'>—</span>";
      var n = Number(score);
      var tone = reportScoreTone(n);
      var w = Math.max(0, Math.min(100, n));
      return (
        "<div class='score-cell tone-" +
        tone +
        "'><strong>" +
        n +
        "%</strong><span class='bar'><i style='width:" +
        w +
        "%'></i></span></div>"
      );
    }

    function kpiCard(label, value, note, tone) {
      return (
        "<article class='kpi tone-" +
        (tone || "mute") +
        "'><span class='kpi-label'>" +
        escapeHtml(label) +
        "</span><strong class='kpi-value'>" +
        escapeHtml(String(value == null ? "—" : value)) +
        "</strong>" +
        (note ? "<span class='kpi-note'>" + escapeHtml(note) + "</span>" : "") +
        "</article>"
      );
    }

    function section(titleText, lead, inner) {
      return (
        "<section class='block'><div class='block-head'><h2>" +
        escapeHtml(titleText) +
        "</h2>" +
        (lead ? "<p>" + escapeHtml(lead) + "</p>" : "") +
        "</div>" +
        inner +
        "</section>"
      );
    }

    function table(headers, rows, opts) {
      opts = opts || {};
      var h =
        "<div class='table-wrap'><table class='" +
        (opts.compact ? "compact" : "") +
        "'><thead><tr>" +
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
            .map(function (c, idx) {
              var raw = c;
              var html =
                opts.htmlCols && opts.htmlCols[idx]
                  ? String(raw == null ? "" : raw)
                  : escapeHtml(String(raw == null ? "" : raw));
              return "<td>" + html + "</td>";
            })
            .join("") +
          "</tr>";
      });
      return h + "</tbody></table></div>";
    }

    var body = "";
    body += "<header class='hero'>";
    body += "<div class='hero-top'>";
    body += "<div class='lockup'><span class='mark'>" + escapeHtml(snap.brand) + "</span>";
    body += "<span class='tag'>Acompañamiento en campo</span></div>";
    body += "<div class='hero-meta'>";
    body += pill(snap.modeLabel, "info");
    body += pill("Generado " + generated, "mute");
    body += "</div></div>";
    body += "<h1>Informe de métricas</h1>";
    body +=
      "<p class='hero-lead'>Lectura del aseguramiento MIPE" +
      (state.mode === "farm" && state.farm ? " · " + escapeHtml(state.farm) : "") +
      ".</p>";
    body += "<div class='hero-chips'>";
    body +=
      "<div class='chip'><span>Periodo</span><strong>" +
      escapeHtml(snap.periodFrom) +
      " → " +
      escapeHtml(snap.periodTo) +
      "</strong></div>";
    if (cmp && cmp.enabled && cmp.prevWin) {
      body +=
        "<div class='chip'><span>Comparado con</span><strong>" +
        escapeHtml(formatDateEs(cmp.prevWin.from)) +
        " → " +
        escapeHtml(formatDateEs(cmp.prevWin.to)) +
        "</strong></div>";
    }
    body +=
      "<div class='chip'><span>Alcance</span><strong>" +
      escapeHtml(snap.modeLabel) +
      "</strong></div>";
    body += "</div></header>";

    var scoreTone = reportScoreTone(snap.score);
    var mixVsMeta = vsMetaPts(snap.mix.score);
    var doseVsMeta = vsMetaPts(snap.dose.score);
    body += "<section class='kpi-strip'>";
    body += kpiCard(
      "Indicador",
      snap.score == null ? "—" : snap.score + "%",
      cmp && cmp.enabled
        ? fmtDelta(cmp.scoreDelta, " pts")
        : snap.score != null
          ? formatSignedPts(vsMetaPts(snap.score)) + " vs meta " + META_TARGET + "%"
          : "Cumplimiento",
      scoreTone
    );
    body += kpiCard(
      "Mezclas",
      snap.mix.score == null ? "—" : snap.mix.score + "%",
      mixVsMeta != null
        ? formatSignedPts(mixVsMeta) + " vs meta " + META_TARGET + "%"
        : "Capítulo 4",
      reportScoreTone(snap.mix.score)
    );
    body += kpiCard(
      "Dosis",
      snap.dose.score == null ? "—" : snap.dose.score + "%",
      doseVsMeta != null
        ? formatSignedPts(doseVsMeta) + " vs meta " + META_TARGET + "%"
        : "Capítulo 2",
      reportScoreTone(snap.dose.score)
    );
    body += kpiCard(
      "Hallazgos",
      data.findings || 0,
      cmp && cmp.enabled
        ? fmtDelta(cmp.findingsDelta, "")
        : "suma del periodo · " +
            (data.visits || 0) +
            " visita" +
            ((data.visits || 0) === 1 ? "" : "s"),
      data.findings ? "bad" : "ok"
    );
    body += kpiCard(
      "Visitas",
      data.visits || 0,
      cmp && cmp.enabled ? fmtDelta(cmp.visitsDelta, "") : "Revisadas",
      "info"
    );
    body += "</section>";

    if (snap.alerts.length) {
      body += section(
        "Qué atender",
        "Prioridades detectadas en el periodo seleccionado.",
        "<div class='alert-grid'>" +
          snap.alerts
            .map(function (a) {
              var tone =
                a.tone === "critical" ? "bad" : a.tone === "healthy" ? "ok" : "mid";
              var label =
                a.tone === "critical" ? "Crítico" : a.tone === "healthy" ? "OK" : "Atención";
              return (
                "<article class='alert tone-" +
                tone +
                "'><header>" +
                pill(label, tone) +
                "<strong>" +
                escapeHtml(a.title || "") +
                "</strong></header><p>" +
                escapeHtml(a.text || "") +
                "</p>" +
                (a.farm && state.mode !== "farm"
                  ? "<footer>" + escapeHtml(a.farm) + (a.chapter != null ? " · Cap. " + a.chapter : "") + "</footer>"
                  : a.chapter != null
                    ? "<footer>Capítulo " + a.chapter + "</footer>"
                    : "") +
                "</article>"
              );
            })
            .join("") +
          "</div>"
      );
    }

    if (data.farms && data.farms.length) {
      body += section(
        "Resumen por finca",
        data.farms.length + " finca" + (data.farms.length === 1 ? "" : "s") + " en el periodo.",
        table(
          ["Finca", "Visitas", "Indicador", "Hallazgos", "Estado", "Primera", "Última"],
          data.farms.map(function (f) {
            return [
              "<strong>" + escapeHtml(f.name) + "</strong>",
              f.visits,
              scoreCell(f.score),
              f.findings,
              pill(statusLabel(f.status), reportToneClass(f.status)),
              formatDateEs(f.firstDate),
              formatDateEs(f.lastDate),
            ];
          }),
          { htmlCols: { 0: true, 2: true, 4: true } }
        )
      );
    }

    if (data.timeline && data.timeline.length) {
      var farmOnly = state.mode === "farm";
      var chartRows = (data.chartTimeline || data.timeline || [])
        .filter(function (r) {
          return r && r.score != null;
        })
        .slice(-12);
      var chartHtml = reportLineChart(chartRows);
      var tableRows = farmOnly
        ? data.timeline
        : expandTimelineForReport(data.timeline);
      var evoLead = farmOnly
        ? "Historial de «" + (state.farm || "la finca seleccionada") + "»."
        : data.firstDate || data.lastDate
          ? formatDateEs(data.firstDate) +
            " → " +
            formatDateEs(data.lastDate) +
            " · " +
            (data.visits || tableRows.length) +
            " visitas" +
            (data.farms && data.farms.length
              ? " · " +
                data.farms.length +
                " finca" +
                (data.farms.length === 1 ? "" : "s")
              : "")
          : "Puntos del periodo con indicador y hallazgos.";
      body += section(
        farmOnly ? "Visitas por fecha" : "Evolución / visitas",
        evoLead,
        chartHtml +
          (farmOnly
            ? table(
                ["Fecha", "Indicador", "Hallazgos", "Estado", "Responsable"],
                tableRows.map(function (r) {
                  return [
                    r.label || formatDateEs(r.date),
                    scoreCell(r.score),
                    r.findings,
                    pill(statusLabel(r.status), reportToneClass(r.status)),
                    r.responsible || "—",
                  ];
                }),
                { htmlCols: { 1: true, 3: true } }
              )
            : table(
                ["Fecha", "Indicador", "Hallazgos", "Estado", "Responsable", "Finca"],
                tableRows.map(function (r) {
                  return [
                    r.label || formatDateEs(r.date),
                    scoreCell(r.score),
                    r.findings,
                    pill(statusLabel(r.status), reportToneClass(r.status)),
                    r.responsible || "—",
                    r.farm || "—",
                  ];
                }),
                { htmlCols: { 1: true, 3: true } }
              ))
      );
    }

    if (data.chapters && data.chapters.length) {
      var capSubHtml = "";
      var capRows = data.chapters.filter(function (c) {
        return c && (c.score != null || c.subScore != null);
      });
      if (capRows.length) {
        capSubHtml =
          "<div class='groupbars capsub'><div class='groupbars-leg'>" +
          "<span class='cap'><i></i>" +
          escapeHtml(seriesLabels(farmOnly ? "farm" : "all").cap) +
          "</span>" +
          "<span class='sub'><i></i>" +
          escapeHtml(seriesLabels(farmOnly ? "farm" : "all").sub) +
          "</span>" +
          "<span class='t'><i></i>Meta " +
          META_TARGET +
          "%</span></div><div class='groupbars-plot pair'>";
        capRows.forEach(function (c) {
          var cap = c.score != null ? Number(c.score) : null;
          var sub = c.subScore != null ? Number(c.subScore) : null;
          var capH = cap == null ? 0 : Math.max(0, Math.min(100, cap));
          var subH = sub == null ? 0 : Math.max(0, Math.min(100, sub));
          capSubHtml +=
            "<div class='groupbars-col'><div class='groupbars-pair'>" +
            (cap == null
              ? ""
              : "<div class='groupbars-bar cap' style='height:" +
                Math.max(capH, 4) +
                "%'><span>" +
                cap +
                "%</span></div>") +
            (sub == null
              ? ""
              : "<div class='groupbars-bar sub' style='height:" +
                Math.max(subH, 4) +
                "%'><span>" +
                sub +
                "%</span></div>") +
            "</div><div class='groupbars-x'>" +
            escapeHtml(c.id + ". " + shortTitle(c.title || "")) +
            "</div></div>";
        });
        capSubHtml +=
          "</div><p class='muted' style='margin:8px 0 0;font-size:11.5px'>" +
          escapeHtml(capSubDefinitionNote(farmOnly ? "farm" : "all")) +
          "</p></div>";
      }
      body += section(
        seriesLabels(farmOnly ? "farm" : "all").title,
        snap.chaptersNote + " · meta " + META_TARGET + "%.",
        capSubHtml +
          table(
            [
              "Capítulo",
              seriesLabels(farmOnly ? "farm" : "all").cap + " %",
              seriesLabels(farmOnly ? "farm" : "all").sub + " %",
              "Hallazgos",
              "Aplicables",
              "Estado",
            ],
            data.chapters.map(function (c) {
              return [
                "<strong>" + escapeHtml(c.id + ". " + c.title) + "</strong>",
                scoreCell(c.score),
                scoreCell(c.subScore),
                c.findings,
                c.applicable,
                pill(statusLabel(c.status), reportToneClass(c.status)),
              ];
            }),
            { htmlCols: { 0: true, 1: true, 2: true, 5: true } }
          )
      );
    }

    if (data.items && data.items.length) {
      body += section(
        snap.findingsNote,
        "Criterios con respuesta No cumple.",
        table(
          ["Ítem", "Capítulo", "Hallazgos", "Frecuencia", "Observación", "Recomendación"],
          data.items.map(function (it) {
            return [
              "<strong>" + escapeHtml(it.id) + "</strong>",
              it.chapterTitle || CHAPTER_TITLES[it.chapter] || it.chapter || "",
              it.findings != null ? it.findings : 1,
              it.rate != null ? it.rate + "%" : "—",
              it.observation || "—",
              it.recommendation || "—",
            ];
          }),
          { htmlCols: { 0: true }, compact: true }
        )
      );
    }

    body +=
      "<footer class='foot'><div><strong>" +
      escapeHtml(snap.brand) +
      "</strong><span>Informe completo de métricas del tablero</span></div><span>Generado " +
      escapeHtml(generated) +
      "</span></footer>";

    var css =
      ":root{--accent:" +
      accent +
      ";--accent-deep:" +
      accentDeep +
      ";--accent-soft:" +
      accentSoft +
      ";--ink:#14262c;--muted:#5b6f76;--line:#d5e3e8;--paper:#f4fafb;--card:#ffffff}" +
      "*{box-sizing:border-box}" +
      "body{margin:0 auto;padding:28px 22px 40px;max-width:980px;color:var(--ink);background:" +
      "linear-gradient(180deg,var(--accent-soft) 0%,#fff 220px,#fff 100%);" +
      "font-family:'Avenir Next','Segoe UI','Helvetica Neue',sans-serif;line-height:1.45}" +
      ".hero{margin:0 0 22px;padding:22px 22px 18px;border-radius:20px;background:" +
      "linear-gradient(135deg,var(--accent-deep) 0%,var(--accent) 58%,#00a0c0 100%);color:#fff;" +
      "box-shadow:0 18px 40px rgb(0 90 110 / 18%)}" +
      ".hero-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}" +
      ".lockup{display:flex;flex-direction:column;gap:4px}" +
      ".mark{font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:.02em}" +
      ".tag{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.82}" +
      ".hero-meta{display:flex;gap:8px;flex-wrap:wrap}" +
      ".hero h1{margin:18px 0 6px;font-size:28px;line-height:1.15;letter-spacing:-.03em;font-weight:700}" +
      ".hero-lead{margin:0 0 14px;opacity:.9;font-size:14px;max-width:42rem}" +
      ".hero-chips{display:flex;gap:10px;flex-wrap:wrap}" +
      ".chip{min-width:140px;padding:10px 12px;border-radius:12px;background:rgb(255 255 255 / 14%);backdrop-filter:blur(4px)}" +
      ".chip span{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.8;margin-bottom:2px}" +
      ".chip strong{font-size:13px;font-weight:600}" +
      ".kpi-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 22px}" +
      ".kpi{padding:14px 14px 12px;border-radius:16px;background:var(--card);border:1px solid var(--line);" +
      "box-shadow:0 8px 24px rgb(20 38 44 / 4%)}" +
      ".kpi-label{display:block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}" +
      ".kpi-value{display:block;font-size:28px;line-height:1;letter-spacing:-.03em;font-weight:700}" +
      ".kpi-note{display:block;margin-top:8px;font-size:12px;color:var(--muted)}" +
      ".kpi.tone-ok .kpi-note{color:#146b45}" +
      ".kpi.tone-mid .kpi-note{color:#8a5a00}" +
      ".kpi.tone-bad .kpi-note{color:#9b1c1c}" +
      ".kpi.tone-info .kpi-note{color:#0b5f74}" +
      ".kpi.tone-ok{border-color:#b7e0c5;background:linear-gradient(180deg,#f3fbf6,#fff)}" +
      ".kpi.tone-mid{border-color:#f0d59a;background:linear-gradient(180deg,#fff9ef,#fff)}" +
      ".kpi.tone-bad{border-color:#f0b4ae;background:linear-gradient(180deg,#fff5f3,#fff)}" +
      ".kpi.tone-info{border-color:#b7dceb;background:linear-gradient(180deg,#f3fafc,#fff)}" +
      ".block{margin:0 0 18px;padding:16px 16px 14px;border:1px solid var(--line);border-radius:18px;background:var(--card)}" +
      ".block-head{margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--line)}" +
      ".block-head h2{margin:0 0 4px;font-size:16px;letter-spacing:-.01em;color:var(--accent-deep)}" +
      ".block-head p{margin:0;font-size:13px;color:var(--muted)}" +
      ".alert-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}" +
      ".alert{padding:12px;border-radius:14px;border:1px solid var(--line);background:#fbfefe}" +
      ".alert header{display:flex;gap:8px;align-items:center;margin-bottom:6px}" +
      ".alert strong{font-size:13px}" +
      ".alert p{margin:0;font-size:12.5px;color:var(--muted)}" +
      ".alert footer{margin-top:8px;font-size:11px;color:var(--muted)}" +
      ".alert.tone-bad{border-color:#f0b4ae;background:#fff7f6}" +
      ".alert.tone-mid{border-color:#f0d59a;background:#fffaf0}" +
      ".alert.tone-ok{border-color:#b7e0c5;background:#f5fbf7}" +
      ".pill{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10.5px;" +
      "font-weight:700;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}" +
      ".pill.tone-ok{background:#d9f2e3;color:#146b45}" +
      ".pill.tone-mid{background:#f8e7b8;color:#8a5a00}" +
      ".pill.tone-bad{background:#f8d4cf;color:#9b1c1c}" +
      ".pill.tone-info{background:#d7eef6;color:#0b5f74}" +
      ".pill.tone-mute{background:#e8eef1;color:#4d6168}" +
      ".hero .pill.tone-info,.hero .pill.tone-mute{background:rgb(255 255 255 / 18%);color:#fff}" +
      ".table-wrap{overflow:auto;border-radius:12px;border:1px solid var(--line)}" +
      "table{width:100%;border-collapse:collapse;font-size:12.5px}" +
      "th,td{padding:10px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}" +
      "th{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);background:var(--paper)}" +
      "tbody tr:nth-child(even) td{background:#fafcfd}" +
      "tbody tr:last-child td{border-bottom:0}" +
      "table.compact td,table.compact th{padding:8px}" +
      ".score-cell{min-width:88px}" +
      ".score-cell strong{display:block;font-size:13px;margin-bottom:4px}" +
      ".bar{display:block;height:6px;border-radius:999px;background:#e6eef1;overflow:hidden}" +
      ".bar i{display:block;height:100%;border-radius:inherit;background:var(--accent)}" +
      ".score-cell.tone-ok .bar i{background:#1f8a5b}" +
      ".score-cell.tone-mid .bar i{background:#c98512}" +
      ".score-cell.tone-bad .bar i{background:#c23b2e}" +
      ".groupbars{margin:0 0 14px;padding:12px 12px 8px;border:1px solid var(--line);border-radius:14px;background:#fff}" +
      ".groupbars-leg{display:flex;flex-wrap:wrap;gap:10px 14px;margin:0 0 10px;font-size:11px;font-weight:700;color:var(--muted)}" +
      ".groupbars-leg span{display:inline-flex;align-items:center;gap:6px}" +
      ".groupbars-leg i{width:10px;height:10px;border-radius:3px;background:var(--accent)}" +
      ".groupbars-leg .t i{width:3px;height:12px;border-radius:1px;background:#007fa3}" +
      ".groupbars-leg .cap i{background:#5b9bd5}" +
      ".groupbars-leg .sub i{background:#ed7d31}" +
      ".groupbars-plot{display:flex;align-items:flex-end;gap:10px;min-height:160px;padding:8px 4px 0;" +
      "border-bottom:1px solid var(--line);background:linear-gradient(180deg,transparent 19%,#eef4f6 20%,transparent 21%," +
      "transparent 39%,#eef4f6 40%,transparent 41%,transparent 59%,#eef4f6 60%,transparent 61%,transparent 79%,#eef4f6 80%,transparent 81%)}" +
      ".groupbars-col{flex:1 1 0;min-width:36px;display:flex;flex-direction:column;align-items:center;gap:6px}" +
      ".groupbars-pair{display:flex;align-items:flex-end;justify-content:center;gap:3px;width:100%;height:140px}" +
      ".groupbars-bar{width:100%;max-width:42px;border-radius:8px 8px 3px 3px;min-height:4px;display:flex;align-items:flex-start;" +
      "justify-content:center;padding-top:4px;color:#fff;font-size:10px;font-weight:700;background:var(--accent)}" +
      ".groupbars-plot.pair .groupbars-bar{max-width:22px;font-size:9px}" +
      ".groupbars-bar.tone-ok{background:linear-gradient(180deg,#3cb87f,#1f8a5b)}" +
      ".groupbars-bar.tone-mid{background:linear-gradient(180deg,#e0a63a,#c98512)}" +
      ".groupbars-bar.tone-bad{background:linear-gradient(180deg,#e06b5c,#c44b3c)}" +
      ".groupbars-bar.cap{background:linear-gradient(180deg,#7eb3de,#5b9bd5)}" +
      ".groupbars-bar.sub{background:linear-gradient(180deg,#f2a06a,#ed7d31)}" +
      ".groupbars-x{font-size:10px;color:var(--muted);text-align:center;line-height:1.2;max-width:72px}" +
      ".linechart{margin:0 0 14px;padding:12px 12px 8px;border:1px solid var(--line);border-radius:14px;background:#fff}" +
      ".linechart.empty{padding:16px}" +
      ".linechart-exec{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}" +
      ".chip-line{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:11.5px;" +
      "font-weight:700;border:1px solid var(--line);background:#f7fafb;color:var(--muted)}" +
      ".chip-line i{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 auto}" +
      ".chip-line.target{color:var(--accent);border-color:#b7dceb;background:#f0f9fc}" +
      ".chip-line.target i{width:14px;height:0;border-radius:0;border-top:2px dashed var(--accent);background:transparent}" +
      ".chip-line.tone-ok{color:#146b45;border-color:#b7e0c5;background:#f3fbf6}" +
      ".chip-line.tone-ok i{background:#1f8a5b}" +
      ".chip-line.tone-mid{color:#8a5a00;border-color:#f0d59a;background:#fff9ef}" +
      ".chip-line.tone-mid i{background:#c98512}" +
      ".chip-line.tone-bad{color:#9b1c1c;border-color:#f0b4ae;background:#fff5f3}" +
      ".chip-line.tone-bad i{background:#c44b3c}" +
      ".chip-line.delta{font-weight:600;color:var(--ink)}" +
      ".chip-line.mute{background:#eef2f4}" +
      ".linechart svg{display:block;width:100%;height:auto;max-height:280px}" +
      ".linechart-note{margin:8px 0 2px;font-size:11.5px;color:var(--muted);font-style:italic}" +
      ".muted{color:var(--muted)}" +
      ".foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end;" +
      "margin-top:8px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}" +
      ".foot strong{display:block;color:var(--ink);font-size:13px;margin-bottom:2px}" +
      "@media (max-width:820px){.kpi-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi:first-child{grid-column:1/-1}}" +
      "@media print{body{padding:12px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      ".hero{box-shadow:none;break-inside:avoid}.kpi,.block,.alert{break-inside:avoid}" +
      ".kpi-strip{gap:8px}.block{box-shadow:none}}";

    return (
      "<!doctype html><html lang='es'><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" +
      escapeHtml(title) +
      "</title><style>" +
      css +
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
      if (!sameFarm(v, farmName, state.farmId)) return false;
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

    var canonical = String(farmName || "").trim();
    var timeline = filtered.map(function (v) {
      var st = visitScore(v);
      return {
        id: v.id || "",
        farm: canonical,
        farmActual: String(v.farm || "").trim(),
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
        // Capítulos: indicador ponderado de la última visita.
        var st = last
          ? chapterScore(last.answers || {}, id, catalog)
          : { applicable: 0, findings: 0, score: null };
        // Subcapítulos: promedio por criterio en todo el periodo (puede divergir).
        var subScore = periodItemAverageScore(filtered, id, catalog);
        var subCount = (catalog[id] || []).filter(function (iid) {
          return filtered.some(function (v) {
            var val = v.answers && v.answers[iid] && answerValue(v.answers[iid]);
            return val === "SI" || val === "NO";
          });
        }).length;
        return {
          id: id,
          title: CHAPTER_TITLES[id],
          applicable: st.applicable,
          findings: st.findings,
          score: st.score,
          subScore: subScore,
          subCount: subCount,
          status: scoreStatus(st.score),
        };
      })
      .filter(function (c) {
        return c.applicable > 0 || c.subScore != null;
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

  /** Celda % con barra de color (estilo informe) para el tablero. */
  function scoreCell(score) {
    if (score == null || score === "" || isNaN(Number(score))) {
      return '<span class="muted">—</span>';
    }
    var n = Number(score);
    var tone = scoreStatus(n);
    return (
      '<div class="c360-score-cell tone-' +
      tone +
      '"><strong>' +
      n +
      "%</strong>" +
      barHtml(n, tone) +
      "</div>"
    );
  }

  /**
   * Tabla Capítulos / Subcapítulos del informe, reutilizada en el tablero.
   * Filas tocables para enfocar el mismo capítulo que el gráfico.
   */
  function renderCapSubTable(chapters) {
    var rows = (chapters || []).filter(function (c) {
      return c && (c.score != null || c.subScore != null || c.applicable > 0);
    });
    if (!rows.length) return "";
    var series = seriesLabels(state.mode);

    var focusCh =
      state.focus && state.focus.type === "chapter" ? Number(state.focus.chapter) : null;

    var html =
      '<div class="c360-metrics-table-wrap c360-capsub-table-wrap">' +
      '<table class="c360-metrics-table c360-capsub-table">' +
      "<thead><tr>" +
      "<th>Capítulo</th>" +
      "<th>" +
      escapeHtml(series.cap) +
      "</th>" +
      "<th>" +
      escapeHtml(series.sub) +
      "</th>" +
      "<th>Hall.</th>" +
      "<th>Aplicables</th>" +
      "<th>Estado</th>" +
      "</tr></thead><tbody>";

    rows.forEach(function (c) {
      var status = c.status || scoreStatus(c.score);
      var isOn = focusCh != null && Number(c.id) === focusCh;
      var label = c.id + ". " + (c.title || CHAPTER_TITLES[c.id] || "Capítulo " + c.id);
      html +=
        '<tr class="c360-capsub-row' +
        (isOn ? " is-selected" : "") +
        '" data-focus-chapter="' +
        c.id +
        '" tabindex="0" role="button" aria-pressed="' +
        (isOn ? "true" : "false") +
        '" title="Ver detalle de ' +
        escapeHtml(label) +
        '">';
      html += td("Capítulo", "<strong>" + escapeHtml(label) + "</strong>");
      html += td(series.cap, scoreCell(c.score));
      html += td(series.sub, scoreCell(c.subScore));
      html += td("Hallazgos", String(c.findings != null ? c.findings : "—"));
      html += td("Aplicables", String(c.applicable != null ? c.applicable : "—"));
      html += td(
        "Estado",
        '<span class="c360-mpill tone-' +
          status +
          '">' +
          escapeHtml(statusLabel(status)) +
          "</span>"
      );
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    return html;
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
    if (points.length === 1) {
      html +=
        '<p class="c360-linechart-sparse-note">Una sola visita · sumá aseguramientos para ver evolución.</p>';
    } else if (sparse) {
      html +=
        '<p class="c360-linechart-sparse-note">Pocas visitas · la tendencia se aclara con más datos.</p>';
    }
    html += "</div>";
    return html;
  }

  /**
   * Barras agrupadas Capítulos vs Subcapítulos (estilo Excel Fig1/Fig2).
   * Capítulos = indicador del capítulo (última visita en finca / periodo en Todas).
   * Subcapítulos = promedio de cumplimiento por criterio en el periodo.
   * Tocá un capítulo para abrir el detalle.
   */
  function chartCapitulosSubcapitulos(chapters) {
    var series = seriesLabels(state.mode);
    var rows = (chapters || []).filter(function (c) {
      return c && (c.score != null || c.subScore != null);
    });
    if (!rows.length) {
      return (
        '<div class="c360-groupbars c360-groupbars-empty">' +
        "<p><strong>Sin datos de capítulos</strong></p>" +
        "<p>Cuando haya visitas revisadas, verás la última visita junto al promedio de los ítems en el periodo.</p></div>"
      );
    }

    var hideCap = !!(state.capSubHide && state.capSubHide.cap);
    var hideSub = !!(state.capSubHide && state.capSubHide.sub);
    var focusCh =
      state.focus && state.focus.type === "chapter" ? Number(state.focus.chapter) : null;
    var selected = null;
    rows.forEach(function (c) {
      if (focusCh != null && Number(c.id) === focusCh) selected = c;
    });
    var html =
      '<div class="c360-groupbars c360-groupbars-capsub" role="group" aria-label="' +
      escapeHtml(series.title) +
      '">';
    html +=
      '<div class="c360-groupbars-legend" role="list">' +
      '<button type="button" class="c360-groupbars-leg cap' +
      (hideCap ? " is-off" : "") +
      '" data-capsub-toggle="cap" role="listitem" aria-pressed="' +
      (hideCap ? "false" : "true") +
      '"><i></i>' +
      escapeHtml(series.cap) +
      "</button>" +
      '<button type="button" class="c360-groupbars-leg sub' +
      (hideSub ? " is-off" : "") +
      '" data-capsub-toggle="sub" role="listitem" aria-pressed="' +
      (hideSub ? "false" : "true") +
      '"><i></i>' +
      escapeHtml(series.sub) +
      "</button>" +
      '<span class="c360-groupbars-leg target" role="listitem"><i></i>Meta ' +
      META_TARGET +
      "%</span>" +
      "</div>";

    html += '<div class="c360-groupbars-plot">';
    html += '<div class="c360-groupbars-yaxis" aria-hidden="true">';
    [100, 75, 50, 25, 0].forEach(function (t) {
      html += "<span>" + t + "</span>";
    });
    html += "</div>";
    html +=
      '<div class="c360-groupbars-grid" aria-hidden="true">' +
      '<i style="bottom:100%"></i><i style="bottom:75%"></i><i style="bottom:50%"></i><i style="bottom:25%"></i><i style="bottom:0"></i>' +
      '<b class="c360-groupbars-meta" style="bottom:' +
      META_TARGET +
      '%"></b>' +
      "</div>";
    html += '<div class="c360-groupbars-cols">';
    rows.forEach(function (c) {
      var cap = c.score != null ? c.score : null;
      var sub = c.subScore != null ? c.subScore : null;
      var capH = cap == null ? 0 : Math.max(0, Math.min(100, cap));
      var subH = sub == null ? 0 : Math.max(0, Math.min(100, sub));
      var fullLabel = c.id + ". " + shortTitle(c.title || CHAPTER_TITLES[c.id] || "");
      var label = axisChapterLabel(c.id, c.title || CHAPTER_TITLES[c.id] || "");
      var isOn = focusCh != null && Number(c.id) === focusCh;
      html +=
        '<button type="button" class="c360-groupbars-col has-compare c360-groupbars-hit' +
        (isOn ? " is-selected" : "") +
        (hideCap ? " hide-cap" : "") +
        (hideSub ? " hide-sub" : "") +
        '" data-focus-chapter="' +
        c.id +
        '" title="' +
        escapeHtml(fullLabel) +
        (cap != null ? " · " + series.cap + " " + cap + "%" : "") +
        (sub != null ? " · " + series.sub + " " + sub + "%" : "") +
        ' · tocar para detalle" aria-label="Ver detalle de ' +
        escapeHtml(fullLabel) +
        '" aria-pressed="' +
        (isOn ? "true" : "false") +
        '">';
      html += '<div class="c360-groupbars-pair">';
      if (!hideCap) {
        html +=
          '<div class="c360-groupbars-bar cap" style="height:' +
          (cap == null ? 0 : Math.max(capH, 3)) +
          '%"><span>' +
          (cap == null ? "" : cap + "%") +
          "</span></div>";
      }
      if (!hideSub) {
        html +=
          '<div class="c360-groupbars-bar sub" style="height:' +
          (sub == null ? 0 : Math.max(subH, 3)) +
          '%"><span>' +
          (sub == null ? "" : sub + "%") +
          "</span></div>";
      }
      html += "</div>";
      html +=
        '<div class="c360-groupbars-xlabel">' + axisLabelHtml(label) + "</div>";
      html += "</button>";
    });
    html += "</div></div>";

    if (selected) {
      var delta =
        selected.score != null && selected.subScore != null
          ? selected.score - selected.subScore
          : null;
      html += '<div class="c360-capsub-peek" role="status">';
      html +=
        "<strong>" +
        escapeHtml(selected.id + ". " + (selected.title || CHAPTER_TITLES[selected.id] || "")) +
        "</strong>";
      html += '<div class="c360-capsub-peek-metrics">';
      html +=
        '<span class="cap"><i></i>' +
        escapeHtml(series.cap) +
        " <b>" +
        (selected.score == null ? "—" : selected.score + "%") +
        "</b></span>";
      html +=
        '<span class="sub"><i></i>' +
        escapeHtml(series.sub) +
        " <b>" +
        (selected.subScore == null ? "—" : selected.subScore + "%") +
        "</b></span>";
      if (delta != null) {
        html +=
          '<span class="delta">' +
          (delta === 0
            ? "Iguales"
            : (delta > 0 ? "+" : "") +
              delta +
              " pts vs " +
              escapeHtml(series.sub.toLowerCase())) +
          "</span>";
      }
      html += "</div>";
      html += "<p>Tocá de nuevo para cerrar.</p>";
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  /**
   * Barras agrupadas por fecha (periodo actual vs anterior).
   */
  function chartGroupedBars(rows, compareRows) {
    var current = (rows || []).filter(function (r) {
      return r && (r.score != null || r.shortLabel || r.label || r.date);
    });
    var previous = (compareRows || []).filter(function (r) {
      return r && r.score != null;
    });
    var hasCompare = previous.length > 0;
    if (!current.length && !previous.length) {
      return (
        '<div class="c360-groupbars c360-groupbars-empty">' +
        "<p><strong>Sin datos de indicador</strong></p>" +
        "<p>Cuando haya visitas revisadas, verás barras por fecha frente a la meta del " +
        META_TARGET +
        "%.</p></div>"
      );
    }

    // Emparejar por etiqueta corta / fecha; si no, por índice.
    var groups = [];
    var usedPrev = {};
    var n = Math.max(current.length, previous.length);
    for (var i = 0; i < n; i++) {
      var cur = current[i] || null;
      var prev = null;
      if (hasCompare) {
        if (cur) {
          var key = String(cur.shortLabel || cur.label || cur.date || "");
          for (var j = 0; j < previous.length; j++) {
            if (usedPrev[j]) continue;
            var pk = String(previous[j].shortLabel || previous[j].label || previous[j].date || "");
            if (key && pk && key === pk) {
              prev = previous[j];
              usedPrev[j] = true;
              break;
            }
          }
        }
        if (!prev && previous[i] && !usedPrev[i]) {
          prev = previous[i];
          usedPrev[i] = true;
        }
      }
      if (!cur && !prev) continue;
      groups.push({
        label: (cur && (cur.shortLabel || cur.label || formatDateShort(cur.date))) ||
          (prev && (prev.shortLabel || prev.label || formatDateShort(prev.date))) ||
          "—",
        current: cur && cur.score != null ? cur.score : null,
        previous: prev && prev.score != null ? prev.score : null,
        status: cur && cur.score != null ? scoreStatus(cur.score) : "pending",
        findings: cur && cur.findings != null ? cur.findings : null,
      });
    }

    var html =
      '<div class="c360-groupbars" role="img" aria-label="Evolución del indicador por fecha' +
      (hasCompare ? ", comparando con el periodo anterior" : "") +
      '">';
    html +=
      '<div class="c360-groupbars-legend" role="list">' +
      '<span class="c360-groupbars-leg current" role="listitem"><i></i>Periodo actual</span>' +
      (hasCompare
        ? '<span class="c360-groupbars-leg previous" role="listitem"><i></i>Periodo anterior</span>'
        : "") +
      '<span class="c360-groupbars-leg target" role="listitem"><i></i>Meta ' +
      META_TARGET +
      "%</span>" +
      "</div>";

    html += '<div class="c360-groupbars-plot">';
    html += '<div class="c360-groupbars-yaxis" aria-hidden="true">';
    [100, 75, 50, 25, 0].forEach(function (t) {
      html += "<span>" + t + "</span>";
    });
    html += "</div>";
    html +=
      '<div class="c360-groupbars-grid" aria-hidden="true">' +
      '<i style="bottom:100%"></i><i style="bottom:75%"></i><i style="bottom:50%"></i><i style="bottom:25%"></i><i style="bottom:0"></i>' +
      '<b class="c360-groupbars-meta" style="bottom:' +
      META_TARGET +
      '%"></b>' +
      "</div>";
    html += '<div class="c360-groupbars-cols">';
    groups.forEach(function (g) {
      var curH = g.current == null ? 0 : Math.max(0, Math.min(100, g.current));
      var prevH = g.previous == null ? 0 : Math.max(0, Math.min(100, g.previous));
      html +=
        '<div class="c360-groupbars-col' +
        (hasCompare ? " has-compare" : "") +
        '" title="' +
        escapeHtml(g.label) +
        (g.current != null ? " · actual " + g.current + "%" : "") +
        (g.previous != null ? " · anterior " + g.previous + "%" : "") +
        '">';
      html += '<div class="c360-groupbars-pair">';
      if (hasCompare) {
        html +=
          '<div class="c360-groupbars-bar previous" style="height:' +
          (g.previous == null ? 0 : Math.max(prevH, 3)) +
          '%"><span>' +
          (g.previous == null ? "" : g.previous + "%") +
          "</span></div>";
      }
      html +=
        '<div class="c360-groupbars-bar current tone-' +
        g.status +
        '" style="height:' +
        (g.current == null ? 0 : Math.max(curH, 3)) +
        '%"><span>' +
        (g.current == null ? "" : g.current + "%") +
        "</span></div>";
      html += "</div>";
      html += '<div class="c360-groupbars-xlabel">' + escapeHtml(g.label) + "</div>";
      html += "</div>";
    });
    html += "</div></div>";
    if (groups.length < 3) {
      html +=
        '<p class="c360-groupbars-note">Pocas mediciones en el corte · con más visitas la comparación por fecha se vuelve más clara.</p>';
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
    farmId: "",
    range: "all",
    dateFrom: "",
    dateTo: "",
    visits: null,
    loading: false,
    error: "",
    openChapter: null,
    focus: null,
    compare: false,
    capSubHide: { cap: false, sub: false },
    notice: "",
    noticeError: false,
    importExpanded: false,
    importStatus: "",
    importStatusError: false,
    importPreviewHtml: "",
    pendingVisits: null,
    boardMounted: false,
    nocumpleOpen: true,
    alertsOpen: false,
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

  function invalidateMetricsCache(detail) {
    state.visits = null;
    state._viewData = null;
    state._compare = null;
    state.focus = null;
    if (detail && detail.farm && state.farm && normFarm(state.farm) === normFarm(detail.farm)) {
      state.farm = "";
      state.farmId = "";
    }
    if (detail && detail.farmId && state.farmId && detail.farmId === state.farmId) {
      state.farm = "";
      state.farmId = "";
    }
    if (onMetricsTab()) loadVisits();
  }

  function farmOptions(visits) {
    var map = {};
    visits.forEach(function (v) {
      if (!v.farm) return;
      var farmName = String(v.farm || "").trim();
      var respName = String(v.responsible || v.technician || "").trim();
      // No listar como finca un valor que es claramente el responsable.
      if (respName && normFarm(farmName) === normFarm(respName)) return;
      var keys = farmKeys(farmName);
      if (!keys.length) return;
      // Clave canónica: sin prefijo «finca», para no duplicar la misma finca.
      var key = keys.length > 1 && keys[0].indexOf("finca ") === 0 ? keys[1] : keys[0];
      if (!map[key]) {
        map[key] = { name: farmName, farmId: visitFarmId(v) };
      } else {
        if (!map[key].farmId) map[key].farmId = visitFarmId(v);
        // Prefiere el nombre más largo / con «Finca» si ya existía el corto.
        if (farmName.length > String(map[key].name).length) map[key].name = farmName;
      }
    });
    return Object.keys(map)
      .sort()
      .map(function (k) {
        return map[k];
      });
  }

  function pickFarmOption(farms, farmName, farmId) {
    if (!farms || !farms.length) return null;
    var want = normFarm(farmName);
    // Prioriza el nombre: el id no puede cambiar la finca elegida por el usuario.
    if (want) {
      for (var j = 0; j < farms.length; j++) {
        if (normFarm(farms[j].name) === want) return farms[j];
        var keys = farmKeys(farms[j].name);
        for (var k = 0; k < keys.length; k++) {
          if (keys[k] === want) return farms[j];
        }
      }
    }
    var wantId = String(farmId || "").trim();
    if (wantId) {
      for (var i = 0; i < farms.length; i++) {
        if (farms[i].farmId && farms[i].farmId === wantId) return farms[i];
      }
    }
    return null;
  }

  function syncSelectedFarm(farms) {
    if (!farms.length) {
      state.farm = "";
      state.farmId = "";
      return;
    }
    var hit = pickFarmOption(farms, state.farm, state.farmId);
    if (!hit) hit = farms[0];
    state.farm = hit.name;
    state.farmId = hit.farmId || "";
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
      // Al salir de Métricas se invalida la caché para no mostrar fincas/visitas ya borradas.
      state.visits = null;
      state.boardMounted = false;
      state._viewData = null;
      state._compare = null;
      state.focus = null;
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
    if (state.mode === "farm") {
      syncSelectedFarm(farms);
    } else if (!state.farm && farms.length) {
      state.farm = farms[0].name;
      state.farmId = farms[0].farmId || "";
    }

    var html = "";
    html += '<header class="c360-metrics-head">';
    html += '<div class="c360-metrics-head-main">';
    html += "<h2>Métricas</h2>";
    html +=
      "<p>" +
      (state.mode === "farm" && state.farm
        ? "Solo · " + escapeHtml(state.farm)
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
      farms.forEach(function (opt) {
        html +=
          '<option value="' +
          escapeHtml(opt.name) +
          '"' +
          (normFarm(opt.name) === normFarm(state.farm) ? " selected" : "") +
          ">" +
          escapeHtml(opt.name) +
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
      var farmVisits = (visits || []).filter(function (v) {
        return sameFarm(v, state.farm, state.farmId);
      });
      html += renderFarmView(
        aggregateFarm(farmVisits, state.farm, farmWin.from || "", farmWin.to || "")
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
    // Si la franja de comparación ya muestra deltas, no repetirlos en los KPIs.
    var kpiDelta = cmp.enabled && cmp.prevWin ? null : heroDelta;
    var sideDeltaMix = cmp.enabled && cmp.prevWin ? null : mixDelta;
    var sideDeltaDose = cmp.enabled && cmp.prevWin ? null : doseDelta;
    var sideDeltaFind = cmp.enabled && cmp.prevWin ? null : findingsDelta;
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
        delta: kpiDelta,
        status: scoreStatus(data.score),
        note: periodNote,
      }
    );
    html += '<div class="c360-metrics-kpis-side">';
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix, {
      score: mix.score,
      delta: sideDeltaMix,
      showStatus: false,
    });
    html += kpiCard("Dosis", dose.value, dose.tone, ICONS.water, {
      score: dose.score,
      delta: sideDeltaDose,
      showStatus: false,
    });
    html += kpiCard(
      "Hallazgos",
      data.findings,
      data.findings ? "critical" : "healthy",
      ICONS.findings,
      {
        delta: sideDeltaFind,
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
        ? formatDateEs(data.firstDate) + " → " + formatDateEs(data.lastDate)
        : "Sin visitas en el periodo"
    );
    html += chartLine(data.timeline, state.compare && prevData ? prevData.timeline : null);
    html += "</section></div>";

    html += renderAlerts(alerts);
    html += renderFocusPanel();

    html += '<section class="c360-metrics-card c360-metrics-capsub-block">';
    html += cardHead(seriesLabels("all").title, snapChaptersLead("all", data));
    html += chartCapitulosSubcapitulos(data.chapters);
    html += renderCapSubTable(data.chapters);
    html +=
      '<p class="muted c360-capsub-hint">' +
      escapeHtml(seriesLabels("all").note) +
      "</p>";
    html += "</section>";

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
    var kpiDelta = cmp.enabled && cmp.prevWin ? null : heroDelta;
    var sideDeltaMix = cmp.enabled && cmp.prevWin ? null : mixDelta;
    var sideDeltaDose = cmp.enabled && cmp.prevWin ? null : doseDelta;
    var sideDeltaFind = cmp.enabled && cmp.prevWin ? null : findingsDelta;
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
        delta: kpiDelta,
        status: scoreStatus(lastScore),
        note: periodNote,
      }
    );
    html += '<div class="c360-metrics-kpis-side">';
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix, {
      score: mix.score,
      delta: sideDeltaMix,
      showStatus: false,
    });
    html += kpiCard("Dosis", dose.value, dose.tone, ICONS.water, {
      score: dose.score,
      delta: sideDeltaDose,
      showStatus: false,
    });
    html += kpiCard(
      "Hallazgos",
      data.findings,
      data.findings ? "critical" : "healthy",
      ICONS.findings,
      {
        delta: sideDeltaFind,
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
        ? formatDateEs(data.firstDate) + " → " + formatDateEs(data.lastDate)
        : "Sin visitas en el periodo"
    );
    html += chartLine(
      data.chartTimeline || data.timeline,
      state.compare && prevData ? prevData.chartTimeline || prevData.timeline : null
    );
    html += "</section></div>";

    html += renderAlerts(alerts);
    html += renderFocusPanel();

    html += '<section class="c360-metrics-card c360-metrics-capsub-block">';
    html += cardHead(seriesLabels("farm").title, snapChaptersLead("farm", data));
    html += chartCapitulosSubcapitulos(data.chapters);
    html += renderCapSubTable(data.chapters);
    html +=
      '<p class="muted c360-capsub-hint">' +
      escapeHtml(seriesLabels("farm").note) +
      "</p>";
    html += "</section>";

    html += '<section class="c360-metrics-card c360-metrics-section">';
    html += cardHead(
      "Visitas por fecha",
      state.farm
        ? "Historial de «" + escapeHtml(state.farm) + "». Abrí la visita para ver el informe."
        : "Abrí la visita en Visitas para ver el informe completo."
    );
    html += legendHtml("status");
    if (!data.timeline.length) {
      html += '<p class="muted">No hay visitas revisadas para esta finca en el rango.</p>';
    } else {
      html += '<div class="c360-visit-cards">';
      data.timeline
        .slice()
        .reverse()
        .forEach(function (row) {
          // Defensa: en Por finca solo pintar visitas de la finca elegida.
          var farmShown = state.farm || row.farm || "";
          if (state.mode === "farm" && state.farm) {
            var actual = row.farmActual || row.farm || "";
            if (!actual || !sameFarm({ farm: actual }, state.farm, state.farmId)) {
              return;
            }
            farmShown = state.farm;
          }
          html += '<article class="c360-visit-card tone-' + (row.status || "pending") + '">';
          html +=
            '<div class="c360-visit-card-top"><div><strong>' +
            escapeHtml(row.label || formatDateEs(row.date)) +
            "</strong>";
          if (farmShown) {
            html +=
              '<p class="c360-visit-card-farm">' + escapeHtml(farmShown) + "</p>";
          }
          html +=
            '<p class="c360-visit-card-meta"><span class="c360-meta-lbl">Responsable técnico</span> · ' +
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
            escapeHtml(farmShown) +
            '" data-open-date="' +
            escapeHtml(row.date || "") +
            '"' +
            (row.id ? ' data-open-visit-id="' + escapeHtml(row.id) + '"' : "") +
            ">Abrir visita</button>";
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

  /** Etiquetas cortas del eje X: caben en móvil sin partir sílabas. */
  var AXIS_CHAPTER_SHORT = {
    1: "Almacén",
    2: "Pesaje",
    3: "Transporte",
    4: "Mezclas",
    5: "Aplicación",
  };

  function axisChapterLabel(id, title) {
    var short = AXIS_CHAPTER_SHORT[Number(id)];
    if (short) return id + ". " + short;
    var t = shortTitle(title);
    if (t.length > 14) t = t.slice(0, 13).replace(/\s+\S*$/, "") || t.slice(0, 12);
    return id + ". " + t;
  }

  /** Solo permite cortes en espacios (evita «Transport e» / «Aplicació n»). */
  function axisLabelHtml(label) {
    return String(label || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) {
        return "<span class=\"c360-axis-word\">" + escapeHtml(word) + "</span>";
      })
      .join(" ");
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
    var wantKeys = farmKeys(farm);
    var dateEs = formatDateEs(date);
    var rows = qa(".visit-row");
    for (var i = 0; i < rows.length; i++) {
      var strong = q("strong", rows[i]);
      var small = q("small", rows[i]) || rows[i];
      var name = strong ? strong.textContent : "";
      var meta = small ? small.textContent : "";
      var got = normFarm(name);
      var nameOk = false;
      for (var k = 0; k < wantKeys.length; k++) {
        if (got === wantKeys[k]) {
          nameOk = true;
          break;
        }
      }
      if (!nameOk) continue;
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
        return sameFarm(v, state.farm, state.farmId);
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
    var open = !!state.alertsOpen;
    var visible = open ? alerts.slice(0, 2) : [];
    var html = '<section class="c360-metrics-alerts-bar' + (open ? " is-open" : " is-collapsed") + '" aria-label="Qué atender">';
    html +=
      '<button type="button" class="c360-alerts-head c360-alerts-toggle" data-act="toggle-alerts" aria-expanded="' +
      (open ? "true" : "false") +
      '"><div><strong>Qué atender</strong><span>' +
      alerts.length +
      "</span></div><em>" +
      (open ? "Ocultar" : "Ver") +
      "</em></button>";
    if (!open) {
      var first = alerts[0];
      html +=
        '<p class="c360-alerts-summary">' +
        escapeHtml(first.title || "") +
        (alerts.length > 1 ? " · +" + (alerts.length - 1) + " más" : "") +
        "</p>";
    } else {
      html += '<div class="c360-alerts-grid">';
      visible.forEach(function (a) {
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
      if (alerts.length > 2) {
        html +=
          '<p class="c360-alerts-more muted">+' +
          (alerts.length - 2) +
          " aviso(s) más en el informe.</p>";
      }
      html += "</div>";
    }
    html += "</section>";
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
          var farmLabel =
            state.mode === "farm" ? state.farm || v.farm || "Finca" : v.farm || state.farm || "Finca";
          html += '<article class="c360-focus-item">';
          html +=
            '<div class="c360-focus-item-main"><strong>' +
            escapeHtml(farmLabel) +
            "</strong><p>" +
            escapeHtml(formatDateEs(v.date)) +
            (v.responsible || v.technician ? " · " + escapeHtml(v.responsible || v.technician) : "") +
            '</p><p class="c360-focus-meta">Indicador ' +
            (st.score == null ? "—" : st.score + "%") +
            " · " +
            st.findings +
            " hallazgos</p></div>";
          html += '<div class="c360-focus-actions">';
          if (v.farm && state.mode !== "farm") {
            html +=
              '<button type="button" class="c360-alert-btn" data-open-farm="' +
              escapeHtml(v.farm) +
              '">Ver finca</button>';
          }
          html +=
            '<button type="button" class="c360-alert-btn primary" data-open-visit="' +
            escapeHtml(farmLabel) +
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
      if (focus.score != null || focus.subScore != null) {
        html +=
          '<div class="c360-capsub-compare" role="group" aria-label="' +
          escapeHtml(seriesLabels(state.mode).title) +
          '">';
        html +=
          '<div class="c360-capsub-compare-item cap"><span>' +
          escapeHtml(seriesLabels(state.mode).cap) +
          "</span><strong>" +
          (focus.score == null ? "—" : focus.score + "%") +
          "</strong>" +
          barHtml(focus.score, scoreStatus(focus.score)) +
          "</div>";
        html +=
          '<div class="c360-capsub-compare-item sub"><span>' +
          escapeHtml(seriesLabels(state.mode).sub) +
          "</span><strong>" +
          (focus.subScore == null ? "—" : focus.subScore + "%") +
          "</strong>" +
          barHtml(focus.subScore, scoreStatus(focus.subScore)) +
          "</div>";
        html += "</div>";
        html +=
          '<p class="c360-capsub-compare-note muted">' +
          escapeHtml(capSubDefinitionNote(state.mode)) +
          "</p>";
      }
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
    if (state.focus && state.focus.type === "chapter" && Number(state.focus.chapter) === ch) {
      state.focus = null;
      render();
      return;
    }
    var title = CHAPTER_TITLES[ch] || "Capítulo " + ch;
    var items = [];
    var score = null;
    var subScore = null;
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
        subScore = chRow.subScore;
        findings = chRow.findings;
      }
    } else {
      var usableCh = filterUsableByRange(state.visits || []);
      if (state.mode === "farm" && state.farm) {
        usableCh = usableCh.filter(function (v) {
          return sameFarm(v, state.farm, state.farmId);
        });
      }
      usableCh.forEach(function (v) {
        Object.keys(v.answers || {}).forEach(function (id) {
          if (Number(String(id).split(".")[0]) !== ch) return;
          if (answerValue(v.answers[id]) !== "NO") return;
          items.push({
            id: id,
            observation: v.answers[id].observation || "",
            recommendation: v.answers[id].recommendation || "",
            farm: state.mode === "farm" ? state.farm || v.farm : v.farm,
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
        if (row) {
          score = row.score;
          subScore = row.subScore;
          if (row.findings != null) findings = row.findings;
        }
      }
    }
    state.focus = {
      type: "chapter",
      title: ch + ". " + title,
      subtitle:
        (score == null ? "Sin indicador" : seriesLabels(state.mode).cap + " " + score + "%") +
        (subScore == null ? "" : " · " + seriesLabels(state.mode).sub + " " + subScore + "%"),
      chapter: ch,
      items: items.slice(0, 20),
      score: score,
      subScore: subScore,
      findings: findings,
    };
    if (state.mode === "farm") state.nocumpleOpen = true;
    render();
    window.setTimeout(function () {
      var el = q("#c360-metrics-focus") || q(".c360-capsub-peek");
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
        var field = el.getAttribute("data-field");
        state[field] = el.value;
        if (field === "farm") {
          var opt = pickFarmOption(farmOptions(state.visits || []), el.value, "");
          state.farm = opt ? opt.name : el.value;
          state.farmId = opt ? opt.farmId || "" : "";
          // Si no hay farmId en el catálogo, toma el de la primera visita coincidente.
          if (!state.farmId) {
            var hit = (state.visits || []).find(function (v) {
              return sameFarm(v, state.farm, "");
            });
            state.farmId = visitFarmId(hit);
          }
        }
        if (field === "dateFrom" || field === "dateTo") {
          state.range = "custom";
          state._showDates = true;
        }
        state.focus = null;
        render();
      });
    });
    qa("[data-open-farm]", root).forEach(function (el) {
      function openFarm() {
        var name = el.getAttribute("data-open-farm") || "";
        var opt = pickFarmOption(farmOptions(state.visits || []), name, "");
        state.mode = "farm";
        state.farm = opt ? opt.name : name;
        state.farmId = opt ? opt.farmId || "" : "";
        if (!state.farmId) {
          var hit = (state.visits || []).find(function (v) {
            return sameFarm(v, state.farm, "");
          });
          state.farmId = visitFarmId(hit);
        }
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
    qa("[data-capsub-toggle]", root).forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var key = btn.getAttribute("data-capsub-toggle");
        if (!state.capSubHide) state.capSubHide = { cap: false, sub: false };
        var next = !state.capSubHide[key];
        // No apagar ambas series a la vez.
        if (next) {
          var other = key === "cap" ? "sub" : "cap";
          if (state.capSubHide[other]) return;
        }
        state.capSubHide[key] = next;
        render();
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
    var toggleAlerts = q('[data-act="toggle-alerts"]', root);
    if (toggleAlerts) {
      toggleAlerts.addEventListener("click", function (ev) {
        ev.preventDefault();
        state.alertsOpen = !state.alertsOpen;
        render();
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
    window.addEventListener("care360:data-changed", function (ev) {
      invalidateMetricsCache((ev && ev.detail) || {});
    });
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
