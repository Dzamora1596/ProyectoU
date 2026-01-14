// asistenciaController.js
const db = require("../config/db");


function normalizarEstado(estado) {
  const e = String(estado || "").trim().toLowerCase();
  if (e === "validada") return "Validada";
  if (e === "rechazada") return "Rechazada";
  if (e === "pendiente") return "Pendiente";
  return "";
}

function derivarEstado(validado, observacion) {
  if (Number(validado) === 1) return "Validada";
  const obs = String(observacion || "");
  if (obs.toUpperCase().startsWith("RECHAZADA:")) return "Rechazada";
  return "Pendiente";
}


async function listarAsistencias(req, res, next) {
  try {
    const { empleadoId, q, estado, fecha, fechaDesde, fechaHasta, periodoId } = req.query;

    const filtros = [];
    const params = [];
    filtros.push("a.Activo = 1");

    if (empleadoId) {
      filtros.push("a.Empleado_idEmpleado = ?");
      params.push(Number(empleadoId));
    }

    if (periodoId) {
      filtros.push("a.Catalogo_Periodo_idCatalogo_Periodo = ?");
      params.push(Number(periodoId));
    }

    if (fecha) {
      filtros.push("a.Fecha = ?");
      params.push(fecha);
    } else {
      if (fechaDesde) {
        filtros.push("a.Fecha >= ?");
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        filtros.push("a.Fecha <= ?");
        params.push(fechaHasta);
      }
    }

    if (q) {
      filtros.push("(p.Nombre LIKE ? OR p.Apellido1 LIKE ? OR p.Apellido2 LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (estado) {
      const est = normalizarEstado(estado);
      if (est === "Validada") filtros.push("a.Validado = 1");
      else if (est === "Rechazada") filtros.push("a.Validado = 0 AND a.Observacion LIKE 'RECHAZADA:%'");
      else if (est === "Pendiente") filtros.push("a.Validado = 0 AND a.Observacion NOT LIKE 'RECHAZADA:%'");
      else return res.status(400).json({ ok: false, mensaje: "Estado inválido" });
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const sql = `
      SELECT
        a.idAsistencia,
        a.Empleado_idEmpleado,
        CONCAT(p.Nombre, ' ', p.Apellido1, ' ', p.Apellido2) AS EmpleadoNombre,
        a.Fecha,
        a.Entrada,
        a.Salida,
        a.Tardia,
        a.Ausente,
        a.Validado,
        a.Observacion,
        a.Catalogo_Periodo_idCatalogo_Periodo,
        CASE
          WHEN a.Validado = 1 THEN 'Validada'
          WHEN a.Validado = 0 AND a.Observacion LIKE 'RECHAZADA:%' THEN 'Rechazada'
          ELSE 'Pendiente'
        END AS Estado
      FROM Asistencia a
      JOIN Empleado e ON e.idEmpleado = a.Empleado_idEmpleado
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      ${where}
      ORDER BY a.Fecha DESC, EmpleadoNombre ASC
    `;

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}


async function obtenerAsistenciaPorId(req, res, next) {
  try {
    const id = Number(req.params.id);

    const sql = `
      SELECT
        a.*,
        CONCAT(p.Nombre, ' ', p.Apellido1, ' ', p.Apellido2) AS EmpleadoNombre
      FROM Asistencia a
      JOIN Empleado e ON e.idEmpleado = a.Empleado_idEmpleado
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      WHERE a.idAsistencia = ? AND a.Activo = 1
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [id]);
    if (!rows.length) {
      return res.status(404).json({ ok: false, mensaje: "Asistencia no encontrada" });
    }

    const a = rows[0];
    return res.json({ ...a, Estado: derivarEstado(a.Validado, a.Observacion) });
  } catch (error) {
    return next(error);
  }
}



async function cambiarEstadoAsistencia(req, res, next) {
  let conn;
  try {
    const idAsistencia = Number(req.params.id);
    const estado = normalizarEstado(req.body?.estado);
    const motivo = String(req.body?.motivo || "").trim();
    const idUsuario = req.usuario?.idUsuario;

    if (!estado) return res.status(400).json({ ok: false, mensaje: "Estado inválido" });
    if (estado === "Rechazada" && !motivo)
      return res.status(400).json({ ok: false, mensaje: "Motivo requerido para rechazar" });
    if (!idUsuario) return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [curRows] = await conn.query(
      "SELECT Validado, Observacion FROM Asistencia WHERE idAsistencia = ? AND Activo = 1 FOR UPDATE",
      [idAsistencia]
    );

    if (!curRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, mensaje: "Asistencia no encontrada" });
    }

    const obsActual = String(curRows[0].Observacion || "");
    const obsSinPrefijoRechazo = obsActual.replace(/^RECHAZADA:\s*/i, "").trim();

    let nuevoValidado = 0;
    let nuevaObs = obsActual;

    if (estado === "Validada") {
      nuevoValidado = 1;
      nuevaObs = obsSinPrefijoRechazo || "Validada";
      await conn.query(
        `
        INSERT INTO Validacion_Asistencia (Asistencia_idAsistencia, Usuario_idUsuario, Activo)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
          Usuario_idUsuario = VALUES(Usuario_idUsuario),
          Fecha_Validacion = CURRENT_TIMESTAMP,
          Activo = 1
        `,
        [idAsistencia, idUsuario]
      );
    }

    if (estado === "Rechazada") {
      nuevoValidado = 0;
      nuevaObs = `RECHAZADA: ${motivo}`;
      await conn.query(
        "UPDATE Validacion_Asistencia SET Activo = 0 WHERE Asistencia_idAsistencia = ?",
        [idAsistencia]
      );
    }

    if (estado === "Pendiente") {
      nuevoValidado = 0;
      nuevaObs = obsSinPrefijoRechazo;
      await conn.query(
        "UPDATE Validacion_Asistencia SET Activo = 0 WHERE Asistencia_idAsistencia = ?",
        [idAsistencia]
      );
    }

    await conn.query(
      "UPDATE Asistencia SET Validado = ?, Observacion = ? WHERE idAsistencia = ?",
      [nuevoValidado, nuevaObs, idAsistencia]
    );

    await conn.commit();
    return res.json({ ok: true, mensaje: "Estado actualizado", estado });
  } catch (error) {
    if (conn) await conn.rollback();
    return next(error);
  } finally {
    if (conn) conn.release();
  }
}



async function validarRangoAsistencias(req, res, next) {
  let conn;
  try {
    const fechaInicio = String(req.body?.fechaInicio || "").trim();
    const fechaFin = String(req.body?.fechaFin || "").trim();
    const empleadoId = req.body?.empleadoId ? Number(req.body.empleadoId) : null;
    const periodoId = req.body?.periodoId ? Number(req.body.periodoId) : null;
    const idUsuario = req.usuario?.idUsuario;

    if (!fechaInicio || !fechaFin)
      return res.status(400).json({ ok: false, mensaje: "fechaInicio y fechaFin son requeridas" });
    if (fechaInicio > fechaFin)
      return res.status(400).json({ ok: false, mensaje: "fechaInicio no puede ser mayor que fechaFin" });
    if (!idUsuario)
      return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    const filtros = [
      "a.Activo = 1",
      "a.Validado = 0",
      "a.Observacion NOT LIKE 'RECHAZADA:%'",
      "a.Fecha >= ?",
      "a.Fecha <= ?",
    ];
    const params = [fechaInicio, fechaFin];

    if (empleadoId) {
      filtros.push("a.Empleado_idEmpleado = ?");
      params.push(empleadoId);
    }
    if (periodoId) {
      filtros.push("a.Catalogo_Periodo_idCatalogo_Periodo = ?");
      params.push(periodoId);
    }

    const where = `WHERE ${filtros.join(" AND ")}`;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [idsRows] = await conn.query(`SELECT a.idAsistencia FROM Asistencia a ${where}`, params);
    const ids = idsRows.map((r) => Number(r.idAsistencia)).filter(Boolean);

    if (ids.length === 0) {
      await conn.commit();
      return res.json({ ok: true, mensaje: "No hay asistencias pendientes", totalValidadas: 0 });
    }

    await conn.query(
      `
      INSERT INTO Validacion_Asistencia (Asistencia_idAsistencia, Usuario_idUsuario, Activo)
      SELECT a.idAsistencia, ?, 1 FROM Asistencia a ${where}
      ON DUPLICATE KEY UPDATE Usuario_idUsuario = VALUES(Usuario_idUsuario),
        Fecha_Validacion = CURRENT_TIMESTAMP,
        Activo = 1
      `,
      [idUsuario, ...params]
    );

    const [upd] = await conn.query(
      `
      UPDATE Asistencia a
      SET a.Validado = 1,
          a.Observacion = CASE WHEN TRIM(a.Observacion) = '' THEN 'Validada' ELSE a.Observacion END
      ${where}
      `,
      params
    );

    const totalValidadas = Number(upd?.affectedRows || 0);

    const accionCorta = `Validar rango: ${fechaInicio} a ${fechaFin} (${totalValidadas})`;

    await conn.query(
      `
      INSERT INTO Bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Fecha_y_Hora, Usuario_idUsuario, Activo)
      VALUES ('Asistencia', ?, ?, CURRENT_TIMESTAMP, ?, 1)
      `,
      [`RANGO:${fechaInicio}_${fechaFin}`, accionCorta.slice(0, 45), idUsuario]
    );

    await conn.commit();
    return res.json({ ok: true, mensaje: "Validación por rango completada", totalValidadas });
  } catch (error) {
    if (conn) await conn.rollback();
    return next(error);
  } finally {
    if (conn) conn.release();
  }
}



async function listarNoRegistradas(req, res, next) {
  try {
    const [rows] = await db.query(
      `
      SELECT
        idAsistenciaNoRegistrada AS id,
        EmpleadoTexto AS EmpleadoNombre,
        Fecha,
        Entrada,
        Salida,
        Tardia,
        Ausente,
        Observacion,
        Catalogo_Periodo_idCatalogo_Periodo AS periodoId
      FROM Asistencia_NoRegistrada
      WHERE Activo = 1
      ORDER BY Fecha DESC, EmpleadoTexto ASC
      `
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}



module.exports = {
  listarAsistencias,
  obtenerAsistenciaPorId,
  cambiarEstadoAsistencia,
  validarRangoAsistencias,
  listarNoRegistradas, 
};
