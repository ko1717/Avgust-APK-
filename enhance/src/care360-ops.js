/**
 * CARE 360 — capa operativa de campo.
 *
 * Briefing en Inicio, calidad de la visita (progreso y pendientes) y
 * herramientas de la lista de visitas. Es aditivo: no modifica el runtime.
 */
(function () {
  "use strict";

  var BACKUP_KEY = "care360:backup:last";
  var HUD_ID = "c360-visit-hud";
  var BRIEF_ID = "c360-home-brief";
  var TOOLS_ID = "c360-visit-tools";
  var META_TARGET = 80;

  var cache = { visits: null, requests: null, at: 0 };
  var listFilter = "all";
  var listQuery = "";
  var hudExpanded = false;
  var lastHudSig = "";
  var lastBriefSig = "";
  var pending = false;

  function q(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function toast(message, tone, duration) {
    if (window.Care360Experience && typeof window.Care360Experience.toast === "function") {
      window.Care360Experience.toast(message, tone, duration);
    }
  }
  function isVisible(node) {
    if (!node) return false;
    var el = node;
    while (el && el.nodeType === 1) {
      if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
      el = el.parentElement;
    }
    var rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }
  function moduleTabs() {
    return qa('.module-nav [data-slot="tabs-trigger"], .module-nav [role="tab"]');
  }
  function activeModuleLabel() {
    var tabs = moduleTabs();
    for (var i = 0; i < tabs.length; i++) {
      if (
        tabs[i].hasAttribute("data-active") ||
        tabs[i].getAttribute("aria-selected") === "true" ||
        tabs[i].getAttribute("data-state") === "active"
      ) {
        return (tabs[i].textContent || "").replace(/\s+/g, " ").trim();
      }
    }
    return "";
  }
  function goToModuleByName(pattern) {
    var tabs = moduleTabs();
    for (var i = 0; i < tabs.length; i++) {
      if (pattern.test((tabs[i].textContent || "").replace(/\s+/g, " "))) {
        tabs[i].click();
        return true;
      }
    }
    return false;
  }
  function todayIso() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function formatDateEs(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso || "—";
    return m[3] + "/" + m[2] + "/" + m[1];
  }
  function weekdayLong() {
    try {
      var raw = new Intl.DateTimeFormat("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch (err) {
      return formatDateEs(todayIso());
    }
  }
  function answerValue(ans) {
    if (!ans) return "";
    var v = ans.value || ans;
    return String(v || "").toUpperCase();
  }
  function storeBackup(ts) {
    try {
      if (ts === undefined) return window.localStorage.getItem(BACKUP_KEY);
      window.localStorage.setItem(BACKUP_KEY, String(ts));
      return String(ts);
    } catch (err) {
      return null;
    }
  }
  function backupAgeDays() {
    var raw = storeBackup();
    if (!raw) return null;
    var ts = Number(raw);
    if (!ts) return null;
    return Math.floor((Date.now() - ts) / 86400000);
  }

  function apiJson(url) {
    return fetch(url).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error((body && body.error) || "No se pudo consultar.");
        return body;
      });
    });
  }

  function loadOpsData(force) {
    if (!force && cache.visits && Date.now() - cache.at < 4000) {
      return Promise.resolve(cache);
    }
    return Promise.all([
      apiJson("/api/visits").catch(function () {
        return [];
      }),
      apiJson("/api/requests").catch(function () {
        return [];
      }),
    ]).then(function (pair) {
      cache.visits = Array.isArray(pair[0]) ? pair[0] : pair[0].visits || pair[0].items || [];
      cache.requests = Array.isArray(pair[1]) ? pair[1] : pair[1].requests || pair[1].items || [];
      cache.at = Date.now();
      return cache;
    });
  }

  function visitScore(v) {
    var answers = (v && v.answers) || {};
    var applicable = 0;
    var findings = 0;
    var answered = 0;
    var incomplete = 0;
    Object.keys(answers).forEach(function (id) {
      var val = answerValue(answers[id]);
      if (val !== "SI" && val !== "NO" && val !== "NA") return;
      answered += 1;
      if (val === "SI" || val === "NO") {
        applicable += 1;
        if (val === "NO") {
          findings += 1;
          var obs = String((answers[id] && answers[id].observation) || "").trim();
          var rec = String((answers[id] && answers[id].recommendation) || "").trim();
          if (!obs || !rec) incomplete += 1;
        }
      }
    });
    return {
      answered: answered,
      applicable: applicable,
      findings: findings,
      incomplete: incomplete,
      score: applicable ? Math.round(((applicable - findings) / applicable) * 100) : null,
      reviewed: !!(v && v.reviewed),
    };
  }

  function actionOverdue(action, today) {
    if (!action) return false;
    var status = String(action.status || "");
    if (status !== "pending" && status !== "progress") return false;
    return !!(action.due && action.due < today);
  }

  function visitOverdueCount(v, today) {
    var n = 0;
    var actions = (v && v.actions) || {};
    Object.keys(actions).forEach(function (id) {
      if (actionOverdue(actions[id], today)) n += 1;
    });
    var answers = (v && v.answers) || {};
    Object.keys(answers).forEach(function (id) {
      if (answerValue(answers[id]) !== "NO") return;
      if (actionOverdue(actions[id], today)) return;
      if (actionOverdue(answers[id] && answers[id].action, today)) n += 1;
    });
    return n;
  }

  /* ------------------------------------------------------------------ *
   * Inicio: briefing operativo
   * ------------------------------------------------------------------ */

  function onHome() {
    return !!q(".home-stats") && /inicio/i.test(activeModuleLabel() || "Inicio");
  }

  function summarizeHome(data) {
    var visits = data.visits || [];
    var requests = data.requests || [];
    var today = todayIso();
    var drafts = [];
    var overdue = 0;
    var todayVisits = [];
    visits.forEach(function (v) {
      if (!v) return;
      if (!v.reviewed) drafts.push(v);
      overdue += visitOverdueCount(v, today);
      if (v.date === today) todayVisits.push(v);
    });
    var todayRequests = requests.filter(function (r) {
      return r && r.date === today && r.status !== "cancelled" && r.status !== "done";
    });
    var age = backupAgeDays();
    return {
      visits: visits.length,
      drafts: drafts,
      overdue: overdue,
      todayVisits: todayVisits,
      todayRequests: todayRequests,
      backupDays: age,
    };
  }

  function briefNarrative(sum) {
    var parts = [];
    if (sum.drafts.length) {
      parts.push(
        sum.drafts.length === 1
          ? "1 informe por revisar"
          : sum.drafts.length + " informes por revisar"
      );
    }
    if (sum.overdue) {
      parts.push(
        sum.overdue === 1 ? "1 compromiso vencido" : sum.overdue + " compromisos vencidos"
      );
    }
    var todayN = sum.todayVisits.length + sum.todayRequests.length;
    if (todayN) {
      parts.push(todayN === 1 ? "1 actividad para hoy" : todayN + " actividades para hoy");
    }
    if (!parts.length) {
      return sum.visits
        ? "Sin pendientes de revisión. El trabajo del día está al día."
        : "Empieza por registrar la finca y abrir la primera visita.";
    }
    return parts.join(" · ") + ".";
  }

  function backupCopy(days) {
    if (days == null) return { label: "Sin respaldo", tone: "warn", hint: "Crea el primero hoy" };
    if (days <= 3) return { label: "Respaldo al día", tone: "ok", hint: days === 0 ? "Hoy" : "Hace " + days + " d" };
    if (days <= 10) return { label: "Respaldo", tone: "warn", hint: "Hace " + days + " días" };
    return { label: "Respaldo atrasado", tone: "crit", hint: "Hace " + days + " días" };
  }

  function renderBriefing(sum) {
    var stats = q(".home-stats");
    if (!stats || !onHome()) {
      var stale = q("#" + BRIEF_ID);
      if (stale) stale.remove();
      lastBriefSig = "";
      return;
    }
    var host = stats.parentElement;
    if (!host) return;
    var backup = backupCopy(sum.backupDays);
    var sig = [
      sum.visits,
      sum.drafts.length,
      sum.overdue,
      sum.todayVisits.length,
      sum.todayRequests.length,
      backup.tone,
      backup.hint,
    ].join("|");
    var root = q("#" + BRIEF_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = BRIEF_ID;
      root.className = "c360-home-brief no-print";
      root.setAttribute("aria-label", "Briefing operativo de campo");
      host.insertBefore(root, stats);
    }
    if (sig === lastBriefSig && root.getAttribute("data-ready") === "1") return;
    lastBriefSig = sig;
    var todayN = sum.todayVisits.length + sum.todayRequests.length;
    root.setAttribute("data-ready", "1");
    root.innerHTML =
      '<header class="c360-brief-head">' +
      '<p class="c360-brief-kicker">Hoy en campo</p>' +
      "<h2>" +
      escapeHtml(weekdayLong()) +
      "</h2>" +
      '<p class="c360-brief-lead">' +
      escapeHtml(briefNarrative(sum)) +
      "</p></header>" +
      '<div class="c360-brief-tiles" role="list">' +
      tile("drafts", "Borradores", String(sum.drafts.length), "Por revisar", sum.drafts.length ? "warn" : "ok") +
      tile("overdue", "Vencidos", String(sum.overdue), "Compromisos", sum.overdue ? "crit" : "ok") +
      tile("today", "Hoy", String(todayN), "Agenda", todayN ? "brand" : "ok") +
      tile("backup", backup.label, backup.hint, "Datos del equipo", backup.tone) +
      "</div>";
  }

  function tile(act, label, value, hint, tone) {
    return (
      '<button type="button" class="c360-brief-tile" data-act="' +
      act +
      '" data-tone="' +
      tone +
      '" role="listitem">' +
      '<span class="c360-brief-tile-label">' +
      escapeHtml(label) +
      "</span><strong>" +
      escapeHtml(value) +
      "</strong><em>" +
      escapeHtml(hint) +
      "</em></button>"
    );
  }

  function handleBriefClick(event) {
    var btn = event.target.closest("[data-act]");
    if (!btn || !btn.closest("#" + BRIEF_ID)) return;
    var act = btn.getAttribute("data-act");
    if (act === "drafts") {
      goToModuleByName(/Visitas/i);
      listFilter = "draft";
      window.setTimeout(enhanceVisitList, 350);
      return;
    }
    if (act === "overdue") {
      goToModuleByName(/Seguimiento/i);
      toast("Abre Seguimiento para cerrar los compromisos vencidos.", "info", 2800);
      return;
    }
    if (act === "today") {
      goToModuleByName(/Solicitudes/i);
      return;
    }
    if (act === "backup") {
      var target = qa("button").find(function (el) {
        return /Crear respaldo completo/i.test(el.textContent || "");
      });
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.focus();
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Visita: panel de calidad
   * ------------------------------------------------------------------ */

  function visitEditor() {
    var editor = q(".editor");
    if (!editor || !q(".steps") || !isVisible(editor)) return null;
    return editor;
  }

  function nativeVisitTabs() {
    return qa('.steps [data-slot="tabs-trigger"]');
  }

  function goVisitPhase(name) {
    var tabs = nativeVisitTabs();
    var map = { datos: 0, chequeo: 1, fotos: 2, informe: 3 };
    var index = map[name];
    if (index === undefined || !tabs[index]) return false;
    tabs[index].click();
    return true;
  }

  function questionAnswer(question) {
    var checked =
      q('.answer-options [data-state="checked"]', question) ||
      q('.answer-options [aria-checked="true"]', question) ||
      q(".answer-options input:checked", question);
    if (checked) {
      var raw = (checked.getAttribute("value") || checked.getAttribute("data-value") || "").toUpperCase();
      if (raw === "SI" || raw === "NO" || raw === "NA") return raw;
      var host = checked.closest("label") || checked;
      var text = String(host.textContent || "").replace(/\s+/g, " ").trim();
      if (/^Sí$/i.test(text)) return "SI";
      if (/^No aplica$/i.test(text)) return "NA";
      if (/^No$/i.test(text)) return "NO";
    }
    var labels = qa(".answer-options label", question);
    for (var i = 0; i < labels.length; i++) {
      var input = q("input", labels[i]);
      var on =
        (input && input.checked) ||
        labels[i].getAttribute("data-state") === "checked" ||
        q('[data-state="checked"], [aria-checked="true"]', labels[i]);
      if (!on) continue;
      var t = String(labels[i].textContent || "").replace(/\s+/g, " ").trim();
      if (/^Sí$/i.test(t)) return "SI";
      if (/^No aplica$/i.test(t)) return "NA";
      if (/^No$/i.test(t)) return "NO";
    }
    return "";
  }

  function measureFilled(re) {
    var labels = qa(".editor label");
    for (var i = 0; i < labels.length; i++) {
      var title = String(
        (labels[i].childNodes[0] && labels[i].childNodes[0].textContent) || labels[i].textContent || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!re.test(title)) continue;
      var input = q("input, textarea, select", labels[i]);
      if (input && String(input.value || "").trim()) return true;
    }
    return false;
  }

  function auditVisitDom() {
    var editor = visitEditor();
    if (!editor) return null;
    var questions = qa(".question", editor);
    var unanswered = [];
    var findings = [];
    var incomplete = [];
    questions.forEach(function (node) {
      var code = ((q(".question-code", node) && q(".question-code", node).textContent) || "").trim();
      var val = questionAnswer(node);
      if (!val) {
        unanswered.push({ node: node, code: code });
        return;
      }
      if (val !== "NO") return;
      var areas = qa("textarea", node);
      var obs = String((areas[0] && areas[0].value) || "").trim();
      var rec = String((areas[1] && areas[1].value) || "").trim();
      var item = { node: node, code: code };
      findings.push(item);
      if (!obs || !rec) incomplete.push(item);
    });
    var dateInput = q('input[type="date"]', editor);
    var datosMissing = [];
    if (dateInput && !dateInput.value) datosMissing.push("fecha");
    var farmField =
      q('[data-slot="select-value"]', editor) || q('button[role="combobox"]', editor);
    var farmText = farmField ? String(farmField.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (farmText && /seleccion|elige una finca|^finca$/i.test(farmText)) datosMissing.push("finca");
    var photos = qa(".photo-card", editor).filter(isVisible);
    var measures = [
      { id: "agua", ok: measureFilled(/^pH del agua/i) && measureFilled(/Dureza/i) },
      { id: "mezcla", ok: measureFilled(/pH mezcla final/i) },
      { id: "presion", ok: measureFilled(/Presión de la bomba|Presión \(PSI\)/i) },
      { id: "equipo", ok: measureFilled(/^Equipo de aplicación/i) },
      { id: "cama", ok: measureFilled(/Volumen por cama/i) },
    ];
    var measuresFilled = measures.filter(function (m) {
      return m.ok;
    }).length;
    var total = questions.length;
    var answered = total - unanswered.length;
    var na = 0;
    questions.forEach(function (node) {
      if (questionAnswer(node) === "NA") na += 1;
    });
    var applicable = answered - na;
    var score = applicable ? Math.round(((applicable - findings.length) / applicable) * 100) : null;
    var status = "blocked";
    if (!total) status = "pending";
    else if (!unanswered.length && !incomplete.length && !datosMissing.length) status = "ready";
    else if (answered > 0) status = "progress";
    return {
      total: total,
      answered: answered,
      unanswered: unanswered,
      findings: findings,
      incomplete: incomplete,
      datosMissing: datosMissing,
      photos: photos.length,
      measuresFilled: measuresFilled,
      measuresTotal: measures.length,
      score: score,
      status: status,
    };
  }

  function hudStatusCopy(audit) {
    if (!audit.total) return { title: "Calidad de la visita", lead: "Completa los datos y responde los criterios." };
    if (audit.status === "ready") {
      return {
        title: "Listo para emitir",
        lead:
          (audit.score != null ? "Indicador " + audit.score + "% · " : "") +
          "Criterios cubiertos. Revisa el informe y confírmalo.",
      };
    }
    if (audit.unanswered.length) {
      return {
        title: "Evaluación en curso",
        lead:
          "Faltan " +
          audit.unanswered.length +
          " criterio" +
          (audit.unanswered.length === 1 ? "" : "s") +
          (audit.incomplete.length ? " · " + audit.incomplete.length + " hallazgo(s) sin cerrar" : "") +
          ".",
      };
    }
    if (audit.incomplete.length) {
      return {
        title: "Hallazgos incompletos",
        lead: "Documenta observación y recomendación en cada No cumple.",
      };
    }
    if (audit.datosMissing.length) {
      return { title: "Faltan datos de la visita", lead: "Completa finca y fecha antes de emitir." };
    }
    return { title: "Calidad de la visita", lead: "Sigue cubriendo el protocolo MIPE." };
  }

  function renderHud(audit) {
    var editor = visitEditor();
    var steps = q(".steps");
    if (!editor || !steps || !audit) {
      var stale = q("#" + HUD_ID);
      if (stale) stale.remove();
      document.documentElement.style.setProperty("--c360-hud-h", "0px");
      lastHudSig = "";
      return;
    }
    var copy = hudStatusCopy(audit);
    var pct = audit.total ? Math.round((audit.answered / audit.total) * 100) : 0;
    var sig = [
      audit.answered,
      audit.total,
      audit.unanswered.length,
      audit.incomplete.length,
      audit.findings.length,
      audit.photos,
      audit.measuresFilled,
      audit.datosMissing.join(","),
      audit.score,
      audit.status,
      hudExpanded ? "1" : "0",
    ].join("|");
    var root = q("#" + HUD_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = HUD_ID;
      root.className = "c360-visit-hud no-print";
      root.setAttribute("aria-label", "Calidad de la visita");
      steps.insertAdjacentElement("afterend", root);
    }
    if (sig === lastHudSig) {
      syncHudHeight();
      return;
    }
    lastHudSig = sig;
    var chips =
      chip("Datos", audit.datosMissing.length ? "warn" : "ok", audit.datosMissing.length ? "Pendiente" : "Listo") +
      chip(
        "Evaluación",
        audit.unanswered.length ? "warn" : audit.total ? "ok" : "pend",
        audit.answered + "/" + (audit.total || "—")
      ) +
      chip("Hallazgos", audit.incomplete.length ? "crit" : audit.findings.length ? "warn" : "ok", String(audit.findings.length)) +
      chip("Mediciones", audit.measuresFilled >= 3 ? "ok" : "warn", audit.measuresFilled + "/" + audit.measuresTotal) +
      chip("Fotos", audit.findings.length && !audit.photos ? "warn" : "ok", String(audit.photos));
    root.setAttribute("data-status", audit.status);
    root.innerHTML =
      '<div class="c360-hud-row">' +
      '<div class="c360-hud-copy"><p class="c360-hud-kicker">Calidad de la visita</p><strong>' +
      escapeHtml(copy.title) +
      "</strong><span>" +
      escapeHtml(copy.lead) +
      "</span></div>" +
      '<div class="c360-hud-meter" aria-hidden="true"><b>' +
      pct +
      "%</b>" +
      '<i><em style="width:' +
      pct +
      '%"></em></i></div>' +
      '<button type="button" class="c360-hud-next" data-act="next">' +
      (audit.status === "ready" ? "Ir al informe" : "Siguiente pendiente") +
      "</button>" +
      '<button type="button" class="c360-hud-toggle" data-act="toggle" aria-expanded="' +
      (hudExpanded ? "true" : "false") +
      '">' +
      (hudExpanded ? "Menos" : "Detalle") +
      "</button></div>" +
      (hudExpanded ? '<div class="c360-hud-chips">' + chips + "</div>" : "");
    syncHudHeight();
  }

  function chip(label, tone, value) {
    return (
      '<span class="c360-hud-chip" data-tone="' +
      tone +
      '"><em>' +
      escapeHtml(label) +
      "</em><b>" +
      escapeHtml(value) +
      "</b></span>"
    );
  }

  function syncHudHeight() {
    var root = q("#" + HUD_ID);
    var h = root ? Math.round(root.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--c360-hud-h", h + "px");
  }

  function scrollToNode(node) {
    if (!node) return;
    try {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (err) {
      node.scrollIntoView(true);
    }
    var focusable = q("textarea, input, [role='radio'], label", node) || node;
    try {
      focusable.focus();
    } catch (err2) {}
  }

  function goNextGap(audit) {
    if (!audit) return;
    if (audit.datosMissing.length) {
      goVisitPhase("datos");
      window.setTimeout(function () {
        var editor = visitEditor();
        if (!editor) return;
        var date = q('input[type="date"]', editor);
        if (date && !date.value) {
          date.focus();
          return;
        }
        var combo = q('button[role="combobox"]', editor);
        if (combo) combo.focus();
      }, 80);
      return;
    }
    if (audit.unanswered.length || audit.incomplete.length) {
      goVisitPhase("chequeo");
      var target = (audit.unanswered[0] || audit.incomplete[0] || {}).node;
      window.setTimeout(function () {
        scrollToNode(target);
      }, 120);
      return;
    }
    if (audit.findings.length && audit.photos === 0) {
      goVisitPhase("fotos");
      toast("Adjunta evidencia fotográfica de los hallazgos.", "info", 2800);
      return;
    }
    goVisitPhase("informe");
  }

  function handleHudClick(event) {
    var btn = event.target.closest("[data-act]");
    if (!btn || !btn.closest("#" + HUD_ID)) return;
    var act = btn.getAttribute("data-act");
    if (act === "toggle") {
      hudExpanded = !hudExpanded;
      lastHudSig = "";
      renderHud(auditVisitDom());
      return;
    }
    if (act === "next") goNextGap(auditVisitDom());
  }

  /* ------------------------------------------------------------------ *
   * Lista de visitas
   * ------------------------------------------------------------------ */

  function visitsListHost() {
    var lists = qa(".visits-list");
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].hidden) continue;
      if (/Visitas guardadas/i.test(lists[i].textContent || "")) return lists[i];
      if (q(".visit-row", lists[i])) return lists[i];
    }
    return null;
  }

  function matchVisitRow(row, visits) {
    var farm = String((q("strong", row) && q("strong", row).textContent) || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    var small = String((q("small", row) && q("small", row).textContent) || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    var hits = (visits || []).filter(function (visit) {
      if (String(visit.farm || "").replace(/\s+/g, " ").trim().toLowerCase() !== farm) return false;
      var date = String(visit.date || "").toLowerCase();
      if (date && small.indexOf(date) === -1) return false;
      return true;
    });
    return hits[0] || null;
  }

  function enhanceVisitList() {
    var host = visitsListHost();
    if (!host || visitEditor()) {
      var stale = q("#" + TOOLS_ID);
      if (stale) stale.remove();
      return;
    }
    var heading = q(".page-heading", host) || q("h2", host);
    if (!heading) return;
    var tools = q("#" + TOOLS_ID);
    if (!tools) {
      tools = document.createElement("div");
      tools.id = TOOLS_ID;
      tools.className = "c360-visit-tools no-print";
      heading.insertAdjacentElement("afterend", tools);
    }
    if (!q("input", tools)) {
      tools.innerHTML =
        '<label class="c360-visit-search"><span>Buscar visita</span>' +
        '<input type="search" placeholder="Finca, responsable o fecha" autocomplete="off" /></label>' +
        '<div class="c360-visit-filters" role="tablist" aria-label="Filtrar visitas">' +
        filterBtn("all", "Todas") +
        filterBtn("draft", "Borradores") +
        filterBtn("reviewed", "Revisadas") +
        "</div>";
      q("input", tools).addEventListener("input", function (event) {
        listQuery = String(event.target.value || "");
        applyVisitFilters();
      });
    }
    var input = q("input", tools);
    if (input && input.value !== listQuery) input.value = listQuery;
    qa("[data-filter]", tools).forEach(function (btn) {
      btn.setAttribute("data-active", btn.getAttribute("data-filter") === listFilter ? "1" : "0");
    });
    var visits = cache.visits || [];
    qa(".visit-row", host).forEach(function (row) {
      var visit = matchVisitRow(row, visits);
      if (visit) {
        row.setAttribute("data-c360-reviewed", visit.reviewed ? "1" : "0");
        var audit = visitScore(visit);
        var badge = q(".c360-visit-badge", row);
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "c360-visit-badge";
          var actions = q("button", row);
          if (actions) row.insertBefore(badge, actions);
          else row.appendChild(badge);
        }
        var tone = visit.reviewed ? (audit.score != null && audit.score < META_TARGET ? "warn" : "ok") : "pend";
        if (audit.incomplete) tone = "crit";
        badge.setAttribute("data-tone", tone);
        badge.textContent = visit.reviewed
          ? audit.score != null
            ? audit.score + "%"
            : "Revisado"
          : audit.answered
            ? "Borrador " + audit.answered
            : "Borrador";
      }
    });
    applyVisitFilters();
  }

  function filterBtn(id, label) {
    return (
      '<button type="button" data-filter="' +
      id +
      '"' +
      (listFilter === id ? ' data-active="1"' : "") +
      ">" +
      label +
      "</button>"
    );
  }

  function applyVisitFilters() {
    var host = visitsListHost();
    if (!host) return;
    var query = listQuery.replace(/\s+/g, " ").trim().toLowerCase();
    var visible = 0;
    qa(".visit-row", host).forEach(function (row) {
      var reviewed = row.getAttribute("data-c360-reviewed") === "1";
      var text = String(row.textContent || "").toLowerCase();
      var ok = true;
      if (listFilter === "draft" && reviewed) ok = false;
      if (listFilter === "reviewed" && !reviewed) ok = false;
      if (query && text.indexOf(query) === -1) ok = false;
      row.removeAttribute("data-c360-hidden");
      if (!ok) row.setAttribute("data-c360-hidden", "");
      if (ok) visible += 1;
    });
    var empty = q(".c360-visit-filter-empty", host);
    if (!visible && qa(".visit-row", host).length) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "c360-visit-filter-empty muted";
        host.appendChild(empty);
      }
      empty.textContent = "Ninguna visita coincide con el filtro.";
    } else if (empty) {
      empty.remove();
    }
  }

  function handleToolsClick(event) {
    var btn = event.target.closest("[data-filter]");
    if (!btn || !btn.closest("#" + TOOLS_ID)) return;
    listFilter = btn.getAttribute("data-filter") || "all";
    enhanceVisitList();
  }

  /* ------------------------------------------------------------------ *
   * arranque
   * ------------------------------------------------------------------ */

  function refresh() {
    var home = onHome();
    var editor = visitEditor();
    var list = !!visitsListHost() && !editor;
    if (home || list) {
      loadOpsData(false)
        .then(function (data) {
          if (home) renderBriefing(summarizeHome(data));
          else {
            var brief = q("#" + BRIEF_ID);
            if (brief) brief.remove();
            lastBriefSig = "";
          }
          if (list) enhanceVisitList();
        })
        .catch(function () {
          if (home) renderBriefing(summarizeHome({ visits: [], requests: [] }));
        });
    } else {
      var brief = q("#" + BRIEF_ID);
      if (brief) brief.remove();
      lastBriefSig = "";
    }
    if (editor) renderHud(auditVisitDom());
    else {
      var hud = q("#" + HUD_ID);
      if (hud) hud.remove();
      document.documentElement.style.setProperty("--c360-hud-h", "0px");
      lastHudSig = "";
    }
  }

  function boot() {
    document.addEventListener("click", handleBriefClick, true);
    document.addEventListener("click", handleHudClick, true);
    document.addEventListener("click", handleToolsClick, true);
    document.addEventListener(
      "click",
      function (event) {
        var btn = event.target.closest("button");
        if (!btn) return;
        if (/Crear respaldo completo/i.test((btn.textContent || "").replace(/\s+/g, " "))) {
          storeBackup(Date.now());
          lastBriefSig = "";
          window.setTimeout(refresh, 500);
        }
      },
      true
    );
    document.addEventListener(
      "input",
      function (event) {
        if (!visitEditor()) return;
        if (!event.target.closest(".editor")) return;
        window.clearTimeout(boot._input);
        boot._input = window.setTimeout(function () {
          lastHudSig = "";
          renderHud(auditVisitDom());
        }, 180);
      },
      true
    );

    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        refresh();
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active", "aria-selected", "data-state", "hidden"],
    });

    window.addEventListener("resize", syncHudHeight, { passive: true });
    refresh();
    var started = Date.now();
    (function poll() {
      refresh();
      if (Date.now() - started < 10000 || visitEditor() || q(".home-stats") || q(".visit-row")) {
        window.setTimeout(poll, 800);
      }
    })();
  }

  window.Care360Ops = {
    refresh: refresh,
    auditVisit: auditVisitDom,
    backupAgeDays: backupAgeDays,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
