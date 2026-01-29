//backend/src/controllers/adelantoController.js
import adelantoModel from "../models/adelantoModel.js";

function getRol(req) {
  return (
    req?.user?.rol ??
    req?.user?.Rol ??
    req?.user?.role ??
    req?.user?.Catalogo_Rol_idCatalogo_Rol ??
    req?.usuario?.rol ??
    req?.usuario?.Rol ??
    req?.usuario?.role ??
    null
  );
}

function isRol(rol, ...roles) {
  if (!rol) return false;
  const r = String(rol).toUpperCase();
  return roles.map(x => String(x).toUpperCase()).includes(r);
}

function parseIntOrNull(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function parseDecimalOrNull(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function ok(res, data) {
  res.json(data);
}

function fail(res, err) {
  const status = err?.status || 500;
  res.status(status).json({ message: err?.message || "Error interno del servidor" });
}

async function listar(req, res) {
  try {
    const rol = getRol(req);
    const empleadoToken = adelantoModel.pickEmpleadoId(req);

    const empleadoIdQuery = parseIntOrNull(req.query.empleadoId);
    const periodoId = parseIntOrNull(req.query.periodoId);
    const estadoId = parseIntOrNull(req.query.estadoId);
    const search = (req.query.search || "").toString();
    const limit = parseIntOrNull(req.query.limit) || 200;
    const offset = parseIntOrNull(req.query.offset) || 0;

    let empleadoId = null;

    if (isRol(rol, "COLABORADOR")) {
      if (!empleadoToken) {
        const e = new Error("No se pudo resolver el empleado autenticado.");
        e.status = 401;
        throw e;
      }
      empleadoId = empleadoToken;
    } else {
      empleadoId = empleadoIdQuery || null;
    }

    const rows = await adelantoModel.listarAdelantos({
      empleadoId,
      periodoId,
      estadoId,
      soloActivos: true,
      search,
      limit,
      offset
    });

    ok(res, rows);
  } catch (e) {
    fail(res, e);
  }
}

async function obtenerPorId(req, res) {
  try {
    const rol = getRol(req);
    const empleadoToken = adelantoModel.pickEmpleadoId(req);
    const id = parseIntOrNull(req.params.id);

    if (!id) {
      const e = new Error("Id inválido.");
      e.status = 400;
      throw e;
    }

    const row = await adelantoModel.getAdelantoById(id);
    if (!row || !row.Activo) {
      const e = new Error("Adelanto no encontrado.");
      e.status = 404;
      throw e;
    }

    if (isRol(rol, "COLABORADOR")) {
      if (!empleadoToken) {
        const e = new Error("No se pudo resolver el empleado autenticado.");
        e.status = 401;
        throw e;
      }
      if (Number(row.Empleado_idEmpleado) !== Number(empleadoToken)) {
        const e = new Error("No autorizado.");
        e.status = 403;
        throw e;
      }
    }

    ok(res, row);
  } catch (e) {
    fail(res, e);
  }
}

async function crearSolicitud(req, res) {
  try {
    const rol = getRol(req);
    const empleadoToken = adelantoModel.pickEmpleadoId(req);

    const descripcion = (req.body?.Descripcion ?? req.body?.descripcion ?? "").toString().trim();
    const monto = parseDecimalOrNull(req.body?.Monto ?? req.body?.monto);
    const fechaISO = (req.body?.Fecha ?? req.body?.fecha ?? "").toString().slice(0, 10);
    const empleadoIdBody = parseIntOrNull(req.body?.Empleado_idEmpleado ?? req.body?.empleadoId);

    if (!descripcion) {
      const e = new Error("La descripción es requerida.");
      e.status = 400;
      throw e;
    }
    if (!monto) {
      const e = new Error("El monto debe ser mayor a 0.");
      e.status = 400;
      throw e;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
      const e = new Error("La fecha debe venir en formato yyyy-mm-dd.");
      e.status = 400;
      throw e;
    }

    let empleadoId = null;

    if (isRol(rol, "COLABORADOR")) {
      if (!empleadoToken) {
        const e = new Error("No se pudo resolver el empleado autenticado.");
        e.status = 401;
        throw e;
      }
      empleadoId = empleadoToken;
    } else {
      empleadoId = empleadoIdBody || empleadoToken;
      if (!empleadoId) {
        const e = new Error("Empleado requerido.");
        e.status = 400;
        throw e;
      }
    }

    const created = await adelantoModel.crearSolicitudAdelanto({
      empleadoId,
      descripcion,
      fechaISO,
      monto
    });

    res.status(201).json(created);
  } catch (e) {
    fail(res, e);
  }
}

async function aprobar(req, res) {
  try {
    const rol = getRol(req);
    if (!isRol(rol, "ADMIN", "JEFATURA")) {
      const e = new Error("No autorizado.");
      e.status = 403;
      throw e;
    }

    const id = parseIntOrNull(req.params.id);
    if (!id) {
      const e = new Error("Id inválido.");
      e.status = 400;
      throw e;
    }

    const actual = await adelantoModel.getAdelantoById(id);
    if (!actual || !actual.Activo) {
      const e = new Error("Adelanto no encontrado.");
      e.status = 404;
      throw e;
    }

    let estadoId = await adelantoModel.getEstadoIdByModuloDescripcion("ADELANTO", "APROBADO");
    if (!estadoId) estadoId = await adelantoModel.getEstadoIdByModuloDescripcion("ADELANTO", "APROBADA");
    if (!estadoId) {
      const e = new Error("No existe estado de adelanto 'APROBADO' en catálogo.");
      e.status = 500;
      throw e;
    }

    const updated = await adelantoModel.cambiarEstadoAdelanto({
      idAdelanto: id,
      nuevoEstadoId: estadoId
    });

    ok(res, updated);
  } catch (e) {
    fail(res, e);
  }
}

async function rechazar(req, res) {
  try {
    const rol = getRol(req);
    if (!isRol(rol, "ADMIN", "JEFATURA")) {
      const e = new Error("No autorizado.");
      e.status = 403;
      throw e;
    }

    const id = parseIntOrNull(req.params.id);
    if (!id) {
      const e = new Error("Id inválido.");
      e.status = 400;
      throw e;
    }

    const actual = await adelantoModel.getAdelantoById(id);
    if (!actual || !actual.Activo) {
      const e = new Error("Adelanto no encontrado.");
      e.status = 404;
      throw e;
    }

    let estadoId = await adelantoModel.getEstadoIdByModuloDescripcion("ADELANTO", "RECHAZADO");
    if (!estadoId) estadoId = await adelantoModel.getEstadoIdByModuloDescripcion("ADELANTO", "RECHAZADA");
    if (!estadoId) {
      const e = new Error("No existe estado de adelanto 'RECHAZADO' en catálogo.");
      e.status = 500;
      throw e;
    }

    const updated = await adelantoModel.cambiarEstadoAdelanto({
      idAdelanto: id,
      nuevoEstadoId: estadoId
    });

    ok(res, updated);
  } catch (e) {
    fail(res, e);
  }
}

async function eliminar(req, res) {
  try {
    const rol = getRol(req);
    const empleadoToken = adelantoModel.pickEmpleadoId(req);

    const id = parseIntOrNull(req.params.id);
    if (!id) {
      const e = new Error("Id inválido.");
      e.status = 400;
      throw e;
    }

    const actual = await adelantoModel.getAdelantoById(id);
    if (!actual || !actual.Activo) {
      const e = new Error("Adelanto no encontrado.");
      e.status = 404;
      throw e;
    }

    if (isRol(rol, "COLABORADOR")) {
      if (!empleadoToken) {
        const e = new Error("No se pudo resolver el empleado autenticado.");
        e.status = 401;
        throw e;
      }
      if (Number(actual.Empleado_idEmpleado) !== Number(empleadoToken)) {
        const e = new Error("No autorizado.");
        e.status = 403;
        throw e;
      }
      const estadoDesc = (actual.EstadoDescripcion || "").toString().toUpperCase();
      if (estadoDesc.includes("APROB")) {
        const e = new Error("No se puede eliminar un adelanto aprobado.");
        e.status = 400;
        throw e;
      }
    } else {
      if (!isRol(rol, "ADMIN", "JEFATURA", "PLANILLA")) {
        const e = new Error("No autorizado.");
        e.status = 403;
        throw e;
      }
    }

    const updated = await adelantoModel.desactivarAdelanto(id);
    ok(res, updated);
  } catch (e) {
    fail(res, e);
  }
}

export default {
  listar,
  obtenerPorId,
  crearSolicitud,
  aprobar,
  rechazar,
  eliminar
};
