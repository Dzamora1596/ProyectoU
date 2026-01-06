// Modelo para gestionar los roles en la base de datos
const db = require("../config/db");

//Convierte valores BIT a booleanos para mayor comodidad al tratar con ellos
function bitToBool(v) {
  // mysql2 puede devolver BIT como Buffer, o number, o boolean
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "object" && v !== null && typeof v[0] !== "undefined") {
    return v[0] === 1;
  }
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}
// Lista todos los roles activos
const listarRolesActivos = async () => {
  const [rows] = await db.query(
    `SELECT idRol, Descripcion, Activo
     FROM Rol
     WHERE Activo = 1
     ORDER BY idRol ASC`
  );

  // Mapear los resultados para convertir los valores BIT a booleanos
  return rows.map((r) => ({
    idRol: r.idRol,
    Descripcion: r.Descripcion,
    Activo: bitToBool(r.Activo),
  }));
};
// Verifica si un rol existe y está activo por su ID
const rolExisteActivo = async (rolId) => {
  const [rows] = await db.query(
    `SELECT idRol
     FROM Rol
     WHERE idRol = ? AND Activo = 1
     LIMIT 1`,
    [Number(rolId)]
  );
  return rows.length > 0;
};

module.exports = {
  listarRolesActivos,
  rolExisteActivo,
};
