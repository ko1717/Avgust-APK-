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
    function cell(label, curr, prev, delta, suffix) {
      suffix = suffix || "";
      var cls = "flat";
      var sign = "";
      if (delta != null && !isNaN(delta)) {
        if (label === "Hallazgos") cls = delta > 0 ? "down" : delta < 0 ? "up" : "flat";
        else cls = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
        sign = delta > 0 ? "+" : "";
      }
      return (
        '<div class="c360-compare-cell"><span class="c360-compare-label">' +
        escapeHtml(label) +
        '</span><strong>' +
        escapeHtml(String(curr == null ? "—" : curr + suffix)) +
        '</strong><span class="c360-compare-prev">Antes: ' +
        escapeHtml(String(prev == null ? "—" : prev + suffix)) +
        '</span><span class="c360-mkpi-delta ' +
        cls +
        '">' +
        (delta == null || isNaN(delta) ? "Sin base" : sign + delta + (suffix === "%" ? " pts" : "")) +
        "</span></div>"
      );
    }
    var html = '<section class="c360-metrics-card c360-metrics-compare">';
    html += cardHead(
      "Comparación de periodos",
      "Actual " +
        formatDateEs(cmp.win.from) +
        " → " +
        formatDateEs(cmp.win.to) +
        " vs anterior " +
        formatDateEs(cmp.prevWin.from) +
        " → " +
        formatDateEs(cmp.prevWin.to)
    );
    html += '<div class="c360-compare-grid">';
    html += cell("Indicador", cmp.score, cmp.prevScore, cmp.scoreDelta, "%");
    html += cell("Hallazgos", cmp.findings, cmp.prevFindings, cmp.findingsDelta, "");
    html += cell("Visitas", cmp.visits, cmp.prevVisits, cmp.visitsDelta, "");
    html += "</div></section>";
    return html;
  }

  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 800);
  }

  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportBoardCsv() {
    var data = state._viewData;
    if (!data) {
      setNotice("No hay datos para exportar.", true);
      render();
      return;
    }
    var lines = [];
    lines.push("CARE 360 · Exportación de métricas");
    lines.push(
      "Modo," +
        csvEscape(state.mode === "farm" ? "Una finca" : "Todas las fincas") +
        (state.mode === "farm" ? "," + csvEscape(state.farm) : "")
    );
    lines.push(
      "Periodo," +
        csvEscape(formatDateEs(state.dateFrom) || "Todo") +
        "," +
        csvEscape(formatDateEs(state.dateTo) || "Todo")
    );
    if (state._compare) {
      lines.push(
        "Periodo anterior," +
          csvEscape(formatDateEs(state._compare.prevWin.from)) +
          "," +
          csvEscape(formatDateEs(state._compare.prevWin.to))
      );
      lines.push(
        "Indicador actual,Indicador anterior,Delta pts,Hallazgos actual,Hallazgos anterior,Visitas actual,Visitas anterior"
      );
      lines.push(
        [
          state._compare.score,
          state._compare.prevScore,
          state._compare.scoreDelta,
          state._compare.findings,
          state._compare.prevFindings,
          state._compare.visits,
          state._compare.prevVisits,
        ]
          .map(csvEscape)
          .join(",")
      );
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
      lines.push("Evolución / visitas");
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
      lines.push("Capítulos");
      lines.push("Capítulo,Título,Indicador %,Hallazgos,Aplicables");
      data.chapters.forEach(function (c) {
        lines.push([c.id, c.title, c.score, c.findings, c.applicable].map(csvEscape).join(","));
      });
      lines.push("");
    }
    if (data.items && data.items.length) {
      lines.push("Hallazgos / criterios");
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
    var stamp = isoDate(new Date());
    var name =
      "CARE360-metricas-" +
      (state.mode === "farm" ? normFarm(state.farm).replace(/\s+/g, "-") + "-" : "todas-") +
      stamp +
      ".csv";
    downloadText(name, "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
    setNotice("Excel/CSV exportado: " + name, false);
    render();
  }

  function exportBoardPrint() {
    var data = state._viewData;
    if (!data) {
      setNotice("No hay datos para exportar.", true);
      render();
      return;
    }
    var cmp = state._compare;
    var title =
      "CARE 360 · Métricas" +
      (state.mode === "farm" ? " · " + (state.farm || "") : " · Todas las fincas");
    var body = "";
    body += "<h1>" + escapeHtml(title) + "</h1>";
    body +=
      "<p class='meta'>Periodo: " +
      escapeHtml(formatDateEs(state.dateFrom) || "Todo") +
      " → " +
      escapeHtml(formatDateEs(state.dateTo) || "Todo") +
      "</p>";
    if (cmp && cmp.prevWin) {
      body +=
        "<p class='meta'>Comparado con: " +
        escapeHtml(formatDateEs(cmp.prevWin.from)) +
        " → " +
        escapeHtml(formatDateEs(cmp.prevWin.to)) +
        "</p>";
      body += "<div class='kpis'>";
      body +=
        "<div><b>Indicador</b><br>" +
        (cmp.score == null ? "—" : cmp.score + "%") +
        " <small>(" +
        (cmp.scoreDelta == null ? "sin base" : (cmp.scoreDelta > 0 ? "+" : "") + cmp.scoreDelta + " pts") +
        ")</small></div>";
      body +=
        "<div><b>Hallazgos</b><br>" +
        cmp.findings +
        " <small>(" +
        (cmp.findingsDelta > 0 ? "+" : "") +
        cmp.findingsDelta +
        ")</small></div>";
      body +=
        "<div><b>Visitas</b><br>" +
        cmp.visits +
        " <small>(" +
        (cmp.visitsDelta > 0 ? "+" : "") +
        cmp.visitsDelta +
        ")</small></div>";
      body += "</div>";
    }
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
      body += "<h2>Evolución / visitas</h2>";
      body += table(
        ["Fecha", "Indicador", "Hallazgos", "Estado", "Responsable"],
        data.timeline.map(function (r) {
          return [
            r.label || formatDateEs(r.date),
            r.score == null ? "—" : r.score + "%",
            r.findings,
            statusLabel(r.status),
            r.responsible || "—",
          ];
        })
      );
    }
    if (data.chapters && data.chapters.length) {
      body += "<h2>Capítulos</h2>";
      body += table(
        ["Capítulo", "Indicador", "Hallazgos"],
        data.chapters.map(function (c) {
          return [c.id + ". " + c.title, c.score == null ? "—" : c.score + "%", c.findings];
        })
      );
    }
    if (data.items && data.items.length) {
      body += "<h2>Hallazgos</h2>";
      body += table(
        ["Ítem", "Capítulo", "Detalle"],
        data.items.slice(0, 40).map(function (it) {
          return [
            it.id,
            it.chapterTitle || CHAPTER_TITLES[it.chapter] || it.chapter || "",
            it.observation || (it.findings != null ? it.findings + " hallazgos" : it.recommendation || ""),
          ];
        })
      );
    }
    body += "<p class='meta'>Generado " + escapeHtml(formatDateEs(isoDate(new Date()))) + " · CARE 360</p>";
    var html =
      "<!doctype html><html lang='es'><head><meta charset='utf-8'><title>" +
      escapeHtml(title) +
      "</title><style>" +
      "body{font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1c2b32;padding:24px;}" +
      "h1{font-size:22px;margin:0 0 8px}h2{font-size:16px;margin:22px 0 8px}" +
      ".meta{color:#58696d;font-size:13px;margin:4px 0}" +
      ".kpis{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap}" +
      ".kpis>div{border:1px solid #dbe4e8;border-radius:12px;padding:12px 14px;min-width:120px}" +
      "table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}" +
      "th,td{border-bottom:1px solid #dbe4e8;text-align:left;padding:8px 6px;vertical-align:top}" +
      "th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#58696d}" +
      "@media print{body{padding:0}}" +
      "</style></head><body>" +
      body +
      "<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script>" +
      "</body></html>";
    var w = window.open("", "_blank", "noopener,noreferrer,width=920,height=720");
    if (!w) {
      setNotice("Permite ventanas emergentes para exportar PDF/imprimir.", true);
      render();
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setNotice("Informe listo para imprimir o guardar como PDF.", false);
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
      return '<div class="c360-linechart c360-linechart-empty"><p>Sin datos de indicador en este periodo.</p></div>';
    }
    var W = 720;
    var H = 280;
    var padL = 12;
    var padR = 12;
    var padT = 40;
    var padB = 42;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    function toCoords(list) {
      return list.map(function (p, i) {
        var x = padL + (list.length === 1 ? innerW / 2 : (i / (list.length - 1)) * innerW);
        var y = padT + innerH - (Math.max(0, Math.min(100, p.score)) / 100) * innerH;
        return { x: x, y: y, p: p };
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
    var coords = toCoords(points);
    var compareCoords = toCoords(compare);
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
      coords.forEach(function (c, idx) {
        var labelY = c.y - 14;
        if (idx > 0 && Math.abs(coords[idx - 1].y - c.y) < 16) labelY = c.y + 22;
        var focusDate = escapeHtml(c.p.date || "");
        var focusLabel = escapeHtml(c.p.label || c.p.shortLabel || "");
        html +=
          '<g class="c360-linechart-hit" data-focus-date="' +
          focusDate +
          '" data-focus-label="' +
          focusLabel +
          '" data-focus-score="' +
          c.p.score +
          '" tabindex="0" role="button" aria-label="Ver detalle ' +
          focusLabel +
          '">';
        html +=
          '<circle class="c360-linechart-dot" cx="' +
          c.x +
          '" cy="' +
          c.y +
          '" r="7" />';
        html +=
          '<circle class="c360-linechart-hitarea" cx="' +
          c.x +
          '" cy="' +
          c.y +
          '" r="16" />';
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
          "</text></g>";
      });
    }
    if (compareCoords.length) {
      html +=
        '<text class="c360-linechart-legend" x="' +
        padL +
        '" y="' +
        (H - 2) +
        '">Verde: periodo actual · Gris: periodo anterior</text>';
    }
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
      var focusAttr = "";
      if (r.chapterId != null) {
        focusAttr =
          ' data-focus-chapter="' +
          r.chapterId +
          '" tabindex="0" role="button" aria-label="Ver capítulo ' +
          escapeHtml(String(label)) +
          '"';
      }
      html +=
        '<div class="c360-mchart-col' +
        (r.chapterId != null ? " c360-mchart-col-hit" : "") +
        '"' +
        focusAttr +
        '><div class="c360-mchart-val">' +
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
        '"><span class="c360-lbl-full">' +
        sign +
        delta +
        ' pts vs anterior</span><span class="c360-lbl-short">' +
        sign +
        delta +
        " pts</span></span>";
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
    compare: true,
    notice: "",
    noticeError: false,
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
      '"><span class="c360-lbl-full">Todas las fincas</span><span class="c360-lbl-short">Todas</span></button>';
    html +=
      '<button type="button" role="tab" data-mode="farm" class="' +
      (state.mode === "farm" ? "active" : "") +
      '"><span class="c360-lbl-full">Una finca</span><span class="c360-lbl-short">Finca</span></button>';
    html += "</div>";
    html += '<div class="c360-metrics-range" role="group" aria-label="Periodo">';
    [
      ["all", "Todo", "Todo"],
      ["30d", "30 días", "30d"],
      ["90d", "90 días", "90d"],
      ["365d", "12 meses", "12m"],
      ["ytd", "Este año", "Año"],
    ].forEach(function (opt) {
      html +=
        '<button type="button" data-range="' +
        opt[0] +
        '" class="' +
        (state.range === opt[0] ? "active" : "") +
        '"><span class="c360-lbl-full">' +
        opt[1] +
        '</span><span class="c360-lbl-short">' +
        opt[2] +
        "</span></button>";
    });
    html += "</div>";
    if (state.compare && (!state.dateFrom || !state.dateTo || state.range === "all")) {
      html +=
        '<p class="c360-metrics-range-hint">Comparación activa: últimos 12 meses vs 12 meses previos' +
        (state.range === "all" ? " (el tablero se acota a esa ventana)" : "") +
        ".</p>";
    }
    if (state.range === "custom" && (state.dateFrom || state.dateTo)) {
      html +=
        '<p class="c360-metrics-range-hint">Rango personalizado: ' +
        escapeHtml(formatDateEs(state.dateFrom) || "…") +
        " → " +
        escapeHtml(formatDateEs(state.dateTo) || "…") +
        "</p>";
    }
    html += '<div class="c360-metrics-actions">';
    html +=
      '<button type="button" class="c360-action-btn' +
      (state.compare ? " active" : "") +
      '" data-act="toggle-compare" aria-pressed="' +
      (state.compare ? "true" : "false") +
      '">Comparar periodos</button>';
    html +=
      '<button type="button" class="c360-action-btn" data-act="export-csv">Exportar Excel</button>';
    html +=
      '<button type="button" class="c360-action-btn primary" data-act="export-print">PDF / Imprimir</button>';
    html += "</div></div></header>";

    if (state.notice) {
      html +=
        '<div class="c360-metrics-notice' +
        (state.noticeError ? " error" : "") +
        '"><p>' +
        escapeHtml(state.notice) +
        '</p><button type="button" data-act="clear-notice" aria-label="Cerrar aviso">×</button></div>';
    }

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
    var alerts = buildAlerts(data, null);
    var html = "";
    html += '<div class="c360-metrics-kpis">';
    html += kpiCard(
      "Indicador",
      data.score == null ? "—" : data.score + "%",
      scoreStatus(data.score),
      ICONS.score,
      cmp.scoreDelta != null ? cmp.scoreDelta : trend
    );
    html += kpiCard("Mezclas", mix.value, mix.tone, ICONS.mix);
    html += kpiCard("Dosificación", dose.value, dose.tone, ICONS.water);
    html += kpiCard("Hallazgos", data.findings, data.findings ? "critical" : "healthy", ICONS.findings);
    html += "</div>";
    html += renderCompareStrip(cmp);
    html += renderAlerts(alerts);
    html += renderFocusPanel();

    html += '<section class="c360-metrics-card c360-metrics-hero-chart">';
    html += cardHead(
      "Evolución del indicador",
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
        (state.compare ? " · Línea gris = periodo anterior" : "") +
        " · Tocá un punto para ver detalle"
    );
    html += chartLine(data.timeline, state.compare && prevData ? prevData.timeline : null);
    html += "</section>";

    html += '<section class="c360-metrics-card">';
    html += cardHead("Resumen por finca", "Toca una finca para ver su detalle con el mismo periodo.");
    html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table c360-metrics-table-farms"><thead><tr>';
    html +=
      "<th>Finca</th><th>Visitas</th><th>Indicador</th><th>Hallazgos</th><th>Estado</th><th>Primera visita</th><th>Última visita</th>";
    html += "</tr></thead><tbody>";
    data.farms.forEach(function (f) {
      html += '<tr data-open-farm="' + escapeHtml(f.name) + '" tabindex="0">';
      html += td("Finca", "<strong>" + escapeHtml(f.name) + "</strong>");
      html += td("Visitas", String(f.visits));
      html += td(
        "Indicador",
        '<div class="c360-metrics-inline">' +
          (f.score == null ? "—" : f.score + "%") +
          barHtml(f.score, f.status) +
          "</div>"
      );
      html += td(
        "Hallazgos",
        '<div class="c360-metrics-inline">' +
          f.findings +
          barHtml(data.findings ? (f.findings / data.findings) * 100 : 0, "warn") +
          "</div>"
      );
      html += td("Estado", '<span class="c360-mpill tone-' + f.status + '">' + statusLabel(f.status) + "</span>");
      html += td("Primera visita", escapeHtml(formatDateEs(f.firstDate)), "c360-col-optional");
      html += td("Última visita", escapeHtml(formatDateEs(f.lastDate)), "c360-col-optional");
      html += "</tr>";
    });
    html += "</tbody></table></div></section>";

    html += '<div class="c360-metrics-charts">';
    html += '<section class="c360-metrics-card">';
    html += cardHead("Indicador por capítulo", "Tocá una barra para ver hallazgos del capítulo.");
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), score: c.score, chapterId: c.id };
      }),
      "score"
    );
    html += "</section>";
    html += '<section class="c360-metrics-card">';
    html += cardHead("Hallazgos por capítulo", "Tocá una barra para profundizar.");
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), findings: c.findings, chapterId: c.id };
      }),
      "findings"
    );
    html += "</section></div>";

    html += '<section class="c360-metrics-card">';
    html += cardHead("Subcapítulos con más hallazgos", "Criterios que más se incumplen.");
    if (!data.items.length) {
      html += '<p class="muted">Sin hallazgos de No cumple en el periodo.</p>';
    } else {
      html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
      html += "<th>Ítem</th><th>Capítulo</th><th>Hallazgos</th><th>Frecuencia</th></tr></thead><tbody>";
      data.items.slice(0, 12).forEach(function (it) {
        html += '<tr data-focus-chapter="' + it.chapter + '" tabindex="0" class="c360-row-hit">';
        html += td("Ítem", "<strong>" + escapeHtml(it.id) + "</strong>");
        html += td("Capítulo", escapeHtml(it.chapter + ". " + it.chapterTitle));
        html += td("Hallazgos", String(it.findings));
        html += td(
          "Frecuencia",
          '<div class="c360-metrics-inline">' + it.rate + "%" + barHtml(it.rate, "warn") + "</div>"
        );
        html += "</tr>";
      });
      html += "</tbody></table></div>";
    }
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
    var alerts = buildAlerts(null, data);
    var html = "";
    html += '<div class="c360-metrics-kpis">';
    html += kpiCard(
      "Indicador",
      lastScore == null ? "—" : lastScore + "%",
      scoreStatus(lastScore),
      ICONS.score,
      cmp.scoreDelta != null ? cmp.scoreDelta : trend
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
    html += renderCompareStrip(cmp);
    html += renderAlerts(alerts);
    html += renderFocusPanel();

    html += '<section class="c360-metrics-card c360-metrics-hero-chart">';
    html += cardHead(
      "Evolución de la finca",
      (data.firstDate || data.lastDate
        ? "Visitas del " +
          formatDateEs(data.firstDate) +
          " al " +
          formatDateEs(data.lastDate) +
          " · " +
          data.visits +
          " visita(s)"
        : "Sin visitas en el rango") +
        (state.compare ? " · Línea gris = periodo anterior" : "") +
        " · Tocá un punto para abrir detalle"
    );
    html += chartLine(
      data.chartTimeline || data.timeline,
      state.compare && prevData ? prevData.chartTimeline || prevData.timeline : null
    );
    html += "</section>";

    html += '<section class="c360-metrics-card">';
    html += cardHead("Visitas por fecha", "Abrí cualquier visita directamente en Visitas.");
    if (!data.timeline.length) {
      html += '<p class="muted">No hay visitas revisadas para esta finca en el rango.</p>';
    } else {
      html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
      html +=
        "<th>Fecha</th><th>Indicador</th><th>Hallazgos</th><th>Estado</th><th>Responsable</th><th></th></tr></thead><tbody>";
      data.timeline
        .slice()
        .reverse()
        .forEach(function (row) {
          html += "<tr>";
          html += td("Fecha", "<strong>" + escapeHtml(row.label) + "</strong>");
          html += td(
            "Indicador",
            '<div class="c360-metrics-inline">' +
              (row.score == null ? "—" : row.score + "%") +
              barHtml(row.score, row.status) +
              "</div>"
          );
          html += td("Hallazgos", String(row.findings));
          html += td(
            "Estado",
            '<span class="c360-mpill tone-' + row.status + '">' + statusLabel(row.status) + "</span>"
          );
          html += td("Responsable", escapeHtml(row.responsible || "—"));
          html +=
            '<td data-label="Acción"><button type="button" class="c360-alert-btn primary" data-open-visit="' +
            escapeHtml(row.farm || state.farm || "") +
            '" data-open-date="' +
            escapeHtml(row.date || "") +
            '">Abrir</button></td>';
          html += "</tr>";
        });
      html += "</tbody></table></div>";
    }
    html += "</section>";

    html += '<div class="c360-metrics-charts">';
    html += '<section class="c360-metrics-card">';
    html += cardHead(
      "Capítulos · última visita",
      (data.lastDate ? "Visita del " + formatDateEs(data.lastDate) + "." : "Sin visita reciente.") +
        " Tocá una barra para ver No cumple."
    );
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), score: c.score, chapterId: c.id };
      }),
      "score"
    );
    html += "</section>";
    html += '<section class="c360-metrics-card">';
    html += cardHead("Hallazgos por capítulo", "No cumple en la última visita.");
    html += chartBars(
      data.chapters.map(function (c) {
        return { label: c.id + ". " + shortTitle(c.title), findings: c.findings, chapterId: c.id };
      }),
      "findings"
    );
    html += "</section></div>";

    html += '<section class="c360-metrics-card">';
    html += cardHead(
      "Detalle de No cumple",
      data.lastDate
        ? "Hallazgos de la visita del " + formatDateEs(data.lastDate) + "."
        : "Sin hallazgos para mostrar."
    );
    if (!data.items.length) {
      html += '<p class="muted">La última visita no tiene respuestas No cumple.</p>';
    } else {
      html += '<div class="c360-metrics-table-wrap"><table class="c360-metrics-table"><thead><tr>';
      html +=
        "<th>Ítem</th><th>Capítulo</th><th>Hallazgo</th><th>Recomendación</th><th></th></tr></thead><tbody>";
      data.items.forEach(function (it) {
        html += "<tr>";
        html += td("Ítem", "<strong>" + escapeHtml(it.id) + "</strong>");
        html += td("Capítulo", escapeHtml(it.chapter + ". " + (CHAPTER_TITLES[it.chapter] || "")));
        html += td("Hallazgo", escapeHtml(it.observation || "—"), "c360-metrics-wrap");
        html += td("Recomendación", escapeHtml(it.recommendation || "—"), "c360-metrics-wrap");
        html +=
          '<td data-label="Acción"><button type="button" class="c360-alert-btn primary" data-open-visit="' +
          escapeHtml(state.farm || "") +
          '" data-open-date="' +
          escapeHtml(data.lastDate || "") +
          '">Abrir visita</button></td>';
        html += "</tr>";
      });
      html += "</tbody></table></div>";
    }
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
    var html = '<section class="c360-metrics-card c360-metrics-alerts">';
    html += cardHead("Qué atender", "Alertas del periodo seleccionado. Tocá una para profundizar.");
    html += '<ul class="c360-alerts-list">';
    alerts.forEach(function (a, idx) {
      html +=
        '<li class="c360-alert tone-' +
        (a.tone || "warn") +
        '"><div class="c360-alert-main"><strong>' +
        escapeHtml(a.title) +
        "</strong><p>" +
        escapeHtml(a.text || "") +
        '</p></div><div class="c360-alert-actions">';
      if (a.farm && state.mode !== "farm") {
        html +=
          '<button type="button" class="c360-alert-btn" data-open-farm="' +
          escapeHtml(a.farm) +
          '">Ver finca</button>';
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
          '">Abrir visita</button>';
      }
      html += "</div></li>";
    });
    html += "</ul></section>";
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
      '</p></div><button type="button" class="c360-focus-close" data-act="clear-focus" aria-label="Cerrar detalle">Cerrar</button></div>';

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
            "<div><strong>" +
            escapeHtml(v.farm || state.farm || "Finca") +
            "</strong><p>" +
            escapeHtml(formatDateEs(v.date)) +
            (v.responsible || v.technician ? " · " + escapeHtml(v.responsible || v.technician) : "") +
            "</p><p class=\"c360-focus-meta\">Indicador " +
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
            '">Abrir en Visitas</button>';
          html += "</div></article>";
        });
        html += "</div>";
      }
    } else if (focus.type === "chapter") {
      var chId = focus.chapter;
      var items = focus.items || [];
      html +=
        '<p class="c360-focus-meta">Indicador del capítulo: <strong>' +
        (focus.score == null ? "—" : focus.score + "%") +
        "</strong> · Hallazgos: <strong>" +
        (focus.findings || 0) +
        "</strong></p>";
      if (!items.length) {
        html += '<p class="muted">Sin respuestas No cumple en este capítulo para el corte actual.</p>';
      } else {
        html += '<div class="c360-focus-list">';
        items.forEach(function (it) {
          html += '<article class="c360-focus-item">';
          html +=
            "<div><strong>" +
            escapeHtml(it.id) +
            "</strong><p>" +
            escapeHtml(it.observation || "Sin observación") +
            "</p>";
          if (it.recommendation) {
            html += "<p class=\"muted\">" + escapeHtml(it.recommendation) + "</p>";
          }
          html += "</div>";
          if (it.farm && it.date) {
            html +=
              '<div class="c360-focus-actions"><button type="button" class="c360-alert-btn primary" data-open-visit="' +
              escapeHtml(it.farm) +
              '" data-open-date="' +
              escapeHtml(it.date) +
              '">Abrir visita</button></div>';
          }
          html += "</article>";
        });
        html += "</div>";
      }
    }
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
        state.focus = null;
        render();
      });
    });
    qa("[data-field]", root).forEach(function (el) {
      el.addEventListener("change", function () {
        state[el.getAttribute("data-field")] = el.value;
        if (el.getAttribute("data-field") === "dateFrom" || el.getAttribute("data-field") === "dateTo") {
          state.range = "custom";
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
