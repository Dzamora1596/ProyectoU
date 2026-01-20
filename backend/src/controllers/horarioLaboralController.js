// controllers/horarioLaboralController.js
const db = require("../config/db");
const horarioLaboralModel = require("../models/horarioLaboralModel");

function bitToBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

function mapBit01(v) {
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  return Number(v) ? 1 : 0;
}

function toTime(v) {
  const s = String(v ?? "").trim();
  if (!s) return "00:00:00";
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return "00:00:00";
}

function toBit01(v, defaultValue = 1) {
  if (v === null || v === undefined) return defaultValue;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v === 1 ? 1 : 0;
  const s = String(v).toLowerCase().trim();
  if (s === "1" || s === "true" || s === "si" || s === "sí") return 1;
  if (s === "0" || s === "false" || s === "no") return 0;
  return defaultValue;
}

function ok(res, payload) {
  return res.json({ ok: true, ...payload });
}

function fail(res, status, mensaje, err) {
  return res.status(status).json({
    ok: false,
    mensaje,
    error: err ? String(err?.message || err) : undefined,
  });
}

function diaValido(d) {
  const n = Number(d);
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

function normalizarTime(t) {
  const s = String(t || "").trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return "";
  return s.length === 5 ? `${s}:00` : s;
}

function getEmpleadoId(req) {
  const raw = req.params?.idEmpleado ?? req.params?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildDetalleCompleto(rawDetalle) {
  const DIAS = [1, 2, 3, 4, 5, 6, 7];

  const map = new Map(
    (Array.isArray(rawDetalle) ? rawDetalle : []).map((x) => [
      Number(x.diaSemana ?? x.Dia_Semana),
      {
        entrada: String(x.entrada ?? x.Entrada ?? ""),
        salida: String(x.salida ?? x.Salida ?? ""),
        activo: Number(x.activo ?? x.Activo ?? 1),
      },
    ])
  );

  return DIAS.map((dia) => {
    const found = map.get(dia);
    return {
      diaSemana: dia,
      entrada: found?.entrada || "00:00:00",
      salida: found?.salida || "00:00:00",
      activo: found?.activo ?? 0,
    };
  });
}

 

const listarHorarios = async (req, res) => {
  try {
    const rows = await horarioLaboralModel.listarHorarios();

    const horarios = rows.map((r) => ({
      idHorarioLaboral: r.idHorarioLaboral ?? r.idHorario_Laboral,
      descripcion: r.Descripcion ?? r.descripcion ?? "",
      entrada: r.Entrada ? String(r.Entrada) : "00:00:00",
      salida: r.Salida ? String(r.Salida) : "00:00:00",
      activo: bitToBool(r.Activo ?? r.activo),
    }));

    return res.json({ ok: true, horarios });
  } catch (e) {
    return fail(res, 500, "Error listando horarios", e);
  }
};

const crearHorario = async (req, res) => {
  try {
    const descripcion = String(req.body?.descripcion ?? "").trim();
    const entrada = toTime(req.body?.entrada);
    const salida = toTime(req.body?.salida);
    const activo = toBit01(req.body?.activo, 1);

    if (!descripcion) return fail(res, 400, "La descripción es requerida.");

    const r = await horarioLaboralModel.crearHorario({
      descripcion,
      entrada,
      salida,
      activo,
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Horario creado.",
      idHorarioLaboral: r.insertId,
    });
  } catch (e) {
    return fail(res, 500, "Error creando horario", e);
  }
};

const actualizarHorario = async (req, res) => {
  try {
    const idHorarioLaboral = Number(req.params.idHorarioLaboral);
    if (!idHorarioLaboral) return fail(res, 400, "idHorarioLaboral inválido.");

    const { descripcion, entrada, salida, activo } = req.body ?? {};

    if (
      descripcion === undefined &&
      entrada === undefined &&
      salida === undefined &&
      activo === undefined
    ) {
      return fail(res, 400, "Debe enviar al menos un campo para actualizar.");
    }

    const fields = {};

    if (descripcion !== undefined) {
      const d = String(descripcion ?? "").trim();
      if (!d) return fail(res, 400, "La descripción no puede ir vacía.");
      fields.descripcion = d;
    }
    if (entrada !== undefined) fields.entrada = toTime(entrada);
    if (salida !== undefined) fields.salida = toTime(salida);
    if (activo !== undefined) fields.activo = toBit01(activo, 1);

    const r = await horarioLaboralModel.actualizarHorario(idHorarioLaboral, fields);

    if (r.affectedRows === 0) return fail(res, 404, "Horario no encontrado.");

    return res.json({ ok: true, mensaje: "Horario actualizado." });
  } catch (e) {
    return fail(res, 500, "Error actualizando horario", e);
  }
};

const eliminarHorario = async (req, res) => {
  try {
    const idHorarioLaboral = Number(req.params.idHorarioLaboral);
    if (!idHorarioLaboral) return fail(res, 400, "idHorarioLaboral inválido.");

    const r = await horarioLaboralModel.desactivarHorario(idHorarioLaboral);

    if (r.affectedRows === 0) return fail(res, 404, "Horario no encontrado.");

    return res.json({ ok: true, mensaje: "Horario desactivado." });
  } catch (e) {
    return fail(res, 500, "Error desactivando horario", e);
  }
};

 

const listarCatalogosHorario = async (req, res) => {
  try {
    const rows = await horarioLaboralModel.listarCatalogosHorario();

    return ok(res, {
      catalogos: rows.map((r) => ({
        idCatalogoHorario: Number(r.idCatalogoHorario),
        descripcion: r.descripcion ?? "",
        tipoHorarioId:
          r.tipoHorarioId !== null && r.tipoHorarioId !== undefined ? Number(r.tipoHorarioId) : null,
        tipoHorarioDescripcion: r.tipoHorarioDescripcion ?? "",
        activo: mapBit01(r.activo),
        diasConfigurados: Number(r.diasConfigurados || 0),
      })),
    });
  } catch (e) {
    return fail(res, 500, "Error listando catálogos de horario", e);
  }
};

const crearCatalogoHorario = async (req, res) => {
  try {
    const descripcion = String(req.body?.descripcion ?? "").trim();
    const tipoHorarioId = Number(req.body?.tipoHorarioId || 0);
    const activo = toBit01(req.body?.activo, 1);

    if (!descripcion) return fail(res, 400, "La descripción es requerida.");
    if (!tipoHorarioId) return fail(res, 400, "tipoHorarioId es requerido.");

    const existeTipo = await horarioLaboralModel.existeTipoHorarioActivo(tipoHorarioId);
    if (!existeTipo) return fail(res, 404, "Tipo de horario no encontrado o inactivo");

    const r = await horarioLaboralModel.crearCatalogoHorario({
      tipoHorarioId,
      descripcion,
      activo,
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Catálogo creado.",
      idCatalogoHorario: r.insertId,
    });
  } catch (e) {
    return fail(res, 500, "Error creando catálogo", e);
  }
};

const actualizarCatalogoHorario = async (req, res) => {
  try {
    const idCatalogoHorario = Number(req.params.idCatalogoHorario || 0);
    if (!idCatalogoHorario) return fail(res, 400, "idCatalogoHorario inválido");

    const { descripcion, tipoHorarioId, activo } = req.body ?? {};
    if (descripcion === undefined && tipoHorarioId === undefined && activo === undefined) {
      return fail(res, 400, "Debe enviar al menos un campo para actualizar.");
    }

    const fields = {};

    if (descripcion !== undefined) {
      const d = String(descripcion ?? "").trim();
      if (!d) return fail(res, 400, "La descripción no puede ir vacía.");
      fields.descripcion = d;
    }

    if (tipoHorarioId !== undefined) {
      const t = Number(tipoHorarioId || 0);
      if (!t) return fail(res, 400, "tipoHorarioId inválido");

      const existeTipo = await horarioLaboralModel.existeTipoHorarioActivo(t);
      if (!existeTipo) return fail(res, 404, "Tipo de horario no encontrado o inactivo");

      fields.tipoHorarioId = t;
    }

    if (activo !== undefined) fields.activo = toBit01(activo, 1);

    const r = await horarioLaboralModel.actualizarCatalogoHorario(idCatalogoHorario, fields);

    if (!r.affectedRows) return fail(res, 404, "Catálogo no encontrado.");

    return ok(res, { mensaje: "Catálogo actualizado." });
  } catch (e) {
    return fail(res, 500, "Error actualizando catálogo", e);
  }
};

const eliminarCatalogoHorario = async (req, res) => {
  try {
    const idCatalogoHorario = Number(req.params.idCatalogoHorario || 0);
    if (!idCatalogoHorario) return fail(res, 400, "idCatalogoHorario inválido");

    const r = await horarioLaboralModel.desactivarCatalogoHorario(idCatalogoHorario);

    if (!r.affectedRows) return fail(res, 404, "Catálogo no encontrado.");

    return ok(res, { mensaje: "Catálogo desactivado." });
  } catch (e) {
    return fail(res, 500, "Error desactivando catálogo", e);
  }
};

const listarTiposHorario = async (req, res) => {
  try {
    const rows = await horarioLaboralModel.listarTiposHorarioActivos();

    return ok(res, {
      tipos: rows.map((r) => ({
        idCatalogoTipoHorario: Number(r.idCatalogoTipoHorario),
        descripcion: r.descripcion ?? "",
        activo: mapBit01(r.activo),
      })),
    });
  } catch (e) {
    return fail(res, 500, "Error listando tipos de horario", e);
  }
};

 

const obtenerDetalleCatalogoHorario = async (req, res) => {
  try {
    const idCatalogoHorario = Number(req.params.idCatalogoHorario);
    if (!idCatalogoHorario) return fail(res, 400, "idCatalogoHorario inválido");

    const existe = await horarioLaboralModel.existeCatalogoActivo(idCatalogoHorario);
    if (!existe) return fail(res, 404, "Catálogo no encontrado o inactivo");

    const rows = await horarioLaboralModel.obtenerDetalleCatalogoHorario(idCatalogoHorario);

    return ok(res, {
      idCatalogoHorario,
      detalle: rows.map((r) => ({
        idCatalogoHorarioDetalle: Number(r.idCatalogoHorarioDetalle),
        diaSemana: Number(r.diaSemana),
        entrada: String(r.entrada),
        salida: String(r.salida),
        activo: mapBit01(r.activo),
      })),
    });
  } catch (e) {
    return fail(res, 500, "Error obteniendo detalle del catálogo", e);
  }
};

const crearDetalleCatalogoHorario = async (req, res) => {
  try {
    const idCatalogoHorario = Number(req.params.idCatalogoHorario || 0);
    if (!idCatalogoHorario) return fail(res, 400, "idCatalogoHorario inválido");

    const diaSemana = Number(req.body?.diaSemana);
    const entrada = normalizarTime(req.body?.entrada);
    const salida = normalizarTime(req.body?.salida);
    const activo = toBit01(req.body?.activo, 1);

    if (!diaValido(diaSemana)) return fail(res, 400, "diaSemana inválido (1..7)");
    if (!entrada || !salida) return fail(res, 400, "entrada y salida son requeridas");

    const existe = await horarioLaboralModel.existeCatalogoActivo(idCatalogoHorario);
    if (!existe) return fail(res, 404, "Catálogo no encontrado o inactivo");

    const r = await horarioLaboralModel.crearDetalleCatalogoHorario(idCatalogoHorario, {
      diaSemana,
      entrada,
      salida,
      activo,
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Detalle creado.",
      idCatalogoHorarioDetalle: r.insertId,
    });
  } catch (e) {
    if (String(e?.code || "").toUpperCase() === "ER_DUP_ENTRY") {
      return fail(res, 409, "Ya existe un detalle para ese día en este catálogo.", e);
    }
    return fail(res, 500, "Error creando detalle del catálogo", e);
  }
};

const actualizarDetalleCatalogoHorario = async (req, res) => {
  try {
    const idCatalogoHorario = Number(req.params.idCatalogoHorario || 0);
    const idCatalogoHorarioDetalle = Number(req.params.idCatalogoHorarioDetalle || 0);
    if (!idCatalogoHorario) return fail(res, 400, "idCatalogoHorario inválido");
    if (!idCatalogoHorarioDetalle) return fail(res, 400, "idCatalogoHorarioDetalle inválido");

    const { diaSemana, entrada, salida, activo } = req.body ?? {};
    if (
      diaSemana === undefined &&
      entrada === undefined &&
      salida === undefined &&
      activo === undefined
    ) {
      return fail(res, 400, "Debe enviar al menos un campo para actualizar.");
    }

    const fields = {};

    if (diaSemana !== undefined) {
      const d = Number(diaSemana);
      if (!diaValido(d)) return fail(res, 400, "diaSemana inválido (1..7)");
      fields.diaSemana = d;
    }

    if (entrada !== undefined) {
      const e = normalizarTime(entrada);
      if (!e) return fail(res, 400, "entrada inválida");
      fields.entrada = e;
    }

    if (salida !== undefined) {
      const s = normalizarTime(salida);
      if (!s) return fail(res, 400, "salida inválida");
      fields.salida = s;
    }

    if (activo !== undefined) fields.activo = toBit01(activo, 1);

    const r = await horarioLaboralModel.actualizarDetalleCatalogoHorario(
      idCatalogoHorario,
      idCatalogoHorarioDetalle,
      fields
    );

    if (!r.affectedRows) return fail(res, 404, "Detalle no encontrado.");

    return ok(res, { mensaje: "Detalle actualizado." });
  } catch (e) {
    if (String(e?.code || "").toUpperCase() === "ER_DUP_ENTRY") {
      return fail(res, 409, "Ya existe un detalle para ese día en este catálogo.", e);
    }
    return fail(res, 500, "Error actualizando detalle del catálogo", e);
  }
};

const eliminarDetalleCatalogoHorario = async (req, res) => {
  try {
    const idCatalogoHorario = Number(req.params.idCatalogoHorario || 0);
    const idCatalogoHorarioDetalle = Number(req.params.idCatalogoHorarioDetalle || 0);
    if (!idCatalogoHorario) return fail(res, 400, "idCatalogoHorario inválido");
    if (!idCatalogoHorarioDetalle) return fail(res, 400, "idCatalogoHorarioDetalle inválido");

    const r = await horarioLaboralModel.desactivarDetalleCatalogoHorario(
      idCatalogoHorario,
      idCatalogoHorarioDetalle
    );

    if (!r.affectedRows) return fail(res, 404, "Detalle no encontrado.");

    return ok(res, { mensaje: "Detalle desactivado." });
  } catch (e) {
    return fail(res, 500, "Error desactivando detalle del catálogo", e);
  }
};

 

const obtenerHorarioPorEmpleado = async (req, res) => {
  try {
    const idEmpleado = getEmpleadoId(req);
    if (!idEmpleado) return fail(res, 400, "idEmpleado inválido");

    const a = await horarioLaboralModel.obtenerAsignacionActivaEmpleado(idEmpleado);

    if (!a) {
      return ok(res, { horario: null, detalle: buildDetalleCompleto([]) });
    }

    const dRows = await horarioLaboralModel.obtenerDetalleActivoCatalogo(Number(a.idCatalogoHorario));

    const detalleCompleto = buildDetalleCompleto(
      dRows.map((r) => ({
        diaSemana: Number(r.diaSemana),
        entrada: String(r.entrada),
        salida: String(r.salida),
        activo: mapBit01(r.activo),
      }))
    );

    return ok(res, {
      horario: {
        idHorarioEmpleado: Number(a.idHorarioEmpleado),
        empleadoId: Number(a.empleadoId),
        idCatalogoHorario: Number(a.idCatalogoHorario),
        catalogoDescripcion: a.catalogoDescripcion ?? "",
        tipoHorarioId:
          a.tipoHorarioId !== null && a.tipoHorarioId !== undefined ? Number(a.tipoHorarioId) : null,
        tipoHorarioDescripcion: a.tipoHorarioDescripcion ?? "",
        fechaAsignacion: a.fechaAsignacion ? String(a.fechaAsignacion) : null,
        activo: mapBit01(a.activo),
      },
      detalle: detalleCompleto,
    });
  } catch (e) {
    return fail(res, 500, "Error obteniendo horario por empleado", e);
  }
};

const obtenerDetallePorEmpleado = async (req, res) => {
   
  return obtenerHorarioPorEmpleado(req, res);
};

 
const upsertDetallePorEmpleado = async (req, res) => {
  let conn;
  try {
    const idEmpleado = getEmpleadoId(req);
    if (!idEmpleado) return fail(res, 400, "idEmpleado inválido");

    const idCatalogoHorario = Number(req.body?.idCatalogoHorario || 0);
    if (!idCatalogoHorario) return fail(res, 400, "Debe enviar { idCatalogoHorario }");

    conn = await db.getConnection();
    await conn.beginTransaction();

     
    const [catRows] = await conn.query(
      `
      SELECT idCatalogo_Horario
      FROM catalogo_horario
      WHERE idCatalogo_Horario = ?
        AND Activo = 1
      LIMIT 1
      `,
      [idCatalogoHorario]
    );

    if (!catRows.length) {
      await conn.rollback();
      return fail(res, 404, "Catálogo no encontrado o inactivo");
    }

     
    const tieneDetalle = await horarioLaboralModel.catalogoTieneDetalleActivoConn(conn, idCatalogoHorario);
    if (!tieneDetalle) {
      await conn.rollback();
      return fail(res, 400, "El catálogo seleccionado no tiene detalle activo configurado.");
    }

    
    const [asigRows] = await conn.query(
      `
      SELECT idHorario_Empleado
      FROM horario_empleado
      WHERE Empleado_idEmpleado = ?
        AND Activo = 1
      LIMIT 1
      `,
      [idEmpleado]
    );

    if (asigRows.length) {
      await horarioLaboralModel.actualizarAsignacionActivaEmpleadoConn(conn, idEmpleado, idCatalogoHorario);
    } else {
      await horarioLaboralModel.crearAsignacionEmpleadoConn(conn, idEmpleado, idCatalogoHorario);
    }

    await conn.commit();

    return ok(res, {
      mensaje: "Horario actualizado.",
      empleadoId: idEmpleado,
      idCatalogoHorario,
    });
  } catch (e) {
    if (conn) await conn.rollback();
    return fail(res, 500, "Error asignando/actualizando horario", e);
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  listarHorarios,
  crearHorario,
  actualizarHorario,
  eliminarHorario,

  listarCatalogosHorario,
  crearCatalogoHorario,
  actualizarCatalogoHorario,
  eliminarCatalogoHorario,
  listarTiposHorario,

  obtenerDetalleCatalogoHorario,
  crearDetalleCatalogoHorario,
  actualizarDetalleCatalogoHorario,
  eliminarDetalleCatalogoHorario,

  obtenerHorarioPorEmpleado,
  obtenerDetallePorEmpleado,
  upsertDetallePorEmpleado,
};
