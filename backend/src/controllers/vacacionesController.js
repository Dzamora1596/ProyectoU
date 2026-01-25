// controllers/vacacionesController.js
const db = require("../config/db");
const vacacionesModel = require("../models/vacacionesModel");

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

function isAdmin(role) {
  return String(role || "").toLowerCase() === "admin";
}

function isJefatura(role) {
  return String(role || "").toLowerCase() === "jefatura";
}
function isPersonalPlanilla(role) {
  return String(role || "").toLowerCase() === "personal de planilla";
}

function canSeeWarnings(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "jefatura" || r === "colaborador" || r === "personal de planilla";
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
    const payload = {
      message: error?.message || defaultMessage,
      code: error?.code || "VALIDATION_ERROR",
    };
    if (error?.extra) payload.extra = error.extra;
    return res.status(status).json(payload);
  }

  return res.status(500).json({
    message: defaultMessage,
    error: error?.message,
  });
}

function attachSaldoWarningIfNeeded(payload, role) {
  if (!canSeeWarnings(role)) return payload;

  const saldo = payload?.saldo ?? payload;
  if (!saldo || typeof saldo !== "object") return payload;

  const disponiblesTotal = Number(
    saldo?.Vacaciones_Disponibles_Total ?? saldo?.Vacaciones_Disponibles ?? 0
  );

  if (!Number.isFinite(disponiblesTotal) || disponiblesTotal <= 12) return payload;

  const warnings = { ...(payload?.warnings || {}) };
  warnings.vacacionesAcumuladas = {
    mensaje:
      `El colaborador tiene ${disponiblesTotal} días de vacaciones disponibles acumuladas. ` +
      `Debe programar vacaciones conforme avanzan los meses (no es legal simplemente eliminarlas).`,
    disponiblesTotal,
    topeOperativoAnual: 12,
  };

  return { ...payload, warnings };
}

async function listar(req, res) {
  try {
    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    const filters = {
      empleadoId: req.query.empleadoId ? Number(req.query.empleadoId) : undefined,
      estadoId: req.query.estadoId ? Number(req.query.estadoId) : undefined,
      periodoId: req.query.periodoId ? Number(req.query.periodoId) : undefined,
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
      const data = await vacacionesModel.list(filters, {
        scopeEmpleadoId: empleadoScope,
        requireScope: true,
      });
      return res.json(data);
    }

    const data = await vacacionesModel.list(filters, {});
    return res.json(data);
  } catch (error) {
    return handleControllerError(res, error, "Error al listar vacaciones");
  }
}

async function obtenerPorId(req, res) {
  try {
    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const vac = await vacacionesModel.getById(
      id,
      empleadoScope ? { scopeEmpleadoId: empleadoScope, requireScope: true } : {}
    );

    if (!vac) return res.status(404).json({ message: "Vacaciones no encontradas" });

    return res.json(vac);
  } catch (error) {
    return handleControllerError(res, error, "Error al obtener vacaciones");
  }
}

async function saldo(req, res) {
  try {
    const role = getUserRole(req);
    const empleadoAuth = getEmpleadoIdFromAuth(req);

    const empleadoIdParam = req.params?.empleadoId ? Number(req.params.empleadoId) : null;

    if (empleadoIdParam) {
      const r = String(role || "").toLowerCase();
      if (!(r === "admin" || r === "jefatura")|| r === "colaborador" || r === "personal de planilla") {
        return res.status(403).json({ message: "No autorizado" });
      }
      let data = await vacacionesModel.getSaldoByEmpleadoId(empleadoIdParam);
      data = attachSaldoWarningIfNeeded(data, role);
      return res.json(data);
    }

    if (!empleadoAuth) {
      return res.status(403).json({ message: "No se pudo determinar el empleado del usuario" });
    }

    let data = await vacacionesModel.getSaldoByEmpleadoId(Number(empleadoAuth));
    data = attachSaldoWarningIfNeeded(data, role);
    return res.json(data);
  } catch (error) {
    return handleControllerError(res, error, "Error al obtener saldo de vacaciones");
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
      Fecha_Inicio,
      Fecha_Fin,
    } = req.body || {};

    const empleadoIdEff = isColaborador(role) ? Number(empleadoScope) : Number(Empleado_idEmpleado || 0);

    if (!empleadoIdEff || !Fecha_Inicio || !Fecha_Fin) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    if (!isValidDateTime(Fecha_Inicio) || !isValidDateTime(Fecha_Fin)) {
      return res.status(400).json({ message: "Fecha_Inicio o Fecha_Fin inválidas" });
    }

    if (new Date(Fecha_Fin).getTime() < new Date(Fecha_Inicio).getTime()) {
      return res.status(400).json({ message: "Fecha_Fin no puede ser menor a Fecha_Inicio" });
    }

    const calc = await vacacionesModel.calcularDiasPorHorarioYFeriados(empleadoIdEff, Fecha_Inicio, Fecha_Fin);

    if (calc.totalConJornada === 0) {
      return res.status(400).json({
        message: "El rango solicitado no contiene días con jornada según el horario del empleado",
        code: "RANGO_SIN_JORNADA",
      });
    }

    if (calc.diasCobrar === 0) {
      return res.status(400).json({
        message: "El rango solicitado cae en feriados (o solo incluye días sin jornada). No se puede solicitar.",
        code: "RANGO_SOLO_FERIADOS",
        feriados: calc.feriados || [],
      });
    }

    const diasSolicitados = Number(calc.diasCobrar);

    const saldoEmp = await vacacionesModel.getSaldoByEmpleadoId(Number(empleadoIdEff));
    const disponiblesBase = Number(
      saldoEmp?.Vacaciones_Disponibles_Total ?? saldoEmp?.Vacaciones_Disponibles ?? 0
    );
    const pendientes = Number(saldoEmp?.Vacaciones_Pendientes ?? 0);
    const disponiblesReales = Math.max(0, disponiblesBase - pendientes);

    if (!isAdmin(role) && diasSolicitados > disponiblesReales) {
      return res.status(400).json({
        message: "No hay suficientes vacaciones disponibles para esta solicitud",
        disponibles: disponiblesReales,
        pendientes,
        derecho: Number(saldoEmp?.Vacaciones_a_Derecho ?? 0),
        derechoReal: Number(saldoEmp?.Vacaciones_a_Derecho_Real ?? 0),
        disfrutadas: Number(saldoEmp?.Vacaciones_Disfrutadas ?? 0),
        disfrutadasTotal: Number(saldoEmp?.Vacaciones_Disfrutadas_Total ?? 0),
      });
    }

    let periodoId = Catalogo_Periodo_idCatalogo_Periodo;
    if (!periodoId) {
      const hoy = new Date().toISOString().slice(0, 19).replace("T", " ");
      periodoId = await vacacionesModel.getPeriodoIdByDate(hoy);

      if (!periodoId) {
        return res.status(400).json({
          message: "No existe un período activo que contenga la fecha actual",
        });
      }
    }

    let estadoId = Catalogo_Estado_idCatalogo_Estado;
    if (!estadoId) {
      estadoId = await getEstadoId("VACACIONES", "PENDIENTE");
      if (!estadoId) {
        return res.status(400).json({
          message: "No existe estado PENDIENTE para módulo VACACIONES en catalogo_estado",
        });
      }
    }

    const created = await vacacionesModel.create(
      {
        Empleado_idEmpleado: Number(empleadoIdEff),
        Catalogo_Periodo_idCatalogo_Periodo: Number(periodoId),
        Catalogo_Estado_idCatalogo_Estado: Number(estadoId),
        Fecha_Inicio,
        Fecha_Fin,
        Vacaciones_Disfrutadas: diasSolicitados,
        Activo: 1,
      },
      usuarioId
    );

    const insertId = typeof created === "object" ? created?.insertId : created;

    if (!insertId) {
      return res.status(500).json({ message: "No se pudo crear la solicitud de vacaciones" });
    }

    const creado = await vacacionesModel.getById(insertId);

    let payload = { ...creado };
    const warnings = typeof created === "object" ? created?.warnings : null;

    if (warnings && canSeeWarnings(role)) payload.warnings = warnings;

    if (canSeeWarnings(role) && Array.isArray(calc.feriados) && calc.feriados.length > 0) {
      payload.warnings = payload.warnings || {};
      payload.warnings.feriados = calc.feriados;
      payload.warnings.mensajeFeriados =
        "El rango incluye feriados. No se cobran como vacaciones y no se descuentan del saldo.";
    }

    payload.saldo = saldoEmp;
    payload = attachSaldoWarningIfNeeded(payload, role);

    payload.calculo = {
      diasCobrar: calc.diasCobrar,
      totalConJornada: calc.totalConJornada,
      feriados: calc.feriados || [],
      desde: calc.d1,
      hasta: calc.d2,
    };

    return res.status(201).json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Error al crear vacaciones");
  }
}

async function actualizar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    if (empleadoScope) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const { Fecha_Inicio, Fecha_Fin, Catalogo_Estado_idCatalogo_Estado } = req.body || {};

    if (!Fecha_Inicio || !Fecha_Fin) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    if (!isValidDateTime(Fecha_Inicio) || !isValidDateTime(Fecha_Fin)) {
      return res.status(400).json({ message: "Fecha_Inicio o Fecha_Fin inválidas" });
    }

    if (new Date(Fecha_Fin).getTime() < new Date(Fecha_Inicio).getTime()) {
      return res.status(400).json({ message: "Fecha_Fin no puede ser menor a Fecha_Inicio" });
    }

    const actual = await vacacionesModel.getById(id);
    if (!actual) return res.status(404).json({ message: "Vacaciones no encontradas o inactivas" });

    const empleadoId = Number(actual.Empleado_idEmpleado);

    const calc = await vacacionesModel.calcularDiasPorHorarioYFeriados(empleadoId, Fecha_Inicio, Fecha_Fin);

    if (calc.totalConJornada === 0) {
      return res.status(400).json({
        message: "El rango solicitado no contiene días con jornada según el horario del empleado",
        code: "RANGO_SIN_JORNADA",
      });
    }

    if (calc.diasCobrar === 0) {
      return res.status(400).json({
        message: "El rango solicitado cae en feriados (o solo incluye días sin jornada). No se puede solicitar.",
        code: "RANGO_SOLO_FERIADOS",
        feriados: calc.feriados || [],
      });
    }

    const dias = Number(calc.diasCobrar);

    const updated = await vacacionesModel.update(
      id,
      {
        Fecha_Inicio,
        Fecha_Fin,
        Vacaciones_Disfrutadas: dias,
        Catalogo_Estado_idCatalogo_Estado: Catalogo_Estado_idCatalogo_Estado
          ? Number(Catalogo_Estado_idCatalogo_Estado)
          : undefined,
      },
      usuarioId
    );

    const affected = typeof updated === "object" ? updated?.affectedRows : updated;

    if (!affected) {
      return res.status(404).json({ message: "Vacaciones no encontradas o inactivas" });
    }

    const actualizado = await vacacionesModel.getById(id);

    const payload = { ...actualizado };
    const warnings = typeof updated === "object" ? updated?.warnings : null;

    if (warnings && canSeeWarnings(role)) payload.warnings = warnings;

    if (canSeeWarnings(role) && Array.isArray(calc.feriados) && calc.feriados.length > 0) {
      payload.warnings = payload.warnings || {};
      payload.warnings.feriados = calc.feriados;
      payload.warnings.mensajeFeriados =
        "El rango incluye feriados. No se cobran como vacaciones y no se descuentan del saldo.";
    }

    payload.calculo = {
      diasCobrar: calc.diasCobrar,
      totalConJornada: calc.totalConJornada,
      feriados: calc.feriados || [],
      desde: calc.d1,
      hasta: calc.d2,
    };

    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Error al actualizar vacaciones");
  }
}

async function aprobar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const role = getUserRole(req);

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const vac = await vacacionesModel.getById(id);
    if (!vac) return res.status(404).json({ message: "Vacaciones no encontradas o inactivas" });

    const empleadoId = Number(vac.Empleado_idEmpleado);
    const diasSolicitud = Number(vac.Vacaciones_Disfrutadas || 0);

    if (!diasSolicitud || diasSolicitud <= 0) {
      return res.status(400).json({ message: "La solicitud no tiene días válidos", code: "VACACIONES_SIN_DIAS" });
    }

    const saldoEmp = await vacacionesModel.getSaldoByEmpleadoId(empleadoId);
    const disponiblesBase = Number(
      saldoEmp?.Vacaciones_Disponibles_Total ?? saldoEmp?.Vacaciones_Disponibles ?? 0
    );
    const pendientes = Number(saldoEmp?.Vacaciones_Pendientes ?? 0);
    const disponiblesReales = Math.max(0, disponiblesBase - pendientes);

    if (diasSolicitud > disponiblesReales) {
      return res.status(400).json({
        message: "No hay suficientes vacaciones disponibles para aprobar esta solicitud",
        code: "SALDO_INSUFICIENTE_PARA_APROBAR",
        disponibles: disponiblesReales,
        pendientes,
        derecho: Number(saldoEmp?.Vacaciones_a_Derecho ?? 0),
        derechoReal: Number(saldoEmp?.Vacaciones_a_Derecho_Real ?? 0),
        disfrutadas: Number(saldoEmp?.Vacaciones_Disfrutadas ?? 0),
        disfrutadasTotal: Number(saldoEmp?.Vacaciones_Disfrutadas_Total ?? 0),
        solicitudDias: diasSolicitud,
      });
    }

    const estadoId = await getEstadoId("VACACIONES", "APROBADO");
    if (!estadoId) {
      return res.status(400).json({
        message: "No existe estado APROBADO para módulo VACACIONES en catalogo_estado",
      });
    }

    const affected = await vacacionesModel.updateEstado(id, Number(estadoId), usuarioId, "APROBAR");
    if (!affected) return res.status(404).json({ message: "Vacaciones no encontradas o inactivas" });

    const actualizado = await vacacionesModel.getById(id);

    let saldoLuego = await vacacionesModel.getSaldoByEmpleadoId(empleadoId);
    saldoLuego = attachSaldoWarningIfNeeded(saldoLuego, role);

    const resp = { ...actualizado, saldo: saldoLuego };
    if (saldoLuego?.warnings) resp.warnings = saldoLuego.warnings;

    return res.json(resp);
  } catch (error) {
    return handleControllerError(res, error, "Error al aprobar vacaciones");
  }
}

async function rechazar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const estadoId = await getEstadoId("VACACIONES", "RECHAZADO");
    if (!estadoId) {
      return res.status(400).json({
        message: "No existe estado RECHAZADO para módulo VACACIONES en catalogo_estado",
      });
    }

    const affected = await vacacionesModel.updateEstado(id, Number(estadoId), usuarioId, "RECHAZAR");
    if (!affected) return res.status(404).json({ message: "Vacaciones no encontradas o inactivas" });

    const actualizado = await vacacionesModel.getById(id);
    return res.json(actualizado);
  } catch (error) {
    return handleControllerError(res, error, "Error al rechazar vacaciones");
  }
}

async function desactivar(req, res) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

    const role = getUserRole(req);
    const empleadoScope = isColaborador(role) ? getEmpleadoIdFromAuth(req) : null;

    if (empleadoScope) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });

    const affected = await vacacionesModel.softDelete(id, usuarioId);
    if (!affected) {
      return res.status(404).json({ message: "Vacaciones no encontradas o ya estaban inactivas" });
    }

    return res.json({ message: "Vacaciones desactivadas" });
  } catch (error) {
    return handleControllerError(res, error, "Error al desactivar vacaciones");
  }
}

module.exports = {
  listar,
  obtenerPorId,
  saldo,
  crear,
  actualizar,
  aprobar,
  rechazar,
  desactivar,
};
