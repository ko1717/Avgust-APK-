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
   * visita: mediciones en su propio paso
   * ------------------------------------------------------------------ */

  var openingMeasures = false;

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
    var extra = q(".c360-step-extra");
    if (extra) {
      if (phase === "mediciones") extra.setAttribute("data-active", "");
      else extra.removeAttribute("data-active");
    }
  }

  function goToVisitPhase(phase) {
    var tabs = nativeVisitTabs();
    if (!tabs.length) return false;
    if (phase === "mediciones") {
      openingMeasures = true;
      if (tabs[1] && !tabs[1].hasAttribute("data-active")) tabs[1].click();
      setVisitPhase("mediciones");
      window.setTimeout(function () {
        setVisitPhase("mediciones");
        openingMeasures = false;
      }, 80);
      return true;
    }
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
    if (phase === "chequeo") return goToVisitPhase("mediciones");
    if (phase === "mediciones") return goToVisitPhase("datos");
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
    var labels = ["01 Datos", "03 Evaluación", "04 Fotos", "05 Informe"];
    for (var i = 0; i < tabs.length && i < labels.length; i++) {
      if ((tabs[i].textContent || "").trim() !== labels[i]) {
        tabs[i].textContent = labels[i];
      }
    }
  }

  function ensureMeasureTab() {
    var list = q(".steps");
    if (!list) return;
    if (q(".c360-step-extra", list)) return;
    var tabs = qa('[data-slot="tabs-trigger"]', list);
    if (tabs.length < 2) return;
    var extra = document.createElement("button");
    extra.type = "button";
    extra.className = "c360-step-extra";
    extra.setAttribute("data-c360-step", "mediciones");
    extra.textContent = "02 Mediciones";
    extra.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      goToVisitPhase("mediciones");
    });
    list.insertBefore(extra, tabs[1]);
  }

  function markMeasureBlocks() {
    qa(".form-body h3").forEach(function (heading) {
      if (!/mediciones de campo/i.test(heading.textContent || "")) return;
      heading.classList.add("c360-measure-heading");
      var fields = heading.nextElementSibling;
      if (fields && /\bfields\b/.test(fields.className || "")) {
        fields.classList.add("c360-measure-fields");
      }
    });
  }

  function ensureMeasureContinue() {
    var fields = q(".c360-measure-fields");
    if (!fields || q(".c360-to-eval")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "primary c360-to-eval";
    button.textContent = "Ir a evaluación";
    button.addEventListener("click", function () {
      goToVisitPhase("chequeo");
    });
    fields.insertAdjacentElement("afterend", button);
  }

  function syncPhaseFromNative() {
    if (openingMeasures) return;
    var tabs = nativeVisitTabs();
    var names = ["datos", "chequeo", "fotos", "informe"];
    for (var i = 0; i < tabs.length; i++) {
      if (!tabs[i].hasAttribute("data-active")) continue;
      if (names[i] === "chequeo" && visitPhase() === "mediciones") return;
      setVisitPhase(names[i] || "datos");
      return;
    }
  }

  function enhanceVisitSteps() {
    if (!q(".editor") || !q(".steps")) {
      document.documentElement.removeAttribute("data-c360-visit");
      return;
    }
    relabelNativeSteps();
    ensureMeasureTab();
    markMeasureBlocks();
    ensureMeasureContinue();
    if (!openingMeasures) syncPhaseFromNative();
  }

  function setupVisitSteps() {
    document.addEventListener(
      "click",
      function (event) {
        var tab = event.target.closest('.steps [data-slot="tabs-trigger"]');
        if (!tab) return;
        window.setTimeout(function () {
          if (!openingMeasures) syncPhaseFromNative();
        }, 50);
      },
      true
    );
  }

  function setupKeyboard() {
    var root = document.documentElement;

    function setOpen(open) {
      root.classList.toggle("c360-keyboard", !!open);
      syncChromeSizes();
    }

    document.addEventListener("focusin", function (event) {
      if (!isTypingTarget(event.target)) return;
      setOpen(true);
      window.setTimeout(function () {
        if (document.activeElement !== event.target) return;
        var rect = event.target.getBoundingClientRect();
        var limit = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - 90;
        if (rect.bottom > limit || rect.top < 70) {
          event.target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 320);
    });

    document.addEventListener("focusout", function () {
      window.setTimeout(function () {
        if (!isTypingTarget(document.activeElement)) setOpen(false);
      }, 120);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        var shrunk = window.visualViewport.height < window.innerHeight * 0.78;
        if (!shrunk) setOpen(false);
        else if (isTypingTarget(document.activeElement)) setOpen(true);
      });
    }
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

    var pendingSync = false;
    var observer = new MutationObserver(function () {
      if (pendingSync) return;
      pendingSync = true;
      window.requestAnimationFrame(function () {
        pendingSync = false;
        syncChromeSizes();
        enhanceVisitSteps();
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
      if (Date.now() - started < 8000 || q(".editor")) window.setTimeout(poll, 500);
    })();
  }

  window.Care360Experience = { toast: toast };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
