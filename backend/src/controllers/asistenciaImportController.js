// asistenciaImportController.js
const XLSX = require("xlsx");
const db = require("../config/db");

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function convertirHora(v) {
  if (v === null || v === undefined) return "00:00:00";

  if (typeof v === "number") {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = Math.floor(totalSeconds / 3600) % 24;
    const mm = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  const str = String(v).trim();
  if (!str) return "00:00:00";

  const parts = str.split(" ");
  if (parts.length === 2 && parts[0].includes(":")) {
    const [time, ampm] = parts;
    let [hh, mm] = time.split(":").map(Number);
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  if (str.includes(":")) {
    const [hh, mm] = str.split(":");
    return `${String(Number(hh) || 0).padStart(2, "0")}:${String(Number(mm) || 0).padStart(2, "0")}:00`;
  }

  return "00:00:00";
}

function convertirFecha(v) {
  if (v === null || v === undefined) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

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

  const sep = str.includes("-") ? "-" : str.includes("/") ? "/" : null;
  if (!sep) return null;

  const parts = str.split(sep);
  if (parts.length < 3) return null;

  
  const dd = parts[0].padStart(2, "0");
  const mm = parts[1].padStart(2, "0");
  let yy = parts[2];
  if (yy.length === 2) yy = `20${yy}`;
  if (yy.length !== 4) return null;

  return `${yy}-${mm}-${dd}`;
}

function encontrarFilaHeaders(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = (aoa[i] || []).map(norm);
    if (row.includes("date") && row.includes("in") && row.includes("out")) return i;
  }
  return -1;
}

async function obtenerPeriodoIdPorFecha(fechaYYYYMMDD) {
  const [rows] = await db.query(
    `SELECT idCatalogo_Periodo
     FROM Catalogo_Periodo
     WHERE Activo = 1
       AND ? BETWEEN Fecha_Inicio AND Fecha_Fin
     LIMIT 1`,
    [fechaYYYYMMDD]
  );
  return rows?.[0]?.idCatalogo_Periodo || 0; // 0 = sin periodo (evita NULL)
}

function buscarMissingEnFila(row) {
  for (const cell of row) {
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

function obtenerTextoEmpleadoDesdeExcel(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = norm(row[j]);
      if (cell === "employee" || cell.includes("employee")) {
        const candidato = row[j + 1] ?? "";
        const s = String(candidato || "").trim();
        if (s) return s;

        for (let k = j + 1; k < row.length; k++) {
          const ss = String(row[k] || "").trim();
          if (ss) return ss;
        }
      }
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

exports.importarDesdeExcel = async (req, res) => {
  try {
    let empleadoId = req.body?.empleadoId ? Number(req.body.empleadoId) : 0; // ✅ opcional
    const periodoIdBody = req.body?.periodoId ? Number(req.body.periodoId) : 0;

    if (!req.file) {
      return res.status(400).json({ ok: false, mensaje: "Debe enviar un archivo Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    
    const empleadoTexto = obtenerTextoEmpleadoDesdeExcel(aoa);

    let empleadoDetectado = empleadoId;

    if (!empleadoDetectado) {
      empleadoDetectado = extraerEmpleadoIdDeTextoEmpleado(empleadoTexto);

      if (!empleadoDetectado) {
        empleadoDetectado = await buscarEmpleadoIdPorNombre(empleadoTexto);
      }
    }

    const headerRowIndex = encontrarFilaHeaders(aoa);
    if (headerRowIndex === -1) {
      return res.status(400).json({
        ok: false,
        mensaje: "No se encontró la fila de encabezados (Date, IN, OUT).",
      });
    }

    const headers = aoa[headerRowIndex].map(norm);
    const idxDate = headers.indexOf("date");
    const idxIn = headers.indexOf("in");
    const idxOut = headers.indexOf("out");
    const idxNote = headers.indexOf("note");

    const asistencias = [];

    for (let i = headerRowIndex + 1; i < aoa.length; i++) {
      const row = aoa[i];

      const firstCell = norm(row[0]);
      if (firstCell.includes("pay period") || firstCell.includes("employee")) continue;

      let rawFecha = row[idxDate];
      let rawIn = row[idxIn];
      let rawOut = row[idxOut];
      let rawNote = idxNote >= 0 ? row[idxNote] : "";

      const filaTieneDia = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(
        String(row[0] || "").trim().toLowerCase()
      );

      if (filaTieneDia) {
        rawFecha = row[idxDate + 1];
        rawIn = row[idxIn + 1];
        rawOut = row[idxOut + 1];
        if (idxNote >= 0) rawNote = row[idxNote + 1];
      }

      if (!String(rawNote || "").trim()) {
        rawNote = buscarMissingEnFila(row);
      }

      const fecha = convertirFecha(rawFecha);
      if (!fecha) continue;

      const entrada = convertirHora(rawIn);
      const salida = convertirHora(rawOut);
      const ausente = entrada === "00:00:00" && salida === "00:00:00" ? 1 : 0;

      asistencias.push({
        Fecha: fecha,
        Entrada: entrada,
        Salida: salida,
        Tardia: 0,
        Ausente: ausente,
        Validado: 0,
        Observacion: String(rawNote || "").trim(),
      });
    }

    if (asistencias.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "No se encontraron filas válidas para importar." });
    }

    
    let periodoId = periodoIdBody;
    if (!periodoId) {
      periodoId = await obtenerPeriodoIdPorFecha(asistencias[0].Fecha);
    }

    
    if (!periodoId) periodoId = 0;

    let insertados = 0;
    let actualizados = 0;
    let noRegistrados = 0;

    
    if (empleadoDetectado) {
      for (const a of asistencias) {
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
        }
      }
    } else {
      
      for (const a of asistencias) {
        await db.query(
          `INSERT INTO Asistencia_NoRegistrada
           (Empleado_idEmpleado, EmpleadoTexto, Fecha, Entrada, Salida, Tardia, Ausente, Validado, Observacion, Catalogo_Periodo_idCatalogo_Periodo, Activo)
           VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            empleadoTexto || "NO REGISTRADO",
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
      }
    }

    return res.json({
      ok: true,
      mensaje: "Importación completada",
      empleadoIdDetectado: empleadoDetectado || 0,
      empleadoTexto: empleadoTexto || "",
      periodoId,
      totalLeidas: asistencias.length,
      insertados,
      actualizados,
      noRegistrados,
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
