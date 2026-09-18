/*
 * AVGUST CARE 360 — capa de experiencia de uso.
 *
 * Resuelve el comportamiento que no cubre la aplicacion web cuando se ejecuta
 * dentro del telefono: boton fisico de atras, aviso de cambios sin guardar,
 * estado de conexion, recuperacion ante un error inesperado y ayudas de
 * navegacion.
 */
(function () {
  "use strict";

  var EXIT_WINDOW_MS = 2600;

  /* ------------------------------------------------------------------ *
   * utilidades
   * ------------------------------------------------------------------ */

  function q(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setNativeValue(el, value) {
    if (!el) return;
    var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function moduleTabs() {
    return qa('.module-nav [data-slot="tabs-trigger"]');
  }

  function activeModuleIndex() {
    var tabs = moduleTabs();
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].hasAttribute("data-active")) return i;
    }
    return -1;
  }

  function hasUnsavedWork() {
    var status = q(".saved-status");
    if (!status) return false;
    return /sin guardar/i.test(status.textContent || "");
  }

  function openDialog() {
    var dialogs = qa('[role="dialog"], [role="alertdialog"]').filter(function (node) {
      return !node.hasAttribute("hidden") && node.className.indexOf("c360-") !== 0;
    });
    return dialogs.length ? dialogs[dialogs.length - 1] : null;
  }

  /* ------------------------------------------------------------------ *
   * avisos breves
   * ------------------------------------------------------------------ */

  var badge = null;
  var badgeTimer = null;

  function toast(message, tone, duration) {
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "c360-net-badge";
      badge.setAttribute("role", "status");
      badge.setAttribute("aria-live", "polite");
      document.body.appendChild(badge);
    }
    badge.textContent = message;
    badge.setAttribute("data-tone", tone || "info");
    badge.setAttribute("data-visible", "1");
    window.clearTimeout(badgeTimer);
    badgeTimer = window.setTimeout(function () {
      badge.removeAttribute("data-visible");
    }, duration || 2800);
  }

  /* ------------------------------------------------------------------ *
   * boton fisico de atras
   * ------------------------------------------------------------------ */

  var armed = false;
  var exitPrompt = 0;
  var rearmTimer = null;

  function arm() {
    if (armed) return;
    try {
      window.history.pushState({ c360: "guard" }, "");
      armed = true;
    } catch (err) {
      armed = false;
    }
  }

  function goToHome() {
    goToModule(0);
  }

  function animatePane() {
    window.setTimeout(function () {
      var workspace = q(".workspace");
      if (!workspace) return;
      workspace.classList.remove("c360-pane-in");
      void workspace.offsetWidth;
      workspace.classList.add("c360-pane-in");
    }, 30);
  }

  function goToModule(index) {
    var tabs = moduleTabs();
    if (!tabs.length) return false;
    if (index < 0 || index >= tabs.length) return false;
    if (index === activeModuleIndex()) return false;
    tabs[index].click();
    animatePane();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch (err) {
        /* algunos navegadores bloquean la vibracion */
      }
    }
    return true;
  }

  function isVisible(node) {
    if (!node) return false;
    var el = node;
    while (el && el.nodeType === 1) {
      if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
      var style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (parseFloat(style.opacity) === 0) return false;
      el = el.parentElement;
    }
    var rect = node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    if (rect.right < 0 || rect.left > document.documentElement.clientWidth) return false;
    return true;
  }

  function visibleButtons() {
    return qa("button").filter(function (button) {
      if (button.disabled) return false;
      if (button.closest(".c360-intro, .c360-crash, .c360-help-btn")) return false;
      return isVisible(button);
    });
  }

  function clickButtonByLabel(pattern, fromEnd) {
    var buttons = visibleButtons();
    var start = fromEnd ? buttons.length - 1 : 0;
    var step = fromEnd ? -1 : 1;
    for (var i = start; fromEnd ? i >= 0 : i < buttons.length; i += step) {
      if (pattern.test((buttons[i].textContent || "").trim())) {
        buttons[i].click();
        return true;
      }
    }
    return false;
  }

  function unwindInnerTabs() {
    var lists = qa('.module-subtabs[data-slot="tabs-list"]');
    for (var i = 0; i < lists.length; i++) {
      if (!isVisible(lists[i])) continue;
      var tabs = qa('[data-slot="tabs-trigger"]', lists[i]);
      if (tabs.length < 2) continue;
      var active = 0;
      for (var t = 0; t < tabs.length; t++) {
        if (tabs[t].hasAttribute("data-active")) active = t;
      }
      if (active > 0) {
        tabs[0].click();
        return true;
      }
    }
    return false;
  }

  function handleBack() {
    if (window.Care360Intro && window.Care360Intro.isOpen()) {
      window.Care360Intro.close(true);
      return true;
    }

    var dialog = openDialog();
    if (dialog) {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
      );
      return true;
    }

    /* Overlay de informe, solicitud o expediente abierto encima del módulo. */
    if (clickButtonByLabel(/^cerrar$/i, true)) return true;

    if (goVisitBack()) return true;

    if (unwindInnerTabs()) return true;

    var index = activeModuleIndex();
    if (index > 0) {
      goToHome();
      return true;
    }

    var now = Date.now();
    if (now - exitPrompt < EXIT_WINDOW_MS) return false;
    exitPrompt = now;

    if (hasUnsavedWork()) {
      toast("Tienes cambios sin guardar. Presiona atrás otra vez para salir.", "info", EXIT_WINDOW_MS);
    } else {
      toast("Presiona atrás otra vez para salir", "info", EXIT_WINDOW_MS);
    }
    return false;
  }

  function setupBackButton() {
    arm();

    window.addEventListener("popstate", function (event) {
      if (event.state && event.state.c360 === "guard") return;
      armed = false;
      var handled = handleBack();
      if (handled) {
        arm();
      } else {
        /* Queda desarmado: la siguiente pulsacion cierra la aplicacion.
           Si el usuario no insiste, se vuelve a proteger la pantalla. */
        window.clearTimeout(rearmTimer);
        rearmTimer = window.setTimeout(arm, EXIT_WINDOW_MS);
      }
    });

    /* Compatibilidad con el evento de Cordova, por si el contenedor lo emite. */
    document.addEventListener("backbutton", function (event) {
      event.preventDefault();
      handleBack();
    });
  }

  /* ------------------------------------------------------------------ *
   * cambios sin guardar
   * ------------------------------------------------------------------ */

  function setupUnsavedGuard() {
    var lastWarning = 0;

    document.addEventListener(
      "click",
      function (event) {
        var tab = event.target.closest('.module-nav [data-slot="tabs-trigger"]');
        if (!tab || tab.hasAttribute("data-active")) return;
        if (!hasUnsavedWork()) return;
        var now = Date.now();
        if (now - lastWarning < 4000) return;
        lastWarning = now;
        toast("Recuerda guardar la visita: tienes cambios sin guardar.", "info", 3400);
      },
      true
    );
  }

  /* ------------------------------------------------------------------ *
   * estado de conexion
   * ------------------------------------------------------------------ */

  function setupConnection() {
    window.addEventListener("offline", function () {
      toast("Sin conexión. Puedes seguir trabajando: todo se guarda en el equipo.", "info", 3600);
    });
    window.addEventListener("online", function () {
      toast("Conexión restablecida", "ok", 2200);
    });
  }

  /* ------------------------------------------------------------------ *
   * recuperacion ante un error inesperado
   * ------------------------------------------------------------------ */

  var crashShown = false;

  function appLooksBroken() {
    var root = document.getElementById("root");
    if (!root) return true;
    if (!q(".topbar")) return true;
    return root.textContent.trim().length === 0;
  }

  function showCrash(detail) {
    if (crashShown) return;
    crashShown = true;

    var panel = document.createElement("div");
    panel.className = "c360-crash";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-label", "La aplicación necesita reiniciarse");
    panel.innerHTML =
      '<div class="c360-crash-card">' +
      "<h2>La aplicación necesita reiniciarse</h2>" +
      "<p>Ocurrió un problema inesperado. Tu información guardada no se pierde: sigue almacenada en este equipo.</p>" +
      "<pre></pre>" +
      '<div class="c360-crash-actions">' +
      '<button type="button" class="c360-nav-btn" data-kind="next" data-act="reload">Reiniciar ahora</button>' +
      '<button type="button" class="c360-nav-btn" data-kind="back" data-act="dismiss">Continuar sin reiniciar</button>' +
      "</div></div>";
    panel.querySelector("pre").textContent = String(detail || "").slice(0, 600);
    panel.addEventListener("click", function (event) {
      var action = event.target.closest("[data-act]");
      if (!action) return;
      if (action.getAttribute("data-act") === "reload") window.location.reload();
      else {
        panel.remove();
        crashShown = false;
      }
    });
    document.body.appendChild(panel);
  }

  function setupCrashGuard() {
    function check(detail) {
      window.setTimeout(function () {
        if (appLooksBroken()) showCrash(detail);
      }, 500);
    }

    window.addEventListener("error", function (event) {
      check(event.message + (event.filename ? " (" + event.filename + ")" : ""));
    });

    window.addEventListener("unhandledrejection", function (event) {
      var reason = event.reason;
      check(reason && reason.message ? reason.message : String(reason));
    });
  }

  /* ------------------------------------------------------------------ *
   * ayudas de navegacion
   * ------------------------------------------------------------------ */

  function setupScrollHelpers() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "c360-to-top";
    button.setAttribute("aria-label", "Volver al inicio de la página");
    button.title = "Volver arriba";
    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 7-7 7 7"/><path d="M12 6v13"/></svg>';
    button.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(button);

    var ticking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          if (window.scrollY > 620) button.setAttribute("data-visible", "1");
          else button.removeAttribute("data-visible");
        });
      },
      { passive: true }
    );

    /* Al cambiar de modulo o de paso se vuelve al comienzo del contenido y
       la pestaña activa se deja siempre visible en la barra. */
    document.addEventListener("click", function (event) {
      var tab = event.target.closest('[data-slot="tabs-trigger"]');
      if (!tab) return;
      var moduleTab = tab.closest(".module-nav");
      if (moduleTab && !tab.hasAttribute("data-active")) {
        animatePane();
      }
      window.setTimeout(function () {
        if (moduleTab) window.scrollTo({ top: 0, behavior: "smooth" });
        keepActiveTabVisible();
      }, 60);
    });
  }

  function keepActiveTabVisible() {
    qa('[data-slot="tabs-list"]').forEach(function (list) {
      if (list.scrollWidth <= list.clientWidth + 4) return;
      var active = q("[data-active]", list);
      if (!active) return;
      var offset = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
      list.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
    });
  }

  /* ------------------------------------------------------------------ *
   * medidas reales de las barras fijas
   * ------------------------------------------------------------------ */

  /* La barra de modulos queda arriba. Se mide su alto para que los pasos
     de la visita se fijen justo debajo. */
  function syncChromeSizes() {
    var nav = q(".module-nav");
    var topbar = q(".topbar");
    var root = document.documentElement;

    if (nav) {
      root.style.setProperty(
        "--c360-nav-h",
        Math.round(nav.getBoundingClientRect().height) + "px"
      );
    }

    if (topbar) {
      root.style.setProperty(
        "--c360-topbar-h",
        Math.round(topbar.getBoundingClientRect().height) + "px"
      );
    }

    var save = q(".mobile-save");
    var saveHeight = 0;
    if (save && window.getComputedStyle(save).display !== "none") {
      saveHeight = Math.round(save.getBoundingClientRect().height);
    }
    root.style.setProperty("--c360-save-h", saveHeight + "px");
  }

  var sizeObserver = null;

  function watchChromeSizes() {
    syncChromeSizes();
    if (typeof ResizeObserver !== "function" || sizeObserver) return;
    var nav = q(".module-nav");
    var topbar = q(".topbar");
    if (!nav && !topbar) return;
    sizeObserver = new ResizeObserver(syncChromeSizes);
    if (nav) sizeObserver.observe(nav);
    if (topbar) sizeObserver.observe(topbar);
  }

  /* ------------------------------------------------------------------ *
   * deslizamiento entre funciones
   * ------------------------------------------------------------------ */

  function isTypingTarget(node) {
    if (!node) return false;
    if (node.isContentEditable) return true;
    if (!/^(input|textarea|select)$/i.test(node.tagName)) return false;
    return !/^(checkbox|radio|button|submit|range|file)$/i.test(node.type || "");
  }

  function horizontalScroller(node) {
    var el = node;
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 12) {
        var overflow = window.getComputedStyle(el).overflowX;
        if (overflow === "auto" || overflow === "scroll") return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function setupModuleSwipe() {
    var startX = 0;
    var startY = 0;
    var tracking = false;
    var startTarget = null;
    var MIN = 64;

    document.addEventListener(
      "touchstart",
      function (event) {
        if (event.touches.length !== 1) {
          tracking = false;
          return;
        }
        if (window.Care360Intro && window.Care360Intro.isOpen()) return;
        if (q(".c360-crash") || openDialog()) return;
        startTarget = event.target;
        if (isTypingTarget(startTarget)) return;
        if (startTarget.closest && startTarget.closest(".c360-intro, .c360-crash, .c360-to-top, .editor, .photo-card, .photo-grid, .module-subtabs, img, video, canvas, select")) return;
        tracking = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      },
      { passive: true }
    );

    document.addEventListener(
      "touchend",
      function (event) {
        if (!tracking) return;
        tracking = false;
        var touch = event.changedTouches[0];
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        if (Math.abs(dx) < MIN || Math.abs(dx) < Math.abs(dy) * 1.35) return;

        var scroller = horizontalScroller(startTarget);
        if (scroller) {
          var atStart = scroller.scrollLeft <= 2;
          var atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
          if ((dx < 0 && !atEnd) || (dx > 0 && !atStart)) return;
        }

        var index = activeModuleIndex();
        if (index < 0) return;
        goToModule(dx < 0 ? index + 1 : index - 1);
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------ *
   * visita: mediciones dentro del capítulo de evaluación
   * ------------------------------------------------------------------ */

  function nativeVisitTabs() {
    return qa('.steps [data-slot="tabs-trigger"]');
  }

  function visitPhase() {
    var editor = q(".editor");
    return (editor && editor.getAttribute("data-c360-visit")) || "";
  }

  function setVisitPhase(phase) {
    var editor = q(".editor");
    if (editor) editor.setAttribute("data-c360-visit", phase);
    document.documentElement.setAttribute("data-c360-visit", phase);
  }

  function goToVisitPhase(phase) {
    var tabs = nativeVisitTabs();
    if (!tabs.length) return false;
    var index = { datos: 0, chequeo: 1, fotos: 2, informe: 3 }[phase];
    if (index === undefined || !tabs[index]) return false;
    tabs[index].click();
    setVisitPhase(phase);
    return true;
  }

  function goVisitBack() {
    var editor = q(".editor");
    if (!isVisible(editor) || !q(".steps")) return false;
    var phase = visitPhase();
    if (phase === "informe") return goToVisitPhase("fotos");
    if (phase === "fotos") return goToVisitPhase("chequeo");
    if (phase === "chequeo") return goToVisitPhase("datos");
    if (phase === "datos") return clickButtonByLabel(/ver visitas guardadas/i);
    var tabs = nativeVisitTabs();
    for (var i = tabs.length - 1; i >= 0; i--) {
      if (tabs[i].hasAttribute("data-active")) {
        if (i > 0) {
          tabs[i - 1].click();
          return true;
        }
        return clickButtonByLabel(/ver visitas guardadas/i);
      }
    }
    return false;
  }

  function relabelNativeSteps() {
    var tabs = nativeVisitTabs();
    var labels = ["01 Datos", "02 Evaluación", "03 Fotos", "04 Informe"];
    for (var i = 0; i < tabs.length && i < labels.length; i++) {
      if ((tabs[i].textContent || "").trim() !== labels[i]) {
        tabs[i].textContent = labels[i];
      }
    }
    qa(".c360-step-extra").forEach(function (node) {
      node.remove();
    });
  }

  var MEASURE_PLACEMENTS = [
    {
      chapter: 4,
      afterCode: "4.6",
      id: "agua",
      badge: "4.6",
      title: "Calidad del agua",
      hint: "Dureza menor a 70 ppm · pH entre 5.5 y 6.5",
      test: /^(pH del agua|Dureza \(ppm\)|Conductividad)$/i,
      order: [/pH del agua/i, /Dureza/i, /^Conductividad$/i],
    },
    {
      chapter: 4,
      afterCode: "4.6",
      afterGroup: "agua",
      id: "mezcla",
      badge: "4.6",
      title: "Mezcla final",
      hint: "pH y conductividad de la mezcla final, para corregir si hace falta",
      test: /^(pH mezcla final|Conductividad mezcla final|Dureza mezcla final)/i,
      order: [/pH mezcla/i, /Conductividad mezcla|Dureza mezcla/i],
    },
    {
      chapter: 5,
      afterCode: "5.1",
      id: "presion",
      badge: "5.1",
      title: "Presión",
      hint: "Bomba e implemento al momento de aplicar",
      test: /^(Presión de la bomba|Presión \(PSI\)|Presión del implemento)/i,
      order: [/bomba|Presión \(PSI\)/i, /implemento/i],
    },
    {
      chapter: 5,
      afterCode: "5.3",
      id: "equipo",
      badge: "5.3",
      title: "Equipo de aplicación",
      hint: "",
      test: /^(Equipo de aplicación|Implementos de aplicación)/i,
    },
    {
      chapter: 5,
      afterCode: "5.6",
      id: "cama",
      badge: "5.6",
      title: "Volumen y tiempo por cama",
      hint: "Lo que se indica a la cuadrilla antes de aplicar",
      test: /^(Volumen por cama|Tiempo por cama)/i,
    },
  ];

  function findMeasureSource() {
    var heading = qa(".form-body h3").find(function (node) {
      return /mediciones de campo/i.test(node.textContent || "");
    });
    if (!heading) return null;
    heading.classList.add("c360-measure-heading");
    heading.setAttribute("data-c360-measure-source", "");
    var fields = heading.nextElementSibling;
    if (fields && fields.classList.contains("c360-measure-lead")) {
      fields = fields.nextElementSibling;
    }
    if (fields && /\bfields\b/.test(fields.className || "")) {
      fields.classList.add("c360-measure-fields");
      fields.setAttribute("data-c360-measure-source", "");
      return { heading: heading, fields: fields };
    }
    return null;
  }

  function measureLabelTitle(label) {
    return String((label.childNodes[0] && label.childNodes[0].textContent) || label.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findSourceMeasureLabel(fields, title) {
    return qa("label", fields).find(function (label) {
      return measureLabelTitle(label) === title;
    });
  }

  function syncProxyToSource(proxyInput, sourceInput) {
    if (!proxyInput || !sourceInput) return;
    if (String(sourceInput.value || "") === String(proxyInput.value || "")) return;
    setNativeValue(sourceInput, proxyInput.value);
  }

  function syncSourceToProxy(proxyInput, sourceInput) {
    if (!proxyInput || !sourceInput) return;
    if (document.activeElement === proxyInput) return;
    if (String(proxyInput.value || "") === String(sourceInput.value || "")) return;
    proxyInput.value = sourceInput.value || "";
  }

  function currentEvalChapter() {
    var heading = q(".form-body .chapter-heading");
    var text = (heading && heading.textContent) || "";
    if (/Preparación de mezclas/i.test(text)) return 4;
    if (/Aplicación de PPC/i.test(text)) return 5;
    if (/Almacén/i.test(text)) return 1;
    if (/Medición y dosificación/i.test(text)) return 2;
    if (/Transporte interno/i.test(text)) return 3;
    var select = q('.form-body [data-slot="select-value"], .form-body button[role="combobox"]');
    var selected = (select && select.textContent) || "";
    var match = /^(\d+)\./.exec(selected.trim());
    return match ? Number(match[1]) : 0;
  }

  function findQuestion(code) {
    return qa(".form-body .question").find(function (node) {
      var badge = q(".question-code", node);
      return badge && (badge.textContent || "").trim() === code;
    });
  }

  function typingInMeasureProxy() {
    var active = document.activeElement;
    return !!(active && active.closest && active.closest(".c360-chapter-measure"));
  }

  function placeMeasuresInChapters() {
    if (typingInMeasureProxy()) return;
    var source = findMeasureSource();
    if (!source) return;

    var chapter = currentEvalChapter();
    var existing = qa(".c360-chapter-measure");
    if (
      chapter &&
      existing.length &&
      existing.every(function (box) {
        return Number(box.getAttribute("data-chapter")) === chapter;
      })
    ) {
      existing.forEach(function (box) {
        qa(".c360-measure-proxy", box).forEach(function (proxy) {
          var title = proxy.getAttribute("data-measure-title") || "";
          var sourceLabel = findSourceMeasureLabel(source.fields, title);
          var sourceInput = sourceLabel && sourceLabel.querySelector("input");
          syncSourceToProxy(proxy, sourceInput);
        });
      });
      return;
    }

    existing.forEach(function (box) {
      box.remove();
    });
    if (!chapter) return;

    var labels = qa("label", source.fields);
    MEASURE_PLACEMENTS.forEach(function (spec) {
      if (spec.chapter !== chapter) return;
      var matched = labels.filter(function (label) {
        return spec.test.test(measureLabelTitle(label));
      });
      if (!matched.length) return;

      if (spec.order && spec.order.length) {
        matched.sort(function (a, b) {
          var aTitle = measureLabelTitle(a);
          var bTitle = measureLabelTitle(b);
          var aIdx = spec.order.findIndex(function (re) {
            return re.test(aTitle);
          });
          var bIdx = spec.order.findIndex(function (re) {
            return re.test(bTitle);
          });
          if (aIdx < 0) aIdx = 999;
          if (bIdx < 0) bIdx = 999;
          return aIdx - bIdx;
        });
      } else if (spec.id === "equipo") {
        matched.sort(function (a, b) {
          var aEquipo = /Equipo de aplicación/i.test(measureLabelTitle(a));
          var bEquipo = /Equipo de aplicación/i.test(measureLabelTitle(b));
          if (aEquipo === bEquipo) return 0;
          return aEquipo ? -1 : 1;
        });
      }

      var box = document.createElement("section");
      box.className = "c360-chapter-measure";
      box.setAttribute("data-group", spec.id);
      box.setAttribute("data-chapter", String(spec.chapter));
      box.innerHTML =
        '<header class="c360-measure-group-head">' +
        '<span class="c360-measure-badge">Crit. ' +
        spec.badge +
        "</span><div><h4>" +
        spec.title +
        "</h4>" +
        (spec.hint ? "<p>" + spec.hint + "</p>" : "") +
        "</div></header>";

      matched.forEach(function (sourceLabel) {
        var title = measureLabelTitle(sourceLabel);
        var sourceInput = sourceLabel.querySelector("input");
        var proxyLabel = document.createElement("label");
        proxyLabel.appendChild(document.createTextNode(title));
        var proxy = document.createElement("input");
        proxy.className = "c360-measure-proxy";
        proxy.type = (sourceInput && sourceInput.type) || "text";
        proxy.maxLength = (sourceInput && sourceInput.maxLength > 0 && sourceInput.maxLength) || 200;
        proxy.setAttribute("data-measure-title", title);
        proxy.value = (sourceInput && sourceInput.value) || "";
        function writeThrough() {
          var live = findMeasureSource();
          if (!live) return;
          var liveLabel = findSourceMeasureLabel(live.fields, title);
          var liveInput = liveLabel && liveLabel.querySelector("input");
          syncProxyToSource(proxy, liveInput);
        }
        proxy.addEventListener("input", writeThrough);
        proxy.addEventListener("change", writeThrough);
        proxyLabel.appendChild(proxy);
        box.appendChild(proxyLabel);
      });

      var anchor = null;
      if (spec.afterGroup) {
        anchor = q('.c360-chapter-measure[data-group="' + spec.afterGroup + '"]');
      }
      if (!anchor) anchor = findQuestion(spec.afterCode);
      if (anchor) anchor.insertAdjacentElement("afterend", box);
      else {
        var heading = q(".form-body .chapter-heading");
        if (heading) heading.insertAdjacentElement("afterend", box);
      }
    });
  }

  function findReportChapterSection(paper, chapterId) {
    return qa("section", paper).find(function (section) {
      var h2 = q("h2", section);
      if (!h2) return false;
      var match = /^Capítulo\s+(\d+)\./i.exec((h2.textContent || "").trim());
      return match && Number(match[1]) === Number(chapterId);
    });
  }

  function findReportCriterionAnchor(chapterSection, code) {
    if (!chapterSection || !code) return null;
    var heading = qa("h3", chapterSection).find(function (node) {
      return new RegExp("^" + code.replace(".", "\\.") + "\\s*·", "i").test((node.textContent || "").trim());
    });
    if (!heading) return null;
    var anchor = heading;
    var node = heading.nextElementSibling;
    while (node && node.tagName !== "H3" && !node.classList.contains("c360-report-chapter-measures")) {
      anchor = node;
      node = node.nextElementSibling;
    }
    return anchor;
  }

  function insertReportMeasureBlock(chapterSection, group, section) {
    if (!chapterSection) return false;
    var existing = q('.c360-report-chapter-measures[data-group="' + group.id + '"]', chapterSection);
    if (existing) existing.remove();
    var anchor = null;
    if (group.afterGroup) {
      anchor = q('.c360-report-chapter-measures[data-group="' + group.afterGroup + '"]', chapterSection);
    }
    if (!anchor) anchor = findReportCriterionAnchor(chapterSection, group.badge || group.afterCode);
    if (anchor) {
      anchor.insertAdjacentElement("afterend", section);
      return true;
    }
    chapterSection.appendChild(section);
    return true;
  }

  function buildMeasureTable(items) {
    var table = document.createElement("table");
    var body = document.createElement("tbody");
    items.forEach(function (row) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      var td = document.createElement("td");
      th.textContent = row.label;
      td.textContent = row.value;
      tr.appendChild(th);
      tr.appendChild(td);
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function organizeOneReportPaper(paper) {
    if (qa(".c360-report-chapter-measures, .c360-report-measures", paper).length) {
      return;
    }
    qa("h2", paper).forEach(function (heading) {
      if (!/Mediciones de campo|Mediciones por capítulo/i.test(heading.textContent || "")) return;
      var node = heading.nextElementSibling;
      if (!node || node.tagName !== "TABLE") return;
      var rows = qa("tr", node)
        .map(function (tr) {
          var th = q("th", tr);
          var td = q("td", tr);
          if (!th || !td) return null;
          return { label: (th.textContent || "").trim(), value: (td.textContent || "").trim() };
        })
        .filter(Boolean);
      if (!rows.length) return;
      var used = [];
      var movedAny = false;
      MEASURE_PLACEMENTS.forEach(function (group) {
        var items = rows.filter(function (row) {
          return group.test.test(row.label) && used.indexOf(row.label) === -1;
        });
        if (!items.length) return;
        if (group.order && group.order.length) {
          items.sort(function (a, b) {
            var aIdx = group.order.findIndex(function (re) {
              return re.test(a.label);
            });
            var bIdx = group.order.findIndex(function (re) {
              return re.test(b.label);
            });
            if (aIdx < 0) aIdx = 999;
            if (bIdx < 0) bIdx = 999;
            return aIdx - bIdx;
          });
        }
        items.forEach(function (row) {
          used.push(row.label);
        });
        var section = document.createElement("div");
        section.className = "c360-report-chapter-measures";
        section.setAttribute("data-group", group.id);
        var title = document.createElement("h3");
        var badge = document.createElement("span");
        badge.className = "c360-measure-badge";
        badge.textContent = group.badge;
        title.appendChild(badge);
        title.appendChild(document.createTextNode(" " + group.title));
        section.appendChild(title);
        section.appendChild(buildMeasureTable(items));
        var chapterSection = findReportChapterSection(paper, group.chapter);
        if (insertReportMeasureBlock(chapterSection, group, section)) {
          movedAny = true;
        }
      });
      var leftover = rows.filter(function (row) {
        return used.indexOf(row.label) === -1;
      });
      if (leftover.length) {
        var wrap = document.createElement("div");
        wrap.className = "c360-report-measures";
        var extraSection = document.createElement("section");
        var extraTitle = document.createElement("h3");
        extraTitle.textContent = "Otras mediciones";
        extraSection.appendChild(extraTitle);
        extraSection.appendChild(buildMeasureTable(leftover));
        wrap.appendChild(extraSection);
        node.insertAdjacentElement("afterend", wrap);
      }
      if (movedAny || leftover.length) {
        heading.setAttribute("data-c360-hidden-measures", "");
        node.setAttribute("data-c360-hidden-measures", "");
      }
    });
  }

  function organizeReportMeasurements() {
    qa(".report-paper").forEach(organizeOneReportPaper);
  }

  function syncPhaseFromNative() {
    var tabs = nativeVisitTabs();
    var names = ["datos", "chequeo", "fotos", "informe"];
    for (var i = 0; i < tabs.length; i++) {
      if (!tabs[i].hasAttribute("data-active")) continue;
      setVisitPhase(names[i] || "datos");
      return;
    }
  }

  function enhanceVisitSteps() {
    if (!q(".editor") || !q(".steps")) {
      document.documentElement.removeAttribute("data-c360-visit");
      return;
    }
    if (typingInMeasureProxy()) return;
    relabelNativeSteps();
    placeMeasuresInChapters();
    organizeReportMeasurements();
    syncPhaseFromNative();
  }

  function setupVisitSteps() {
    document.addEventListener(
      "click",
      function (event) {
        var tab = event.target.closest('.steps [data-slot="tabs-trigger"]');
        if (tab) {
          window.setTimeout(function () {
            syncPhaseFromNative();
            placeMeasuresInChapters();
          }, 60);
          return;
        }
        var option = event.target.closest('[role="option"], [data-slot="select-item"]');
        if (option) {
          window.setTimeout(placeMeasuresInChapters, 80);
        }
      },
      true
    );
  }

  function keyboardCoverPx() {
    var inner = window.innerHeight || 0;
    if (window.visualViewport) {
      var gap =
        inner - window.visualViewport.height - (window.visualViewport.offsetTop || 0);
      if (gap > 96) return Math.round(gap);
    }
    /* En el WebView de Android el teclado suele tapar sin encoger visualViewport. */
    var guess = Math.round(inner * 0.45);
    if (guess < 220) guess = Math.min(280, Math.round(inner * 0.5));
    if (guess > inner * 0.52) guess = Math.round(inner * 0.52);
    return guess;
  }

  function keyboardPaddingPx() {
    if (window.visualViewport) {
      var gap = window.innerHeight - window.visualViewport.height;
      if (gap > 96) return 0;
    }
    return keyboardCoverPx();
  }

  function setKeyboardOpen(open, target) {
    var root = document.documentElement;
    var height = open ? keyboardPaddingPx() : 0;
    var queryTyping = !!(open && target && target.closest && target.closest(".farm-query"));
    root.classList.toggle("c360-keyboard", !!open);
    root.classList.toggle("c360-query-typing", queryTyping);
    root.style.setProperty("--c360-keyboard-h", height + "px");
    syncChromeSizes();
  }

  function chromeBottom() {
    var bottom = 8;
    var topbar = q(".topbar");
    var nav = q(".module-nav");
    if (topbar) bottom = Math.max(bottom, topbar.getBoundingClientRect().bottom);
    if (nav) bottom = Math.max(bottom, nav.getBoundingClientRect().bottom);
    return Math.round(bottom);
  }

  function nearestScroller(el) {
    var node = el && el.parentElement;
    while (node && node !== document.documentElement) {
      if (node.scrollHeight > node.clientHeight + 4) {
        var overflow = window.getComputedStyle(node).overflowY;
        if (
          overflow === "auto" ||
          overflow === "scroll" ||
          overflow === "overlay" ||
          overflow === "hidden" ||
          node === document.body
        ) {
          return node;
        }
      }
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function revealTypingTarget(el) {
    if (!el || !isTypingTarget(el)) return;
    setKeyboardOpen(true, el);
    window.requestAnimationFrame(function () {
      if (document.activeElement !== el) return;
      var cover = keyboardCoverPx();
      var topLimit = chromeBottom() + 10;
      var bottomLimit = window.innerHeight - cover - 16;
      if (window.visualViewport && window.innerHeight - window.visualViewport.height > 96) {
        bottomLimit =
          (window.visualViewport.offsetTop || 0) + window.visualViewport.height - 16;
      }
      if (bottomLimit - topLimit < 72) bottomLimit = topLimit + 96;

      var rect = el.getBoundingClientRect();
      if (rect.top >= topLimit && rect.bottom <= bottomLimit) return;

      var desiredTop = topLimit + 8;
      var delta = rect.top - desiredTop;
      var scroller = nearestScroller(el);
      try {
        scroller.scrollTop += delta;
      } catch (err) {
        /* algunos nodos no aceptan scrollTop */
      }

      rect = el.getBoundingClientRect();
      if (rect.top >= topLimit && rect.bottom <= bottomLimit) return;

      if (document.scrollingElement && document.scrollingElement !== scroller) {
        document.scrollingElement.scrollTop += rect.top - desiredTop;
      }

      rect = el.getBoundingClientRect();
      if (rect.top >= topLimit && rect.bottom <= bottomLimit) return;
      try {
        el.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
      } catch (err2) {
        el.scrollIntoView();
      }
      rect = el.getBoundingClientRect();
      var extra = rect.top - desiredTop;
      if (Math.abs(extra) > 4) {
        var follow = nearestScroller(el);
        try {
          follow.scrollTop += extra;
        } catch (err3) {
          window.scrollBy(0, extra);
        }
      }
    });
  }

  function setupKeyboard() {
    var timers = [];

    function clearRevealTimers() {
      timers.forEach(function (id) {
        window.clearTimeout(id);
      });
      timers = [];
    }

    function scheduleReveal(el) {
      clearRevealTimers();
      [40, 160, 320, 520, 860].forEach(function (ms) {
        timers.push(
          window.setTimeout(function () {
            if (document.activeElement !== el) return;
            revealTypingTarget(el);
          }, ms)
        );
      });
    }

    document.addEventListener("focusin", function (event) {
      if (!isTypingTarget(event.target)) return;
      setKeyboardOpen(true, event.target);
      scheduleReveal(event.target);
    });

    document.addEventListener("focusout", function () {
      window.setTimeout(function () {
        if (isTypingTarget(document.activeElement)) return;
        clearRevealTimers();
        setKeyboardOpen(false, null);
      }, 160);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        var active = document.activeElement;
        if (!isTypingTarget(active)) {
          if (keyboardPaddingPx() === 0 && keyboardCoverPx() < 96) setKeyboardOpen(false, null);
          return;
        }
        setKeyboardOpen(true, active);
        revealTypingTarget(active);
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * fincas: diccionario de ubicación y responsable
   * solicitudes: representante / profesional a mano
   * ------------------------------------------------------------------ */

  function geoData() {
    return window.__C360_GEO || {};
  }

  function fillMunicipios(select, departamento, selected) {
    var list = geoData()[departamento] || [];
    select.innerHTML = '<option value="">Municipio</option>';
    list.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (selected && selected === name) option.selected = true;
      select.appendChild(option);
    });
  }

  function enhanceFarmRegister() {
    var details = qa("details").find(function (node) {
      var summary = q("summary", node);
      return summary && /Registrar una finca/i.test(summary.textContent || "");
    });
    if (!details || q(".c360-farm-geo", details)) return;

    var fields = q(".fields", details);
    if (!fields) return;

    var zoneLabel = qa("label", fields).find(function (label) {
      return /^Zona/i.test((label.childNodes[0] && label.childNodes[0].textContent) || label.textContent || "");
    });
    var zoneInput = zoneLabel && zoneLabel.querySelector("input");

    var geo = document.createElement("div");
    geo.className = "c360-farm-geo";
    geo.innerHTML =
      '<label class="c360-geo-field">Departamento' +
      '<select class="c360-geo-dept" aria-label="Departamento"><option value="">Departamento</option></select></label>' +
      '<label class="c360-geo-field">Municipio' +
      '<select class="c360-geo-muni" aria-label="Municipio" disabled><option value="">Municipio</option></select></label>' +
      '<label class="c360-geo-field">Nombre del responsable / representante' +
      '<input class="c360-farm-manager" maxlength="300" placeholder="Ej. Juan Pérez" /></label>';

    var dept = q(".c360-geo-dept", geo);
    var muni = q(".c360-geo-muni", geo);
    Object.keys(geoData())
      .sort(function (a, b) {
        return a.localeCompare(b, "es");
      })
      .forEach(function (name) {
        var option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        dept.appendChild(option);
      });

    dept.addEventListener("change", function () {
      var value = dept.value;
      muni.disabled = !value;
      fillMunicipios(muni, value, "");
      syncFarmZone(zoneInput, dept, muni);
    });
    muni.addEventListener("change", function () {
      syncFarmZone(zoneInput, dept, muni);
    });
    q(".c360-farm-manager", geo).addEventListener("input", function (event) {
      window.__C360_MANAGER_NAME = String(event.target.value || "").trim();
    });

    if (zoneLabel) zoneLabel.insertAdjacentElement("afterend", geo);
    else fields.appendChild(geo);
    if (zoneLabel) zoneLabel.setAttribute("data-c360-zone-host", "");
  }

  function syncFarmZone(zoneInput, dept, muni) {
    if (!zoneInput) return;
    var text = [muni.value, dept.value].filter(Boolean).join(", ");
    setNativeValue(zoneInput, text);
    window.__C360_MANAGER_NAME = (q(".c360-farm-manager") && q(".c360-farm-manager").value) || "";
  }

  function enhanceRequestPeople() {
    var editor = qa(".action-editor").find(function (node) {
      var heading = q("h3", node);
      return heading && /solicitud/i.test(heading.textContent || "");
    });
    if (!editor) return;

    [
      { label: /Representante técnico comercial/i, key: "rtc" },
      { label: /Profesional que realiza el servicio/i, key: "assignee" },
    ].forEach(function (spec) {
      var host = qa("label", editor).find(function (label) {
        return spec.label.test(label.textContent || "");
      });
      if (!host || q(".c360-person-input", host)) return;
      host.classList.add("c360-person-host");
      host.setAttribute("data-c360-person", spec.key);

      var current = "";
      var active = q('[data-slot="select-value"]', host) || q("[data-placeholder]", host);
      if (active) {
        current = (active.textContent || "").trim();
        if (/^Sin asignar$/i.test(current)) current = "";
      }

      var input = document.createElement("input");
      input.className = "c360-person-input";
      input.maxLength = 300;
      input.placeholder = "Escribe el nombre";
      input.value = current;
      input.setAttribute("aria-label", host.childNodes[0] ? host.childNodes[0].textContent : "Participante");
      host.appendChild(input);
    });
  }

  function personInputValue(key) {
    var input = q('.c360-person-host[data-c360-person="' + key + '"] .c360-person-input');
    return input ? String(input.value || "").trim() : "";
  }

  function setupTeamFetchHooks() {
    if (window.__C360_TEAM_HOOKS) return;
    window.__C360_TEAM_HOOKS = true;
    var original = window.fetch.bind(window);

    async function resolveMemberId(farmId, name) {
      if (!name) return "";
      var team = await original("/api/team").then(function (res) {
        return res.json();
      });
      var farm = (team.farms || []).find(function (item) {
        return item.id === farmId;
      });
      if (!farm) throw new Error("No se encontró la finca de la solicitud.");
      var match = (farm.members || []).find(function (member) {
        return String(member.name || "").trim().toLowerCase() === name.toLowerCase();
      });
      if (match) return match.user_id;
      var local = (farm.members || []).find(function (member) {
        return member.user_id === "local";
      });
      if (local && /responsable local/i.test(local.name || "")) {
        await original("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "renameLocal", farmId: farmId, name: name }),
        }).then(function (res) {
          if (!res.ok) return res.json().then(function (body) {
            throw new Error(body.error || "No se pudo guardar el responsable.");
          });
        });
        return "local";
      }
      var created = await original("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "addLocal", farmId: farmId, name: name }),
      }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "No se pudo registrar al participante.");
          return body;
        });
      });
      return created.id;
    }

    window.fetch = async function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (method === "POST" && /\/api\/team(?:\?|$)/.test(url) && init && typeof init.body === "string") {
        try {
          var teamBody = JSON.parse(init.body);
          if (teamBody && teamBody.op === "create") {
            var manager =
              (q(".c360-farm-manager") && q(".c360-farm-manager").value) ||
              window.__C360_MANAGER_NAME ||
              "";
            if (manager && !teamBody.managerName) teamBody.managerName = String(manager).trim();
            var dept = q(".c360-geo-dept");
            var muni = q(".c360-geo-muni");
            if (dept && muni && (dept.value || muni.value)) {
              teamBody.zone = [muni.value, dept.value].filter(Boolean).join(", ");
            }
            init = Object.assign({}, init, { body: JSON.stringify(teamBody) });
          }
        } catch (err) {
          /* seguir con el cuerpo original */
        }
      }
      if (method === "POST" && /\/api\/requests(?:\?|$)/.test(url) && init && typeof init.body === "string") {
        try {
          var body = JSON.parse(init.body);
          if (body && body.farmId) {
            var rtcName = personInputValue("rtc");
            var assigneeName = personInputValue("assignee");
            if (rtcName) body.rtc = await resolveMemberId(body.farmId, rtcName);
            else if (q('.c360-person-host[data-c360-person="rtc"]')) body.rtc = "";
            if (assigneeName) body.assignee = await resolveMemberId(body.farmId, assigneeName);
            else if (q('.c360-person-host[data-c360-person="assignee"]')) body.assignee = "";
            init = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        } catch (err) {
          /* seguir con el cuerpo original */
        }
      }
      var response = await original(input, init);
      try {
        var path = new URL(url, location.origin).pathname;
        if (method === "GET") {
          var visitMatch = /^\/api\/visits\/([a-f0-9-]{36})$/i.exec(path);
          if (visitMatch) rememberVisitId(visitMatch[1]);
          if (path === "/api/visits" || path === "/api/requests" || path.indexOf("/api/reports") === 0) {
            invalidateDeleteCache();
          }
        }
        if (method === "POST" && /\/api\/(visits|requests|reports|team)(?:\/|$)/.test(path)) {
          invalidateDeleteCache();
        }
        if (method === "DELETE" && /\/api\/(visits|requests|reports|farms)\//.test(path)) {
          invalidateDeleteCache();
          if (/\/api\/visits\//.test(path)) window.__C360_CURRENT_VISIT = "";
        }
      } catch (err) {
        /* no interrumpir la respuesta */
      }
      return response;
    };
  }

  function enhanceTeamForms() {
    enhanceFarmRegister();
    enhanceRequestPeople();
  }

  /* ------------------------------------------------------------------ *
   * borrar visitas, informes y solicitudes
   * ------------------------------------------------------------------ */

  var deleteCache = { visits: null, requests: null, reports: {}, farms: null, at: 0 };
  var UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function apiJson(url, init) {
    return fetch(url, init).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error((body && body.error) || "No se pudo completar la operación.");
        return body;
      });
    });
  }

  function invalidateDeleteCache() {
    deleteCache = { visits: null, requests: null, reports: {}, farms: null, at: 0 };
  }

  function loadVisits() {
    if (deleteCache.visits) return Promise.resolve(deleteCache.visits);
    return apiJson("/api/visits").then(function (list) {
      deleteCache.visits = Array.isArray(list) ? list : [];
      return deleteCache.visits;
    });
  }

  function loadRequests() {
    if (deleteCache.requests) return Promise.resolve(deleteCache.requests);
    return apiJson("/api/requests").then(function (list) {
      deleteCache.requests = Array.isArray(list) ? list : [];
      return deleteCache.requests;
    });
  }

  function loadReports(visitId) {
    if (!visitId) return Promise.resolve([]);
    if (deleteCache.reports[visitId]) return Promise.resolve(deleteCache.reports[visitId]);
    return apiJson("/api/reports?visitId=" + encodeURIComponent(visitId)).then(function (body) {
      var versions = (body && body.versions) || [];
      deleteCache.reports[visitId] = versions;
      return versions;
    });
  }

  function rememberVisitId(id) {
    if (id && UUID_RE.test(id)) window.__C360_CURRENT_VISIT = id;
  }

  function currentVisitId() {
    if (window.__C360_CURRENT_VISIT && UUID_RE.test(window.__C360_CURRENT_VISIT)) {
      return window.__C360_CURRENT_VISIT;
    }
    return "";
  }

  function rowKind(row) {
    if (!row) return "";
    var open = qa("button", row).find(function (button) {
      return /abrir solicitud|consultar solicitud/i.test(button.textContent || "");
    });
    if (open) return "request";
    open = qa("button", row).find(function (button) {
      return /^abrir$/i.test((button.textContent || "").trim());
    });
    if (open) return "visit";
    return "";
  }

  function matchVisit(row, visits) {
    var farm = normalizeText(q("strong", row) && q("strong", row).textContent);
    var small = normalizeText(q("small", row) && q("small", row).textContent);
    var hits = (visits || []).filter(function (visit) {
      if (normalizeText(visit.farm) !== farm) return false;
      var date = normalizeText(visit.date);
      var responsible = normalizeText(visit.responsible);
      if (date && small.indexOf(date) === -1) return false;
      if (responsible && small.indexOf(responsible) === -1) return false;
      return true;
    });
    return hits.length === 1 ? hits[0] : hits[0] || null;
  }

  function matchRequest(row, requests) {
    var title = normalizeText(q("strong", row) && q("strong", row).textContent);
    var reason = normalizeText(q("p", row) && q("p", row).textContent);
    var hits = (requests || []).filter(function (item) {
      var date = normalizeText(item.date);
      if (date && title.indexOf(date) === -1) return false;
      if (reason && normalizeText(item.reason) !== reason) return false;
      return true;
    });
    return hits.length === 1 ? hits[0] : hits[0] || null;
  }

  function confirmDelete(message) {
    return window.confirm(message);
  }

  function refreshAfterDelete() {
    invalidateDeleteCache();
    if (clickButtonByLabel(/^actualizar(?:\s+equipo)?$/i)) return;
    if (clickButtonByLabel(/^cerrar$/i, true)) {
      window.setTimeout(function () {
        if (!clickButtonByLabel(/^actualizar(?:\s+equipo)?$/i)) window.location.reload();
      }, 200);
      return;
    }
    window.setTimeout(function () {
      window.location.reload();
    }, 120);
  }

  function deleteByUrl(url, label) {
    return apiJson(url, { method: "DELETE" }).then(function () {
      var gender = /finca/i.test(label || "") ? "eliminada" : "eliminado";
      toast((label || "Registro") + " " + gender + ".", "ok");
      refreshAfterDelete();
    });
  }

  function attachDeleteButton(host, options) {
    if (!host || q(".c360-delete-btn", host)) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "c360-delete-btn";
    button.textContent = options.label || "Borrar";
    button.setAttribute("aria-label", options.aria || "Borrar");
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (!confirmDelete(options.confirm)) return;
      button.disabled = true;
      Promise.resolve()
        .then(options.resolve)
        .then(function (target) {
          if (!target || !target.url) throw new Error("No se encontró el registro a borrar.");
          return deleteByUrl(target.url, target.name || "Registro");
        })
        .catch(function (err) {
          button.disabled = false;
          toast((err && err.message) || "No se pudo borrar.", "info", 3600);
        });
    });
    host.appendChild(button);
  }

  function enhanceVisitRequestDelete() {
    qa(".visit-row").forEach(function (row) {
      var kind = rowKind(row);
      if (!kind) return;
      attachDeleteButton(row, {
        label: "Borrar",
        aria: kind === "visit" ? "Borrar visita" : "Borrar solicitud",
        confirm:
          kind === "visit"
            ? "¿Borrar esta visita y sus informes asociados? Esta acción no se puede deshacer."
            : "¿Borrar esta solicitud? Esta acción no se puede deshacer.",
        resolve: function () {
          if (kind === "visit") {
            return loadVisits().then(function (visits) {
              var hit = matchVisit(row, visits);
              if (!hit || !hit.id) throw new Error("No se identificó la visita.");
              return { url: "/api/visits/" + hit.id, name: "Visita" };
            });
          }
          return loadRequests().then(function (requests) {
            var hit = matchRequest(row, requests);
            if (!hit || !hit.id) throw new Error("No se identificó la solicitud.");
            return { url: "/api/requests/" + hit.id, name: "Solicitud" };
          });
        },
      });
    });
  }

  function enhanceReportDelete() {
    var list = q(".report-version-list");
    if (!list) return;
    var visitId = currentVisitId();
    qa("article", list).forEach(function (article) {
      attachDeleteButton(article, {
        label: "Borrar",
        aria: "Borrar versión de informe",
        confirm: "¿Borrar esta versión del informe? Esta acción no se puede deshacer.",
        resolve: function () {
          var strong = q("strong", article);
          var versionMatch = strong && /Versión\s+(\d+)/i.exec(strong.textContent || "");
          var versionNumber = versionMatch ? Number(versionMatch[1]) : NaN;
          function findVersion(versions) {
            var hit = (versions || []).find(function (item) {
              return Number(item.versionNumber) === versionNumber;
            });
            if (!hit && versions && versions.length === 1) hit = versions[0];
            if (!hit || !hit.id) throw new Error("No se identificó la versión del informe.");
            return { url: "/api/reports/" + hit.id, name: "Informe" };
          }
          if (visitId) return loadReports(visitId).then(findVersion);
          return loadVisits().then(async function (visits) {
            var candidates = (visits || []).slice(0, 20);
            for (var i = 0; i < candidates.length; i++) {
              var versions = await loadReports(candidates[i].id);
              var hit = (versions || []).find(function (item) {
                return Number(item.versionNumber) === versionNumber;
              });
              if (hit) {
                rememberVisitId(candidates[i].id);
                return findVersion(versions);
              }
            }
            throw new Error("No se identificó la versión del informe.");
          });
        },
      });
    });
  }

  function enhanceEditorDelete() {
    var requestEditor = qa(".action-editor").find(function (node) {
      var heading = q("h3", node);
      return heading && /Editar solicitud/i.test(heading.textContent || "");
    });
    if (requestEditor) {
      var actions = q(".actions", requestEditor) || requestEditor;
      attachDeleteButton(actions, {
        label: "Borrar solicitud",
        aria: "Borrar solicitud",
        confirm: "¿Borrar esta solicitud? Esta acción no se puede deshacer.",
        resolve: function () {
          return loadRequests().then(function (requests) {
            var reasonInput = q("textarea", requestEditor);
            var reason = normalizeText(reasonInput && reasonInput.value);
            var dateInput = qa("input[type='date']", requestEditor)[0];
            var date = normalizeText(dateInput && dateInput.value);
            var hit = (requests || []).find(function (item) {
              if (date && normalizeText(item.date) !== date) return false;
              if (reason && normalizeText(item.reason) !== reason) return false;
              return true;
            });
            if (!hit || !hit.id) throw new Error("Guarda la solicitud antes de borrarla, o ábrela desde la lista.");
            return { url: "/api/requests/" + hit.id, name: "Solicitud" };
          });
        },
      });
    }

    var visitEditor = q(".editor");
    if (visitEditor && currentVisitId()) {
      var saveBar = q(".mobile-save, .editor-heading .actions, .actions", visitEditor) || visitEditor;
      attachDeleteButton(saveBar, {
        label: "Borrar visita",
        aria: "Borrar visita",
        confirm: "¿Borrar esta visita y sus informes asociados? Esta acción no se puede deshacer.",
        resolve: function () {
          return { url: "/api/visits/" + currentVisitId(), name: "Visita" };
        },
      });
    }
  }

  function enhanceDeleteActions() {
    enhanceVisitRequestDelete();
    enhanceReportDelete();
    enhanceEditorDelete();
    enhanceFarmDelete();
  }

  /* ------------------------------------------------------------------ *
   * Seguimiento más completo (acciones + fotos importadas)
   * ------------------------------------------------------------------ */

  var ACTION_LABELS = {
    proposed: "Propuesta",
    pending: "Aceptada",
    progress: "En proceso",
    closed: "Completado",
    cancelled: "Cancelado",
  };

  function onFollowupTab() {
    var tabs = qa('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]');
    for (var i = 0; i < tabs.length; i++) {
      var el = tabs[i];
      if (!/Seguimiento/i.test(el.textContent || "")) continue;
      return (
        el.getAttribute("aria-selected") === "true" ||
        el.getAttribute("data-state") === "active" ||
        !!el.hasAttribute("data-active")
      );
    }
    return !!q(".followup-panel") && /Seguimiento|Plan de acci/i.test(document.body.innerText || "");
  }

  function enhanceFollowupSummary() {
    var existing = q("#c360-followup-summary");
    if (!onFollowupTab()) {
      if (existing) existing.remove();
      return;
    }
    var host =
      q(".followup-panel") ||
      q("main") ||
      q("#root");
    if (!host) return;
    if (!existing) {
      existing = document.createElement("section");
      existing.id = "c360-followup-summary";
      existing.className = "c360-followup-summary no-print";
      existing.setAttribute("aria-label", "Resumen de seguimiento");
      var heading = q("h1, h2, .page-heading", host);
      if (heading && heading.parentElement) {
        heading.parentElement.insertBefore(existing, heading.nextSibling);
      } else {
        host.insertAdjacentElement("afterbegin", existing);
      }
    }
    if (existing.getAttribute("data-loading") === "1") return;
    existing.setAttribute("data-loading", "1");
    apiJson("/api/visits")
      .then(function (data) {
        var visits = Array.isArray(data) ? data : data.visits || [];
        var open = [];
        var photos = 0;
        visits.forEach(function (v) {
          photos += Array.isArray(v.photos) ? v.photos.length : 0;
          var actions = v.actions || {};
          Object.keys(actions).forEach(function (id) {
            var a = actions[id] || {};
            if (a.status === "closed" || a.status === "cancelled") return;
            var ans = (v.answers && v.answers[id]) || {};
            open.push({
              id: id,
              farm: v.farm || "",
              date: v.date || "",
              status: a.status || "proposed",
              owner: a.owner || "",
              due: a.due || "",
              closure: a.closure || "",
              observation: ans.observation || "",
              recommendation: ans.recommendation || "",
              hasPhoto: !!(a.photoId || (v.photos || []).some(function (p) {
                return p && p.criterionId === id;
              })),
            });
          });
        });
        open.sort(function (a, b) {
          return String(a.due || "9999").localeCompare(String(b.due || "9999"));
        });
        if (!open.length && !photos) {
          existing.innerHTML =
            '<div class="c360-followup-summary-card">' +
            "<strong>Seguimiento</strong>" +
            "<p>Importa un informe Word CARE 360 para traer el plan de acción, fechas y evidencias fotográficas.</p>" +
            "</div>";
          return;
        }
        var rows = open
          .slice(0, 12)
          .map(function (item) {
            return (
              '<article class="c360-followup-item tone-' +
              (item.status || "proposed") +
              '">' +
              "<header><strong>" +
              escapeHtml(item.id) +
              " · " +
              escapeHtml(ACTION_LABELS[item.status] || item.status) +
              "</strong><span>" +
              escapeHtml(item.farm) +
              (item.due ? " · límite " + escapeHtml(item.due) : "") +
              (item.hasPhoto ? " · con foto" : "") +
              "</span></header>" +
              "<p>" +
              escapeHtml(item.observation || item.recommendation || "Sin detalle") +
              "</p>" +
              (item.owner || item.closure
                ? "<p class=\"muted\">" +
                  escapeHtml(
                    [item.owner ? "Resp. " + item.owner : "", item.closure ? "Cierre: " + item.closure : ""]
                      .filter(Boolean)
                      .join(" · ")
                  ) +
                  "</p>"
                : "") +
              "</article>"
            );
          })
          .join("");
        existing.innerHTML =
          '<div class="c360-followup-summary-card">' +
          "<strong>Seguimiento activo</strong>" +
          "<p>" +
          open.length +
          " hallazgo(s) abiertos · " +
          photos +
          " foto(s) en informes importados/revisados.</p>" +
          '<div class="c360-followup-list">' +
          rows +
          "</div>" +
          (open.length > 12 ? "<p class=\"muted\">Mostrando 12 de " + open.length + ".</p>" : "") +
          "</div>";
      })
      .catch(function () {
        existing.innerHTML = "";
      })
      .then(function () {
        existing.removeAttribute("data-loading");
      });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------------ *
   * borrar finca (Directorio de fincas)
   * ------------------------------------------------------------------ */

  function onFarmsModuleTab() {
    var tabs = qa('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]');
    for (var i = 0; i < tabs.length; i++) {
      var el = tabs[i];
      if (!/Fincas/i.test(el.textContent || "")) continue;
      return (
        el.getAttribute("aria-selected") === "true" ||
        el.getAttribute("data-state") === "active" ||
        !!el.hasAttribute("data-active")
      );
    }
    return /Directorio de fincas/i.test((q("h2") && q("h2").textContent) || "");
  }

  function findFarmWorkSelectHost() {
    var labels = qa("label");
    for (var i = 0; i < labels.length; i++) {
      if (/Finca de trabajo/i.test(labels[i].textContent || "")) return labels[i];
    }
    var headings = qa("h2, h3");
    for (var j = 0; j < headings.length; j++) {
      if (/Directorio de fincas/i.test(headings[j].textContent || "")) {
        return headings[j].closest("section, article, .panel, .followup-panel, main") || headings[j].parentElement;
      }
    }
    return null;
  }

  function readSelectedFarmLabel() {
    var host = findFarmWorkSelectHost();
    if (!host) return "";
    var valueNode =
      q('[data-slot="select-value"]', host) ||
      q("[data-placeholder]", host) ||
      q('button[role="combobox"]', host) ||
      q("select", host);
    if (!valueNode) {
      var parent = host.parentElement || host;
      valueNode =
        q('[data-slot="select-value"]', parent) ||
        q('button[role="combobox"]', parent) ||
        q("select", parent);
    }
    if (!valueNode) return "";
    if (valueNode.tagName === "SELECT") {
      var opt = valueNode.options[valueNode.selectedIndex];
      return ((opt && opt.textContent) || "").trim();
    }
    return String(valueNode.textContent || "").replace(/\s+/g, " ").trim();
  }

  function loadTeamFarms() {
    if (deleteCache.farms && Date.now() - deleteCache.at < 8000) {
      return Promise.resolve(deleteCache.farms);
    }
    return apiJson("/api/team").then(function (team) {
      var farms = (team && team.farms) || [];
      deleteCache.farms = Array.isArray(farms) ? farms : [];
      deleteCache.at = Date.now();
      return deleteCache.farms;
    });
  }

  function resolveSelectedFarm() {
    return loadTeamFarms().then(function (farms) {
      if (!farms || !farms.length) return null;
      var label = readSelectedFarmLabel();
      if (label && !/Selecciona una finca|^none$/i.test(label)) {
        var hit = farms.find(function (farm) {
          return normalizeText(farm.name) === normalizeText(label);
        });
        if (hit) return hit;
        hit = farms.find(function (farm) {
          return normalizeText(label).indexOf(normalizeText(farm.name)) !== -1;
        });
        if (hit) return hit;
      }
      var detailOpen = qa("h3").some(function (h) {
        return /Contactos e informes|Participantes/i.test(h.textContent || "");
      });
      if (!detailOpen) return null;
      if (farms.length === 1) return farms[0];
      var panelText = normalizeText((q(".followup-panel") || document.body).innerText || "");
      var matches = farms.filter(function (farm) {
        return panelText.indexOf(normalizeText(farm.name)) !== -1;
      });
      return matches.length === 1 ? matches[0] : null;
    });
  }

  function mountFarmActionsBar(farm) {
    var existing = q("#c360-farm-actions");
    if (!onFarmsModuleTab()) {
      if (existing) existing.remove();
      return;
    }

    var host = findFarmWorkSelectHost();
    var mountParent =
      (host && (host.closest(".section-gap") || host.parentElement)) ||
      (q(".page-heading") && q(".page-heading").parentElement) ||
      q(".followup-panel") ||
      q("main");
    if (!mountParent) return;

    if (!farm) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      existing = document.createElement("div");
      existing.id = "c360-farm-actions";
      existing.className = "c360-farm-actions no-print";
      existing.setAttribute("data-c360-farm-actions", "1");
      if (host && host.parentElement) {
        host.parentElement.insertAdjacentElement("afterend", existing);
      } else {
        var importPanel = q("#c360-farms-import");
        if (importPanel) importPanel.insertAdjacentElement("afterend", existing);
        else mountParent.insertAdjacentElement("afterbegin", existing);
      }
    }

    if (existing.getAttribute("data-farm-id") === farm.id) return;
    existing.setAttribute("data-farm-id", farm.id);
    existing.innerHTML =
      '<div class="c360-farm-actions-copy">' +
      "<strong>Acciones de la finca</strong>" +
      "<p>Finca seleccionada: <span class=\"c360-farm-actions-name\"></span>. " +
      "Al borrar también se eliminan visitas, informes y solicitudes vinculadas.</p>" +
      "</div>" +
      '<button type="button" class="c360-delete-btn c360-farm-delete-btn" aria-label="Borrar finca">Borrar finca</button>';
    q(".c360-farm-actions-name", existing).textContent = farm.name || "Finca";

    q(".c360-farm-delete-btn", existing).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var button = event.currentTarget;
      if (button.disabled) return;
      var name = farm.name || "esta finca";
      var message =
        '¿Borrar la finca «' +
        name +
        '»?\n\nSe eliminarán también sus visitas, informes y solicitudes vinculadas. Esta acción no se puede deshacer.';
      if (!confirmDelete(message)) return;
      button.disabled = true;
      apiJson("/api/farms/" + farm.id, { method: "DELETE" })
        .then(function () {
          return purgeOrphanVisitsForFarm(farm);
        })
        .then(function () {
          invalidateDeleteCache();
          try {
            window.dispatchEvent(
              new CustomEvent("care360:data-changed", {
                detail: { type: "farm-deleted", farmId: farm.id, farm: farm.name },
              })
            );
          } catch (err) {
            /* sin CustomEvent */
          }
          toast("Finca eliminada.", "ok");
          refreshAfterDelete();
        })
        .catch(function (err) {
          button.disabled = false;
          toast((err && err.message) || "No se pudo borrar la finca.", "info", 3600);
        });
    });
  }

  function purgeOrphanVisitsForFarm(farm) {
    var farmId = farm && farm.id;
    var farmName = normalizeText(farm && farm.name);
    if (!farmId && !farmName) return Promise.resolve();
    return apiJson("/api/visits")
      .then(function (list) {
        var arr = Array.isArray(list) ? list : list && list.visits ? list.visits : [];
        var jobs = arr
          .filter(function (v) {
            if (!v || !v.id) return false;
            if (farmId && (v.farmId === farmId || v.farm_id === farmId)) return true;
            return farmName && normalizeText(v.farm) === farmName;
          })
          .map(function (v) {
            return fetch("/api/visits/" + encodeURIComponent(v.id), { method: "DELETE" }).catch(
              function () {
                return null;
              }
            );
          });
        return Promise.all(jobs);
      })
      .catch(function () {
        return null;
      });
  }

  function enhanceFarmDelete() {
    if (!onFarmsModuleTab()) {
      var stale = q("#c360-farm-actions");
      if (stale) stale.remove();
      return;
    }
    resolveSelectedFarm()
      .then(function (farm) {
        mountFarmActionsBar(farm);
      })
      .catch(function () {
        mountFarmActionsBar(null);
      });
  }

  /* ------------------------------------------------------------------ *
   * arranque
   * ------------------------------------------------------------------ */

  function boot() {
    setupCrashGuard();
    setupConnection();
    setupBackButton();
    setupUnsavedGuard();
    setupScrollHelpers();
    setupKeyboard();
    setupModuleSwipe();
    setupVisitSteps();
    setupTeamFetchHooks();

    var pendingSync = false;
    var observer = new MutationObserver(function () {
      if (pendingSync) return;
      pendingSync = true;
      window.requestAnimationFrame(function () {
        pendingSync = false;
        syncChromeSizes();
        enhanceVisitSteps();
        organizeReportMeasurements();
        enhanceTeamForms();
        enhanceDeleteActions();
        enhanceFollowupSummary();
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active"],
    });

    window.addEventListener("resize", syncChromeSizes, { passive: true });
    window.addEventListener("orientationchange", function () {
      window.setTimeout(syncChromeSizes, 260);
    });

    var started = Date.now();
    (function poll() {
      keepActiveTabVisible();
      watchChromeSizes();
      enhanceVisitSteps();
      organizeReportMeasurements();
      enhanceTeamForms();
      enhanceDeleteActions();
      enhanceFollowupSummary();
      if (Date.now() - started < 8000 || q(".editor") || q("details") || q(".action-editor") || q(".visit-row") || q(".followup-panel")) {
        window.setTimeout(poll, 500);
      }
    })();
  }

  window.Care360Experience = { toast: toast };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
