// asistenciaImportController.js
const XLSX = require("xlsx");
const db = require("../config/db");

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isVacio(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

function esSoloDosPuntos(v) {
  const s = String(v ?? "").trim();
  return s === ":" || norm(s) === ":";
}

function rowTieneTexto(row, texto) {
  const t = norm(texto);
  return (row || []).some((c) => norm(c).includes(t));
}

function rowEsVacia(row) {
  const r = row || [];
  return r.length === 0 || r.every((c) => isVacio(c));
}

// ===== HORAS =====
function convertirHora(v) {
  if (v === null || v === undefined) return "00:00:00";

  // Excel serial time (fracción del día)
  if (typeof v === "number") {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = Math.floor(totalSeconds / 3600) % 24;
    const mm = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  let str = String(v).trim();
  if (!str) return "00:00:00";

  // Normaliza "a. m." / "p. m." / "AM" / "PM"
  str = str
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  // "a m" / "p m" -> "am"/"pm"
  str = str.replace(/\b(p|a)\s*m\b/g, (_, x) => `${x}m`);

  // HH:MM am/pm
  const m = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (m) {
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const ampm = (m[3] || "").toLowerCase();

    if (Number.isNaN(hh) || Number.isNaN(mm)) return "00:00:00";

    if (ampm === "pm" && hh < 12) hh += 12;
    if (ampm === "am" && hh === 12) hh = 0;

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  // HH:MM (sin AM/PM)
  if (str.includes(":")) {
    const [hh, mm] = str.split(":");
    return `${String(Number(hh) || 0).padStart(2, "0")}:${String(Number(mm) || 0).padStart(2, "0")}:00`;
  }

  return "00:00:00";
}

// ===== FECHAS (CLAVE DEL ARREGLO) =====
// Mapeo del día en el Excel (col 0) a getUTCDay() de JS
const DOW_TO_UTC = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function esDiaSemana(v) {
  const s = String(v || "").trim().toLowerCase();
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(s);
}

function pad2(n) {
  return String(Number(n) || 0).padStart(2, "0");
}

function ymdFromParts(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function validarYMD(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  if (yy < 1900 || yy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;

  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  return (
    dt.getUTCFullYear() === yy &&
    dt.getUTCMonth() + 1 === mm &&
    dt.getUTCDate() === dd
  );
}

function utcDowFromYYYYMMDD(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!validarYMD(y, m, d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay();
}

// ✅ Esta versión elimina la ambigüedad 02/01..12/01 usando:
// 1) raw:true para que Excel fechas salgan como número (ideal)
// 2) si llega como string dd/mm/yyyy (o mm/dd/yyyy), y el día de semana está disponible (THU/FRI...),
//    prueba ambas interpretaciones cuando es ambiguo y elige la que calza con el DOW.
function convertirFecha(v, diaSemanaHint = null) {
  if (v === null || v === undefined) return null;

  // Date object
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = v.getMonth() + 1;
    const d = v.getDate();
    return ymdFromParts(y, m, d);
  }

  // Excel serial date (número) -> NO ambiguo
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const y = d.y;
    const m = d.m;
    const day = d.d;
    if (!validarYMD(y, m, day)) return null;
    return ymdFromParts(y, m, day);
  }

  let str = String(v).trim();
  if (!str) return null;

  // ISO-like "YYYY-MM-DD" (opcionalmente con hora)
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    if (!validarYMD(y, m, d)) return null;
    return ymdFromParts(y, m, d);
  }

  const sep = str.includes("-") ? "-" : str.includes("/") ? "/" : null;
  if (!sep) return null;

  const parts = str.split(sep).map((x) => String(x || "").trim());
  if (parts.length < 3) return null;

  const p1 = Number(parts[0]); // puede ser dd o mm
  const p2 = Number(parts[1]); // puede ser mm o dd
  let y = String(parts[2]).trim();

  if (!Number.isFinite(p1) || !Number.isFinite(p2) || !y) return null;

  // Año 2 dígitos -> ventana 70/30
  let year = Number(y);
  if (y.length === 2) {
    year = year >= 70 ? 1900 + year : 2000 + year;
  }
  if (!Number.isFinite(year) || String(year).length !== 4) return null;

  const make = (month, day) => {
    if (!validarYMD(year, month, day)) return null;
    return ymdFromParts(year, month, day);
  };

  // Si no es ambiguo, resolver directo:
  // p1 > 12 => p1 es día (D/M)
  if (p1 > 12 && p2 <= 12) return make(p2, p1);

  // p2 > 12 => p2 es día (M/D)
  if (p2 > 12 && p1 <= 12) return make(p1, p2);

  // Ambiguo (1..12 / 1..12)
  // ✅ Si tenemos hint de día de semana (THU/FRI...), usamos eso para escoger.
  const hint = String(diaSemanaHint || "").trim().toLowerCase();
  const hintDow = hint && DOW_TO_UTC[hint] !== undefined ? DOW_TO_UTC[hint] : null;

  const candDMY = make(p2, p1); // D/M
  const candMDY = make(p1, p2); // M/D

  if (hintDow !== null) {
    const dowDMY = candDMY ? utcDowFromYYYYMMDD(candDMY) : null;
    const dowMDY = candMDY ? utcDowFromYYYYMMDD(candMDY) : null;

    // Preferir la que calza con el DOW del archivo
    if (dowDMY === hintDow && dowMDY !== hintDow) return candDMY;
    if (dowMDY === hintDow && dowDMY !== hintDow) return candMDY;

    // Si ambas calzan (raro) o ninguna calza, default D/M (CR)
    return candDMY || candMDY || null;
  }

  // Sin hint, default D/M (Costa Rica)
  return candDMY || candMDY || null;
}

// ===== HEADERS =====
function encontrarFilaHeadersDesde(aoa, startIdx) {
  for (let i = startIdx; i < aoa.length; i++) {
    const row = (aoa[i] || []).map(norm);

    const hasDate = row.some((x) => x === "date" || x.startsWith("date"));
    const hasIn = row.some((x) => x === "in" || x.startsWith("in "));
    const hasOut = row.some((x) => x === "out" || x.startsWith("out "));

    if (hasDate && hasIn && hasOut) return i;
  }
  return -1;
}

function encontrarIndicesHeaders(headersNorm) {
  const findIdx = (predicate) => headersNorm.findIndex(predicate);

  const idxDate = findIdx((h) => h === "date" || h.startsWith("date"));
  const idxIn = findIdx((h) => h === "in" || h.startsWith("in "));
  const idxOut = findIdx((h) => h === "out" || h.startsWith("out "));
  const idxNote = findIdx((h) => h === "note" || h.startsWith("note"));

  return { idxDate, idxIn, idxOut, idxNote };
}

// ===== DB helpers =====
async function obtenerPeriodoIdPorFecha(fechaYYYYMMDD) {
  const [rows] = await db.query(
    `SELECT idCatalogo_Periodo
     FROM Catalogo_Periodo
     WHERE Activo = 1
       AND ? BETWEEN Fecha_Inicio AND Fecha_Fin
     LIMIT 1`,
    [fechaYYYYMMDD]
  );
  return rows?.[0]?.idCatalogo_Periodo || 0;
}

function buscarMissingEnFila(row) {
  for (const cell of row || []) {
    const s = String(cell || "").trim();
    if (!s) continue;
    if (s.toLowerCase().includes("missing")) return s;
  }
  return "";
}

function extraerEmpleadoIdDeTextoEmpleado(texto) {
  const s = String(texto || "").trim();
  if (!s) return 0;
  const m = s.match(/\((\d+)\)/);
  if (m && m[1]) return Number(m[1]) || 0;
  return 0;
}

function obtenerEmpleadoTextoEnFila(row, colEmployee) {
  const r = row || [];
  let mejor = "";

  for (let k = colEmployee + 1; k < r.length; k++) {
    const raw = String(r[k] ?? "").trim();
    if (!raw) continue;
    if (esSoloDosPuntos(raw)) continue;

    if (/\(\d+\)/.test(raw)) return raw;
    if (!mejor) mejor = raw;
  }

  return mejor || "";
}

function buscarCualquierCeldaConId(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i] || [];
    for (let j = 0; j < row.length; j++) {
      const raw = String(row[j] ?? "").trim();
      if (!raw) continue;
      if (/\(\d+\)/.test(raw)) return raw;
    }
  }
  return "";
}

async function buscarEmpleadoIdPorNombre(textoEmpleado) {
  const limpio = String(textoEmpleado || "")
    .replace(/\(\d+\)/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!limpio) return 0;

  const [rowsExact] = await db.query(
    `
    SELECT e.idEmpleado
    FROM Empleado e
    JOIN Persona p ON p.idPersona = e.Persona_idPersona
    WHERE e.Activo = 1 AND p.Activo = 1
      AND CONCAT(p.Nombre, ' ', p.Apellido1, ' ', p.Apellido2) = ?
    LIMIT 1
    `,
    [limpio]
  );
  if (rowsExact?.[0]?.idEmpleado) return Number(rowsExact[0].idEmpleado) || 0;

  const [rowsLike] = await db.query(
    `
    SELECT e.idEmpleado
    FROM Empleado e
    JOIN Persona p ON p.idPersona = e.Persona_idPersona
    WHERE e.Activo = 1 AND p.Activo = 1
      AND CONCAT(p.Nombre, ' ', p.Apellido1, ' ', p.Apellido2) LIKE ?
    ORDER BY e.idEmpleado ASC
    LIMIT 1
    `,
    [`%${limpio}%`]
  );
  if (rowsLike?.[0]?.idEmpleado) return Number(rowsLike[0].idEmpleado) || 0;

  return 0;
}

async function existeEmpleado(idEmpleado) {
  const id = Number(idEmpleado) || 0;
  if (!id) return false;

  const [rows] = await db.query(
    `SELECT 1 FROM Empleado WHERE idEmpleado = ? AND Activo = 1 LIMIT 1`,
    [id]
  );
  return rows.length > 0;
}

// ===== EXTRACCIÓN FILAS =====
function extraerRegistroFila(dataRow, idxDate, idxIn, idxOut, idxNote) {
  const row = dataRow || [];

  // ✅ Formato fijo (como tu captura): DOW | DATE | IN | OUT
  // Usamos el DOW (row[0]) como "hint" para desambiguar 02/01..12/01.
  if (esDiaSemana(row[0])) {
    const fecha = convertirFecha(row[1], row[0]);
    if (!fecha) return null;

    const entrada = convertirHora(row[2]);
    const salida = convertirHora(row[3]);

    let rawNote = String(row[6] ?? "").trim();
    if (!rawNote) rawNote = buscarMissingEnFila(row);

    const ausente = entrada === "00:00:00" && salida === "00:00:00" ? 1 : 0;

    return {
      Fecha: fecha,
      Entrada: entrada,
      Salida: salida,
      Tardia: 0,
      Ausente: ausente,
      Validado: 0,
      Observacion: String(rawNote || "").trim(),
    };
  }

  // Formato general con headers Date/IN/OUT
  let shift = 0;
  const fecha0 = convertirFecha(row[idxDate]);
  const fecha1 = convertirFecha(row[idxDate + 1]);
  if (!fecha0 && fecha1) shift = 1;

  let rawFecha = row[idxDate + shift];
  if (!convertirFecha(rawFecha) && convertirFecha(row[idxDate + shift + 1])) {
    rawFecha = row[idxDate + shift + 1];
  }

  const rawIn = row[idxIn + shift];
  const rawOut = row[idxOut + shift];

  let rawNote = "";
  if (idxNote >= 0) rawNote = row[idxNote + shift];
  if (!String(rawNote || "").trim()) rawNote = buscarMissingEnFila(row);

  const fecha = convertirFecha(rawFecha);
  if (!fecha) return null;

  const entrada = convertirHora(rawIn);
  const salida = convertirHora(rawOut);

  const ausente = entrada === "00:00:00" && salida === "00:00:00" ? 1 : 0;

  return {
    Fecha: fecha,
    Entrada: entrada,
    Salida: salida,
    Tardia: 0,
    Ausente: ausente,
    Validado: 0,
    Observacion: String(rawNote || "").trim(),
  };
}

function extraerBloquesDesdeHoja(aoa) {
  const bloques = [];
  let i = 0;

  while (i < aoa.length) {
    const row = aoa[i] || [];

    const idxEmployeeCol = row.findIndex((c) => {
      const v = norm(c);
      return v === "employee" || v.startsWith("employee");
    });

    if (idxEmployeeCol === -1) {
      i++;
      continue;
    }

    let empleadoTexto = obtenerEmpleadoTextoEnFila(row, idxEmployeeCol);
    if (!empleadoTexto) empleadoTexto = buscarCualquierCeldaConId(aoa);

    const headerRowIndex = encontrarFilaHeadersDesde(aoa, i);
    if (headerRowIndex === -1) {
      i++;
      continue;
    }

    const headersNorm = (aoa[headerRowIndex] || []).map(norm);
    const { idxDate, idxIn, idxOut, idxNote } = encontrarIndicesHeaders(headersNorm);

    if (idxDate < 0 || idxIn < 0 || idxOut < 0) {
      i = headerRowIndex + 1;
      continue;
    }

    const asistencias = [];
    let r = headerRowIndex + 1;

    while (r < aoa.length) {
      const dataRow = aoa[r] || [];

      if (rowTieneTexto(dataRow, "employee") || rowTieneTexto(dataRow, "pay period")) break;
      if (rowEsVacia(dataRow)) {
        r++;
        continue;
      }

      const reg = extraerRegistroFila(dataRow, idxDate, idxIn, idxOut, idxNote);
      if (reg) asistencias.push(reg);

      r++;
    }

    bloques.push({
      empleadoTexto: String(empleadoTexto || "").trim(),
      headerRowIndex,
      headersNorm,
      asistencias,
    });

    i = r;
  }

  return bloques;
}

// ===== CONTROLLER =====
exports.importarDesdeExcel = async (req, res) => {
  try {
    const empleadoIdBody = req.body?.empleadoId ? Number(req.body.empleadoId) : 0;
    const periodoIdBody = req.body?.periodoId ? Number(req.body.periodoId) : 0;

    if (!req.file) {
      return res.status(400).json({ ok: false, mensaje: "Debe enviar un archivo Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // ✅ CLAVE: raw:true para que las fechas/hora de Excel salgan como NÚMEROS (serial) y no strings ambiguos por locale
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

    const bloques = extraerBloquesDesdeHoja(aoa);

    if (!bloques.length) {
      return res.status(400).json({
        ok: false,
        mensaje: "No se detectaron bloques de empleados (Employee + tabla Date/IN/OUT).",
      });
    }

    const cachePeriodo = new Map();
    async function periodoPorFecha(fecha) {
      if (periodoIdBody) return periodoIdBody;
      if (cachePeriodo.has(fecha)) return cachePeriodo.get(fecha);
      const pid = await obtenerPeriodoIdPorFecha(fecha);
      cachePeriodo.set(fecha, pid || 0);
      return pid || 0;
    }

    let insertados = 0;
    let actualizados = 0;
    let noRegistrados = 0;

    const resumenBloques = [];

    for (let b = 0; b < bloques.length; b++) {
      const bloque = bloques[b];

      if (!bloque.asistencias || bloque.asistencias.length === 0) {
        resumenBloques.push({
          empleadoTexto: bloque.empleadoTexto || "",
          empleadoIdDetectado: 0,
          totalLeidas: 0,
          insertados: 0,
          actualizados: 0,
          noRegistrados: 0,
          mensaje: "Bloque sin filas válidas",
        });
        continue;
      }

      const empleadoIdExcel = extraerEmpleadoIdDeTextoEmpleado(bloque.empleadoTexto);

      let empleadoDetectado = 0;
      if (empleadoIdExcel) empleadoDetectado = empleadoIdExcel;
      else if (empleadoIdBody && bloques.length === 1) empleadoDetectado = empleadoIdBody;
      else empleadoDetectado = await buscarEmpleadoIdPorNombre(bloque.empleadoTexto);

      const empleadoExiste = empleadoDetectado ? await existeEmpleado(empleadoDetectado) : false;
      if (empleadoDetectado && !empleadoExiste) empleadoDetectado = 0;

      let insB = 0;
      let updB = 0;
      let nrB = 0;

      if (empleadoDetectado) {
        for (const a of bloque.asistencias) {
          const periodoId = await periodoPorFecha(a.Fecha);

          const [existe] = await db.query(
            `SELECT idAsistencia
             FROM Asistencia
             WHERE Empleado_idEmpleado = ?
               AND Fecha = ?
               AND Catalogo_Periodo_idCatalogo_Periodo = ?
               AND Activo = 1
             LIMIT 1`,
            [empleadoDetectado, a.Fecha, periodoId]
          );

          if (existe.length > 0) {
            const idAsistencia = existe[0].idAsistencia;

            await db.query(
              `UPDATE Asistencia
               SET Entrada = ?,
                   Salida = ?,
                   Tardia = ?,
                   Ausente = ?,
                   Validado = ?,
                   Observacion = ?
               WHERE idAsistencia = ?`,
              [a.Entrada, a.Salida, a.Tardia, a.Ausente, a.Validado, a.Observacion, idAsistencia]
            );

            actualizados++;
            updB++;
          } else {
            await db.query(
              `INSERT INTO Asistencia
               (Empleado_idEmpleado, Fecha, Entrada, Salida, Tardia, Ausente, Validado, Observacion, Catalogo_Periodo_idCatalogo_Periodo, Activo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                empleadoDetectado,
                a.Fecha,
                a.Entrada,
                a.Salida,
                a.Tardia,
                a.Ausente,
                a.Validado,
                a.Observacion,
                periodoId,
              ]
            );

            insertados++;
            insB++;
          }
        }
      } else {
        const textoFinal = String(bloque.empleadoTexto || "").trim() || "NO REGISTRADO";

        for (const a of bloque.asistencias) {
          const periodoId = await periodoPorFecha(a.Fecha);

          await db.query(
            `INSERT INTO Asistencia_NoRegistrada
             (Empleado_idEmpleado, EmpleadoTexto, Fecha, Entrada, Salida, Tardia, Ausente, Validado, Observacion, Catalogo_Periodo_idCatalogo_Periodo, Activo)
             VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              textoFinal,
              a.Fecha,
              a.Entrada,
              a.Salida,
              a.Tardia,
              a.Ausente,
              a.Validado,
              a.Observacion || "",
              periodoId,
            ]
          );

          noRegistrados++;
          nrB++;
        }
      }

      resumenBloques.push({
        empleadoTexto: bloque.empleadoTexto || "",
        empleadoIdDetectado: empleadoDetectado || 0,
        totalLeidas: bloque.asistencias.length,
        insertados: insB,
        actualizados: updB,
        noRegistrados: nrB,
      });
    }

    const totalLeidas = resumenBloques.reduce((acc, x) => acc + (x.totalLeidas || 0), 0);

    return res.json({
      ok: true,
      mensaje: "Importación completada",
      totalBloques: resumenBloques.length,
      totalLeidas,
      insertados,
      actualizados,
      noRegistrados,
      resumenBloques,
    });
  } catch (error) {
    console.error("Error importando excel:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error importando y guardando asistencias",
      error: error.message,
    });
  }
};
