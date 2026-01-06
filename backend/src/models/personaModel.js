// Modelo para gestionar las personas y géneros en la base de datos
const db = require("../config/db");
// Funciones para interactuar con la tabla Persona y Catalogo_Genero que representan personas y géneros
function bitToBool(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}
// Lista todas las personas
async function listar() {
  const [rows] = await db.query(
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
    activo: bitToBool(r.Activo),
  }));
}
// Lista todos los géneros disponibles
async function listarGeneros() {
  const [rows] = await db.query(
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
    Activo: bitToBool(g.Activo),
  }));
}
// Verifica si un género existe por su ID
async function existeGenero(generoId) {
  const [rows] = await db.query(
    `SELECT 1 FROM Catalogo_Genero WHERE idCatalogo_Genero = ? LIMIT 1`,
    [Number(generoId)]
  );
  return rows.length > 0;
}
// Verifica si una persona existe por su ID
async function existePersona(idPersona) {
  const [rows] = await db.query(
    `SELECT 1 FROM Persona WHERE idPersona = ? LIMIT 1`,
    [Number(idPersona)]
  );
  return rows.length > 0;
}
// Crea una nueva persona
async function crear({ idPersona, nombre, apellido1, apellido2, generoId, activo = 1 }) {
  const [result] = await db.query(
    `INSERT INTO Persona
      (idPersona, Nombre, Apellido1, Apellido2, Catalogo_Genero_idCatalogo_Genero, Activo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Number(idPersona), nombre, apellido1, apellido2, Number(generoId), Number(activo)]
  );
  return result.insertId;
}
// Actualiza una persona existente por su ID
async function actualizarById(idPersona, { nombre, apellido1, apellido2, generoId, activo = 1 }) {
  const [result] = await db.query(
    `UPDATE Persona
     SET Nombre = ?, Apellido1 = ?, Apellido2 = ?, Catalogo_Genero_idCatalogo_Genero = ?, Activo = ?
     WHERE idPersona = ?`,
    [nombre, apellido1, apellido2, Number(generoId), Number(activo), Number(idPersona)]
  );
  return result.affectedRows;
}
// Desactiva una persona por su ID
async function desactivarById(idPersona) {
  const [result] = await db.query(
    `UPDATE Persona SET Activo = 0 WHERE idPersona = ?`,
    [Number(idPersona)]
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
