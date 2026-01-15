// asistenciaController.js
const db = require("../config/db");

function normalizarEstado(estado) {
  const e = String(estado || "").trim().toLowerCase();
  // ✅ Nuevo enfoque: solo Confirmada o Pendiente
  if (e === "confirmada") return "Confirmada";
  if (e === "pendiente") return "Pendiente";
  // Compat: si el frontend aún manda "validada"
  if (e === "validada") return "Confirmada";
  return "";
}

function derivarEstado(validado) {
  return Number(validado) === 1 ? "Confirmada" : "Pendiente";
}

function limpiarObservacionVieja(obs) {
  // ✅ Compat: si antes guardaban "RECHAZADA: ..."
  const s = String(obs || "").trim();
  return s.replace(/^RECHAZADA:\s*/i, "").trim();
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

    // ✅ Estado SOLO depende de Validado
    if (estado) {
      const est = normalizarEstado(estado);
      if (est === "Confirmada") filtros.push("a.Validado = 1");
      else if (est === "Pendiente") filtros.push("a.Validado = 0");
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
          WHEN a.Validado = 1 THEN 'Confirmada'
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
    return res.json({ ...a, Estado: derivarEstado(a.Validado) });
  } catch (error) {
    return next(error);
  }
}

async function cambiarEstadoAsistencia(req, res, next) {
  let conn;
  try {
    const idAsistencia = Number(req.params.id);
    const estado = normalizarEstado(req.body?.estado);
    const idUsuario = req.usuario?.idUsuario;

    if (!estado) return res.status(400).json({ ok: false, mensaje: "Estado inválido" });
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

    const nuevoValidado = estado === "Confirmada" ? 1 : 0;

    if (nuevoValidado === 1) {
      // ✅ Registrar/actualizar confirmación
      await conn.query(
        `
        INSERT INTO Validacion_Asistencia (Asistencia_idAsistencia, Usuario_idUsuario, Fecha_Validacion, Activo)
        VALUES (?, ?, CURRENT_TIMESTAMP, 1)
        ON DUPLICATE KEY UPDATE
          Usuario_idUsuario = VALUES(Usuario_idUsuario),
          Fecha_Validacion = CURRENT_TIMESTAMP,
          Activo = 1
        `,
        [idAsistencia, idUsuario]
      );

      // ✅ Compat: limpiar observaciones viejas tipo "RECHAZADA:"
      const obsLimpia = limpiarObservacionVieja(curRows[0].Observacion);

      await conn.query(
        "UPDATE Asistencia SET Validado = ?, Observacion = ? WHERE idAsistencia = ?",
        [1, obsLimpia, idAsistencia]
      );
    } else {
      // ✅ Volver a pendiente: desactiva la validación (no es rechazo)
      await conn.query(
        "UPDATE Validacion_Asistencia SET Activo = 0 WHERE Asistencia_idAsistencia = ?",
        [idAsistencia]
      );

      await conn.query("UPDATE Asistencia SET Validado = ? WHERE idAsistencia = ?", [
        0,
        idAsistencia,
      ]);
    }

    await conn.commit();
    return res.json({
      ok: true,
      mensaje: "Estado actualizado",
      estado: nuevoValidado === 1 ? "Confirmada" : "Pendiente",
    });
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
    if (!idUsuario) return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    // ✅ Solo pendientes (Validado = 0)
    const filtros = ["a.Activo = 1", "a.Validado = 0", "a.Fecha >= ?", "a.Fecha <= ?"];
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
      return res.json({ ok: true, mensaje: "No hay asistencias pendientes", totalConfirmadas: 0 });
    }

    // ✅ Registrar confirmación
    await conn.query(
      `
      INSERT INTO Validacion_Asistencia (Asistencia_idAsistencia, Usuario_idUsuario, Fecha_Validacion, Activo)
      SELECT a.idAsistencia, ?, CURRENT_TIMESTAMP, 1
      FROM Asistencia a ${where}
      ON DUPLICATE KEY UPDATE
        Usuario_idUsuario = VALUES(Usuario_idUsuario),
        Fecha_Validacion = CURRENT_TIMESTAMP,
        Activo = 1
      `,
      [idUsuario, ...params]
    );

    // ✅ Confirmar asistencias + limpiar prefijo RECHAZADA viejo si existía
    const [upd] = await conn.query(
      `
      UPDATE Asistencia a
      SET a.Validado = 1,
          a.Observacion = TRIM(REGEXP_REPLACE(a.Observacion, '^RECHAZADA:\\\\s*', ''))
      ${where}
      `,
      params
    );

    const totalConfirmadas = Number(upd?.affectedRows || 0);

    const accionCorta = `Confirmar rango: ${fechaInicio} a ${fechaFin} (${totalConfirmadas})`;

    await conn.query(
      `
      INSERT INTO Bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Fecha_y_Hora, Usuario_idUsuario, Activo)
      VALUES ('Asistencia', ?, ?, CURRENT_TIMESTAMP, ?, 1)
      `,
      [`RANGO:${fechaInicio}_${fechaFin}`, accionCorta.slice(0, 45), idUsuario]
    );

    await conn.commit();
    return res.json({ ok: true, mensaje: "Confirmación por rango completada", totalConfirmadas });
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
