/**
 * Importación de finca e informes (matriz, Word y PDF).
 * - Crea la finca si no existe.
 * - Acepta Sí cumple / No cumple.
 * - Parsea informes Word (.docx) y PDF de CARE 360.
 */
(function () {
  "use strict";

  // Must match the criterion catalog of the app (device-runtime / index).
  var CHAPTER_ITEMS = {
    1: ["1.1", "1.2", "1.3", "1.4"],
    2: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"],
    3: ["3.1", "3.2", "3.3", "3.4"],
    4: ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10"],
    5: ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11"],
  };
  var ALL_ITEM_IDS = Object.keys(CHAPTER_ITEMS).reduce(function (acc, ch) {
    CHAPTER_ITEMS[ch].forEach(function (id) {
      acc[id] = true;
    });
    return acc;
  }, {});

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

  function clampStr(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function normalizeAnswer(raw) {
    var t = norm(raw);
    if (t === "si" || t === "si cumple" || t === "cumple" || t === "yes") return "SI";
    if (t === "no" || t === "no cumple" || t === "incumple") return "NO";
    if (t === "no aplica" || t === "na" || t === "n a" || t === "sin evaluar") return "NA";
    return "";
  }

  function normalizeDate(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      var y = Number(iso[1]);
      var m = Number(iso[2]);
      var d = Number(iso[3]);
      if (m < 1 || m > 12 || d < 1 || d > 31) return "";
      var check = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      // Runtime compares with toISOString().slice(0,10); ISO date-only is UTC-safe.
      if (new Date(check).toISOString().slice(0, 10) !== check) return "";
      return check;
    }
    var slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (slash) {
      var day = Number(slash[1]);
      var month = Number(slash[2]);
      var year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
      // Prefer D/M/Y (Colombia); if day>12 keep that. If month>12 swap.
      if (month > 12 && day <= 12) {
        var tmp = day;
        day = month;
        month = tmp;
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) return "";
      return normalizeDate(
        year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0")
      );
    }
    return "";
  }

  function normalizeTextMap(obj) {
    var out = {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
    Object.keys(obj).forEach(function (key) {
      if (!/^[a-z0-9.]+$/i.test(key)) return;
      var val = clampStr(obj[key], 12000);
      if (val) out[key] = val;
    });
    return out;
  }

  var ACTION_STATUS = {
    propuesta: "proposed",
    proposed: "proposed",
    aceptada: "pending",
    pending: "pending",
    enproceso: "progress",
    progress: "progress",
    completado: "closed",
    cerrado: "closed",
    closed: "closed",
    cancelado: "cancelled",
    cancelled: "cancelled",
  };

  function normalizeActionStatus(raw) {
    var key = norm(raw).replace(/\s+/g, "");
    return ACTION_STATUS[key] || "proposed";
  }

  function normalizeActions(actions) {
    var out = {};
    if (!actions || typeof actions !== "object" || Array.isArray(actions)) return out;
    Object.keys(actions).forEach(function (id) {
      if (!ALL_ITEM_IDS[id]) return;
      var raw = actions[id] || {};
      out[id] = {
        owner: clampStr(raw.owner, 300),
        due: normalizeDate(raw.due) || "",
        status: normalizeActionStatus(raw.status || "proposed"),
        closure: clampStr(raw.closure, 12000),
        beforePhotoId: clampStr(raw.beforePhotoId, 36),
        photoId: clampStr(raw.photoId, 36),
        completedAt: clampStr(raw.completedAt, 40),
        completedBy: clampStr(raw.completedBy, 300),
        reopenedAt: clampStr(raw.reopenedAt, 40),
      };
    });
    return out;
  }

  function normalizePhotos(photos) {
    if (!Array.isArray(photos)) return [];
    return photos
      .map(function (p) {
        if (!p || !p.id) return null;
        var chapter = Number(p.chapter);
        return {
          id: clampStr(p.id, 36),
          caption: clampStr(p.caption, 2000),
          chapter: Number.isFinite(chapter) && chapter >= 1 && chapter <= 5 ? chapter : "",
          criterionId: ALL_ITEM_IDS[p.criterionId] ? p.criterionId : "",
        };
      })
      .filter(Boolean)
      .slice(0, 60);
  }

  var MEASURE_LABELS = [
    { re: /^ph del agua$/i, key: "ph" },
    { re: /^dureza/i, key: "hardness" },
    { re: /^conductividad(?!.*mezcla)/i, key: "conductivity" },
    { re: /^ph mezcla final$/i, key: "mixPh" },
    { re: /^conductividad mezcla final$/i, key: "mixConductivity" },
    { re: /^presi[oó]n de la bomba/i, key: "pressure" },
    { re: /^presi[oó]n del implemento/i, key: "implementPressure" },
    { re: /^equipo de aplicaci[oó]n$/i, key: "equipment" },
    { re: /^implementos? de aplicaci[oó]n$/i, key: "implement" },
    { re: /^volumen por cama/i, key: "volume" },
    { re: /^tiempo por cama/i, key: "time" },
  ];

  function measureKeyFromLabel(label) {
    var t = String(label || "").trim();
    for (var i = 0; i < MEASURE_LABELS.length; i++) {
      if (MEASURE_LABELS[i].re.test(t)) return MEASURE_LABELS[i].key;
    }
    return "";
  }

  /** Align a parsed visit with device-runtime saveVisit validation. */
  function sanitizeVisit(visit, warnings, opts) {
    warnings = warnings || [];
    opts = opts || {};
    var complete = opts.complete !== false;
    var farm = clampStr(visit.farm, 300);
    var responsible = clampStr(visit.responsible || visit.technician || "Histórico importado", 300);
    var date = normalizeDate(visit.date);
    if (!farm) throw new Error("Falta el nombre de la finca.");
    if (!responsible) throw new Error("Falta el responsable técnico.");
    if (!date) throw new Error("Fecha inválida. Usa formato AAAA-MM-DD.");

    var chapters = [];
    if (complete) {
      chapters = [1, 2, 3, 4, 5];
    } else {
      (Array.isArray(visit.chapters) ? visit.chapters : []).forEach(function (ch) {
        var n = Number(ch);
        if (Number.isInteger(n) && n >= 1 && n <= 5 && chapters.indexOf(n) < 0) chapters.push(n);
      });
      Object.keys(visit.answers || {}).forEach(function (id) {
        if (!ALL_ITEM_IDS[id]) return;
        var ch = Number(String(id).split(".")[0]);
        if (chapters.indexOf(ch) < 0) chapters.push(ch);
      });
      chapters.sort(function (a, b) {
        return a - b;
      });
    }
    if (!chapters.length) throw new Error("No hay capítulos válidos para importar.");

    var answers = {};
    Object.keys(visit.answers || {}).forEach(function (id) {
      if (!ALL_ITEM_IDS[id]) {
        warnings.push("Se omitió el ítem desconocido " + id + ".");
        return;
      }
      var raw = visit.answers[id] || {};
      var value = normalizeAnswer(raw.value);
      if (!value && ["SI", "NO", "NA", ""].indexOf(raw.value) >= 0) value = raw.value;
      if (!value) value = "NA";
      var observation = clampStr(raw.observation, 12000);
      var recommendation = clampStr(raw.recommendation, 12000);
      if (value === "NO") {
        if (!observation) observation = "Hallazgo importado sin detalle en el documento.";
        if (!recommendation) recommendation = "Revisar en campo y completar recomendación.";
      }
      answers[id] = { value: value, observation: observation, recommendation: recommendation };
    });

    chapters.forEach(function (ch) {
      (CHAPTER_ITEMS[ch] || []).forEach(function (id) {
        if (!answers[id]) {
          answers[id] = { value: "NA", observation: "", recommendation: "" };
        }
      });
    });

    Object.keys(answers).forEach(function (id) {
      var ch = Number(String(id).split(".")[0]);
      if (chapters.indexOf(ch) < 0) delete answers[id];
    });

    var out = {
      id: "",
      revision: 0,
      farm: farm,
      date: date,
      city: clampStr(visit.city, 300),
      zone: clampStr(visit.zone, 300),
      crop: clampStr(visit.crop, 300),
      technician: clampStr(visit.technician || responsible, 300),
      responsible: responsible,
      rtc: clampStr(visit.rtc, 300),
      chapters: chapters,
      answers: answers,
      notes: normalizeTextMap(visit.notes),
      recommendations: normalizeTextMap(visit.recommendations),
      measurements: normalizeTextMap(visit.measurements),
      delivery: normalizeDate(visit.delivery) || "",
      followup: normalizeDate(visit.followup) || "",
      conclusion: clampStr(visit.conclusion || "Informe histórico importado. Revisar y completar en Visitas.", 15000),
      photos: normalizePhotos(visit.photos),
      reviewed: true,
      serviceKind: "assurance",
      actions: normalizeActions(visit.actions),
    };
    if (visit.farmId && /^[a-f0-9-]{36}$/i.test(visit.farmId)) out.farmId = visit.farmId;
    if (Array.isArray(visit._importPhotos) && visit._importPhotos.length) {
      out._importPhotos = visit._importPhotos.slice(0, 60);
    }
    return out;
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
      var date = normalizeDate(get("fecha")) || get("fecha");
      var item = get("item").replace(/\s+/g, "");
      var answer = normalizeAnswer(get("respuesta"));
      var chapter = Number((get("capitulo").match(/^\s*(\d+)/) || ["", "0"])[1]);
      if (!farm && !date && !item) return;
      if (!farm || !date || !item || !answer) {
        errors.push("Fila " + line + ": completa finca, fecha, ítem y respuesta.");
        return;
      }
      if (!normalizeDate(date)) {
        errors.push("Fila " + line + ": fecha inválida (" + get("fecha") + "). Usa AAAA-MM-DD.");
        return;
      }
      date = normalizeDate(date);
      if (!ALL_ITEM_IDS[item]) {
        errors.push("Fila " + line + ": el ítem " + item + " no existe en CARE 360.");
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
      var chapters = Array.from(g.chapters).sort(function (a, b) {
        return a - b;
      });
      var missingItems = [];
      chapters.forEach(function (ch) {
        (CHAPTER_ITEMS[ch] || []).forEach(function (id) {
          if (!g.answers[id]) missingItems.push(id);
        });
      });
      // Missing items are filled as NA in sanitizeVisit; warn but don't block.
      if (missingItems.length) {
        errors.push(
          g.farm +
            " (" +
            g.date +
            "): faltaban ítems y se marcarán No aplica: " +
            missingItems.slice(0, 8).join(", ") +
            (missingItems.length > 8 ? "…" : "")
        );
      }
      Object.keys(g.answers).forEach(function (id) {
        if (g.answers[id].value === "NO") {
          if (!g.answers[id].observation || !g.answers[id].recommendation) {
            errors.push(
              g.farm +
                " (" +
                g.date +
                "): el No cumple de " +
                id +
                " sin hallazgo/recomendación se completará al importar."
            );
          }
        }
      });
      try {
        visits.push(
          sanitizeVisit({
            farm: g.farm,
            date: g.date,
            responsible: g.responsible,
            technician: g.responsible,
            chapters: chapters,
            answers: g.answers,
            conclusion: "Informe histórico importado.",
          }, errors)
        );
      } catch (err) {
        errors.push(g.farm + " (" + g.date + "): " + (err.message || String(err)));
      }
    });
    return { visits: visits, errors: errors, rows: rows.length - 1 };
  }

  async function readZipEntries(buffer) {
    var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var map = new Map();
    var i;
    for (i = 0; i <= bytes.length - 46; i++) {
      if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b || bytes[i + 2] !== 1 || bytes[i + 3] !== 2) continue;
      var method = bytes[i + 10] | (bytes[i + 11] << 8);
      var compSize =
        bytes[i + 20] |
        (bytes[i + 21] << 8) |
        (bytes[i + 22] << 16) |
        (bytes[i + 23] << 24);
      var nameLen = bytes[i + 28] | (bytes[i + 29] << 8);
      var extraLen = bytes[i + 30] | (bytes[i + 31] << 8);
      var commentLen = bytes[i + 32] | (bytes[i + 33] << 8);
      var localOffset =
        bytes[i + 42] |
        (bytes[i + 43] << 8) |
        (bytes[i + 44] << 16) |
        (bytes[i + 45] << 24);
      var name = new TextDecoder().decode(bytes.slice(i + 46, i + 46 + nameLen));
      var localNameLen = bytes[localOffset + 26] | (bytes[localOffset + 27] << 8);
      var localExtraLen = bytes[localOffset + 28] | (bytes[localOffset + 29] << 8);
      var data = bytes.slice(
        localOffset + 30 + localNameLen + localExtraLen,
        localOffset + 30 + localNameLen + localExtraLen + compSize
      );
      if (method === 0) {
        map.set(name, data);
      } else if (method === 8 && typeof DecompressionStream !== "undefined") {
        var blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)]);
        var stream = blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
        map.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
      } else {
        throw new Error(
          "Este Word usa una compresión no compatible en el equipo. Guárdalo otra vez como .docx o exporta a PDF/CSV."
        );
      }
      i += 46 + nameLen + extraLen + commentLen - 1;
    }
    return map;
  }

  async function docxToText(file) {
    var parsed = await parseDocx(file);
    return parsed.text;
  }

  function mimeFromPath(path) {
    var lower = String(path || "").toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  }

  async function parseDocx(file) {
    var entries = await readZipEntries(await file.arrayBuffer());
    var docBytes = entries.get("word/document.xml");
    if (!docBytes) throw new Error("El Word no tiene document.xml válido.");
    var xml = new TextDecoder("utf-8").decode(docBytes);
    var relBytes = entries.get("word/_rels/document.xml.rels");
    var ridMap = {};
    if (relBytes) {
      var relXml = new TextDecoder("utf-8").decode(relBytes);
      var relRe = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
      var rm;
      while ((rm = relRe.exec(relXml))) {
        ridMap[rm[1]] = rm[2].replace(/^\//, "");
      }
    }
    var embeds = [];
    var embedRe = /a:blip[^>]*r:embed="(rId\d+)"/g;
    var em;
    while ((em = embedRe.exec(xml))) embeds.push(em[1]);

    var text = xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<br\s*\/>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n");

    var photoBlobs = [];
    embeds.forEach(function (rid) {
      var target = ridMap[rid];
      if (!target || !/^media\//i.test(target)) return;
      var bytes = entries.get("word/" + target) || entries.get(target);
      if (!bytes || !bytes.length) return;
      if (bytes.length > 8388608) return;
      photoBlobs.push({
        rid: rid,
        bytes: bytes,
        mime: mimeFromPath(target),
      });
    });

    return { text: text, photoBlobs: photoBlobs };
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

  function parseHeaderField(text, labels) {
    for (var i = 0; i < labels.length; i++) {
      var re = new RegExp(labels[i] + "\\s*[:|]?\\s*([^\\n|]+)", "i");
      var m = text.match(re);
      if (m && m[1]) {
        var val = m[1].replace(/\s+/g, " ").trim();
        if (val && !/^no registrado$/i.test(val)) return val;
      }
    }
    return "";
  }

  function parseReportText(text, photoBlobs) {
    photoBlobs = photoBlobs || [];
    var farm = parseHeaderField(text, ["Nombre de la finca", "Finca"]);
    var date = normalizeDate(parseHeaderField(text, ["Fecha de visita", "Fecha"]));
    var city = parseHeaderField(text, ["Ciudad / departamento", "Departamento / ciudad", "Departamento", "Ciudad"]);
    var zone = parseHeaderField(text, ["Municipio / zona", "Municipio", "Zona"]);
    var crop = parseHeaderField(text, ["Tipo de cultivo", "Cultivo"]);
    var technician = parseHeaderField(text, ["Representante de la finca", "Representante finca"]);
    var responsible =
      parseHeaderField(text, ["Responsable técnico", "Responsable tecnico"]) || "Histórico importado";
    var rtc = parseHeaderField(text, ["Representante técnico comercial", "RTC"]);

    var delivery = "";
    var followup = "";
    var crono = text.match(
      /Entrega del informe\s*\n\s*([^\n]+)\s*\n\s*Seguimiento\s*\n\s*([^\n]+)/i
    );
    if (crono) {
      delivery = normalizeDate(crono[1]);
      if (!/no programado|sin fecha|pendiente/i.test(crono[2])) {
        followup = normalizeDate(crono[2]);
      }
    }
    if (!delivery) {
      delivery = normalizeDate(parseHeaderField(text, ["Entrega del informe", "Fecha de entrega"]));
    }
    if (!followup) {
      var fuRaw = parseHeaderField(text, ["Fecha de seguimiento", "Seguimiento"]);
      if (fuRaw && !/no programado|sin fecha|pendiente/i.test(fuRaw)) {
        followup = normalizeDate(fuRaw);
      }
    }

    var conclusion =
      parseHeaderField(text, ["Conclusión", "Conclusion", "Conclusiones y seguimiento"]) || "";
    if (!conclusion) {
      var ind = text.match(/Indicador de la visita\s*\n\s*([^\n]{10,240})/i);
      var alc = text.match(/Alcance de la evaluaci[oó]n\s*\n\s*([^\n]{10,240})/i);
      var bits = [];
      if (ind) bits.push(ind[1].trim());
      if (alc) bits.push(alc[1].trim());
      conclusion =
        bits.join(" ") ||
        "Informe importado completo. Revisar plan de acción y evidencias fotográficas en Seguimiento.";
    }

    var answers = {};
    var notes = {};
    var recommendations = {};
    var measurements = {};
    var actions = {};
    var re =
      /(\d+\.\d+)\s*(?:·|-|:)?\s*(Sí cumple|No cumple|No aplica|Sin evaluar|Sí|No)/gi;
    var match;
    var matches = [];
    while ((match = re.exec(text))) {
      matches.push({ id: match[1], answer: match[2], index: match.index, end: re.lastIndex });
    }
    matches.forEach(function (m, i) {
      if (!ALL_ITEM_IDS[m.id]) return;
      var value = normalizeAnswer(m.answer);
      if (!value) return;
      var chunk = text.slice(m.end, matches[i + 1] ? matches[i + 1].index : m.end + 1800);
      var observation = (chunk.match(/Hallazgo\s*\/?\s*observaci[oó]n\s*[:：]?\s*([^\n]+)/i) || [])[1] || "";
      var recommendation = (chunk.match(/Recomendaci[oó]n\s*[:：]?\s*([^\n]+)/i) || [])[1] || "";
      answers[m.id] = {
        value: value,
        observation: observation.trim(),
        recommendation: recommendation.trim(),
      };
    });

    // Plan de acción → Seguimiento
    var planRe =
      /Hallazgo\s+(\d+\.\d+)\s*·\s*(Propuesta|Aceptada|En proceso|Completado|Cerrado|Cancelado)([\s\S]*?)(?=Hallazgo\s+\d+\.\d+\s*·|Registro fotogr[aá]fico|Responsables\b|$)/gi;
    var planMatch;
    while ((planMatch = planRe.exec(text))) {
      var pid = planMatch[1];
      if (!ALL_ITEM_IDS[pid]) continue;
      var block = planMatch[3] || "";
      var ownerLine =
        (block.match(/Responsable\s*[:：]?\s*([^\n]+)/i) || [])[1] || "";
      var owner = ownerLine.split(/·|Fecha l[ií]mite/i)[0].trim();
      var due =
        normalizeDate((ownerLine.match(/Fecha l[ií]mite\s*[:：]?\s*([0-9\/\-.]+)/i) || [])[1]) ||
        normalizeDate((block.match(/Fecha l[ií]mite\s*[:：]?\s*([0-9\/\-.]+)/i) || [])[1]) ||
        "";
      var closure = ((block.match(/Seguimiento\s*\/?\s*cierre\s*[:：]?\s*([^\n]+)/i) || [])[1] || "").trim();
      var actionText = ((block.match(/Acci[oó]n\s*[:：]?\s*([^\n]+)/i) || [])[1] || "").trim();
      if (!answers[pid] && actionText) {
        // Keep action even if criterion answer missing from chapters 1-2.
      }
      actions[pid] = {
        owner: owner,
        due: due,
        status: planMatch[2],
        closure: closure,
        photoId: "",
        beforePhotoId: "",
      };
      if (answers[pid] && actionText && !answers[pid].recommendation) {
        answers[pid].recommendation = actionText;
      }
    }

    for (var ch = 1; ch <= 5; ch++) {
      var noteRe = new RegExp(
        "(?:Cap[ií]tulo\\s*" +
          ch +
          "[^\\n]{0,80}|Observaciones?\\s*(?:cap[ií]tulo\\s*" +
          ch +
          ")?)\\s*[:：]?\\s*([^\\n]{8,})",
        "i"
      );
      var nm = text.match(noteRe);
      if (nm) notes[String(ch)] = nm[1].trim().slice(0, 12000);
    }

    // Pair label/value lines (tables flatten to consecutive lines in text).
    var lines = text.split(/\n+/);
    for (var li = 0; li < lines.length - 1; li++) {
      var key = measureKeyFromLabel(lines[li]);
      if (!key) continue;
      var val = String(lines[li + 1] || "").trim();
      if (!val) continue;
      if (measureKeyFromLabel(val)) continue;
      if (norm(val) === norm(lines[li])) continue;
      if (/^(pH|Dureza|Conductividad|Presi|Equipo|Implement|Volumen|Tiempo|Capítulo|Hallazgo|Fotografía|Registro|Sí cumple|No cumple|No aplica|\d+\.\d+)/i.test(val)) {
        continue;
      }
      measurements[key] = val.slice(0, 300);
    }
    // Fallback regex pairs
    try {
      var measurePairs = text.matchAll
        ? text.matchAll(
            /(?:^|\n)(pH del agua|Dureza\s*\(ppm\)|Conductividad(?:\s+mezcla final)?|pH mezcla final|Presi[oó]n de la bomba[^:\n]{0,20}|Equipo de aplicaci[oó]n|Implementos? de aplicaci[oó]n|Volumen por cama[^:\n]{0,10}|Tiempo por cama[^:\n]{0,10})\s*\n\s*([^\n]{1,80})/gi
          )
        : [];
      for (var mm of measurePairs) {
        var mk = measureKeyFromLabel(mm[1]);
        var mv = String(mm[2] || "").trim();
        if (!mk || !mv) continue;
        if (measureKeyFromLabel(mv) || norm(mv) === norm(mm[1])) continue;
        measurements[mk] = mv.slice(0, 300);
      }
    } catch (err) {}

    // Fotos: captions "Fotografía N · Capítulo X · Subcapítulo Y.Z. …"
    var captions = [];
    var capRe =
      /Fotograf[ií]a\s+(\d+)\s*·\s*Cap[ií]tulo\s+(\d+)\s*·\s*Subcap[ií]tulo\s+(\d+\.\d+)\.\s*([^\n]*)/gi;
    var cm;
    while ((cm = capRe.exec(text))) {
      captions[Number(cm[1])] = {
        chapter: Number(cm[2]),
        criterionId: cm[3],
        caption: ("Fotografía " + cm[1] + " · " + cm[3] + ". " + (cm[4] || "")).trim(),
      };
    }
    var importPhotos = [];
    photoBlobs.forEach(function (blob, idx) {
      var meta = captions[idx + 1] || {};
      var criterionId = ALL_ITEM_IDS[meta.criterionId] ? meta.criterionId : "";
      var chapter =
        meta.chapter ||
        (criterionId ? Number(String(criterionId).split(".")[0]) : "");
      importPhotos.push({
        bytes: blob.bytes,
        mime: blob.mime || "image/jpeg",
        caption: meta.caption || "Fotografía " + (idx + 1) + " importada del informe Word",
        chapter: chapter || "",
        criterionId: criterionId,
      });
      if (criterionId && actions[criterionId] && !actions[criterionId].photoId) {
        actions[criterionId]._pendingPhotoIndex = idx;
      }
    });

    if (!farm || !date) {
      throw new Error(
        "No se encontró finca o fecha válida en el informe. Revisa el encabezado (fecha AAAA-MM-DD)."
      );
    }
    if (!Object.keys(answers).length) {
      throw new Error("No se encontraron criterios con Sí cumple / No cumple en el documento.");
    }

    var warnings = [];
    if (importPhotos.length) {
      warnings.push(importPhotos.length + " fotografía(s) detectadas en el Word.");
    }
    if (Object.keys(actions).length) {
      warnings.push(Object.keys(actions).length + " acción(es) de seguimiento leídas del plan.");
    }

    var visit = sanitizeVisit(
      {
        farm: farm,
        date: date,
        city: city,
        zone: zone,
        crop: crop,
        technician: technician || responsible,
        responsible: responsible,
        rtc: rtc,
        answers: answers,
        notes: notes,
        recommendations: recommendations,
        measurements: measurements,
        conclusion: conclusion,
        delivery: delivery,
        followup: followup,
        actions: actions,
        photos: [],
        _importPhotos: importPhotos,
      },
      warnings,
      { complete: true }
    );

    return {
      visits: [visit],
      errors: warnings,
      rows: Object.keys(visit.answers).length,
      farmMeta: { name: farm, zone: zone || "Importado", city: city, crop: crop },
      photoCount: importPhotos.length,
      actionCount: Object.keys(visit.actions || {}).length,
    };
  }

  async function ensureFarm(name, responsible, zone) {
    var teamRes = await fetch("/api/team");
    var team = await teamRes.json();
    if (!teamRes.ok) throw new Error(team.error || "No se pudo leer el equipo");
    var farms = team.farms || team || [];
    if (!Array.isArray(farms)) farms = farms.farms || [];
    var existing = farms.find(function (f) {
      return norm(f.name || f.farm || "") === norm(name);
    });
    if (existing) return existing.id || existing.farmId || null;

    var manager = String(responsible || "").trim() || "Responsable importado";
    var farmZone = clampStr(zone || "Importado", 300) || "Importado";
    var create = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "create",
        name: name,
        zone: farmZone,
        managerName: manager,
        contacts: [
          {
            name: manager,
            role: "Responsable local",
            phone: "0000000000",
            email: "importado@care360.local",
            receiveReports: false,
          },
        ],
      }),
    });
    var body = await create.json().catch(function () {
      return {};
    });
    if (!create.ok) {
      if (!/ya existe|duplicate|unique/i.test(body.error || "")) {
        throw new Error(String(body.error || "No se pudo crear la finca " + name).replace(/^400:/, ""));
      }
      return body.id || null;
    }
    return body.id || null;
  }

  async function uploadPhoto(bytes, farmId) {
    var url = "/api/photos" + (farmId ? "?farmId=" + encodeURIComponent(farmId) : "");
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    });
    var body = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error(String(body.error || "No se pudo guardar una fotografía").replace(/^\d+:/, ""));
    }
    if (!body.id) throw new Error("La API de fotos no devolvió un id.");
    return body.id;
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
    var prepared = [];
    var prepErrors = [];
    (visits || []).forEach(function (v, idx) {
      try {
        var copy = Object.assign({}, v);
        if (Array.isArray(v._importPhotos)) copy._importPhotos = v._importPhotos;
        prepared.push(sanitizeVisit(copy, prepErrors, { complete: true }));
      } catch (err) {
        prepErrors.push("Visita " + (idx + 1) + ": " + (err.message || String(err)));
      }
    });
    if (!prepared.length) {
      throw new Error(prepErrors.slice(0, 3).join(" · ") || "No hay visitas válidas para importar.");
    }
    var todo = prepared.filter(function (v) {
      return !seen.has(norm(v.farm) + "|" + v.date);
    });
    if (!todo.length) throw new Error("Todos los aseguramientos ya aparecen con la misma finca y fecha.");
    var saved = [];
    for (var i = 0; i < todo.length; i++) {
      var farmId = await ensureFarm(
        todo[i].farm,
        todo[i].responsible || todo[i].technician,
        todo[i].zone
      );
      var photos = [];
      var importPhotos = Array.isArray(todo[i]._importPhotos) ? todo[i]._importPhotos : [];
      for (var p = 0; p < importPhotos.length; p++) {
        var blob = importPhotos[p];
        if (!blob || !blob.bytes) continue;
        var photoId = await uploadPhoto(blob.bytes, farmId);
        var chapter = Number(blob.chapter);
        photos.push({
          id: photoId,
          caption: clampStr(blob.caption, 2000),
          chapter: Number.isFinite(chapter) && chapter >= 1 && chapter <= 5 ? chapter : "",
          criterionId: ALL_ITEM_IDS[blob.criterionId] ? blob.criterionId : "",
        });
      }
      var actions = Object.assign({}, todo[i].actions || {});
      photos.forEach(function (ph) {
        if (!ph.criterionId || !actions[ph.criterionId]) return;
        if (!actions[ph.criterionId].photoId) {
          actions[ph.criterionId] = Object.assign({}, actions[ph.criterionId], { photoId: ph.id });
        }
      });
      var payload = Object.assign({}, todo[i], {
        photos: photos,
        actions: actions,
      });
      delete payload._importPhotos;
      if (farmId) payload.farmId = farmId;
      payload = sanitizeVisit(payload, [], { complete: true });
      delete payload._importPhotos;
      var res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var body = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        throw new Error(
          String(body.error || "Error al guardar visita de " + todo[i].farm)
            .replace(/^400:/, "")
            .replace(/^422:/, "")
        );
      }
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
        var docx = await parseDocx(file);
        parsed = parseReportText(docx.text, docx.photoBlobs);
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

  function onFarmsTab() {
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
    return false;
  }

  function findFarmsHost() {
    var headings = qa("h1, h2, h3");
    for (var i = 0; i < headings.length; i++) {
      if (/Directorio de fincas|Fincas y equipo/i.test(headings[i].textContent || "")) {
        return (
          headings[i].closest("section, article, .panel, .module-shell, main") ||
          headings[i].parentElement
        );
      }
    }
    var eyebrows = qa(".eyebrow");
    for (var j = 0; j < eyebrows.length; j++) {
      if (/EQUIPO/i.test(eyebrows[j].textContent || "")) {
        return eyebrows[j].closest("section, article, .panel, div") || eyebrows[j].parentElement;
      }
    }
    return q("main") || q("#root");
  }

  function wireImportUi(root) {
    if (!root || root.getAttribute("data-c360-import-wired") === "1") return;
    root.setAttribute("data-c360-import-wired", "1");
    var input = q("input[type=file]", root);
    var status = q(".c360-import-status", root);
    var preview = q(".c360-import-preview", root);
    if (!input || !status || !preview) return;
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
        var warn = (parsed.errors || []).slice(0, 4).join(" · ");
        var v0 = (parsed.visits && parsed.visits[0]) || {};
        var photoCount =
          parsed.photoCount ||
          (v0._importPhotos && v0._importPhotos.length) ||
          (v0.photos && v0.photos.length) ||
          0;
        var actionCount = parsed.actionCount || Object.keys(v0.actions || {}).length || 0;
        var measureCount = Object.keys(v0.measurements || {}).length || 0;
        var scheduleBits = [];
        if (v0.delivery) scheduleBits.push("Entrega " + v0.delivery);
        if (v0.followup) scheduleBits.push("Seguimiento " + v0.followup);
        else if (v0.delivery) scheduleBits.push("Seguimiento sin programar");
        preview.innerHTML =
          "<p><strong>" +
          parsed.visits.length +
          "</strong> aseguramiento(s) listos · " +
          parsed.rows +
          " criterios · <strong>" +
          photoCount +
          "</strong> foto(s) · <strong>" +
          actionCount +
          "</strong> acción(es) de seguimiento" +
          (measureCount ? " · " + measureCount + " mediciones" : "") +
          ".</p>" +
          (scheduleBits.length ? "<p class=\"muted\">" + scheduleBits.join(" · ") + "</p>" : "") +
          (warn ? "<p class=\"notice\">" + warn + "</p>" : "") +
          '<button type="button" class="primary c360-import-go">Importar finca e informes</button>';
        q(".c360-import-go", preview).addEventListener("click", async function () {
          try {
            ui.setStatus("Importando finca, informe, fotos y seguimiento…", false);
            var saved = await saveVisits(pending.visits);
            ui.setStatus(
              saved.length +
                " informe(s) importados con evidencias. Ábrelos en Visitas o revisa el plan en Seguimiento.",
              false
            );
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

  function mountFarmsImport() {
    var existing = q("#c360-farms-import");
    if (!onFarmsTab()) {
      if (existing) existing.remove();
      var tools = q("#c360-farms-tools");
      if (tools) tools.remove();
      return;
    }
    if (existing) {
      wireImportUi(existing);
      return;
    }
    var host = findFarmsHost();
    if (!host) return;
    var panel = document.createElement("section");
    panel.id = "c360-farms-import";
    panel.className = "c360-farms-import no-print";
    panel.setAttribute("data-c360-farms-import", "1");
    panel.setAttribute("aria-label", "Importar finca e informes");
    panel.innerHTML =
      '<div class="c360-import-box">' +
      '<div class="c360-import-head">' +
      "<strong>Importar finca e informes</strong>" +
      "<p class=\"c360-import-lead\">Sube Excel/CSV, Word o PDF. Se crea la finca si falta; el informe queda editable en Visitas con fotos, mediciones y plan de seguimiento.</p>" +
      "</div>" +
      '<label class="c360-import-file"><span>Elegir archivo</span>' +
      '<input type="file" class="c360-import-input" accept=".xlsx,.csv,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />' +
      "</label>" +
      '<div class="c360-import-status muted" hidden></div>' +
      '<div class="c360-import-preview" hidden></div>' +
      "</div>";
    var heading = null;
    var heads = qa("h1, h2", host);
    for (var i = 0; i < heads.length; i++) {
      if (/Directorio de fincas|Fincas/i.test(heads[i].textContent || "")) {
        heading = heads[i];
        break;
      }
    }
    var tools = q("#c360-farms-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.id = "c360-farms-tools";
      tools.className = "c360-farms-tools no-print";
      tools.innerHTML = "<p class=\"c360-farms-tools-title\">Herramientas de finca</p>";
      if (heading && heading.parentElement) {
        heading.parentElement.insertAdjacentElement("afterend", tools);
      } else {
        host.insertAdjacentElement("afterbegin", tools);
      }
    }
    tools.appendChild(panel);
    wireImportUi(panel);
  }

  function enhanceImportPanel() {
    var details = q("details.matrix-import");
    if (details) {
      details.setAttribute("hidden", "hidden");
      details.style.display = "none";
    }
    mountFarmsImport();
  }

  // Also ensure farm on native matrix import POSTs.
  var nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    try {
      var url = String(input && input.url ? input.url : input || "");
      if (/\/api\/visits\/?$/.test(url) && init && String(init.method || "GET").toUpperCase() === "POST" && init.body) {
        var payload = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        if (payload && payload.farm) {
          await ensureFarm(payload.farm, payload.responsible || payload.technician, payload.zone);
        }
      }
    } catch (err) {
      // Don't block native flow on ensureFarm preview errors; rethrow only if create failed hard.
      if (err && /No se pudo crear la finca|Contactos inválidos|Completa nombre/i.test(err.message || "")) throw err;
    }
    return nativeFetch(input, init);
  };

  window.C360Import = {
    handleFile: handleFile,
    saveVisits: saveVisits,
    rowsToVisits: rowsToVisits,
    parseReportText: parseReportText,
    sanitizeVisit: sanitizeVisit,
    CHAPTER_ITEMS: CHAPTER_ITEMS,
  };

  function tick() {
    enhanceImportPanel();
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
