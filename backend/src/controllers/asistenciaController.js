// backend/src/controllers/asistenciaController.js
const db = require("../config/db");

function normalizarEstado(estado) {
  const e = String(estado || "").trim().toLowerCase();
  if (e === "confirmada") return "Confirmada";
  if (e === "pendiente") return "Pendiente";
  if (e === "validada") return "Confirmada";
  return "";
}

function derivarEstado(validado) {
  return Number(validado) === 1 ? "Confirmada" : "Pendiente";
}

function limpiarObservacionVieja(obs) {
  const s = String(obs || "").trim();
  return s.replace(/^RECHAZADA:\s*/i, "").trim();
}

function limpiarPrefijoIncapacidad(obs) {
  const s = String(obs || "").trim();
  return s
    .replace(/^DIA DE INCAPACIDAD(?:\s*\(INCAPACIDAD\s*#\d+\))?:\s*/i, "")
    .replace(/^INCAPACIDAD(?:\s*\(INCAPACIDAD\s*#\d+\))?:\s*/i, "")
    .trim();
}

function toSqlDateOnly(value) {
  const s0 = String(value || "").trim();
  if (!s0) return "";

  const dmy = s0.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const iso = s0.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m}-${d}`;
  }

  const t = Date.parse(s0);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function normalizeDateParam(value) {
  return toSqlDateOnly(value);
}

function safeSwapIfInverted(a, b) {
  if (!a || !b) return [a, b];
  return b < a ? [b, a] : [a, b];
}

function truncObs(s) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return v.length > 250 ? v.slice(0, 250) : v;
}

function normalizeObs(payload) {
  const p = payload || {};
  const v = p.Observacion ?? p.observacion ?? p.Motivo ?? p.motivo ?? "";
  return truncObs(v);
}

async function aplicarIncapacidadEnAsistencia(conn, payload) {
  const c = conn && typeof conn.query === "function" ? conn : db;

  const idIncapacidad = Number(payload?.idIncapacidad || 0);
  const empleadoId = Number(payload?.Empleado_idEmpleado || payload?.empleadoId || 0);

  let fIniSql = toSqlDateOnly(payload?.Fecha_Inicio);
  let fFinSql = toSqlDateOnly(payload?.Fecha_Fin);

  if (!empleadoId || !fIniSql || !fFinSql) return;

  [fIniSql, fFinSql] = safeSwapIfInverted(fIniSql, fFinSql);

  const obsUser = normalizeObs(payload);
  const obsPref = `DIA DE INCAPACIDAD (Incapacidad #${idIncapacidad || 0})`;
  const obsFinal = obsUser ? `${obsPref}: ${obsUser}` : obsPref;

  await c.query(
    `
    UPDATE Asistencia a
       SET a.Ausente = 0,
           a.Tardia = 0,
           a.Observacion = CASE
             WHEN a.Observacion IS NULL OR TRIM(a.Observacion) = '' THEN ?
             ELSE CONCAT(
               ?, ': ',
               TRIM(
                 REGEXP_REPLACE(
                   TRIM(a.Observacion),
                   '^(DIA DE INCAPACIDAD|INCAPACIDAD)([^:]*):\\\\s*',
                   ''
                 )
               )
             )
           END
     WHERE a.Activo = 1
       AND a.Empleado_idEmpleado = ?
       AND DATE(a.Fecha) BETWEEN DATE(?) AND DATE(?)
       AND (a.Ausente = 1 OR a.Tardia = 1 OR (a.Observacion IS NOT NULL AND TRIM(a.Observacion) <> ''))
    `,
    [obsFinal, obsPref, empleadoId, fIniSql, fFinSql]
  );
}

async function listarAsistencias(req, res, next) {
  try {
    const { empleadoId, q, estado, fecha, fechaDesde, fechaHasta, periodoId } = req.query;

    const filtros = ["a.Activo = 1"];
    const params = [];

    if (empleadoId) {
      filtros.push("a.Empleado_idEmpleado = ?");
      params.push(Number(empleadoId));
    }

    if (periodoId) {
      filtros.push("a.Catalogo_Periodo_idCatalogo_Periodo = ?");
      params.push(Number(periodoId));
    }

    if (fecha) {
      const f = normalizeDateParam(fecha);
      if (!f) return res.status(400).json({ ok: false, mensaje: "Fecha inválida (use dd/mm/yyyy)" });
      filtros.push("DATE(a.Fecha) = ?");
      params.push(f);
    } else {
      if (fechaDesde) {
        const fd = normalizeDateParam(fechaDesde);
        if (!fd) return res.status(400).json({ ok: false, mensaje: "fechaDesde inválida (use dd/mm/yyyy)" });
        filtros.push("DATE(a.Fecha) >= ?");
        params.push(fd);
      }
      if (fechaHasta) {
        const fh = normalizeDateParam(fechaHasta);
        if (!fh) return res.status(400).json({ ok: false, mensaje: "fechaHasta inválida (use dd/mm/yyyy)" });
        filtros.push("DATE(a.Fecha) <= ?");
        params.push(fh);
      }
    }

    if (q) {
      filtros.push("(p.Nombre LIKE ? OR p.Apellido1 LIKE ? OR p.Apellido2 LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (estado) {
      const est = normalizarEstado(estado);
      if (est === "Confirmada") filtros.push("a.Validado = 1");
      else if (est === "Pendiente") filtros.push("a.Validado = 0");
      else return res.status(400).json({ ok: false, mensaje: "Estado inválido" });
    }

    const where = `WHERE ${filtros.join(" AND ")}`;

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
        CASE WHEN a.Validado = 1 THEN 'Confirmada' ELSE 'Pendiente' END AS Estado
      FROM Asistencia a
      JOIN Empleado e ON e.idEmpleado = a.Empleado_idEmpleado
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      ${where}
      ORDER BY DATE(a.Fecha) DESC, EmpleadoNombre ASC
    `;

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, asistencias: rows });
  } catch (error) {
    return next(error);
  }
}

async function obtenerAsistenciaPorId(req, res, next) {
  try {
    const id = Number(req.params.id);

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
        CASE WHEN a.Validado = 1 THEN 'Confirmada' ELSE 'Pendiente' END AS Estado
      FROM Asistencia a
      JOIN Empleado e ON e.idEmpleado = a.Empleado_idEmpleado
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      WHERE a.idAsistencia = ? AND a.Activo = 1
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: "Asistencia no encontrada" });

    return res.json({ ok: true, asistencia: rows[0] });
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

      const obsLimpia = limpiarObservacionVieja(curRows[0].Observacion);

      await conn.query("UPDATE Asistencia SET Validado = ?, Observacion = ? WHERE idAsistencia = ?", [
        1,
        obsLimpia,
        idAsistencia,
      ]);
    } else {
      await conn.query("UPDATE Validacion_Asistencia SET Activo = 0 WHERE Asistencia_idAsistencia = ?", [
        idAsistencia,
      ]);
      await conn.query("UPDATE Asistencia SET Validado = ? WHERE idAsistencia = ?", [0, idAsistencia]);
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

async function listarAsistenciasPorEmpleado(req, res, next) {
  try {
    const empleadoId = Number(req.params.empleadoId || 0);
    if (!empleadoId) return res.status(400).json({ ok: false, mensaje: "empleadoId inválido" });

    const desdeRaw = String(req.query?.desde || "").trim();
    const hastaRaw = String(req.query?.hasta || "").trim();

    const desde = desdeRaw ? toSqlDateOnly(desdeRaw) : "";
    const hasta = hastaRaw ? toSqlDateOnly(hastaRaw) : "";

    if ((desdeRaw && !desde) || (hastaRaw && !hasta)) {
      return res.status(400).json({ ok: false, mensaje: "desde/hasta inválidos (use dd/mm/yyyy)" });
    }

    let d = desde;
    let h = hasta;
    [d, h] = safeSwapIfInverted(d, h);

    const filtros = ["a.Activo = 1", "a.Empleado_idEmpleado = ?"];
    const params = [empleadoId];

    if (d) {
      filtros.push("DATE(a.Fecha) >= ?");
      params.push(d);
    }
    if (h) {
      filtros.push("DATE(a.Fecha) <= ?");
      params.push(h);
    }

    const where = `WHERE ${filtros.join(" AND ")}`;

    const sql = `
      SELECT
        a.idAsistencia,
        a.Empleado_idEmpleado,
        a.Fecha,
        a.Entrada,
        a.Salida,
        a.Tardia,
        a.Ausente,
        a.Validado,
        a.Observacion,
        a.Catalogo_Periodo_idCatalogo_Periodo,
        CASE WHEN a.Validado = 1 THEN 'Confirmada' ELSE 'Pendiente' END AS Estado
      FROM Asistencia a
      ${where}
      ORDER BY DATE(a.Fecha) ASC
    `;

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, asistencias: rows });
  } catch (error) {
    return next(error);
  }
}

async function listarColaboradoresParaValidacion(req, res, next) {
  try {
    const buscar = String(req.query?.buscar || "").trim();

    const params = [];
    let where = "WHERE e.Activo = 1 AND p.Activo = 1";

    if (buscar) {
      where += " AND (p.Nombre LIKE ? OR p.Apellido1 LIKE ? OR p.Apellido2 LIKE ?)";
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    const sql = `
      SELECT
        e.idEmpleado,
        CONCAT(p.Nombre, ' ', p.Apellido1, ' ', p.Apellido2) AS nombreCompleto
      FROM Empleado e
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      ${where}
      ORDER BY nombreCompleto ASC
      LIMIT 200
    `;

    const [rows] = await db.query(sql, params);
    return res.json({ ok: true, colaboradores: rows });
  } catch (error) {
    return next(error);
  }
}

async function crearAsistencia(req, res, next) {
  try {
    const empleadoId = Number(req.body?.Empleado_idEmpleado || req.body?.empleadoId || 0);
    const fechaSql = toSqlDateOnly(req.body?.Fecha || req.body?.fecha);
    const entrada = String(req.body?.Entrada || req.body?.entrada || "00:00:00").trim();
    const salida = String(req.body?.Salida || req.body?.salida || "00:00:00").trim();
    const tardia = Number(req.body?.Tardia || req.body?.tardia || 0) ? 1 : 0;
    const ausente = Number(req.body?.Ausente || req.body?.ausente || 0) ? 1 : 0;
    const observacion = String(req.body?.Observacion || req.body?.observacion || "").trim();
    const periodoId = Number(req.body?.Catalogo_Periodo_idCatalogo_Periodo || req.body?.periodoId || 0);

    if (!empleadoId) return res.status(400).json({ ok: false, mensaje: "Empleado requerido" });
    if (!fechaSql) return res.status(400).json({ ok: false, mensaje: "Fecha inválida (use dd/mm/yyyy)" });
    if (!periodoId) return res.status(400).json({ ok: false, mensaje: "Periodo requerido" });

    const [r] = await db.query(
      `
      INSERT INTO Asistencia
        (Empleado_idEmpleado, Fecha, Entrada, Salida, Tardia, Ausente, Validado, Observacion, Catalogo_Periodo_idCatalogo_Periodo, Activo)
      VALUES
        (?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
      `,
      [empleadoId, fechaSql, entrada, salida, tardia, ausente, observacion, periodoId]
    );

    return res.status(201).json({ ok: true, mensaje: "Asistencia creada", idAsistencia: r.insertId });
  } catch (error) {
    return next(error);
  }
}

async function actualizarAsistencia(req, res, next) {
  try {
    const idAsistencia = Number(req.params.id || 0);
    if (!idAsistencia) return res.status(400).json({ ok: false, mensaje: "ID inválido" });

    const fields = [];
    const params = [];

    const has = (k) => Object.prototype.hasOwnProperty.call(req.body || {}, k);

    if (has("Entrada")) {
      fields.push("Entrada = ?");
      params.push(String(req.body.Entrada || "00:00:00").trim());
    }
    if (has("Salida")) {
      fields.push("Salida = ?");
      params.push(String(req.body.Salida || "00:00:00").trim());
    }
    if (has("Tardia")) {
      fields.push("Tardia = ?");
      params.push(Number(req.body.Tardia) ? 1 : 0);
    }
    if (has("Ausente")) {
      fields.push("Ausente = ?");
      params.push(Number(req.body.Ausente) ? 1 : 0);
    }
    if (has("Observacion")) {
      fields.push("Observacion = ?");
      params.push(String(req.body.Observacion || "").trim());
    }

    if (fields.length === 0) return res.status(400).json({ ok: false, mensaje: "Nada que actualizar" });

    params.push(idAsistencia);

    const [r] = await db.query(
      `
      UPDATE Asistencia
         SET ${fields.join(", ")}
       WHERE idAsistencia = ?
         AND Activo = 1
      `,
      params
    );

    if (!r.affectedRows) return res.status(404).json({ ok: false, mensaje: "Asistencia no encontrada" });
    return res.json({ ok: true, mensaje: "Asistencia actualizada" });
  } catch (error) {
    return next(error);
  }
}

async function eliminarAsistencia(req, res, next) {
  try {
    const idAsistencia = Number(req.params.id || 0);
    if (!idAsistencia) return res.status(400).json({ ok: false, mensaje: "ID inválido" });

    const [r] = await db.query(
      `UPDATE Asistencia SET Activo = 0 WHERE idAsistencia = ? AND Activo = 1`,
      [idAsistencia]
    );

    if (!r.affectedRows) return res.status(404).json({ ok: false, mensaje: "Asistencia no encontrada" });
    return res.json({ ok: true, mensaje: "Asistencia eliminada" });
  } catch (error) {
    return next(error);
  }
}

async function validarTodoPeriodo(req, res, next) {
  req.body = {
    ...req.body,
    fechaInicio: req.body?.fechaInicio || req.body?.desde || "",
    fechaFin: req.body?.fechaFin || req.body?.hasta || "",
  };
  return validarRangoAsistencias(req, res, next);
}

async function guardarValidacionesLote(req, res, next) {
  let conn;
  try {
    const idUsuario = req.usuario?.idUsuario;
    if (!idUsuario) return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    const cambios = Array.isArray(req.body?.cambios) ? req.body.cambios : [];
    if (cambios.length === 0) return res.status(400).json({ ok: false, mensaje: "cambios requerido" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    let confirmadas = 0;
    let pendientes = 0;

    for (const c of cambios) {
      const idAsistencia = Number(c?.idAsistencia || c?.id || 0);
      if (!idAsistencia) continue;

      let estado = "";
      if (c?.estado !== undefined) estado = normalizarEstado(c.estado);
      else if (c?.Estado !== undefined) estado = normalizarEstado(c.Estado);
      else if (c?.validado !== undefined || c?.Validado !== undefined) {
        const v = Number(c?.validado ?? c?.Validado) ? 1 : 0;
        estado = v === 1 ? "Confirmada" : "Pendiente";
      }

      if (!estado) continue;

      const nuevoValidado = estado === "Confirmada" ? 1 : 0;

      const [cur] = await conn.query(
        "SELECT Validado, Observacion FROM Asistencia WHERE idAsistencia = ? AND Activo = 1 FOR UPDATE",
        [idAsistencia]
      );
      if (!cur.length) continue;

      if (nuevoValidado === 1) {
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

        const obsLimpia = limpiarObservacionVieja(cur[0].Observacion);

        await conn.query("UPDATE Asistencia SET Validado = 1, Observacion = ? WHERE idAsistencia = ?", [
          obsLimpia,
          idAsistencia,
        ]);

        confirmadas++;
      } else {
        await conn.query("UPDATE Validacion_Asistencia SET Activo = 0 WHERE Asistencia_idAsistencia = ?", [
          idAsistencia,
        ]);
        await conn.query("UPDATE Asistencia SET Validado = 0 WHERE idAsistencia = ?", [idAsistencia]);
        pendientes++;
      }
    }

    await conn.commit();
    return res.json({
      ok: true,
      mensaje: "Validaciones guardadas",
      confirmadas,
      pendientes,
      total: confirmadas + pendientes,
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
    const fechaInicioRaw = String(req.body?.fechaInicio || req.body?.desde || "").trim();
    const fechaFinRaw = String(req.body?.fechaFin || req.body?.hasta || "").trim();

    const fechaInicio = toSqlDateOnly(fechaInicioRaw);
    const fechaFin = toSqlDateOnly(fechaFinRaw);

    const empleadoId = req.body?.empleadoId ? Number(req.body.empleadoId) : null;
    const periodoId = req.body?.periodoId ? Number(req.body.periodoId) : null;
    const idUsuario = req.usuario?.idUsuario;

    if (!fechaInicioRaw || !fechaFinRaw)
      return res.status(400).json({ ok: false, mensaje: "fechaInicio y fechaFin son requeridas" });

    if (!fechaInicio || !fechaFin)
      return res.status(400).json({ ok: false, mensaje: "fechaInicio/fechaFin inválidas (use dd/mm/yyyy)" });

    if (fechaInicio > fechaFin)
      return res.status(400).json({ ok: false, mensaje: "fechaInicio no puede ser mayor que fechaFin" });

    if (!idUsuario) return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    const filtros = ["a.Activo = 1", "a.Validado = 0", "DATE(a.Fecha) >= ?", "DATE(a.Fecha) <= ?"];
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

    const accionCorta = `Confirmar rango: ${fechaInicioRaw} a ${fechaFinRaw} (${totalConfirmadas})`;

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
      ORDER BY DATE(Fecha) DESC, EmpleadoTexto ASC
      `
    );

    return res.json({ ok: true, asistencias: rows });
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
  aplicarIncapacidadEnAsistencia,
  listarColaboradoresParaValidacion,
  listarAsistenciasPorEmpleado,
  crearAsistencia,
  actualizarAsistencia,
  eliminarAsistencia,
  validarTodoPeriodo,
  guardarValidacionesLote,
  validarLote: guardarValidacionesLote,
};
