// controllers/catalogosController.js
const db = require("../config/db");

function mapActivoBit(row) {
  const val = row?.Activo;
  if (Buffer.isBuffer(val)) return val[0] ? 1 : 0;
  return Number(val) ? 1 : 0;
}

function ok(res, payload) {
  return res.json({ ok: true, ...payload });
}

async function obtenerCatalogosRegistroPersonal(req, res, next) {
  try {
    const [generos] = await db.query(
      `
      SELECT idCatalogo_Genero AS id, Descripcion_Genero AS descripcion, Activo
      FROM catalogo_genero
      WHERE Activo = 1
      ORDER BY Descripcion_Genero ASC
      `
    );

    const [cadencias] = await db.query(
      `
      SELECT idCatalogo_Cadencia_Pago AS id, Descripcion AS descripcion, Activo
      FROM catalogo_cadencia_pago
      WHERE Activo = 1
      ORDER BY Descripcion ASC
      `
    );

    const [tiposTelefono] = await db.query(
      `
      SELECT idCatalogo_Tipo_Telefono AS id, Descripcion_Tipo_Telefono AS descripcion, Activo
      FROM catalogo_tipo_telefono
      WHERE Activo = 1
      ORDER BY Descripcion_Tipo_Telefono ASC
      `
    );

    const [tiposCorreo] = await db.query(
      `
      SELECT idCatalogo_Tipo_Correo AS id, Descripcion_Tipo_Correo AS descripcion, Activo
      FROM catalogo_tipo_correo
      WHERE Activo = 1
      ORDER BY Descripcion_Tipo_Correo ASC
      `
    );

    const salida = {
      generos: generos.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
      cadenciasPago: cadencias.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
      tiposTelefono: tiposTelefono.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
      tiposCorreo: tiposCorreo.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
    };

    return ok(res, salida);
  } catch (err) {
    return next(err);
  }
}

async function obtenerCatalogosRoles(req, res, next) {
  try {
    const [roles] = await db.query(
      `
      SELECT idCatalogo_Rol AS id, Descripcion AS descripcion, Activo
      FROM catalogo_rol
      WHERE Activo = 1
      ORDER BY Descripcion ASC
      `
    );

    return ok(res, {
      roles: roles.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
    });
  } catch (err) {
    return next(err);
  }
}

async function obtenerCatalogosCadenciaPago(req, res, next) {
  try {
    const [cadencias] = await db.query(
      `
      SELECT idCatalogo_Cadencia_Pago AS id, Descripcion AS descripcion, Activo
      FROM catalogo_cadencia_pago
      WHERE Activo = 1
      ORDER BY Descripcion ASC
      `
    );

    return ok(res, {
      cadenciasPago: cadencias.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
    });
  } catch (err) {
    return next(err);
  }
}

async function obtenerCatalogosTiposHoraExtra(req, res, next) {
  try {
    const [tipos] = await db.query(
      `
      SELECT idCatalogo_Tipo_Hora_Extra AS id, Descripcion AS descripcion, PorcentajePago, Activo
      FROM catalogo_tipo_hora_extra
      WHERE Activo = 1
      ORDER BY Descripcion ASC
      `
    );

    return ok(res, {
      tiposHoraExtra: tipos.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
    });
  } catch (err) {
    return next(err);
  }
}

async function obtenerCatalogosEstadosPorModulo(req, res, next) {
  try {
    const modulo = String(req.query.modulo || "").trim();

    if (!modulo) {
      return res.status(400).json({
        ok: false,
        mensaje: "El parámetro 'modulo' es requerido. Ej: HORA_EXTRA",
      });
    }

    const [estados] = await db.query(
      `
      SELECT idCatalogo_Estado AS id, Modulo AS modulo, Descripcion AS descripcion, Activo
      FROM catalogo_estado
      WHERE Activo = 1 AND Modulo = ?
      ORDER BY Descripcion ASC
      `,
      [modulo]
    );

    return ok(res, {
      estados: estados.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
    });
  } catch (err) {
    return next(err);
  }
}

async function obtenerCatalogosPeriodos(req, res, next) {
  try {
    const [rows] = await db.query(
      `
      SELECT idCatalogo_Periodo AS id,
             Fecha_Inicio AS fechaInicio,
             Fecha_Fin AS fechaFin,
             Estado,
             Activo
      FROM catalogo_periodo
      WHERE Activo = 1
      ORDER BY Fecha_Inicio DESC, idCatalogo_Periodo DESC
      `
    );

    return ok(res, {
      periodos: rows.map((r) => ({ ...r, Activo: mapActivoBit(r) })),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  obtenerCatalogosRegistroPersonal,
  obtenerCatalogosRoles,
  obtenerCatalogosCadenciaPago,
  obtenerCatalogosTiposHoraExtra,
  obtenerCatalogosEstadosPorModulo,
  obtenerCatalogosPeriodos,
};
