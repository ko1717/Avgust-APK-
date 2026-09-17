/*
 * CARE 360 — capa profesional 1.5.0 (edición sin marca).
 *
 * Comportamiento aditivo sobre la aplicación compilada: marca de cabecera,
 * píldora de conexión, espejo de guardado, buscadores en listas, resaltado
 * de obligatorios, encabezado de informe, modo sol para exteriores y botón
 * de volver arriba. Todo defensivo: si el DOM cambia, estas funciones
 * simplemente no hacen nada en lugar de romper la aplicación.
 */
(function () {
  "use strict";

  var PRO_VERSION = "1.5.0";
  var SUN_KEY = "c360-sun";

  var BRAND_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<rect width="64" height="64" rx="14" fill="#14532d"/>' +
    '<path d="M32 10c-9 6-14 11-14 19a14 14 0 0 0 28 0c0-8-5-13-14-19z" fill="#7cb342"/>' +
    '<path d="M32 14v30M32 30l-8-8M32 26l8-8" stroke="#14532d" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
    '<path d="M24 44l5 5 11-12" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    "</svg>";

  function q(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function isDebrand() {
    return (
      window.__C360_DEBRAND === true ||
      document.documentElement.classList.contains("c360-debrand") ||
      /CARE-360-.*sin-marca/i.test(window.location.href)
    );
  }

  /* ------------------------------------------------------------------ *
   * marca de cabecera + píldoras
   * ------------------------------------------------------------------ */

  function markDebrand() {
    if (isDebrand()) document.documentElement.classList.add("c360-debrand");
  }

  function brandTopbar() {
    var bar = q(".topbar .brand") || q(".topbar");
    if (!bar || bar.getAttribute("data-c360-pro") === "1") return;
    bar.setAttribute("data-c360-pro", "1");
    if (document.title && /avgust/i.test(document.title)) {
      document.title = "CARE 360";
    }

    var host = q(".brand", bar) || bar;
    if (!q(".c360-pro-mark", host)) {
      var mark = document.createElement("span");
      mark.className = "c360-pro-mark";
      mark.innerHTML =
        BRAND_SVG +
        '<span class="c360-pro-name">CARE 360</span>' +
        '<span class="c360-pro-tag">MIPE · Campo</span>' +
        '<span class="c360-pro-ver">v' +
        PRO_VERSION +
        " Pro</span>";
      // La edición sin marca ya oculta el logo por CSS; el lockup se antepone.
      host.insertBefore(mark, host.firstChild);
    }
    if (!q(".c360-pro-conn", bar)) {
      var conn = document.createElement("span");
      conn.className = "c360-pro-conn";
      conn.setAttribute("role", "status");
      conn.setAttribute("aria-live", "polite");
      conn.innerHTML = "<i></i><span></span>";
      bar.appendChild(conn);
      paintConn(conn);
    }
    if (!q(".c360-pro-sunbtn", bar)) {
      var btn = document.createElement("button");
      btn.className = "c360-pro-sunbtn";
      btn.type = "button";
      btn.title = "Modo sol: contraste alto para exteriores";
      btn.setAttribute("aria-label", "Activar modo sol de alto contraste");
      btn.setAttribute("aria-pressed", document.documentElement.classList.contains("c360-sun") ? "true" : "false");
      btn.textContent = "☀";
      btn.addEventListener("click", function () {
        var on = document.documentElement.classList.toggle("c360-sun");
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        try {
          window.localStorage.setItem(SUN_KEY, on ? "1" : "0");
        } catch (err) {
          /* almacenamiento no disponible: se ignora */
        }
      });
      bar.appendChild(btn);
    }
  }

  function restoreSun() {
    try {
      if (window.localStorage.getItem(SUN_KEY) === "1") {
        document.documentElement.classList.add("c360-sun");
      }
    } catch (err) {
      /* sin almacenamiento: se ignora */
    }
  }

  function paintConn(conn) {
    conn = conn || q(".c360-pro-conn");
    if (!conn) return;
    var online = window.navigator.onLine !== false;
    conn.setAttribute("data-state", online ? "online" : "offline");
    var label = q("span", conn);
    if (label) label.textContent = online ? "En línea" : "Sin conexión";
    conn.title = online ? "Hay conexión" : "Trabajando sin conexión: todo se guarda en el equipo";
  }

  /* ------------------------------------------------------------------ *
   * espejo de guardado
   * ------------------------------------------------------------------ */

  var savePill = null;
  var saveTimer = null;

  function ensureSavePill() {
    if (savePill) return savePill;
    savePill = document.createElement("div");
    savePill.className = "c360-pro-save";
    savePill.setAttribute("role", "status");
    savePill.setAttribute("aria-live", "polite");
    document.body.appendChild(savePill);
    return savePill;
  }

  function mirrorSaveStatus() {
    var status = q(".saved-status");
    if (!status) return;
    var text = (status.textContent || "").trim();
    if (!text) return;
    var pill = ensureSavePill();
    var dirty = /sin guardar|no guard/i.test(text);
    pill.setAttribute("data-visible", "1");
    pill.setAttribute("data-tone", dirty ? "warn" : "ok");
    var stamp = "";
    if (!dirty) {
      var now = new Date();
      var hh = String(now.getHours()).padStart(2, "0");
      var mm = String(now.getMinutes()).padStart(2, "0");
      stamp = " · " + hh + ":" + mm;
    }
    var label = dirty ? "● Cambios sin guardar" : "✓ Guardado" + stamp;
    if (pill.textContent !== label) pill.textContent = label;
    window.clearTimeout(saveTimer);
    if (!dirty) {
      saveTimer = window.setTimeout(function () {
        pill.removeAttribute("data-visible");
      }, 6000);
    }
  }

  /* ------------------------------------------------------------------ *
   * buscadores rápidos en listas
   * ------------------------------------------------------------------ */

  var LIST_HINTS = [
    /fincas?/i,
    /visitas?/i,
    /informes?/i,
    /solicitudes?/i,
    /seguimiento/i,
    /consulta/i,
    /compromisos?/i,
  ];

  function sectionLists() {
    var out = [];
    // Solo vistas de módulo de primer nivel: evita inyectar en subsecciones
    // anidadas (criterios, mediciones, tarjetas internas).
    var scopes = qa(".workspace, [role='tabpanel']");
    if (!scopes.length) scopes = [document];
    scopes.forEach(function (scope) {
      if (out.length >= 12) return;
      var sections = qa(":scope > section, :scope > article, :scope > div", scope);
      if (!sections.length && scope === document) {
        sections = qa("main > section, main > div");
      }
      sections.forEach(function (sec) {
        if (out.length >= 12) return;
        if (sec.getAttribute("data-c360-pro-list") === "1") {
          out.push(sec);
          return;
        }
        // El título debe ser hijo directo: si viene de una subsección
        // anidada, esta no es la vista propietaria de la lista.
        var head = q(":scope > h1, :scope > h2, :scope > h3", sec);
        var title = head
          ? head.textContent || ""
          : sec.getAttribute("aria-label") || "";
        if (!LIST_HINTS.some(function (re) { return re.test(title); })) return;
        var list = q(":scope > ul, :scope > ol, :scope > table, :scope > .cards, :scope > .list", sec);
        if (!list) return;
        // Coexistencia con la capa operativa: si la vista ya trae su propio
        // buscador (p. ej. visitas), no se duplica el filtro genérico.
        if (q(".c360-visit-search, .c360-pro-filterbar", sec)) return;
        var count =
          list.tagName === "TABLE"
            ? qa("tbody tr", list).filter(function (tr) { return !q("th", tr); }).length
            : list.children.length;
        if (count < 3) return;
        sec.setAttribute("data-c360-pro-list", "1");
        out.push(sec);
      });
    });
    return out;
  }

  function ensureFilter(sec) {
    if (q(":scope > .c360-pro-filterbar", sec)) return;
    var list = q(":scope ul, :scope ol, :scope table, :scope .cards, :scope .list, :scope [role='list']", sec);
    if (!list) return;
    var bar = document.createElement("div");
    bar.className = "c360-pro-filterbar";
    var input = document.createElement("input");
    input.className = "c360-pro-filter";
    input.type = "search";
    input.placeholder = "Buscar en esta lista…";
    input.setAttribute("aria-label", "Buscar en esta lista");
    var count = document.createElement("span");
    count.className = "c360-pro-count";
    bar.appendChild(input);
    bar.appendChild(count);
    list.parentNode.insertBefore(bar, list);

    var empty = document.createElement("p");
    empty.className = "c360-pro-empty";
    empty.hidden = true;
    empty.textContent = "Sin resultados para esa búsqueda.";
    list.parentNode.insertBefore(empty, list.nextSibling);

    var rows = null;
    function collect() {
      if (list.tagName === "TABLE") {
        var body = q("tbody", list) || list;
        rows = qa("tr", body).filter(function (tr) {
          return !q("th", tr);
        });
      } else {
        rows = Array.prototype.slice.call(list.children).filter(function (el) {
          return el !== bar && el !== empty && el.nodeType === 1;
        });
      }
      return rows;
    }

    function paint() {
      var term = (input.value || "").trim().toLowerCase();
      var all = collect();
      var shown = 0;
      all.forEach(function (row) {
        var hit = !term || (row.textContent || "").toLowerCase().indexOf(term) !== -1;
        row.classList.toggle("c360-pro-hidden", !hit);
        if (hit) shown += 1;
      });
      count.textContent = shown + " / " + all.length;
      empty.hidden = shown !== 0;
    }

    input.addEventListener("input", paint);
    // Recalcula cuando la lista cambia (p. ej. al crear una finca).
    new MutationObserver(function () {
      if (document.contains(list)) paint();
    }).observe(list, { childList: true, subtree: false });
    paint();
  }

  function ensureFilters() {
    try {
      sectionLists().forEach(ensureFilter);
    } catch (err) {
      /* listas no disponibles todavía */
    }
  }

  /* ------------------------------------------------------------------ *
   * obligatorios vacíos
   * ------------------------------------------------------------------ */

  function highlightRequired() {
    try {
      qa("label").forEach(function (label) {
        if (label.textContent.indexOf("*") === -1) return;
        var target = null;
        var forId = label.getAttribute("for");
        if (forId) target = document.getElementById(forId);
        if (!target) target = q("input, select, textarea", label);
        if (!target) {
          var box = label.parentElement;
          if (box) target = q("input, select, textarea", box);
        }
        if (!target) return;
        var empty = !(target.value || "").toString().trim();
        target.classList.toggle("c360-pro-missing", empty);
        if (!q(".c360-pro-req", label)) {
          label.innerHTML = label.innerHTML.replace("*", '<span class="c360-pro-req" aria-hidden="true">*</span>');
        }
      });
    } catch (err) {
      /* formulario no disponible todavía */
    }
  }

  /* ------------------------------------------------------------------ *
   * encabezado del informe en pantalla
   * ------------------------------------------------------------------ */

  function reportHead() {
    try {
      var anchors = qa(
        ".report-panel, .report-preview, .consolidated-panel, [class*='report']"
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
      anchors.forEach(function (box) {
        if (q(":scope > .c360-pro-report-head", box)) return;
        // Solo donde haya pinta de informe (tabla o título de informe).
        var looks = /informe|reporte|hallazgos?/i.test(box.textContent.slice(0, 400));
        if (!looks) return;
        var head = document.createElement("div");
        head.className = "c360-pro-report-head";
        head.setAttribute("aria-hidden", "true");
        var today = new Date().toLocaleDateString("es-CO", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        head.innerHTML =
          BRAND_SVG +
          "<div><b>CARE 360 · Informe técnico MIPE</b><small>Acompañamiento en campo · " +
          today +
          "</small></div>";
        box.insertBefore(head, box.firstChild);
      });
    } catch (err) {
      /* informe no visible todavía */
    }
  }

  /* ------------------------------------------------------------------ *
   * volver arriba (refuerzo si la capa base no lo puso)
   * ------------------------------------------------------------------ */

  function backToTop() {
    var btn = q(".c360-to-top");
    if (btn) return;
    btn = document.createElement("button");
    btn.className = "c360-to-top c360-pro-totop";
    btn.type = "button";
    btn.textContent = "↑";
    btn.setAttribute("aria-label", "Volver arriba");
    btn.style.display = "none";
    btn.addEventListener("click", function () {
      try {
        (q(".workspace") || document.documentElement).scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        window.scrollTo(0, 0);
      }
    });
    document.body.appendChild(btn);
    window.addEventListener(
      "scroll",
      function () {
        btn.style.display = window.scrollY > 600 ? "" : "none";
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------ *
   * arranque
   * ------------------------------------------------------------------ */

  var scheduled = false;

  function pass() {
    scheduled = false;
    try {
      markDebrand();
      brandTopbar();
      paintConn();
      mirrorSaveStatus();
      ensureFilters();
      highlightRequired();
      reportHead();
      backToTop();
    } catch (err) {
      /* nunca romper la app por un pulido */
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(pass);
    } else {
      window.setTimeout(pass, 60);
    }
  }

  function boot() {
    restoreSun();
    markDebrand();
    schedule();
    try {
      var observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch (err) {
      /* sin observador: un pase único */
    }
    window.addEventListener("online", paintConn);
    window.addEventListener("offline", paintConn);
    window.setInterval(paintConn, 15000);
  }

  window.Care360Pro = {
    version: PRO_VERSION,
    pass: schedule,
    isDebrand: isDebrand,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
