// Codigo para el controllador de asistencias
const db = require("../config/db");

//helpers encargados de normalizar y convertir datos

function bitToBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

function toDate(v) {
  const s = String(v ?? "").trim();
  return s.slice(0, 10); // Año-Mes-Día
}

function toTime(v) {
  const s = String(v ?? "").trim();
  if (!s) return "00:00:00";
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return "00:00:00";
}

function normalizarPayload(body) {
  const ausente = !!body.ausente;

  const entrada = ausente ? "00:00:00" : toTime(body.entrada);
  const salida = ausente ? "00:00:00" : toTime(body.salida);

  // si ausente => tardia = 0
  const tardia = ausente ? false : !!body.tardia;

  const validado = !!body.validado;
  const observacion = String(body.observacion ?? "");

  return { entrada, salida, ausente, tardia, validado, observacion };
}

function getEmpleadoIdFromBody(body) {
  // Me permite aceptar varias variantes de nombres
  return Number(body?.Empleado_idEmpleado ?? body?.empleadoId ?? body?.EmpleadoId ?? 0);
}

// endpoints para las rutas de asistencias

//Get asistencias de colaboradores 
const listarColaboradores = async (req, res) => {
  try {
    const buscar = String(req.query.buscar ?? "").trim();
    const like = `%${buscar}%`;

    const [rows] = await db.query(
      `
      SELECT
        e.idEmpleado,
        p.idPersona,
        p.Nombre,
        p.Apellido1,
        p.Apellido2
      FROM Empleado e
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      WHERE e.Activo = 1
        AND p.Activo = 1
        AND (
          ? = '' OR
          CAST(e.idEmpleado AS CHAR) LIKE ? OR
          CAST(p.idPersona AS CHAR) LIKE ? OR
          CONCAT(p.Nombre,' ',p.Apellido1,' ',p.Apellido2) LIKE ?
        )
      ORDER BY e.idEmpleado ASC
      `,
      [buscar, like, like, like]
    );

    const colaboradores = rows.map((r) => ({
      idEmpleado: r.idEmpleado,
      personaId: r.idPersona,
      nombreCompleto: `${r.Nombre} ${r.Apellido1} ${r.Apellido2}`.trim(),
    }));

    return res.json({ ok: true, colaboradores });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando colaboradores",
      error: String(e),
    });
  }
};

//Get asistencias por empleado y rango de fechas
const listarAsistenciasPorEmpleado = async (req, res) => {
  try {
    const empleadoId = Number(req.params.empleadoId);
    const { desde, hasta } = req.query;

    if (!empleadoId || !desde || !hasta) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan parámetros: empleadoId, desde, hasta",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        idAsistencia,
        Empleado_idEmpleado,
        Fecha,
        Entrada,
        Salida,
        Tardia,
        Ausente,
        Validado,
        Observacion,
        Activo
      FROM Asistencia
      WHERE Empleado_idEmpleado = ?
        AND Activo = 1
        AND Fecha BETWEEN ? AND ?
      ORDER BY Fecha ASC
      `,
      [empleadoId, toDate(desde), toDate(hasta)]
    );

    //por cada fila, mapea el objeto asistencia
    const asistencias = rows.map((r) => ({
      idAsistencia: r.idAsistencia,
      Empleado_idEmpleado: r.Empleado_idEmpleado,
      fecha: String(r.Fecha).slice(0, 10),
      entrada: r.Entrada ? String(r.Entrada) : "00:00:00",
      salida: r.Salida ? String(r.Salida) : "00:00:00",
      tardia: bitToBool(r.Tardia),
      ausente: bitToBool(r.Ausente),
      validado: bitToBool(r.Validado),
      observacion: r.Observacion ?? "",
      activo: bitToBool(r.Activo),
    }));

    return res.json({ ok: true, asistencias });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando asistencias",
      error: String(e),
    });
  }
};

//Crear nueva asistencia
const crearAsistencia = async (req, res) => {
  try {
    const Empleado_idEmpleado = getEmpleadoIdFromBody(req.body);
    const fecha = toDate(req.body.fecha);

    if (!Empleado_idEmpleado || !fecha) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos requeridos: Empleado_idEmpleado y fecha",
      });
    }

    // validar que el empleado exista
    const [e] = await db.query(`SELECT idEmpleado FROM Empleado WHERE idEmpleado = ?`, [
      Empleado_idEmpleado,
    ]);
    if (!e.length) {
      return res.status(400).json({ ok: false, mensaje: "Empleado no existe." });
    }
    // normalizar payload, payload es un objeto con los datos de la asistencia
    const payload = normalizarPayload(req.body);

    // Confirma si existe una asistencia activa para esa fecha
    const [ex] = await db.query(
      `
      SELECT idAsistencia
      FROM Asistencia
      WHERE Empleado_idEmpleado = ? AND Fecha = ? AND Activo = 1
      LIMIT 1
      `,
      [Empleado_idEmpleado, fecha]
    );

    if (ex.length) {
      const idAsistencia = ex[0].idAsistencia;

      const [r] = await db.query(
        `
        UPDATE Asistencia
        SET Entrada = ?,
            Salida = ?,
            Tardia = ?,
            Ausente = ?,
            Observacion = ?
        WHERE idAsistencia = ?
        `,
        [
          payload.entrada,
          payload.salida,
          payload.tardia ? 1 : 0,
          payload.ausente ? 1 : 0,
          payload.observacion,
          idAsistencia,
        ]
      );

      return res.json({
        ok: true,
        mensaje: "Asistencia actualizada (ya existía para esa fecha).",
        idAsistencia,
        afectados: r.affectedRows,
      });
    }

    // Crear un nuevo registro de asistencia
    const [result] = await db.query(
      `
      INSERT INTO Asistencia
        (Empleado_idEmpleado, Fecha, Entrada, Salida, Tardia, Ausente, Validado, Observacion, Activo)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        Empleado_idEmpleado,
        fecha,
        payload.entrada,
        payload.salida,
        payload.tardia ? 1 : 0,
        payload.ausente ? 1 : 0,
        0,
        payload.observacion,
        1,
      ]
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Asistencia creada.",
      idAsistencia: result.insertId,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error creando asistencia",
      error: String(e),
    });
  }
};

//Put para actualizar la asistencia
const actualizarAsistencia = async (req, res) => {
  try {
    const idAsistencia = Number(req.params.idAsistencia);
    if (!idAsistencia) {
      return res.status(400).json({ ok: false, mensaje: "idAsistencia inválido." });
    }

    const payload = normalizarPayload(req.body);

    const [result] = await db.query(
      `
      UPDATE Asistencia
      SET Entrada = ?,
          Salida = ?,
          Tardia = ?,
          Ausente = ?,
          Validado = ?,
          Observacion = ?
      WHERE idAsistencia = ?
        AND Activo = 1
      `,
      [
        payload.entrada,
        payload.salida,
        payload.tardia ? 1 : 0,
        payload.ausente ? 1 : 0,
        payload.validado ? 1 : 0,
        payload.observacion,
        idAsistencia,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Registro no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Asistencia actualizada." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error actualizando asistencia",
      error: String(e),
    });
  }
};

//Delete asistencia
const eliminarAsistencia = async (req, res) => {
  try {
    const idAsistencia = Number(req.params.idAsistencia);

    const [result] = await db.query(
      `UPDATE Asistencia SET Activo = 0 WHERE idAsistencia = ?`,
      [idAsistencia]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Registro no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Registro desactivado." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error desactivando asistencia",
      error: String(e),
    });
  }
};

//Post para validar todas las asistencias por rango de fechas
const validarTodoPeriodo = async (req, res) => {
  try {
    const { desde, hasta } = req.body;
    if (!desde || !hasta) {
      return res.status(400).json({ ok: false, mensaje: "Debe enviar desde y hasta." });
    }

    const [result] = await db.query(
      `
      UPDATE Asistencia
      SET Validado = 1
      WHERE Activo = 1
        AND Fecha BETWEEN ? AND ?
      `,
      [toDate(desde), toDate(hasta)]
    );

    return res.json({
      ok: true,
      mensaje: `Período validado. Registros afectados: ${result.affectedRows}.`,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error validando período",
      error: String(e),
    });
  }
};

//Post para validar un lote de asistencias, el lote es un array con idAsistencia y validado
const validarLote = async (req, res) => {
  try {
    const cambios = req.body?.cambios ?? [];

    if (!Array.isArray(cambios) || cambios.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Debe enviar cambios[]" });
    }

    let afectados = 0;

    for (const c of cambios) {
      const id = Number(c.idAsistencia);
      const validado = c.validado ? 1 : 0;

      if (!id) continue;

      const [r] = await db.query(
        `UPDATE Asistencia SET Validado = ? WHERE idAsistencia = ? AND Activo = 1`,
        [validado, id]
      );

      afectados += r.affectedRows;
    }

    return res.json({
      ok: true,
      mensaje: `Validaciones guardadas. Registros afectados: ${afectados}.`,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error guardando validaciones",
      error: String(e),
    });
  }
};

module.exports = {
  listarColaboradores,
  listarAsistenciasPorEmpleado,
  crearAsistencia,
  actualizarAsistencia,
  eliminarAsistencia,
  validarTodoPeriodo,
  validarLote,
};
