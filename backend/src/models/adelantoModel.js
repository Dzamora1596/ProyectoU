//backend/src/models/adelantoModel.js
import pool from "../config/db.js";

function pickEmpleadoId(req) {
  return (
    req?.user?.Empleado_idEmpleado ??
    req?.user?.empleadoId ??
    req?.user?.idEmpleado ??
    req?.usuario?.Empleado_idEmpleado ??
    req?.usuario?.empleadoId ??
    req?.usuario?.idEmpleado ??
    null
  );
}

function pickUsuarioId(req) {
  return (
    req?.user?.idUsuario ??
    req?.user?.usuarioId ??
    req?.usuario?.idUsuario ??
    req?.usuario?.usuarioId ??
    null
  );
}

async function getEstadoIdByModuloDescripcion(modulo, descripcion, conn = pool) {
  const [rows] = await conn.query(
    `SELECT idCatalogo_Estado
     FROM catalogo_estado
     WHERE UPPER(Modulo)=UPPER(?) AND UPPER(Descripcion)=UPPER(?) AND Activo=1
     LIMIT 1`,
    [modulo, descripcion]
  );
  if (!rows.length) return null;
  return rows[0].idCatalogo_Estado;
}

async function getPeriodoIdByFecha(fechaISO, conn = pool) {
  const [rows] = await conn.query(
    `SELECT idCatalogo_Periodo
     FROM catalogo_periodo
     WHERE ? BETWEEN Fecha_Inicio AND Fecha_Fin AND Activo=1
     LIMIT 1`,
    [fechaISO]
  );
  if (!rows.length) return null;
  return rows[0].idCatalogo_Periodo;
}

async function getAdelantoById(idAdelanto) {
  const [rows] = await pool.query(
    `SELECT a.idAdelanto, a.Empleado_idEmpleado, a.Catalogo_Periodo_idCatalogo_Periodo, a.Catalogo_Estado_idCatalogo_Estado,
            a.Descripcion, a.Fecha, a.Monto, a.Activo,
            ce.Modulo AS EstadoModulo, ce.Descripcion AS EstadoDescripcion,
            p.Fecha_Inicio AS PeriodoInicio, p.Fecha_Fin AS PeriodoFin
     FROM adelanto a
     LEFT JOIN catalogo_estado ce ON ce.idCatalogo_Estado = a.Catalogo_Estado_idCatalogo_Estado
     LEFT JOIN catalogo_periodo p ON p.idCatalogo_Periodo = a.Catalogo_Periodo_idCatalogo_Periodo
     WHERE a.idAdelanto = ?
     LIMIT 1`,
    [idAdelanto]
  );
  return rows[0] || null;
}

async function listarAdelantos({
  empleadoId = null,
  periodoId = null,
  estadoId = null,
  soloActivos = true,
  search = "",
  limit = 200,
  offset = 0
}) {
  const where = [];
  const params = [];

  if (soloActivos) {
    where.push("a.Activo=1");
  }

  if (empleadoId) {
    where.push("a.Empleado_idEmpleado=?");
    params.push(empleadoId);
  }

  if (periodoId) {
    where.push("a.Catalogo_Periodo_idCatalogo_Periodo=?");
    params.push(periodoId);
  }

  if (estadoId) {
    where.push("a.Catalogo_Estado_idCatalogo_Estado=?");
    params.push(estadoId);
  }

  if (search && search.trim()) {
    where.push("(a.Descripcion LIKE ?)");
    params.push(`%${search.trim()}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT a.idAdelanto, a.Empleado_idEmpleado, a.Catalogo_Periodo_idCatalogo_Periodo, a.Catalogo_Estado_idCatalogo_Estado,
            a.Descripcion, a.Fecha, a.Monto, a.Activo,
            ce.Modulo AS EstadoModulo, ce.Descripcion AS EstadoDescripcion,
            p.Fecha_Inicio AS PeriodoInicio, p.Fecha_Fin AS PeriodoFin
     FROM adelanto a
     LEFT JOIN catalogo_estado ce ON ce.idCatalogo_Estado = a.Catalogo_Estado_idCatalogo_Estado
     LEFT JOIN catalogo_periodo p ON p.idCatalogo_Periodo = a.Catalogo_Periodo_idCatalogo_Periodo
     ${whereSql}
     ORDER BY a.Fecha DESC, a.idAdelanto DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return rows;
}

async function crearSolicitudAdelanto({
  empleadoId,
  descripcion,
  fechaISO,
  monto
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const periodoId = await getPeriodoIdByFecha(fechaISO, conn);
    if (!periodoId) {
      const err = new Error("No existe un período de planilla para la fecha indicada.");
      err.status = 400;
      throw err;
    }

    let estadoId = await getEstadoIdByModuloDescripcion("ADELANTO", "PENDIENTE", conn);
    if (!estadoId) {
      estadoId = await getEstadoIdByModuloDescripcion("ADELANTO", "PENDIENTE DE APROBACION", conn);
    }
    if (!estadoId) {
      const err = new Error("No existe estado de adelanto 'PENDIENTE' en catálogo.");
      err.status = 500;
      throw err;
    }

    const [result] = await conn.query(
      `INSERT INTO adelanto
       (Empleado_idEmpleado, Catalogo_Periodo_idCatalogo_Periodo, Catalogo_Estado_idCatalogo_Estado, Descripcion, Fecha, Monto, Activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [empleadoId, periodoId, estadoId, descripcion, `${fechaISO} 00:00:00`, monto]
    );

    await conn.commit();
    return await getAdelantoById(result.insertId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cambiarEstadoAdelanto({
  idAdelanto,
  nuevoEstadoId
}) {
  const [res] = await pool.query(
    `UPDATE adelanto
     SET Catalogo_Estado_idCatalogo_Estado=?
     WHERE idAdelanto=?`,
    [nuevoEstadoId, idAdelanto]
  );
  if (res.affectedRows === 0) return null;
  return await getAdelantoById(idAdelanto);
}

async function desactivarAdelanto(idAdelanto) {
  const [res] = await pool.query(
    `UPDATE adelanto SET Activo=0 WHERE idAdelanto=?`,
    [idAdelanto]
  );
  if (res.affectedRows === 0) return null;
  return await getAdelantoById(idAdelanto);
}

export default {
  pickEmpleadoId,
  pickUsuarioId,
  getEstadoIdByModuloDescripcion,
  getPeriodoIdByFecha,
  getAdelantoById,
  listarAdelantos,
  crearSolicitudAdelanto,
  cambiarEstadoAdelanto,
  desactivarAdelanto
};