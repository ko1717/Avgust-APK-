/*
 * Capa sin marca Avgust: sustituye el nombre visible en el DOM.
 * No reescribe lo que escribe el usuario en un campo.
 */
(function () {
  "use strict";

  window.__C360_DEBRAND = true;

  function scrub(value) {
    if (!value) return value;
    return String(value)
      .replace(/Avgust Crop Protection/g, "Acompañamiento en campo")
      .replace(/AVGUST Crop Protection/g, "Acompañamiento en campo")
      .replace(/EQUIPO AVGUST CARE 360/g, "EQUIPO DE CAMPO")
      .replace(/AVGUST CARE 360/g, "CARE 360")
      .replace(/AVGUST care 360/g, "CARE 360")
      .replace(/Responsable AVGUST/g, "Responsable técnico")
      .replace(/Técnico AVGUST/g, "Técnico de campo")
      .replace(/profesional de AVGUST/g, "profesional técnico")
      .replace(/asistencia técnica de Avgust/g, "asistencia técnica en campo")
      .replace(/ · AVGUST/g, "")
      .replace(/ de AVGUST/g, " técnico");
  }

  function isTyping(node) {
    var el = node && node.parentElement;
    while (el) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      if (isTyping(root)) return;
      var next = scrub(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (root.nodeType !== 1) return;
    if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(root.tagName)) return;
    ["alt", "title", "aria-label", "placeholder"].forEach(function (attr) {
      if (!root.hasAttribute(attr)) return;
      var value = root.getAttribute(attr);
      var cleaned = scrub(value);
      if (cleaned !== value) root.setAttribute(attr, cleaned);
    });
    var child = root.firstChild;
    while (child) {
      var following = child.nextSibling;
      walk(child);
      child = following;
    }
  }

  function apply() {
    document.title = scrub(document.title) || "CARE 360";
    walk(document.body);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(function () {
      pending = false;
      apply();
    });
  }

  function boot() {
    apply();
    var observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
