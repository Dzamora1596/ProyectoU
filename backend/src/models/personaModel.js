// personaModel.js
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

async function listar(conn = db) {
  const [rows] = await conn.query(
    `SELECT 
      p.idPersona,
      p.Nombre,
      p.Apellido1,
      p.Apellido2,
      p.Catalogo_Genero_idCatalogo_Genero AS generoId,
      p.Activo
     FROM Persona p
     ORDER BY p.idPersona DESC`
  );

  return rows.map((r) => ({
    idPersona: r.idPersona,
    nombre: r.Nombre,
    apellido1: r.Apellido1,
    apellido2: r.Apellido2,
    generoId: r.generoId,
    activo: convertirBitABooleano(r.Activo),
  }));
}

async function listarGeneros(conn = db) {
  const [rows] = await conn.query(
    `SELECT 
      idCatalogo_Genero AS idGenero,
      Descripcion_Genero AS descripcion,
      Activo
     FROM Catalogo_Genero
     ORDER BY idCatalogo_Genero ASC`
  );

  return rows.map((g) => ({
    idCatalogo_Genero: g.idGenero,
    Descripcion_Genero: g.descripcion,
    Activo: convertirBitABooleano(g.Activo),
  }));
}

async function existeGenero(generoId, conn = db) {
  const id = aNumero(generoId);
  if (!Number.isFinite(id)) return false;

  const [rows] = await conn.query(
    `SELECT 1 FROM Catalogo_Genero WHERE idCatalogo_Genero = ? LIMIT 1`,
    [id]
  );
  return rows.length > 0;
}

async function existePersona(idPersona, conn = db) {
  const id = aNumero(idPersona);
  if (!Number.isFinite(id)) return false;

  const [rows] = await conn.query(
    `SELECT 1 FROM Persona WHERE idPersona = ? LIMIT 1`,
    [id]
  );
  return rows.length > 0;
}

async function crear(
  { idPersona, nombre, apellido1, apellido2, generoId, activo = 1 },
  conn = db
) {
  const idP = aNumero(idPersona);
  const idG = aNumero(generoId);
  if (!Number.isFinite(idP) || !Number.isFinite(idG)) {
    throw new Error("IDs inválidos para crear Persona.");
  }

  await conn.query(
    `INSERT INTO Persona
      (idPersona, Nombre, Apellido1, Apellido2, Catalogo_Genero_idCatalogo_Genero, Activo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      idP,
      limpiarTexto(nombre),
      limpiarTexto(apellido1),
      limpiarTexto(apellido2),
      idG,
      Number(activo ?? 1),
    ]
  );
}

async function actualizarById(
  idPersona,
  { nombre, apellido1, apellido2, generoId, activo = 1 },
  conn = db
) {
  const idP = aNumero(idPersona);
  const idG = aNumero(generoId);
  if (!Number.isFinite(idP) || !Number.isFinite(idG)) {
    return 0;
  }

  const [result] = await conn.query(
    `UPDATE Persona
     SET Nombre = ?, Apellido1 = ?, Apellido2 = ?, Catalogo_Genero_idCatalogo_Genero = ?, Activo = ?
     WHERE idPersona = ?`,
    [
      limpiarTexto(nombre),
      limpiarTexto(apellido1),
      limpiarTexto(apellido2),
      idG,
      Number(activo ?? 1),
      idP,
    ]
  );
  return result.affectedRows;
}

async function desactivarById(idPersona, conn = db) {
  const idP = aNumero(idPersona);
  if (!Number.isFinite(idP)) return 0;

  const [result] = await conn.query(
    `UPDATE Persona SET Activo = 0 WHERE idPersona = ?`,
    [idP]
  );
  return result.affectedRows;
}

module.exports = {
  listar,
  listarGeneros,
  existeGenero,
  existePersona,
  crear,
  actualizarById,
  desactivarById,
};
