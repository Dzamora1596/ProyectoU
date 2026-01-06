// Modelo para gestionar los usuarios en la base de datos
const db = require("../config/db");

const usuarioModel = {
 // Lista todos los usuarios con detalles de empleado, persona y rol
  async listarUsuariosConDetalle() {
    const [rows] = await db.query(
      `SELECT
        u.idUsuario,
        u.NombreUsuario AS nombreUsuario,
        u.Empleado_idEmpleado AS empleadoId,
        u.Rol_idRol AS rolId,
        u.Activo AS activo,
        r.Descripcion AS rolNombre,
        e.Persona_idPersona AS personaId,
        p.Nombre AS personaNombre,
        p.Apellido1 AS personaApellido1,
        p.Apellido2 AS personaApellido2
      FROM Usuario u
      INNER JOIN Rol r ON r.idRol = u.Rol_idRol
      INNER JOIN Empleado e ON e.idEmpleado = u.Empleado_idEmpleado
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      ORDER BY u.idUsuario DESC`
    );
    return rows;
  },
// Obtiene un usuario por su ID con detalles de empleado, persona y rol
  async obtenerUsuarioPorId(idUsuario) {
    const [rows] = await db.query(
      `SELECT 
        idUsuario,
        NombreUsuario,
        Password,
        Empleado_idEmpleado AS empleadoId,
        Rol_idRol AS rolId,
        Activo
       FROM Usuario
       WHERE idUsuario = ?
       LIMIT 1`,
      [Number(idUsuario)]
    );
    return rows[0] || null;
  },
// Verifica si un empleado existe por su ID
  async existeEmpleado(empleadoId) {
    const [rows] = await db.query(
      `SELECT idEmpleado FROM Empleado WHERE idEmpleado = ? LIMIT 1`,
      [Number(empleadoId)]
    );
    return rows.length > 0;
  },
// Verifica si un rol existe por su ID
  async existeRol(rolId) {
    const [rows] = await db.query(
      `SELECT idRol FROM Rol WHERE idRol = ? LIMIT 1`,
      [Number(rolId)]
    );
    return rows.length > 0;
  },
  // Verifica si un nombre de usuario ya existe, opcionalmente excluyendo un ID de usuario
  async existeNombreUsuario(nombreUsuario, excludeIdUsuario = null) {
    if (excludeIdUsuario) {
      const [rows] = await db.query(
        `SELECT idUsuario FROM Usuario WHERE NombreUsuario = ? AND idUsuario <> ? LIMIT 1`,
        [String(nombreUsuario).trim(), Number(excludeIdUsuario)]
      );
      return rows.length > 0;
    }
    const [rows] = await db.query(
      `SELECT idUsuario FROM Usuario WHERE NombreUsuario = ? LIMIT 1`,
      [String(nombreUsuario).trim()]
    );
    return rows.length > 0;
  },
// Verifica si un empleado ya tiene un usuario asignado, opcionalmente excluyendo un ID de usuario
  async empleadoTieneUsuario(empleadoId, excludeIdUsuario = null) {
    if (excludeIdUsuario) {
      const [rows] = await db.query(
        `SELECT idUsuario FROM Usuario WHERE Empleado_idEmpleado = ? AND idUsuario <> ? LIMIT 1`,
        [Number(empleadoId), Number(excludeIdUsuario)]
      );
      return rows.length > 0;
    }
    const [rows] = await db.query(
      `SELECT idUsuario FROM Usuario WHERE Empleado_idEmpleado = ? LIMIT 1`,
      [Number(empleadoId)]
    );
    return rows.length > 0;
  },
// Obtiene el siguiente ID de usuario disponible
  async obtenerSiguienteIdUsuario() {
    const [mx] = await db.query(`SELECT IFNULL(MAX(idUsuario),0) AS maxId FROM Usuario`);
    return Number(mx?.[0]?.maxId ?? 0) + 1;
  },
// Inserta un nuevo usuario
  async insertarUsuario({ idUsuario, nombreUsuario, passwordHash, empleadoId, rolId, activo }) {
    const [result] = await db.query(
      `INSERT INTO Usuario (idUsuario, NombreUsuario, Password, Empleado_idEmpleado, Rol_idRol, Activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(idUsuario),
        String(nombreUsuario).trim(),
        String(passwordHash),
        Number(empleadoId),
        Number(rolId),
        Number(activo ?? 1),
      ]
    );
    return result;
  },
// Actualiza un usuario sin cambiar la contraseña
  async actualizarUsuarioSinPassword({ idUsuario, nombreUsuario, empleadoId, rolId, activo }) {
    const [result] = await db.query(
      `UPDATE Usuario
       SET NombreUsuario = ?,
           Empleado_idEmpleado = ?,
           Rol_idRol = ?,
           Activo = ?
       WHERE idUsuario = ?`,
      [
        String(nombreUsuario).trim(),
        Number(empleadoId),
        Number(rolId),
        Number(activo ?? 1),
        Number(idUsuario),
      ]
    );
    return result;
  },
// Actualiza un usuario incluyendo la contraseña
  async actualizarUsuarioConPassword({ idUsuario, nombreUsuario, passwordHash, empleadoId, rolId, activo }) {
    const [result] = await db.query(
      `UPDATE Usuario
       SET NombreUsuario = ?,
           Password = ?,
           Empleado_idEmpleado = ?,
           Rol_idRol = ?,
           Activo = ?
       WHERE idUsuario = ?`,
      [
        String(nombreUsuario).trim(),
        String(passwordHash),
        Number(empleadoId),
        Number(rolId),
        Number(activo ?? 1),
        Number(idUsuario),
      ]
    );
    return result;
  },
// Desactiva un usuario por su ID
  async desactivarUsuario(idUsuario) {
    const [result] = await db.query(
      `UPDATE Usuario SET Activo = 0 WHERE idUsuario = ?`,
      [Number(idUsuario)]
    );
    return result;
  },
// Elimina un usuario definitivamente
  async eliminarUsuarioDefinitivo(idUsuario) {
    const [result] = await db.query(
      `DELETE FROM Usuario WHERE idUsuario = ?`,
      [Number(idUsuario)]
    );
    return result;
  },
// Lista los empleados que no tienen un usuario asignado
  async listarEmpleadosDisponibles() {
    const [rows] = await db.query(
      `SELECT
        e.idEmpleado,
        e.Persona_idPersona AS personaId,
        p.Nombre AS nombre,
        p.Apellido1 AS apellido1,
        p.Apellido2 AS apellido2
      FROM Empleado e
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      LEFT JOIN Usuario u ON u.Empleado_idEmpleado = e.idEmpleado AND u.Activo = 1
      WHERE u.idUsuario IS NULL
        AND e.Activo = 1
        AND p.Activo = 1
      ORDER BY e.idEmpleado ASC`
    );
    return rows;
  },
};

module.exports = usuarioModel;
