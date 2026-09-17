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
    if (!ans) return "";
    var v = ans.value || ans;
    return String(v || "").toUpperCase();
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
        byMonth[key] = { date: key + "-01", scores: [], findings: 0, visits: 0 };
      }
      if (r.score != null) byMonth[key].scores.push(r.score);
      byMonth[key].findings += r.findings || 0;
      byMonth[key].visits += r.visits || 1;
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
          label: label,
          shortLabel: shortLabel,
          score: score,
          findings: b.findings,
          visits: b.visits,
          status: scoreStatus(score),
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

  function chapterKpi(chapters, id) {
    var ch = null;
    (chapters || []).forEach(function (c) {
      if (c.id === id) ch = c;
    });
    if (!ch || ch.score == null) return { value: "—", tone: "pending" };
    return { value: ch.score + "%", tone: scoreStatus(ch.score) };
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

  function chartLine(rows) {
    var points = (rows || []).filter(function (r) {
      return r && r.score != null;
    });
    if (!points.length) {
      return '<div class="c360-linechart c360-linechart-empty"><p>Sin datos de indicador en este periodo.</p></div>';
    }
    var W = 720;
    var H = 280;
    var padL = 12;
    var padR = 12;
    var padT = 40;
    var padB = 36;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var coords = points.map(function (p, i) {
      var x = padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
      var y = padT + innerH - (Math.max(0, Math.min(100, p.score)) / 100) * innerH;
      return { x: x, y: y, p: p };
    });
    function smoothPath(list) {
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
    var html =
      '<div class="c360-linechart"><svg viewBox="0 0 ' +
      W +
      " " +
      H +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolución del indicador">';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (innerH * g) / 4;
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
    }
    html += '<path class="c360-linechart-area" d="' + area + '" />';
    html += '<path class="c360-linechart-path" d="' + line + '" />';
    coords.forEach(function (c, idx) {
      var labelY = c.y - 14;
      if (idx > 0 && Math.abs(coords[idx - 1].y - c.y) < 16) {
        labelY = c.y + 22;
      }
      html +=
        '<circle class="c360-linechart-dot" cx="' +
        c.x +
        '" cy="' +
        c.y +
        '" r="5" />';
      html +=
        '<text class="c360-linechart-val" x="' +
        c.x +
        '" y="' +
        labelY +
        '">' +
        c.p.score.toFixed(2).replace(/\.00$/, ".00") +
        "%</text>";
      html +=
        '<text class="c360-linechart-xlabel" x="' +
        c.x +
        '" y="' +
        (H - 10) +
        '">' +
        escapeHtml(c.p.shortLabel || c.p.label || "") +
        "</text>";
    });
    html += "</svg></div>";
    return html;
  }

  function chartBars(rows, valueKey) {
    var max = 1;
    var any = false;
    rows.forEach(function (r) {
      var v = r[valueKey];
      if (v != null && v > 0) any = true;
      if (v != null && v > max) max = v;
    });
    if (!rows.length || (valueKey === "findings" && !any)) {
      return (
        '<div class="c360-linechart c360-linechart-empty"><p>' +
        (valueKey === "findings" ? "Sin hallazgos No cumple en este corte." : "Sin datos para graficar.") +
        "</p></div>"
      );
    }
    var html = '<div class="c360-mchart"><div class="c360-mchart-bars">';
    rows.forEach(function (r) {
      var v = r[valueKey];
      var h = v == null ? 0 : Math.round((v / max) * 100);
      var label = r.label || r.name || r.title || r.id || "";
      var tone =
        valueKey === "score"
          ? scoreStatus(v)
          : v == null || v === 0
            ? "healthy"
            : v / max >= 0.66
              ? "critical"
              : "warn";
      html +=
        '<div class="c360-mchart-col"><div class="c360-mchart-val">' +
        (v == null ? "—" : v + (valueKey === "score" ? "%" : "")) +
        '</div><div class="c360-mchart-bar tone-' +
        tone +
        '" style="height:' +
        Math.max(h, v == null || v === 0 ? 0 : 6) +
        '%"></div><div class="c360-mchart-label">' +
        escapeHtml(String(label)) +
        "</div></div>";
    });
    html += "</div></div>";
    return html;
  }

  function kpiCard(label, value, tone, icon, delta) {
    var deltaHtml = "";
    if (delta != null && !isNaN(delta)) {
      var cls = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
      var sign = delta > 0 ? "+" : "";
      deltaHtml =
        '<span class="c360-mkpi-delta ' +
        cls +
        '">' +
        sign +
        delta +
        " pts vs visita anterior</span>";
    }
    return (
      '<article class="c360-mkpi tone-' +
      (tone || "brand") +
      '"><div class="c360-mkpi-top"><span class="c360-mkpi-label">' +
      escapeHtml(label) +
      '</span><span class="c360-mkpi-icon" aria-hidden="true">' +
      icon +
      '</span></div><strong class="c360-mkpi-value">' +
      escapeHtml(String(value)) +
      "</strong>" +
      deltaHtml +
      "</article>"
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
    importExpanded: true,
    importStatus: "",
    importStatusError: false,
    importPreviewHtml: "",
    pendingVisits: null,
    boardMounted: false,
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
    var usable = filterUsableByRange(visits);
    var farms = farmOptions(usable);
    if (!state.farm && farms.length) state.farm = farms[0];
    if (state.mode === "farm" && farms.length && farms.indexOf(state.farm) === -1) {
      state.farm = farms[0];
    }

    var html = "";
    html += '<header class="c360-metrics-head">';
    html += '<div class="c360-metrics-head-main">';
    html += '<p class="eyebrow">MÉTRICAS MIPE</p>';
    html += "<h2>Tablero de aseguramientos</h2>";
    html +=
      "<p>Indicador por finca y por visita, con fechas completas. Importa un informe y edítalo en Visitas.</p>";
    html += "</div>";
    html += '<div class="c360-metrics-toolbar">';
    html += '<div class="c360-metrics-switch" role="tablist">';
    html +=
      '<button type="button" role="tab" data-mode="all" class="' +
      (state.mode === "all" ? "active" : "") +
      '">Todas las fincas</button>';
    html +=
      '<button type="button" role="tab" data-mode="farm" class="' +
      (state.mode === "farm" ? "active" : "") +
      '">Una finca</button>';
    html += "</div>";
    html += '<div class="c360-metrics-range" role="group" aria-label="Periodo">';
    [
      ["all", "Todo"],
      ["30d", "30 días"],
      ["90d", "90 días"],
      ["365d", "12 meses"],
      ["ytd", "Este año"],
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
    if (state.range === "custom" && (state.dateFrom || state.dateTo)) {
      html +=
        '<p class="c360-metrics-range-hint">Rango personalizado: ' +
        escapeHtml(formatDateEs(state.dateFrom) || "…") +
        " → " +
        escapeHtml(formatDateEs(state.dateTo) || "…") +
        "</p>";
    }
    html += "</div></header>";

    html +=
      '<div class="c360-metrics-import" data-c360-board-import="1">' +
      '<p class="c360-import-open">Importar finca e informes</p>' +
      '<div class="c360-import-box">' +
      '<p class="c360-import-lead">Sube <strong>Excel/CSV</strong>, <strong>Word (.docx)</strong> o <strong>PDF</strong>. Se crea la finca si falta y el informe queda completo para editarlo en Visitas.</p>' +
      '<label class="c360-import-file"><span>Elegir archivo</span>' +
      '<input id="c360-board-file" type="file" class="c360-import-input" accept=".xlsx,.csv,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />' +
      "</label>" +
      '<div class="c360-import-status muted" hidden></div>' +
      '<div class="c360-import-preview" hidden></div>' +
      "</div></div>";

    if (!usable.length) {
      html +=
        '<div class="c360-metrics-empty"><p>No hay visitas revisadas en este periodo. Amplía el rango, guarda un informe en Visitas o importa un Word/CSV.</p></div>';
      root.innerHTML = html;
      bind(root);
      state.boardMounted = true;
      return;
    }

    html += '<div class="c360-metrics-filters">';
    if (state.mode === "farm") {
      html += '<label>Finca<select data-field="farm">';
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
        '<label>Alcance<select disabled><option>Todas las fincas (' +
        farms.length +
        ")</option></select></label>";
    }
    html +=
      '<label>Desde<input data-field="dateFrom" type="date" value="' +
      escapeHtml(state.dateFrom) +
      '"></label>';
    html +=
      '<label>Hasta<input data-field="dateTo" type="date" value="' +
      escapeHtml(state.dateTo) +
      '"></label>';
    html += "</div>";

    if (state.mode === "farm") {
      html += renderFarmView(aggregateFarm(usable, state.farm, state.dateFrom, state.dateTo));
    } else {
      html += renderAllView(aggregateAll(usable));
    }

    root.innerHTML = html;
    bind(root);
    state.boardMounted = true;
  }

  function renderAllView(data) {
    var trend = timelineTrend(data.timeline);
    var mix = chapterKpi(data.chapters, 4);
    var dose = chapterKpi(data.chapters, 2);
    var html = "";
    html += '<div class="c360-metrics-kpis">';
    html += kpiCard(
      "Indicador",
      data.score == null ? "—" : data.score + "%",
      scoreStatus(data.score),
      ICONS.score,
      trend
    );
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix);
    html += kpiCard("Dosificación", dose.value, dose.tone, ICONS.water);
    html += kpiCard("Hallazgos", data.findings, data.findings ? "critical" : "healthy", ICONS.findings);
    html += "</div>";

    html += '<section class="c360-metrics-card c360-metrics-hero-chart">';
    html += '<div class="c360-metrics-card-head"><div>';
    html += "<h3>Evolución del indicador</h3>";
    html +=
      "<p>" +
      (data.firstDate || data.lastDate
        ? "De " +
          formatDateEs(data.firstDate) +
          " a " +
          formatDateEs(data.lastDate) +
          " · " +
          data.visits +
          " visita(s) en " +
          data.farms.length +
          " finca(s)"
        : "Sin visitas en el periodo") +
      "</p></div></div>";
    html += chartLine(data.timeline);
    html += "</section>";

    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Resumen por finca</h3>';
    html += "<p>Toca una finca para ver su detalle por fecha con el mismo periodo.</p></div>";
    html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
    html +=
      "<th>Finca</th><th>Visitas</th><th>Indicador</th><th>Hallazgos</th><th>Estado</th><th>Primera visita</th><th>Última visita</th>";
    html += "</tr></thead><tbody>";
    data.farms.forEach(function (f) {
      html += '<tr data-open-farm="' + escapeHtml(f.name) + '" tabindex="0">';
      html += "<td><strong>" + escapeHtml(f.name) + "</strong></td>";
      html += "<td>" + f.visits + "</td>";
      html +=
        '<td><div class="c360-metrics-inline">' +
        (f.score == null ? "—" : f.score + "%") +
        barHtml(f.score, f.status) +
        "</div></td>";
      html +=
        '<td><div class="c360-metrics-inline">' +
        f.findings +
        barHtml(data.findings ? (f.findings / data.findings) * 100 : 0, "warn") +
        "</div></td>";
      html += '<td><span class="c360-mpill tone-' + f.status + '">' + statusLabel(f.status) + "</span></td>";
      html += "<td>" + escapeHtml(formatDateEs(f.firstDate)) + "</td>";
      html += "<td>" + escapeHtml(formatDateEs(f.lastDate)) + "</td>";
      html += "</tr>";
    });
    html += "</tbody></table></div></section>";

    html += '<div class="c360-metrics-charts">';
    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Indicador por capítulo</h3>';
    html += "<p>Promedio de cumplimiento global.</p></div>";
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), score: c.score };
      }),
      "score"
    );
    html += "</section>";
    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Hallazgos por capítulo</h3>';
    html += "<p>Cantidad de No cumple.</p></div>";
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), findings: c.findings };
      }),
      "findings"
    );
    html += "</section></div>";

    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Subcapítulos con más hallazgos</h3>';
    html += "<p>Criterios que más se incumplen.</p></div>";
    if (!data.items.length) {
      html += '<p class="muted">Sin hallazgos de No cumple en el periodo.</p>';
    } else {
      html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
      html += "<th>Ítem</th><th>Capítulo</th><th>Hallazgos</th><th>Frecuencia</th></tr></thead><tbody>";
      data.items.slice(0, 12).forEach(function (it) {
        html += "<tr>";
        html += "<td><strong>" + escapeHtml(it.id) + "</strong></td>";
        html += "<td>" + escapeHtml(it.chapter + ". " + it.chapterTitle) + "</td>";
        html += "<td>" + it.findings + "</td>";
        html +=
          '<td><div class="c360-metrics-inline">' +
          it.rate +
          "%" +
          barHtml(it.rate, "warn") +
          "</div></td></tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</section>";
    return html;
  }

  function renderFarmView(data) {
    var lastScore = data.timeline.length ? data.timeline[data.timeline.length - 1].score : null;
    var trend = timelineTrend(data.timeline);
    var mix = chapterKpi(data.chapters, 4);
    var dose = chapterKpi(data.chapters, 2);
    var html = "";
    html += '<div class="c360-metrics-kpis">';
    html += kpiCard(
      "Indicador",
      lastScore == null ? "—" : lastScore + "%",
      scoreStatus(lastScore),
      ICONS.score,
      trend
    );
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix);
    html += kpiCard("Dosificación", dose.value, dose.tone, ICONS.water);
    html += kpiCard(
      "Hallazgos",
      data.findings,
      data.findings ? "critical" : "healthy",
      ICONS.findings
    );
    html += "</div>";

    html += '<section class="c360-metrics-card c360-metrics-hero-chart">';
    html += '<div class="c360-metrics-card-head"><div>';
    html += "<h3>Evolución de la finca</h3>";
    html +=
      "<p>" +
      (data.firstDate || data.lastDate
        ? "Visitas del " +
          formatDateEs(data.firstDate) +
          " al " +
          formatDateEs(data.lastDate) +
          " · " +
          data.visits +
          " visita(s)"
        : "Sin visitas en el rango") +
      "</p></div></div>";
    html += chartLine(data.chartTimeline || data.timeline);
    html += "</section>";

    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Visitas por fecha</h3>';
    html += "<p>Detalle de cada aseguramiento.</p></div>";
    if (!data.timeline.length) {
      html += '<p class="muted">No hay visitas revisadas para esta finca en el rango.</p>';
    } else {
      html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
      html += "<th>Fecha</th><th>Indicador</th><th>Hallazgos</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>";
      data.timeline
        .slice()
        .reverse()
        .forEach(function (row) {
          html += "<tr>";
          html += "<td><strong>" + escapeHtml(row.label) + "</strong></td>";
          html +=
            '<td><div class="c360-metrics-inline">' +
            (row.score == null ? "—" : row.score + "%") +
            barHtml(row.score, row.status) +
            "</div></td>";
          html += "<td>" + row.findings + "</td>";
          html +=
            '<td><span class="c360-mpill tone-' +
            row.status +
            '">' +
            statusLabel(row.status) +
            "</span></td>";
          html += "<td>" + escapeHtml(row.responsible || "—") + "</td></tr>";
        });
      html += "</tbody></table></div>";
    }
    html += "</section>";

    html += '<div class="c360-metrics-charts">';
    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Capítulos · última visita</h3>';
    html +=
      "<p>" +
      (data.lastDate ? "Visita del " + formatDateEs(data.lastDate) + "." : "Sin visita reciente.") +
      "</p></div>";
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), score: c.score };
      }),
      "score"
    );
    html += "</section>";
    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Hallazgos por capítulo</h3>';
    html += "<p>No cumple en la última visita.</p></div>";
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), findings: c.findings };
      }),
      "findings"
    );
    html += "</section></div>";

    html += '<section class="c360-metrics-card"><div class="c360-metrics-card-head"><h3>Detalle de No cumple</h3>';
    html +=
      "<p>" +
      (data.lastDate
        ? "Hallazgos de la visita del " + formatDateEs(data.lastDate) + "."
        : "Sin hallazgos para mostrar.") +
      "</p></div>";
    if (!data.items.length) {
      html += '<p class="muted">La última visita no tiene respuestas No cumple.</p>';
    } else {
      html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
      html += "<th>Ítem</th><th>Capítulo</th><th>Hallazgo</th><th>Recomendación</th></tr></thead><tbody>";
      data.items.forEach(function (it) {
        html += "<tr>";
        html += "<td><strong>" + escapeHtml(it.id) + "</strong></td>";
        html +=
          "<td>" + escapeHtml(it.chapter + ". " + (CHAPTER_TITLES[it.chapter] || "")) + "</td>";
        html += '<td class="c360-metrics-wrap">' + escapeHtml(it.observation || "—") + "</td>";
        html += '<td class="c360-metrics-wrap">' + escapeHtml(it.recommendation || "—") + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</section>";
    return html;
  }

  function shortTitle(title) {
    return String(title || "").replace(/^Capítulo\s+/i, "");
  }

  function bind(root) {
    qa("[data-mode]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.mode = btn.getAttribute("data-mode") || "all";
        render();
      });
    });
    qa("[data-range]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyRangePreset(btn.getAttribute("data-range") || "all");
        render();
      });
    });
    qa("[data-field]", root).forEach(function (el) {
      el.addEventListener("change", function () {
        state[el.getAttribute("data-field")] = el.value;
        if (el.getAttribute("data-field") === "dateFrom" || el.getAttribute("data-field") === "dateTo") {
          state.range = "custom";
        }
        render();
      });
    });
    qa("[data-open-farm]", root).forEach(function (row) {
      function openFarm() {
        state.mode = "farm";
        state.farm = row.getAttribute("data-open-farm") || "";
        render();
      }
      row.addEventListener("click", openFarm);
      row.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          openFarm();
        }
      });
    });
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
    if (openTitle) {
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
