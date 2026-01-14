// correoModel.js
const db = require("../config/db");

function convertirBitABooleano(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

function limpiarTexto(v) {
  return String(v ?? "").trim();
}

function aNumero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function listarTipos(conn = db) {
  const [rows] = await conn.query(
    `SELECT idCatalogo_Tipo_Correo AS idTipoCorreo,
            Descripcion_Tipo_Correo AS descripcion,
            Activo
     FROM Catalogo_Tipo_Correo
     ORDER BY idCatalogo_Tipo_Correo ASC`
  );

  return rows.map((r) => ({
    idTipoCorreo: r.idTipoCorreo,
    descripcion: r.descripcion,
    activo: convertirBitABooleano(r.Activo),
  }));
}

async function existeCorreo(correo, conn = db) {
  const c = limpiarTexto(correo);
  if (!c) return false;

  const [rows] = await conn.query(
    `SELECT 1 FROM Correo_Electronico WHERE idCorreo_Electronico = ? LIMIT 1`,
    [c]
  );
  return rows.length > 0;
}

async function crear({ personaId, correo, tipoCorreoId, activo = 1 }, conn = db) {
  const pid = aNumero(personaId);
  const tipo = aNumero(tipoCorreoId);
  const c = limpiarTexto(correo);

  if (!Number.isFinite(pid) || !Number.isFinite(tipo) || !c) {
    throw new Error("Datos inválidos para crear Correo.");
  }

  await conn.query(
    `INSERT INTO Correo_Electronico
      (idCorreo_Electronico, Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo, Persona_idPersona, Activo)
     VALUES (?, ?, ?, ?)`,
    [c, tipo, pid, Number(activo ?? 1)]
  );
}

module.exports = {
  listarTipos,
  existeCorreo,
  crear,
};
