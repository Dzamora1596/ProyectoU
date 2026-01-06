// Modelo de Autenticación para gestionar usuarios y roles
const db = require("../config/db");
// Funciones para interactuar con la base de datos relacionadas con autenticación
const autenticarModel = {
  // Buscar un usuario por su nombre de usuario para login
  async buscarUsuarioParaLogin(nombreUsuario) {
    const sql = `
      SELECT 
        u.idUsuario,
        u.NombreUsuario,
        u.Password,
        u.Activo,
        u.Rol_idRol,
        r.Descripcion AS RolNombre
      FROM Usuario u
      INNER JOIN Rol r ON r.idRol = u.Rol_idRol
      WHERE u.NombreUsuario = ?
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [String(nombreUsuario)]);
    return rows[0] || null;
  },
// Verifica si un empleado existe por su ID
  async empleadoExiste(empleadoId) {
    const [rows] = await db.query(
      `SELECT idEmpleado FROM Empleado WHERE idEmpleado = ? LIMIT 1`,
      [Number(empleadoId)]
    );
    return rows.length > 0;
  },
// Verifica si un nombre de usuario ya existe
  async nombreUsuarioExiste(nombreUsuario) {
    const [rows] = await db.query(
      `SELECT idUsuario FROM Usuario WHERE NombreUsuario = ? LIMIT 1`,
      [String(nombreUsuario).trim()]
    );
    return rows.length > 0;
  },
// Inserta un nuevo usuario durante el registro
  async insertarUsuarioRegistro({ nombreUsuario, passwordHash, empleadoId, rolId }) {
    const insertSql = `
      INSERT INTO Usuario (NombreUsuario, Password, Empleado_idEmpleado, Rol_idRol, Activo)
      VALUES (?, ?, ?, ?, b'1')
    `;
    const [result] = await db.query(insertSql, [
      String(nombreUsuario).trim(),
      String(passwordHash),
      Number(empleadoId),
      Number(rolId),
    ]);
    return result;
  },
};

module.exports = autenticarModel;
