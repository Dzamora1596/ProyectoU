// models/permisosModel.js

const db = require("../config/db");

function normalizeQueryResult(result) {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (result && Array.isArray(result.rows)) return result.rows;
  return result;
}

function bitTo01(v) {
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  return Number(v) ? 1 : 0;
}

function isDateOnlyYYYYMMDD(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

function normalizeDesde(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (isDateOnlyYYYYMMDD(s)) return `${s} 00:00:00`;
  if (s.includes("T")) return s.replace("T", " ");
  return s;
}

function normalizeHasta(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (isDateOnlyYYYYMMDD(s)) return `${s} 23:59:59`;
  if (s.includes("T")) return s.replace("T", " ");
  return s;
}

function throw400(code, message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  throw err;
}

function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
}

function formatDMY(value, withTime = true) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    const dd = pad2(value.getDate());
    const mm = pad2(value.getMonth() + 1);
    const yyyy = value.getFullYear();
    if (!withTime) return `${dd}/${mm}/${yyyy}`;
    const hh = pad2(value.getHours());
    const mi = pad2(value.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, y, mo, d, hh, mm] = m;
    if (!withTime || hh === undefined || mm === undefined) return `${d}/${mo}/${y}`;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return formatDMY(dt, withTime);

  return s;
}

function mapPermisoRowDates(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    Fecha_Inicio: formatDMY(row.Fecha_Inicio, true),
    Fecha_Fin: formatDMY(row.Fecha_Fin, true),
    Fecha_Solicitud: formatDMY(row.Fecha_Solicitud, true),
  };
}

function mapRowsDates(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(mapPermisoRowDates);
}

function toMySqlDateTime(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;

  if (isDateOnlyYYYYMMDD(s)) return `${s} 00:00:00`;

  if (s.includes("T")) {
    const t = s.replace("T", " ");
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(s)) return `${s}:00`;

  return s;
}

async function insertBitacora({ tabla, idRegistro, accion, usuarioId }) {
  const sql = `
    INSERT INTO bitacora
      (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
    VALUES
      (?, ?, ?, ?, b'1')
  `;
  await db.query(sql, [tabla, String(idRegistro), accion, usuarioId]);
}

async function getPeriodoIdByDate(fechaInicio) {
  const sql = `
    SELECT idCatalogo_Periodo
    FROM catalogo_periodo
    WHERE Activo = b'1'
      AND ? BETWEEN Fecha_Inicio AND Fecha_Fin
    ORDER BY idCatalogo_Periodo DESC
    LIMIT 1
  `;
  const res = await db.query(sql, [fechaInicio]);
  const rows = normalizeQueryResult(res);
  return rows?.[0]?.idCatalogo_Periodo ?? null;
}

async function validarCalendarioFeriadoPorFechaInicio(fechaInicio) {
  const sqlCalendario = `
    SELECT
      c.Fecha,
      c.Laborable,
      c.EsFinSemana,
      c.Activo AS CalendarioActivo,
      c.Feriado_idFeriado,
      f.Nombre AS FeriadoNombre,
      f.Activo AS FeriadoActivo
    FROM calendario c
    LEFT JOIN feriado f
      ON f.idFeriado = c.Feriado_idFeriado
    WHERE c.Activo = b'1'
      AND c.Fecha = DATE(?)
    LIMIT 1
  `;

  const resCal = await db.query(sqlCalendario, [fechaInicio]);
  const rowsCal = normalizeQueryResult(resCal);
  const r = rowsCal?.[0] || null;

  if (r) {
    const laborable01 = bitTo01(r.Laborable);
    const esFinSemana01 = bitTo01(r.EsFinSemana);
    const feriadoId = Number(r.Feriado_idFeriado || 0);
    const feriadoActivo01 = bitTo01(r.FeriadoActivo);

    const esFeriado = feriadoId > 0 && feriadoActivo01 === 1;
    const noLaborable = laborable01 === 0;

    if (esFeriado || noLaborable) {
      const nombre = String(r.FeriadoNombre || "").trim();
      if (esFeriado && nombre) {
        return {
          bloquea: true,
          motivo: `El día seleccionado es feriado (${nombre}), no es necesario registrar un permiso.`,
        };
      }

      if (esFinSemana01 === 1 && noLaborable) {
        return {
          bloquea: true,
          motivo: `El día seleccionado es fin de semana/no laborable, no es necesario registrar un permiso.`,
        };
      }

      return {
        bloquea: true,
        motivo: `El día seleccionado no es laborable/feriado, no es necesario registrar un permiso.`,
      };
    }

    return { bloquea: false, motivo: "" };
  }

  const sqlFeriado = `
    SELECT Nombre
    FROM feriado
    WHERE Activo = b'1'
      AND Fecha = DATE(?)
    LIMIT 1
  `;
  const resFer = await db.query(sqlFeriado, [fechaInicio]);
  const rowsFer = normalizeQueryResult(resFer);
  const f = rowsFer?.[0] || null;

  if (f) {
    const nombre = String(f.Nombre || "").trim();
    return {
      bloquea: true,
      motivo: nombre
        ? `El día seleccionado es feriado (${nombre}), no es necesario registrar un permiso.`
        : `El día seleccionado es feriado, no es necesario registrar un permiso.`,
    };
  }

  return { bloquea: false, motivo: "" };
}

async function getEmpleadoIdByUsuarioId(usuarioId) {
  const id = Number(usuarioId || 0);
  if (!id) return null;

  const sql = `
    SELECT Empleado_idEmpleado
    FROM usuario
    WHERE idUsuario = ?
    LIMIT 1
  `;
  const res = await db.query(sql, [id]);
  const rows = normalizeQueryResult(res) || [];
  const emp = rows?.[0]?.Empleado_idEmpleado ?? null;
  return emp ? Number(emp) : null;
}

function requireScopeEmpleadoId(scopeEmpleadoId) {
  const sid = Number(scopeEmpleadoId || 0);
  if (!sid) throw400("SCOPE_REQUIRED", "No se pudo determinar el empleado del usuario.");
  return sid;
}

async function getTraslapes({ empleadoId, fechaInicio, fechaFin, excludeIdPermisos = null }) {
  const ini = toMySqlDateTime(fechaInicio);
  const fin = toMySqlDateTime(fechaFin);

  if (!empleadoId || !ini || !fin) return [];

  const params = [Number(empleadoId), fin, ini];

  let extra = "";
  if (excludeIdPermisos) {
    extra = " AND p.idPermisos <> ? ";
    params.push(Number(excludeIdPermisos));
  }

  const sql = `
    SELECT
      p.idPermisos,
      p.Empleado_idEmpleado,
      p.Catalogo_Estado_idCatalogo_Estado,
      ce.Descripcion AS EstadoDescripcion,
      p.Fecha_Inicio,
      p.Fecha_Fin,
      p.Activo
    FROM permisos p
    LEFT JOIN catalogo_estado ce
      ON ce.idCatalogo_Estado = p.Catalogo_Estado_idCatalogo_Estado
    WHERE p.Activo = b'1'
      AND p.Empleado_idEmpleado = ?
      AND p.Fecha_Inicio <= ?
      AND p.Fecha_Fin >= ?
      ${extra}
    ORDER BY p.Fecha_Inicio ASC, p.idPermisos ASC
  `;

  const res = await db.query(sql, params);
  const rows = normalizeQueryResult(res) || [];
  return mapRowsDates(rows);
}

async function getById(idPermisos, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  const params = [idPermisos];
  let scopeSql = "";

  if (requireScope) {
    const sid = requireScopeEmpleadoId(scopeEmpleadoId);
    scopeSql = " AND p.Empleado_idEmpleado = ? ";
    params.push(sid);
  } else if (scopeEmpleadoId) {
    scopeSql = " AND p.Empleado_idEmpleado = ? ";
    params.push(Number(scopeEmpleadoId));
  }

  const sql = `
    SELECT
      p.idPermisos,
      p.Empleado_idEmpleado,
      p.Catalogo_Periodo_idCatalogo_Periodo,
      p.Catalogo_Estado_idCatalogo_Estado,
      p.Descripcion,
      p.Tipo_Permiso_idTipo_Permiso,
      p.Fecha_Inicio,
      p.Fecha_Fin,
      p.Fecha_Solicitud,
      p.Activo
    FROM permisos p
    WHERE p.idPermisos = ?
      ${scopeSql}
    LIMIT 1
  `;
  const res = await db.query(sql, params);
  const rows = normalizeQueryResult(res);
  const row = rows?.[0] || null;
  return mapPermisoRowDates(row);
}

async function list(filters = {}, opts = {}) {
  const { empleadoId, estadoId, periodoId, tipoPermisoId, desde, hasta, activo = 1 } = filters;
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  const where = [];
  const params = [];

  if (activo !== undefined && activo !== null) {
    where.push("p.Activo = ?");
    params.push(activo ? 1 : 0);
  }

  let empleadoIdEff = null;

  if (requireScope) {
    empleadoIdEff = requireScopeEmpleadoId(scopeEmpleadoId);
  } else if (scopeEmpleadoId) {
    empleadoIdEff = Number(scopeEmpleadoId);
  } else if (empleadoId) {
    empleadoIdEff = Number(empleadoId);
  }

  if (empleadoIdEff) {
    where.push("p.Empleado_idEmpleado = ?");
    params.push(empleadoIdEff);
  }

  if (estadoId) {
    where.push("p.Catalogo_Estado_idCatalogo_Estado = ?");
    params.push(estadoId);
  }

  if (periodoId) {
    where.push("p.Catalogo_Periodo_idCatalogo_Periodo = ?");
    params.push(periodoId);
  }

  if (tipoPermisoId) {
    where.push("p.Tipo_Permiso_idTipo_Permiso = ?");
    params.push(tipoPermisoId);
  }

  const desdeNorm = normalizeDesde(desde);
  const hastaNorm = normalizeHasta(hasta);

  if (desdeNorm) {
    where.push("p.Fecha_Solicitud >= ?");
    params.push(desdeNorm);
  }

  if (hastaNorm) {
    where.push("p.Fecha_Solicitud <= ?");
    params.push(hastaNorm);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      p.idPermisos,
      p.Empleado_idEmpleado,
      p.Catalogo_Periodo_idCatalogo_Periodo,
      p.Catalogo_Estado_idCatalogo_Estado,
      ce.Modulo AS EstadoModulo,
      ce.Descripcion AS EstadoDescripcion,
      p.Descripcion,
      p.Tipo_Permiso_idTipo_Permiso,
      ctp.Descripcion AS TipoPermisoDescripcion,
      p.Fecha_Inicio,
      p.Fecha_Fin,
      p.Fecha_Solicitud,
      p.Activo
    FROM permisos p
    LEFT JOIN catalogo_estado ce
      ON ce.idCatalogo_Estado = p.Catalogo_Estado_idCatalogo_Estado
    LEFT JOIN catalogo_tipo_permiso ctp
      ON ctp.idCatalogo_Tipo_Permiso = p.Tipo_Permiso_idTipo_Permiso
    ${whereSql}
    ORDER BY p.Fecha_Solicitud DESC, p.idPermisos DESC
  `;

  const res = await db.query(sql, params);
  const rows = normalizeQueryResult(res);
  return mapRowsDates(rows);
}

async function create(data, usuarioId) {
  const {
    Empleado_idEmpleado,
    Catalogo_Periodo_idCatalogo_Periodo,
    Catalogo_Estado_idCatalogo_Estado,
    Descripcion,
    Fecha_Inicio,
    Fecha_Fin,
    Tipo_Permiso_idTipo_Permiso,
    Activo = 1,
  } = data;

  const validacion = await validarCalendarioFeriadoPorFechaInicio(Fecha_Inicio);
  if (validacion?.bloquea) {
    throw400("FERIADO_NO_REQUIERE_PERMISO", validacion.motivo);
  }

  const warningsTraslape = await getTraslapes({
    empleadoId: Empleado_idEmpleado,
    fechaInicio: Fecha_Inicio,
    fechaFin: Fecha_Fin,
  });

  const sql = `
    INSERT INTO permisos
      (Empleado_idEmpleado, Catalogo_Periodo_idCatalogo_Periodo, Catalogo_Estado_idCatalogo_Estado,
       Descripcion, Fecha_Inicio, Fecha_Fin, Fecha_Solicitud, Tipo_Permiso_idTipo_Permiso, Activo)
    VALUES
      (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
  `;

  const res = await db.query(sql, [
    Empleado_idEmpleado,
    Catalogo_Periodo_idCatalogo_Periodo,
    Catalogo_Estado_idCatalogo_Estado,
    Descripcion,
    Fecha_Inicio,
    Fecha_Fin,
    Tipo_Permiso_idTipo_Permiso,
    Activo ? 1 : 0,
  ]);

  const insertId = res?.insertId ?? (Array.isArray(res) ? res[0]?.insertId : null);

  if (insertId) {
    await insertBitacora({
      tabla: "permisos",
      idRegistro: insertId,
      accion: "CREAR",
      usuarioId,
    });
  }

  return { insertId, warnings: { traslapes: warningsTraslape } };
}

async function update(idPermisos, data, usuarioId, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;
  const { Descripcion, Fecha_Inicio, Fecha_Fin, Tipo_Permiso_idTipo_Permiso } = data;

  const actual = await getById(idPermisos, { scopeEmpleadoId, requireScope });
  if (!actual) return { affectedRows: 0, warnings: { traslapes: [] } };

  const validacion = await validarCalendarioFeriadoPorFechaInicio(Fecha_Inicio);
  if (validacion?.bloquea) {
    throw400("FERIADO_NO_REQUIERE_PERMISO", validacion.motivo);
  }

  const warningsTraslape = await getTraslapes({
    empleadoId: actual.Empleado_idEmpleado,
    fechaInicio: Fecha_Inicio,
    fechaFin: Fecha_Fin,
    excludeIdPermisos: idPermisos,
  });

  const sql = `
    UPDATE permisos
    SET
      Descripcion = ?,
      Fecha_Inicio = ?,
      Fecha_Fin = ?,
      Tipo_Permiso_idTipo_Permiso = ?
    WHERE idPermisos = ?
      AND Activo = b'1'
  `;

  const res = await db.query(sql, [
    Descripcion,
    Fecha_Inicio,
    Fecha_Fin,
    Tipo_Permiso_idTipo_Permiso,
    idPermisos,
  ]);

  const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

  if (affectedRows > 0) {
    await insertBitacora({
      tabla: "permisos",
      idRegistro: idPermisos,
      accion: "ACTUALIZAR",
      usuarioId,
    });
  }

  return { affectedRows, warnings: { traslapes: warningsTraslape } };
}

async function updateEstado(idPermisos, estadoId, usuarioId, accionBitacora, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  if (requireScope) {
    const sid = requireScopeEmpleadoId(scopeEmpleadoId);

    const sqlScoped = `
      UPDATE permisos
      SET Catalogo_Estado_idCatalogo_Estado = ?
      WHERE idPermisos = ?
        AND Empleado_idEmpleado = ?
        AND Activo = b'1'
    `;
    const res = await db.query(sqlScoped, [estadoId, idPermisos, sid]);
    const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

    if (affectedRows > 0) {
      await insertBitacora({
        tabla: "permisos",
        idRegistro: idPermisos,
        accion: accionBitacora || "CAMBIAR_ESTADO",
        usuarioId,
      });
    }
    return affectedRows;
  }

  const sql = `
    UPDATE permisos
    SET Catalogo_Estado_idCatalogo_Estado = ?
    WHERE idPermisos = ?
      AND Activo = b'1'
  `;

  const res = await db.query(sql, [estadoId, idPermisos]);
  const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

  if (affectedRows > 0) {
    await insertBitacora({
      tabla: "permisos",
      idRegistro: idPermisos,
      accion: accionBitacora || "CAMBIAR_ESTADO",
      usuarioId,
    });
  }

  return affectedRows;
}

async function softDelete(idPermisos, usuarioId, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  if (requireScope) {
    const sid = requireScopeEmpleadoId(scopeEmpleadoId);

    const sqlScoped = `
      UPDATE permisos
      SET Activo = b'0'
      WHERE idPermisos = ?
        AND Empleado_idEmpleado = ?
        AND Activo = b'1'
    `;
    const res = await db.query(sqlScoped, [idPermisos, sid]);
    const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

    if (affectedRows > 0) {
      await insertBitacora({
        tabla: "permisos",
        idRegistro: idPermisos,
        accion: "DESACTIVAR",
        usuarioId,
      });
    }

    return affectedRows;
  }

  const sql = `
    UPDATE permisos
    SET Activo = b'0'
    WHERE idPermisos = ?
      AND Activo = b'1'
  `;

  const res = await db.query(sql, [idPermisos]);
  const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

  if (affectedRows > 0) {
    await insertBitacora({
      tabla: "permisos",
      idRegistro: idPermisos,
      accion: "DESACTIVAR",
      usuarioId,
    });
  }

  return affectedRows;
}

module.exports = {
  getEmpleadoIdByUsuarioId,
  getPeriodoIdByDate,
  getTraslapes,
  getById,
  list,
  create,
  update,
  updateEstado,
  softDelete,
};
