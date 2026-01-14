// catalogosController.js
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
      FROM Catalogo_Genero
      WHERE Activo = 1
      ORDER BY Descripcion_Genero ASC
      `
    );

    const [cadencias] = await db.query(
      `
      SELECT idCatalogo_Cadencia_Pago AS id, Descripcion AS descripcion, Activo
      FROM Catalogo_Cadencia_Pago
      WHERE Activo = 1
      ORDER BY Descripcion ASC
      `
    );

    const [tiposTelefono] = await db.query(
      `
      SELECT idCatalogo_Tipo_Telefono AS id, Descripcion_Tipo_Telefono AS descripcion, Activo
      FROM Catalogo_Tipo_Telefono
      WHERE Activo = 1
      ORDER BY Descripcion_Tipo_Telefono ASC
      `
    );

    const [tiposCorreo] = await db.query(
      `
      SELECT idCatalogo_Tipo_Correo AS id, Descripcion_Tipo_Correo AS descripcion, Activo
      FROM Catalogo_Tipo_Correo
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
      FROM Catalogo_Rol
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

module.exports = {
  obtenerCatalogosRegistroPersonal,
  obtenerCatalogosRoles,
};
