/**
 * Importación de finca e informes (matriz, Word y PDF).
 * - Crea la finca si no existe.
 * - Acepta Sí cumple / No cumple.
 * - Parsea informes Word (.docx) y PDF de CARE 360.
 */
(function () {
  "use strict";

  var CHAPTER_ITEMS = {
    1: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"],
    2: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"],
    3: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
    4: ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10"],
    5: ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11"],
  };

  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function q(sel, root) {
    return (root || document).querySelector(sel);
  }

  function norm(str) {
    return String(str || "")
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeAnswer(raw) {
    var t = norm(raw);
    if (t === "si" || t === "si cumple" || t === "cumple") return "SI";
    if (t === "no" || t === "no cumple" || t === "incumple") return "NO";
    if (t === "no aplica" || t === "na" || t === "n a") return "NA";
    return "";
  }

  function parseCsv(text) {
    var rows = [];
    var i = 0;
    var field = "";
    var row = [];
    var inQuotes = false;
    text = text.replace(/^\uFEFF/, "");
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        i += 1;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.some(function (c) {
        return String(c || "").trim();
      });
    });
  }

  function colIndex(header, name) {
    var want = norm(name);
    return header.findIndex(function (h) {
      return norm(h) === want;
    });
  }

  function rowsToVisits(rows) {
    if (!rows.length) return { visits: [], errors: ["El archivo no contiene filas."], rows: 0 };
    var header = rows[0].map(String);
    var map = {
      finca: colIndex(header, "finca"),
      fecha: colIndex(header, "fecha"),
      capitulo: colIndex(header, "capitulo"),
      item: colIndex(header, "item"),
      respuesta: colIndex(header, "respuesta"),
      responsible: colIndex(header, "responsable avgust"),
      observation: colIndex(header, "hallazgo observacion"),
      recommendation: colIndex(header, "recomendacion"),
    };
    var missing = ["finca", "fecha", "capitulo", "item", "respuesta"].filter(function (k) {
      return map[k] < 0;
    });
    if (missing.length) {
      return { visits: [], errors: ["Faltan columnas: " + missing.join(", ") + "."], rows: rows.length - 1 };
    }
    var groups = new Map();
    var errors = [];
    rows.slice(1).forEach(function (row, idx) {
      var line = idx + 2;
      var get = function (key) {
        return map[key] >= 0 ? String(row[map[key]] || "").trim() : "";
      };
      var farm = get("finca");
      var date = get("fecha");
      var item = get("item");
      var answer = normalizeAnswer(get("respuesta"));
      var chapter = Number((get("capitulo").match(/^\s*(\d+)/) || ["", "0"])[1]);
      if (!farm && !date && !item) return;
      if (!farm || !date || !item || !answer) {
        errors.push("Fila " + line + ": completa finca, fecha, ítem y respuesta.");
        return;
      }
      if (!chapter || Number(item.split(".")[0]) !== chapter) {
        errors.push("Fila " + line + ": el ítem " + item + " no corresponde al capítulo indicado.");
        return;
      }
      var responsible = get("responsible") || "Histórico importado";
      var key = norm(farm) + "|" + date + "|" + norm(responsible);
      var group = groups.get(key) || {
        farm: farm,
        date: date,
        responsible: responsible,
        chapters: new Set(),
        answers: {},
      };
      if (group.answers[item]) {
        errors.push("Fila " + line + ": el ítem " + item + " está repetido.");
        return;
      }
      group.chapters.add(chapter);
      group.answers[item] = {
        value: answer,
        observation: get("observation"),
        recommendation: get("recommendation"),
      };
      groups.set(key, group);
    });

    var visits = [];
    groups.forEach(function (g) {
      var chapters = Array.from(g.chapters).sort();
      var missingItems = [];
      chapters.forEach(function (ch) {
        (CHAPTER_ITEMS[ch] || []).forEach(function (id) {
          if (!g.answers[id]) missingItems.push(id);
        });
      });
      if (missingItems.length) {
        errors.push(
          g.farm +
            " (" +
            g.date +
            "): faltan ítems del capítulo: " +
            missingItems.slice(0, 8).join(", ") +
            (missingItems.length > 8 ? "…" : "")
        );
        return;
      }
      Object.keys(g.answers).forEach(function (id) {
        if (g.answers[id].value === "NO") {
          if (!g.answers[id].observation || !g.answers[id].recommendation) {
            errors.push(g.farm + " (" + g.date + "): el No cumple de " + id + " necesita hallazgo y recomendación.");
          }
        }
      });
      visits.push({
        id: "",
        farm: g.farm,
        date: g.date,
        revision: 0,
        responsible: g.responsible,
        technician: g.responsible,
        rtc: "",
        city: "",
        zone: "",
        crop: "",
        chapters: chapters,
        answers: g.answers,
        notes: {},
        recommendations: {},
        measurements: {},
        photos: [],
        delivery: "",
        followup: "",
        reviewed: true,
        serviceKind: "assurance",
        conclusion: "Informe histórico importado.",
        actions: {},
      });
    });
    return { visits: visits, errors: errors, rows: rows.length - 1 };
  }

  async function docxToText(file) {
    if (!window.JSZip) throw new Error("JSZip no está disponible todavía. Abre Métricas e inténtalo de nuevo.");
    var zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    var doc = zip.file("word/document.xml");
    if (!doc) throw new Error("El Word no tiene document.xml válido.");
    var xml = await doc.async("text");
    return xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<br\s*\/>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n");
  }

  async function pdfToText(file) {
    var buf = new Uint8Array(await file.arrayBuffer());
    var raw = "";
    // Best-effort: extract printable Latin text streams (no full PDF parser).
    var asLatin = "";
    for (var i = 0; i < buf.length; i++) {
      var c = buf[i];
      asLatin += c >= 32 && c <= 126 ? String.fromCharCode(c) : c === 10 || c === 13 ? "\n" : " ";
    }
    var parts = asLatin.match(/\((?:\\.|[^\\)])*\)/g) || [];
    raw = parts
      .map(function (p) {
        return p.slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1");
      })
      .join(" ");
    raw = raw.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
    if (raw.replace(/\s+/g, "").length < 40) {
      throw new Error(
        "No se pudo leer el texto de este PDF. Expórtalo a Word o usa la matriz Excel/CSV de CARE 360."
      );
    }
    return raw;
  }

  function parseReportText(text) {
    var farm =
      (text.match(/Finca\s*[:|]?\s*([^\n|]+)/i) ||
        text.match(/Nombre de la finca\s*[:|]?\s*([^\n]+)/i) ||
        [])[1] || "";
    farm = farm.replace(/\s+/g, " ").trim();
    var date =
      (text.match(/Fecha\s*[:|]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i) || [])[1] || "";
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(date)) {
      var bits = date.split(/[\/\-]/);
      var y = bits[2].length === 2 ? "20" + bits[2] : bits[2];
      date = y + "-" + bits[1].padStart(2, "0") + "-" + bits[0].padStart(2, "0");
    }
    var responsible =
      (text.match(/Responsable t[eé]cnico\s*[:|]?\s*([^\n|]+)/i) ||
        text.match(/Representante t[eé]cnico\s*[:|]?\s*([^\n|]+)/i) ||
        [])[1] || "Histórico importado";
    responsible = responsible.replace(/\s+/g, " ").trim();

    var answers = {};
    var chapters = new Set();
    var re = /(\d+\.\d+)\s*·\s*(Sí cumple|No cumple|No aplica|Sí|No|Sin evaluar)/gi;
    var match;
    var matches = [];
    while ((match = re.exec(text))) {
      matches.push({ id: match[1], answer: match[2], index: match.index, end: re.lastIndex });
    }
    matches.forEach(function (m, i) {
      var value = normalizeAnswer(m.answer);
      if (!value) return;
      var chunk = text.slice(m.end, matches[i + 1] ? matches[i + 1].index : m.end + 500);
      var observation = (chunk.match(/Hallazgo\s*\/?\s*observaci[oó]n\s*[:：]?\s*([^\n]+)/i) || [])[1] || "";
      var recommendation = (chunk.match(/Recomendaci[oó]n\s*[:：]?\s*([^\n]+)/i) || [])[1] || "";
      answers[m.id] = {
        value: value,
        observation: observation.trim(),
        recommendation: recommendation.trim(),
      };
      chapters.add(Number(m.id.split(".")[0]));
    });

    if (!farm || !date) {
      throw new Error("No se encontró finca o fecha en el informe. Revisa el encabezado del Word/PDF.");
    }
    if (!Object.keys(answers).length) {
      throw new Error("No se encontraron criterios con Sí cumple / No cumple en el documento.");
    }

    // Fill missing chapter items as NA so the visit can be imported.
    Array.from(chapters).forEach(function (ch) {
      (CHAPTER_ITEMS[ch] || []).forEach(function (id) {
        if (!answers[id]) answers[id] = { value: "NA", observation: "", recommendation: "" };
      });
    });

    return {
      visits: [
        {
          id: "",
          farm: farm,
          date: date,
          revision: 0,
          responsible: responsible,
          technician: responsible,
          rtc: "",
          city: "",
          zone: "",
          crop: "",
          chapters: Array.from(chapters).sort(),
          answers: answers,
          notes: {},
          recommendations: {},
          measurements: {},
          photos: [],
          delivery: "",
          followup: "",
          reviewed: true,
          serviceKind: "assurance",
          conclusion: "Informe importado desde documento.",
          actions: {},
        },
      ],
      errors: [],
      rows: Object.keys(answers).length,
    };
  }

  async function ensureFarm(name) {
    var teamRes = await fetch("/api/team");
    var team = await teamRes.json();
    if (!teamRes.ok) throw new Error(team.error || "No se pudo leer el equipo");
    var farms = team.farms || team || [];
    if (!Array.isArray(farms)) farms = farms.farms || [];
    var exists = farms.some(function (f) {
      return norm(f.name || f.farm || "") === norm(name);
    });
    if (exists) return;
    var create = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "create",
        name: name,
        zone: "Importado",
        managerName: "Responsable importado",
      }),
    });
    var body = await create.json().catch(function () {
      return {};
    });
    if (!create.ok) {
      // Idempotent: ignore if already exists under another code path.
      if (!/ya existe|duplicate|unique/i.test(body.error || "")) {
        throw new Error(body.error || "No se pudo crear la finca " + name);
      }
    }
  }

  async function saveVisits(visits) {
    var listRes = await fetch("/api/visits");
    var existing = await listRes.json();
    if (!listRes.ok) throw new Error(existing.error || "No se pudieron leer visitas");
    var current = Array.isArray(existing) ? existing : existing.visits || [];
    var seen = new Set(
      current.map(function (v) {
        return norm(v.farm) + "|" + v.date;
      })
    );
    var todo = visits.filter(function (v) {
      return !seen.has(norm(v.farm) + "|" + v.date);
    });
    if (!todo.length) throw new Error("Todos los aseguramientos ya aparecen con la misma finca y fecha.");
    var saved = [];
    for (var i = 0; i < todo.length; i++) {
      await ensureFarm(todo[i].farm);
      var res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(todo[i]),
      });
      var body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error al guardar visita de " + todo[i].farm);
      saved.push(body);
    }
    return saved;
  }

  async function handleFile(file, ui) {
    ui.setStatus("Revisando " + file.name + "…", false);
    var name = file.name.toLowerCase();
    var parsed;
    try {
      if (name.endsWith(".csv")) {
        parsed = rowsToVisits(parseCsv(await file.text()));
      } else if (name.endsWith(".docx")) {
        parsed = parseReportText(await docxToText(file));
      } else if (name.endsWith(".pdf")) {
        parsed = parseReportText(await pdfToText(file));
      } else if (name.endsWith(".xlsx")) {
        // Defer to native matrix input when possible.
        var native = q(".matrix-import input[type=file]");
        if (native) {
          ui.setStatus("Usa el selector nativo para Excel .xlsx (ya está abierto abajo).", false);
          native.click();
          return;
        }
        throw new Error("Para Excel .xlsx usa el importador de matriz del panel.");
      } else {
        throw new Error("Formato no soportado. Usa Excel, CSV, Word (.docx) o PDF.");
      }
    } catch (err) {
      ui.setStatus(err.message || String(err), true);
      return;
    }

    if (parsed.errors && parsed.errors.length && !parsed.visits.length) {
      ui.setStatus(parsed.errors.slice(0, 4).join(" · "), true);
      return;
    }
    ui.setPreview(parsed);
  }

  function enhanceImportPanel() {
    var details = q("details.matrix-import");
    if (!details || details.getAttribute("data-c360-import") === "1") return;
    details.setAttribute("data-c360-import", "1");

    var box = document.createElement("div");
    box.className = "c360-import-box";
    box.innerHTML =
      '<p class="c360-import-lead">Importa una <strong>finca</strong> y sus <strong>informes</strong> desde matriz Excel/CSV, Word o PDF. Si la finca no existe, se crea sola.</p>' +
      '<label class="c360-import-file">Elegir archivo' +
      '<input type="file" accept=".xlsx,.csv,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />' +
      "</label>" +
      '<div class="c360-import-status muted" hidden></div>' +
      '<div class="c360-import-preview" hidden></div>';
    details.insertBefore(box, details.firstChild.nextSibling);

    var input = q("input[type=file]", box);
    var status = q(".c360-import-status", box);
    var preview = q(".c360-import-preview", box);
    var pending = null;

    var ui = {
      setStatus: function (text, isError) {
        status.hidden = !text;
        status.textContent = text || "";
        status.className = "c360-import-status " + (isError ? "notice error" : "muted");
      },
      setPreview: function (parsed) {
        pending = parsed;
        preview.hidden = false;
        var warn = (parsed.errors || []).slice(0, 3).join(" · ");
        preview.innerHTML =
          "<p><strong>" +
          parsed.visits.length +
          "</strong> aseguramiento(s) listos · " +
          parsed.rows +
          " filas/criterios leídos.</p>" +
          (warn ? "<p class=\"notice error\">" + warn + "</p>" : "") +
          '<button type="button" class="primary c360-import-go">Importar finca e informes</button>';
        q(".c360-import-go", preview).addEventListener("click", async function () {
          try {
            ui.setStatus("Importando…", false);
            var saved = await saveVisits(pending.visits);
            ui.setStatus(saved.length + " aseguramientos importados. Recarga Métricas para verlos.", false);
            preview.hidden = true;
            pending = null;
            setTimeout(function () {
              window.location.reload();
            }, 900);
          } catch (err) {
            ui.setStatus(err.message || String(err), true);
          }
        });
      },
    };

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (file) handleFile(file, ui);
      input.value = "";
    });
  }

  // Also ensure farm on native matrix import POSTs.
  var nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    try {
      var url = String(input && input.url ? input.url : input || "");
      if (/\/api\/visits\/?$/.test(url) && init && String(init.method || "GET").toUpperCase() === "POST" && init.body) {
        var payload = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        if (payload && payload.farm) await ensureFarm(payload.farm);
      }
    } catch (err) {
      // Don't block native flow on ensureFarm preview errors; rethrow only if create failed hard.
      if (err && /No se pudo crear la finca/.test(err.message || "")) throw err;
    }
    return nativeFetch(input, init);
  };

  window.C360Import = {
    handleFile: handleFile,
    saveVisits: saveVisits,
    rowsToVisits: rowsToVisits,
    parseReportText: parseReportText,
  };

  function tick() {
    if (q("details.matrix-import")) enhanceImportPanel();
  }

  function boot() {
    tick();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        tick();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
