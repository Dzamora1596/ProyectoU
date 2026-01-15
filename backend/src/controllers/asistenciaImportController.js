// asistenciaImportController.js
const XLSX = require("xlsx");
const db = require("../config/db");

/** -----------------------------
 * Helpers básicos
 * ------------------------------ */
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

/** -----------------------------
 * Hora / Fecha
 * ------------------------------ */
function convertirHora(v) {
  if (v === null || v === undefined) return "00:00:00";

  // Excel time fraction (0.0 - 1.0)
  if (typeof v === "number") {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = Math.floor(totalSeconds / 3600) % 24;
    const mm = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  const str = String(v).trim();
  if (!str) return "00:00:00";

  // "09:30 AM"
  const parts = str.split(" ");
  if (parts.length === 2 && parts[0].includes(":")) {
    const [time, ampmRaw] = parts;
    const ampm = String(ampmRaw || "").toUpperCase();
    let [hh, mm] = time.split(":").map(Number);

    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  // "09:30"
  if (str.includes(":")) {
    const [hh, mm] = str.split(":");
    return `${String(Number(hh) || 0).padStart(2, "0")}:${String(Number(mm) || 0).padStart(2, "0")}:00`;
  }

  return "00:00:00";
}

function convertirFecha(v) {
  if (v === null || v === undefined) return null;

  // Date object
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Excel serial date
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const y = d.y;
    const m = String(d.m).padStart(2, "0");
    const day = String(d.d).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const str = String(v).trim();
  if (!str) return null;

  // dd-mm-yy, dd/mm/yy, dd-mm-yyyy...
  const sep = str.includes("-") ? "-" : str.includes("/") ? "/" : null;
  if (!sep) return null;

  const parts = str.split(sep).map((x) => String(x || "").trim());
  if (parts.length < 3) return null;

  const dd = parts[0].padStart(2, "0");
  const mm = parts[1].padStart(2, "0");
  let yy = parts[2];

  if (yy.length === 2) yy = `20${yy}`;
  if (yy.length !== 4) return null;

  return `${yy}-${mm}-${dd}`;
}

/** -----------------------------
 * Headers
 * ------------------------------ */
function encontrarFilaHeadersDesde(aoa, startIdx) {
  for (let i = startIdx; i < aoa.length; i++) {
    const row = (aoa[i] || []).map(norm);
    // EXACTOS: date / in / out
    if (row.includes("date") && row.includes("in") && row.includes("out")) return i;
  }
  return -1;
}

function encontrarIndicesHeaders(headersNorm) {
  const idxDate = headersNorm.indexOf("date");
  const idxIn = headersNorm.indexOf("in");
  const idxOut = headersNorm.indexOf("out");
  const idxNote = headersNorm.indexOf("note");
  return { idxDate, idxIn, idxOut, idxNote };
}

/** -----------------------------
 * Período
 * ------------------------------ */
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

/** -----------------------------
 * Missing
 * ------------------------------ */
function buscarMissingEnFila(row) {
  for (const cell of row || []) {
    const s = String(cell || "").trim();
    if (!s) continue;
    if (s.toLowerCase().includes("missing")) return s;
  }
  return "";
}

/** -----------------------------
 * Empleado
 * ------------------------------ */
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

/** -----------------------------
 * PARSER MULTI-EMPLEADO
 * ------------------------------ */
function esDiaSemana(v) {
  const s = String(v || "").trim().toLowerCase();
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(s);
}

/**
 * ✅ CLAVE:
 * - Si la fila inicia con MON/TUE/... entonces la FECHA está corrida +1 (col B),
 *   pero IN y OUT NO se corren (siguen siendo col C y D).
 * - Esto evita leer Work Time/Daily Total por error.
 */
function extraerRegistroFila(dataRow, idxDate, idxIn, idxOut, idxNote) {
  const row = dataRow || [];

  const filaDia = esDiaSemana(row[0]);

  // Fecha: si hay día de semana, la fecha está a la derecha (B)
  let rawFecha = filaDia ? row[idxDate + 1] : row[idxDate];

  // Fallback: a veces hay una columna vacía y la fecha cae a la derecha aunque no haya MON
  if (!convertirFecha(rawFecha) && convertirFecha(row[idxDate + 1])) {
    rawFecha = row[idxDate + 1];
  }

  // IN/OUT: SIEMPRE idxIn/idxOut (no aplicar shift)
  const rawIn = row[idxIn];
  const rawOut = row[idxOut];

  // Note: en tu formato típico no se corre; si hay MON igual queda en su columna
  let rawNote = "";
  if (idxNote >= 0) rawNote = row[idxNote];

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

/**
 * Extrae bloques:
 *  - Busca fila que contenga "Employee"
 *  - Agarra empleadoTexto de esa fila
 *  - Busca headers Date/IN/OUT después
 *  - Lee filas hasta antes del siguiente Employee/Pay Period
 */
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

    // si no existen IN/OUT exactos, aborta este bloque
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

/** -----------------------------
 * IMPORT PRINCIPAL
 * ------------------------------ */
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
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const bloques = extraerBloquesDesdeHoja(aoa);

    if (!bloques.length) {
      return res.status(400).json({
        ok: false,
        mensaje: "No se detectaron bloques de empleados (Employee + tabla Date/IN/OUT).",
      });
    }

    // cache periodo por fecha
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
        // Mantener Asistencia_NoRegistrada
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
