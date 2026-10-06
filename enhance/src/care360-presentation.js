/*
 * AVGUST CARE 360 — presentacion de bienvenida y guia del programa.
 *
 * Se muestra la primera vez que se abre la aplicacion si no hay una visita
 * en curso. Si la visita ya está abierta, el primer pantallazo va al
 * siguiente pendiente del panel de calidad y la guía queda en el botón Guía.
 */
(function () {
  "use strict";

  var VERSION = "__C360_VERSION__";
  var SEEN_KEY = "care360:presentacion:vista";
  var SEEN_VALUE = "1";

  function debranded() {
    return window.__C360_DEBRAND === true;
  }

  function appName() {
    return debranded() ? "CARE 360" : "AVGUST CARE 360";
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (err) {
      return null;
    }
    return value;
  }

  var ICONS = {
    play:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 14 9-14 9z"/></svg>',
    clipboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/></svg>',
    camera:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    file:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 14h6M9 18h4"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
    chart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    home:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/></svg>',
    shield:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    wifi:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/></svg>',
  };

  function item(badge, title, text) {
    return (
      '<li><span class="c360-badge">' +
      badge +
      "</span><div><b>" +
      title +
      "</b><span>" +
      text +
      "</span></div></li>"
    );
  }

  var SLIDES = [
    {
      eyebrow: debranded() ? "Acompañamiento en campo" : "Avgust Crop Protection",
      title: "Bienvenido a " + appName(),
      lead:
        "La herramienta de acompañamiento en campo para el programa de aseguramiento del proceso MIPE en fincas de flores.",
      html:
        '<ul class="c360-list">' +
        item(
          ICONS.play,
          "Esta presentación dura menos de un minuto",
          "Te explica para qué sirve el programa, cómo se usa y quién lo desarrolló."
        ) +
        item(
          ICONS.wifi,
          "Funciona sin conexión",
          "Puedes trabajar en la finca aunque no haya señal. La información queda guardada en el equipo."
        ) +
        "</ul>",
    },
    {
      eyebrow: "Para qué está hecha",
      title: "De la visita al informe, sin papeles",
      lead:
        "CARE 360 acompaña todo el ciclo del servicio técnico: lo que se observa en la finca, lo que se recomienda y lo que se cumple.",
      html:
        '<ul class="c360-list">' +
        item(
          ICONS.clipboard,
          "Evalúa el proceso MIPE por capítulos",
          "Almacén, dosificación, transporte interno, preparación de mezclas, aplicación en campo y demás criterios."
        ) +
        item(
          ICONS.camera,
          "Documenta cada hallazgo",
          "Registra observaciones, mediciones de campo y fotografías de antes y de cierre."
        ) +
        item(
          ICONS.file,
          "Emite el informe técnico",
          debranded()
            ? "Genera el documento en Word o PDF y lo prepara para enviarlo por correo."
            : "Genera el documento en Word o PDF con la imagen de AVGUST y lo prepara para enviarlo por correo."
        ) +
        item(
          ICONS.check,
          "Cierra los compromisos",
          "Cada acuerdo queda con responsable, fecha límite y evidencia hasta darlo por cumplido."
        ) +
        "</ul>",
    },
    {
      eyebrow: "Cómo funciona",
      title: "Una visita en cinco pasos",
      lead:
        'Al tocar "Nueva visita" el programa te guía por cinco pestañas. Puedes guardar el avance en cualquier momento y continuar después.',
      html:
        '<ul class="c360-list">' +
        item(
          "01",
          "Datos",
          debranded()
            ? "Finca, fecha, representante, responsable técnico y los capítulos que vas a evaluar."
            : "Finca, fecha, representante, responsable AVGUST y los capítulos que vas a evaluar."
        ) +
        item(
          "02",
          "Mediciones",
          "Agua (cap. 4.6), presión (cap. 5.1), equipo e implementos de aplicación, y volumen y tiempo por cama (cap. 5.6)."
        ) +
        item(
          "03",
          "Evaluación",
          'Responde Sí cumple, No cumple o No aplica en cada criterio. Cada "No cumple" pide su hallazgo y su recomendación.'
        ) +
        item(
          "04",
          "Fotos",
          "Adjunta hasta 60 fotografías. Sirven como evidencia del hallazgo y del cierre."
        ) +
        item(
          "05",
          "Informe",
          "Revisa el documento, márcalo como revisado y descárgalo en Word o PDF. El panel de calidad te avisa si aún falta un criterio, un hallazgo o una foto."
        ) +
        "</ul>",
    },
    {
      eyebrow: "Los módulos",
      title: "Todo el trabajo, organizado",
      lead:
        "La barra de la parte superior reúne las siete funciones del programa. Puedes entrar a cualquiera desde la pantalla de Inicio.",
      html:
        '<ul class="c360-list">' +
        item(ICONS.home, "Inicio", "Briefing del día: borradores, compromisos vencidos, agenda y el estado del respaldo.") +
        item(ICONS.users, "Fincas y equipo", "Fincas, contactos que reciben los informes y permisos del equipo.") +
        item(ICONS.search, "Consulta de finca", "El expediente completo de una finca: visitas, indicadores, hallazgos y compromisos.") +
        item(ICONS.calendar, "Solicitudes", "Programación de servicios, fechas propuestas y responsables.") +
        item(ICONS.file, "Visitas e informes", "Registra la visita, sigue el avance con el panel de calidad y filtra borradores o revisadas.") +
        item(ICONS.chart, "Métricas", "Tablero claro por finca o consolidado: indicador anual, capítulos y subcapítulos.") +
        item(ICONS.check, "Seguimiento", "Compromisos pendientes, vencidos y cerrados, con su historial por finca.") +
        "</ul>",
    },
    {
      eyebrow: "Del hallazgo al resultado",
      title: "El informe tiene un ciclo de vida",
      lead:
        "Así se garantiza que lo que se entrega a la finca sea una versión revisada y no se modifique después.",
      html:
        '<ul class="c360-list">' +
        item("1", "Borrador", "Trabajas la visita y guardas el avance las veces que necesites.") +
        item("2", "En revisión", "Al enviarlo se congela una captura de la información de ese momento.") +
        item("3", "Aprobado", "El responsable técnico da el visto bueno sin cambiar la captura.") +
        item("4", "Publicado", "La versión queda inmutable y es la que recibe la finca.") +
        "</ul><p style=\"margin-top:14px\">Si hay que corregir algo, el informe se devuelve a borrador y se crea una nueva versión: el historial anterior nunca se pierde.</p>",
    },
    {
      eyebrow: "Tus datos",
      title: "La información vive en tu equipo",
      lead:
        "CARE 360 no necesita internet ni cuentas de usuario para funcionar. Por eso el respaldo es importante.",
      html:
        '<ul class="c360-list">' +
        item(
          ICONS.shield,
          "Crea un respaldo completo",
          'Desde Inicio, con "Crear respaldo completo". Incluye visitas, fincas, compromisos y fotografías.'
        ) +
        item(
          ICONS.wifi,
          "Restaura en otro equipo",
          'Con "Restaurar respaldo" recuperas todo el trabajo tal como estaba.'
        ) +
        item(
          ICONS.check,
          "Guarda el avance seguido",
          "Si cambias de pantalla sin guardar, el programa te avisa antes de perder algo."
        ) +
        "</ul>",
    },
    {
      eyebrow: "Créditos",
      title: "Quién desarrolló este programa",
      lead: "",
      html:
        '<div class="c360-credits">' +
        '<div class="c360-credit"><small>Desarrollado por</small><strong>Kevin Villamizar</strong>' +
        "<p>Diseño, desarrollo y puesta en marcha de " +
        appName() +
        ".</p></div>" +
        '<div class="c360-credit"><small>Con la ayuda de</small><strong>Wilson Castro</strong>' +
        "<p>Este programa fue creado con la ayuda de Wilson Castro.</p></div>" +
        "</div>" +
        '<p class="c360-version">' +
        appName() +
        " · versión " +
        (VERSION.indexOf("__C360") === 0 ? "1.5.32" : VERSION) +
        "<br>Si quieres volver a esta guía, usa el botón “Guía” de la barra superior.</p>",
    },
  ];

  var overlay = null;
  var index = 0;
  var lastFocused = null;

  function build() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "c360-intro";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Presentación de " + appName());
    overlay.innerHTML =
      '<div class="c360-intro-card">' +
      '<div class="c360-intro-head">' +
      (debranded()
        ? '<strong class="c360-intro-mark">CARE 360</strong>'
        : '<img src="/avgust-logo.svg" alt="Avgust Crop Protection">') +
      '<button type="button" class="c360-intro-skip" data-act="skip">Omitir</button>' +
      "</div>" +
      '<div class="c360-intro-progress"><i></i></div>' +
      '<div class="c360-intro-body" tabindex="-1"></div>' +
      '<label class="c360-intro-again"><input type="checkbox" data-act="again"> No volver a mostrar al abrir la aplicación</label>' +
      '<div class="c360-intro-foot">' +
      '<div class="c360-dots" role="tablist" aria-label="Diapositivas"></div>' +
      '<button type="button" class="c360-nav-btn" data-kind="back" data-act="back">Atrás</button>' +
      '<button type="button" class="c360-nav-btn" data-kind="next" data-act="next">Siguiente</button>' +
      "</div>" +
      "</div>";

    var dots = overlay.querySelector(".c360-dots");
    SLIDES.forEach(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Ir a la sección " + (i + 1) + ": " + slide.title);
      dot.addEventListener("click", function () {
        go(i);
      });
      dots.appendChild(dot);
    });

    overlay.addEventListener("click", function (event) {
      var act = event.target.closest("[data-act]");
      if (!act) return;
      var kind = act.getAttribute("data-act");
      if (kind === "skip") close(true);
      else if (kind === "back") go(index - 1);
      else if (kind === "next") {
        if (index >= SLIDES.length - 1) close(true);
        else go(index + 1);
      }
    });

    overlay.querySelector('[data-act="again"]').addEventListener("change", function (event) {
      store(SEEN_KEY, event.target.checked ? SEEN_VALUE : "0");
    });

    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      } else if (event.key === "ArrowRight") {
        go(index + 1);
      } else if (event.key === "ArrowLeft") {
        go(index - 1);
      } else if (event.key === "Tab") {
        trapFocus(event);
      }
    });

    addSwipe(overlay.querySelector(".c360-intro-body"));
    document.body.appendChild(overlay);
    return overlay;
  }

  function trapFocus(event) {
    var focusable = overlay.querySelectorAll(
      'button:not([hidden]):not(:disabled), input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function addSwipe(node) {
    var startX = 0;
    var startY = 0;
    var tracking = false;
    node.addEventListener(
      "touchstart",
      function (event) {
        if (event.touches.length !== 1) return;
        tracking = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      },
      { passive: true }
    );
    node.addEventListener(
      "touchend",
      function (event) {
        if (!tracking) return;
        tracking = false;
        var touch = event.changedTouches[0];
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
        go(dx < 0 ? index + 1 : index - 1);
      },
      { passive: true }
    );
  }

  function go(next) {
    if (!overlay) return;
    if (next < 0) next = 0;
    if (next > SLIDES.length - 1) next = SLIDES.length - 1;
    var direction = next >= index ? "18px" : "-18px";
    index = next;

    var slide = SLIDES[index];
    var body = overlay.querySelector(".c360-intro-body");
    body.style.setProperty("--c360-slide-from", direction);
    body.innerHTML =
      '<section class="c360-slide">' +
      (slide.eyebrow ? '<span class="c360-slide-eyebrow">' + slide.eyebrow + "</span>" : "") +
      "<h2>" +
      slide.title +
      "</h2>" +
      (slide.lead ? "<p>" + slide.lead + "</p>" : "") +
      slide.html +
      "</section>";
    body.scrollTop = 0;

    overlay.querySelector(".c360-intro-progress > i").style.width =
      ((index + 1) / SLIDES.length) * 100 + "%";

    var dots = overlay.querySelectorAll(".c360-dots button");
    for (var i = 0; i < dots.length; i++) {
      dots[i].setAttribute("aria-current", i === index ? "true" : "false");
    }

    var back = overlay.querySelector('[data-act="back"]');
    back.hidden = index === 0;

    var isLast = index === SLIDES.length - 1;
    overlay.querySelector('[data-act="next"]').textContent = isLast ? "Comenzar" : "Siguiente";
    overlay.querySelector('[data-act="skip"]').textContent = isLast ? "Cerrar" : "Omitir";
  }

  function open(startAt) {
    build();
    var again = overlay.querySelector('[data-act="again"]');
    again.checked = store(SEEN_KEY) === SEEN_VALUE;
    lastFocused = document.activeElement;
    document.documentElement.style.overflow = "hidden";
    overlay.hidden = false;
    overlay.style.display = "";
    overlay.setAttribute("data-open", "1");
    go(typeof startAt === "number" ? startAt : 0);
    requestAnimationFrame(function () {
      overlay.querySelector('[data-act="next"]').focus();
    });
    window.dispatchEvent(new CustomEvent("care360:intro-open"));
  }

  function close(markSeen) {
    if (!overlay || overlay.getAttribute("data-open") !== "1") return;
    if (markSeen) store(SEEN_KEY, SEEN_VALUE);
    overlay.removeAttribute("data-open");
    document.documentElement.style.overflow = "";
    window.setTimeout(function () {
      if (overlay && overlay.getAttribute("data-open") !== "1") overlay.style.display = "none";
    }, 300);
    if (lastFocused && lastFocused.focus) {
      try {
        lastFocused.focus();
      } catch (err) {
        /* el elemento pudo desaparecer con el re-render */
      }
    }
    window.dispatchEvent(new CustomEvent("care360:intro-close"));
  }

  function isOpen() {
    return !!overlay && overlay.getAttribute("data-open") === "1";
  }

  /* ---------- boton "Guia" en la barra superior ---------- */

  function mountHelpButton() {
    var host = document.querySelector(".topbar .platform-state");
    if (!host || host.querySelector(".c360-help-btn")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "c360-help-btn";
    button.title = "Ver la presentación y la guía del programa";
    button.setAttribute("aria-label", "Ver la presentación y la guía del programa");
    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg><span>Guía</span>';
    button.addEventListener("click", function () {
      open(0);
    });
    host.insertBefore(button, host.firstChild);
  }

  function watchTopbar() {
    mountHelpButton();
    var observer = new MutationObserver(function () {
      mountHelpButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- arranque ---------- */

  function whenAppReady(callback) {
    var started = Date.now();
    (function poll() {
      if (document.querySelector(".topbar") || Date.now() - started > 6000) {
        callback();
        return;
      }
      window.setTimeout(poll, 120);
    })();
  }

  function visitIsOpen() {
    var editor = document.querySelector(".editor");
    var steps = document.querySelector(".steps");
    if (!editor || !steps) return false;
    if (editor.hasAttribute("hidden") || editor.getAttribute("aria-hidden") === "true") return false;
    var rect = editor.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function goToPending() {
    var tries = 0;
    (function tick() {
      var next = document.querySelector("#c360-visit-hud .c360-hud-next");
      if (next) {
        next.click();
        return;
      }
      if (tries++ < 30) {
        window.setTimeout(tick, 120);
        return;
      }
      var ops = window.Care360Ops;
      if (ops && typeof ops.focusNextGap === "function") ops.focusNextGap();
    })();
  }

  function decideFirstRun() {
    var started = Date.now();
    (function poll() {
      if (visitIsOpen()) {
        goToPending();
        return;
      }
      if (Date.now() - started < 800) {
        window.setTimeout(poll, 120);
        return;
      }
      open(0);
    })();
  }

  function boot() {
    whenAppReady(function () {
      watchTopbar();
      if (store(SEEN_KEY) !== SEEN_VALUE) {
        window.setTimeout(decideFirstRun, 260);
      }
    });
  }

  window.Care360Intro = {
    open: open,
    close: close,
    isOpen: isOpen,
    slides: SLIDES.length,
    version: VERSION,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
