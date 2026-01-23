// controllers/permisosController.js
const db = require("../config/db");
const permisosModel = require("../models/permisosModel");

function getUserId(req) {
  return (
    req?.user?.idUsuario ??
    req?.user?.id ??
    req?.user?.userId ??
    req?.usuario?.idUsuario ??
    req?.usuario?.id ??
    req?.usuario?.userId ??
    null
  );
}

function getUserRole(req) {
  const r =
    req?.user?.rol ??
    req?.user?.role ??
    req?.user?.Rol ??
    req?.usuario?.rol ??
    req?.usuario?.role ??
    req?.usuario?.Rol ??
    "";
  return String(r || "").trim();
}

function getEmpleadoIdFromAuth(req) {
  const v =
    req?.user?.Empleado_idEmpleado ??
    req?.user?.empleadoId ??
    req?.user?.idEmpleado ??
    req?.user?.EmpleadoId ??
    req?.usuario?.Empleado_idEmpleado ??
    req?.usuario?.empleadoId ??
    req?.usuario?.idEmpleado ??
    req?.usuario?.EmpleadoId ??
    null;

  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isColaborador(role) {
  return String(role || "").toLowerCase() === "colaborador";
}

function canSeeWarnings(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "jefatura" || r === "colaborador";
}

function isValidDateTime(value) {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function normalizeQueryResult(result) {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (result && Array.isArray(result.rows)) return result.rows;
  return result;
}

async function getEstadoId(modulo, descripcion) {
  const sql = `
    SELECT idCatalogo_Estado
    FROM catalogo_estado
    WHERE Activo = b'1'
      AND UPPER(Modulo) = UPPER(?)
      AND UPPER(Descripcion) = UPPER(?)
    LIMIT 1
  `;
  const result = await db.query(sql, [modulo, descripcion]);
  const rows = normalizeQueryResult(result) || [];
  return rows?.[0]?.idCatalogo_Estado ?? null;
}

function handleControllerError(res, error, defaultMessage) {
  const status = Number(error?.statusCode || error?.status || 0);

  if (status >= 400 && status < 500) {
    return res.status(status).json({
      message: error?.message || defaultMessage,
      code: error?.code || "VALIDATION_ERROR",
    });
  }

  return res.status(500).json({
    message: defaultMessage,
    error: error?.message,
  });
}

async function listar(req, res) {
  try {
    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    const filters = {
      empleadoId: req.query.empleadoId ? Number(req.query.empleadoId) : undefined,
      estadoId: req.query.estadoId ? Number(req.query.estadoId) : undefined,
      periodoId: req.query.periodoId ? Number(req.query.periodoId) : undefined,
      tipoPermisoId: req.query.tipoPermisoId ? Number(req.query.tipoPermisoId) : undefined,
      desde: req.query.desde,
      hasta: req.query.hasta,
      activo: req.query.activo !== undefined ? Number(req.query.activo) : 1,
    };

    if (filters.desde && !isValidDateTime(filters.desde)) {
      return res.status(400).json({ message: "Parámetro 'desde' inválido" });
    }

    if (filters.hasta && !isValidDateTime(filters.hasta)) {
      return res.status(400).json({ message: "Parámetro 'hasta' inválido" });
    }

    if (empleadoScope) {
      const data = await permisosModel.list(filters, { scopeEmpleadoId: empleadoScope, requireScope: true });
      return res.json(data);
    }

    const data = await permisosModel.list(filters, {});
    return res.json(data);
  } catch (error) {
    return handleControllerError(res, error, "Error al listar permisos");
  }
}

async function obtenerPorId(req, res) {
  try {
    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const permiso = await permisosModel.getById(
      id,
      empleadoScope ? { scopeEmpleadoId: empleadoScope, requireScope: true } : {}
    );

    if (!permiso) return res.status(404).json({ message: "Permiso no encontrado" });

    return res.json(permiso);
  } catch (error) {
    return handleControllerError(res, error, "Error al obtener permiso");
  }
}

async function crear(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    if (isColaborador(role) && !empleadoScope) {
      return res.status(403).json({ message: "No se pudo determinar el empleado del usuario" });
    }

    const {
      Empleado_idEmpleado,
      Catalogo_Periodo_idCatalogo_Periodo,
      Catalogo_Estado_idCatalogo_Estado,
      Descripcion,
      Fecha_Inicio,
      Fecha_Fin,
      Tipo_Permiso_idTipo_Permiso,
    } = req.body || {};

    const empleadoIdEff = isColaborador(role) ? Number(empleadoScope) : Number(Empleado_idEmpleado || 0);

    if (!empleadoIdEff || !Tipo_Permiso_idTipo_Permiso || !Descripcion || !Fecha_Inicio || !Fecha_Fin) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    if (!isValidDateTime(Fecha_Inicio) || !isValidDateTime(Fecha_Fin)) {
      return res.status(400).json({ message: "Fecha_Inicio o Fecha_Fin inválidas" });
    }

    if (new Date(Fecha_Fin).getTime() < new Date(Fecha_Inicio).getTime()) {
      return res.status(400).json({ message: "Fecha_Fin no puede ser menor a Fecha_Inicio" });
    }

    let periodoId = Catalogo_Periodo_idCatalogo_Periodo;
    if (!periodoId) {
      const hoy = new Date().toISOString().slice(0, 19).replace("T", " ");
      periodoId = await permisosModel.getPeriodoIdByDate(hoy);

      if (!periodoId) {
        return res.status(400).json({
          message: "No existe un período activo que contenga la fecha actual (Fecha_Solicitud)",
        });
      }
    }

    let estadoId = Catalogo_Estado_idCatalogo_Estado;
    if (!estadoId) {
      estadoId = await getEstadoId("PERMISO", "PENDIENTE");
      if (!estadoId) {
        return res.status(400).json({
          message: "No existe estado PENDIENTE para módulo PERMISO en catalogo_estado",
        });
      }
    }

    const created = await permisosModel.create(
      {
        Empleado_idEmpleado: Number(empleadoIdEff),
        Catalogo_Periodo_idCatalogo_Periodo: Number(periodoId),
        Catalogo_Estado_idCatalogo_Estado: Number(estadoId),
        Descripcion: String(Descripcion),
        Fecha_Inicio,
        Fecha_Fin,
        Tipo_Permiso_idTipo_Permiso: Number(Tipo_Permiso_idTipo_Permiso),
        Activo: 1,
      },
      usuarioId
    );

    const insertId = typeof created === "object" ? created?.insertId : created;

    if (!insertId) {
      return res.status(500).json({ message: "No se pudo crear el permiso" });
    }

    const creado = await permisosModel.getById(insertId);

    const payload = { ...creado };
    const warnings = typeof created === "object" ? created?.warnings : null;

    if (warnings && canSeeWarnings(role)) {
      payload.warnings = warnings;
    }

    return res.status(201).json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Error al crear permiso");
  }
}

async function actualizar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const { Descripcion, Fecha_Inicio, Fecha_Fin, Tipo_Permiso_idTipo_Permiso } = req.body || {};

    if (!Descripcion || !Fecha_Inicio || !Fecha_Fin || !Tipo_Permiso_idTipo_Permiso) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    if (!isValidDateTime(Fecha_Inicio) || !isValidDateTime(Fecha_Fin)) {
      return res.status(400).json({ message: "Fecha_Inicio o Fecha_Fin inválidas" });
    }

    if (new Date(Fecha_Fin).getTime() < new Date(Fecha_Inicio).getTime()) {
      return res.status(400).json({ message: "Fecha_Fin no puede ser menor a Fecha_Inicio" });
    }

    if (empleadoScope) {
      const existe = await permisosModel.getById(id, { scopeEmpleadoId: empleadoScope, requireScope: true });
      if (!existe) return res.status(404).json({ message: "Permiso no encontrado" });
    }

    const updated = await permisosModel.update(
      id,
      {
        Descripcion: String(Descripcion),
        Fecha_Inicio,
        Fecha_Fin,
        Tipo_Permiso_idTipo_Permiso: Number(Tipo_Permiso_idTipo_Permiso),
      },
      usuarioId
    );

    const affected = typeof updated === "object" ? updated?.affectedRows : updated;

    if (!affected) {
      return res.status(404).json({ message: "Permiso no encontrado o inactivo" });
    }

    const actualizado = await permisosModel.getById(id);

    const payload = { ...actualizado };
    const warnings = typeof updated === "object" ? updated?.warnings : null;

    if (warnings && canSeeWarnings(role)) {
      payload.warnings = warnings;
    }

    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Error al actualizar permiso");
  }
}

async function aprobar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const estadoId = await getEstadoId("PERMISO", "APROBADO");
    if (!estadoId) {
      return res.status(400).json({
        message: "No existe estado APROBADO para módulo PERMISO en catalogo_estado",
      });
    }

    const affected = await permisosModel.updateEstado(id, Number(estadoId), usuarioId, "APROBAR");
    if (!affected) return res.status(404).json({ message: "Permiso no encontrado o inactivo" });

    const actualizado = await permisosModel.getById(id);
    return res.json(actualizado);
  } catch (error) {
    return handleControllerError(res, error, "Error al aprobar permiso");
  }
}

async function rechazar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const estadoId = await getEstadoId("PERMISO", "RECHAZADO");
    if (!estadoId) {
      return res.status(400).json({
        message: "No existe estado RECHAZADO para módulo PERMISO en catalogo_estado",
      });
    }

    const affected = await permisosModel.updateEstado(id, Number(estadoId), usuarioId, "RECHAZAR");
    if (!affected) return res.status(404).json({ message: "Permiso no encontrado o inactivo" });

    const actualizado = await permisosModel.getById(id);
    return res.json(actualizado);
  } catch (error) {
    return handleControllerError(res, error, "Error al rechazar permiso");
  }
}

async function desactivar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    if (empleadoScope) {
      const existe = await permisosModel.getById(id, { scopeEmpleadoId: empleadoScope, requireScope: true });
      if (!existe) return res.status(404).json({ message: "Permiso no encontrado" });
    }

    const affected = await permisosModel.softDelete(id, usuarioId);
    if (!affected) {
      return res.status(404).json({ message: "Permiso no encontrado o ya estaba inactivo" });
    }

    return res.json({ message: "Permiso desactivado" });
  } catch (error) {
    return handleControllerError(res, error, "Error al desactivar permiso");
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  aprobar,
  rechazar,
  desactivar,
};
