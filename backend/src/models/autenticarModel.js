// autenticarModel.js
const db = require("../config/db");

const autenticarModel = {
  
  async buscarUsuarioParaLogin(nombreUsuario) {
    const sql = `
      SELECT 
        u.idUsuario,
        u.Empleado_idEmpleado AS empleadoId,
        u.NombreUsuario,
        u.Password,
        u.Activo,
        u.Bloqueado,
        u.Intentos_Fallidos,
        u.Catalogo_Rol_idCatalogo_Rol AS rolId,
        r.Descripcion AS rolNombre
      FROM Usuario u
      INNER JOIN Catalogo_Rol r 
        ON r.idCatalogo_Rol = u.Catalogo_Rol_idCatalogo_Rol
      WHERE u.NombreUsuario = ?
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [String(nombreUsuario).trim()]);
    return rows[0] || null;
  },

  
  async empleadoExiste(empleadoId, { soloActivos = true } = {}) {
    const sql = soloActivos
      ? `SELECT 1 FROM Empleado WHERE idEmpleado = ? AND Activo = 1 LIMIT 1`
      : `SELECT 1 FROM Empleado WHERE idEmpleado = ? LIMIT 1`;

    const [rows] = await db.query(sql, [Number(empleadoId)]);
    return rows.length > 0;
  },

  
  async nombreUsuarioExiste(nombreUsuario) {
    const [rows] = await db.query(
      `SELECT 1 FROM Usuario WHERE NombreUsuario = ? LIMIT 1`,
      [String(nombreUsuario).trim()]
    );
    return rows.length > 0;
  },

  
  async rolExisteActivo(rolId) {
    const [rows] = await db.query(
      `SELECT 1 FROM Catalogo_Rol WHERE idCatalogo_Rol = ? AND Activo = 1 LIMIT 1`,
      [Number(rolId)]
    );
    return rows.length > 0;
  },

  
  async listarRolesActivos() {
    const [rows] = await db.query(
      `
      SELECT idCatalogo_Rol AS idRol, Descripcion
      FROM Catalogo_Rol
      WHERE Activo = 1
      ORDER BY Descripcion ASC
      `
    );
    return rows;
  },

  
  async insertarUsuarioRegistro({ nombreUsuario, passwordHash, empleadoId, rolId }) {
    const insertSql = `
      INSERT INTO Usuario
        (Empleado_idEmpleado, NombreUsuario, Password, Catalogo_Rol_idCatalogo_Rol, Intentos_Fallidos, Bloqueado, Activo)
      VALUES
        (?, ?, ?, ?, 0, 0, 1)
    `;
    const [result] = await db.query(insertSql, [
      Number(empleadoId),
      String(nombreUsuario).trim(),
      String(passwordHash),
      Number(rolId),
    ]);
    return result;
  },

  
  async actualizarIntentos({ idUsuario, intentosFallidos, bloqueado }) {
    const [result] = await db.query(
      `UPDATE Usuario SET Intentos_Fallidos = ?, Bloqueado = ? WHERE idUsuario = ?`,
      [Number(intentosFallidos), bloqueado ? 1 : 0, Number(idUsuario)]
    );
    return result;
  },

  
  async resetIntentos(idUsuario) {
    const [result] = await db.query(
      `UPDATE Usuario SET Intentos_Fallidos = 0, Bloqueado = 0 WHERE idUsuario = ?`,
      [Number(idUsuario)]
    );
    return result;
  },

  
  async registrarLogAcceso({ idUsuario, empleadoId, exitoso, observacion }) {
    const [result] = await db.query(
      `
      INSERT INTO Log_Acceso
        (Fecha_y_Hora, Exitoso, Observacion, Activo, Usuario_idUsuario, Usuario_Empleado_idEmpleado)
      VALUES
        (NOW(), ?, ?, 1, ?, ?)
      `,
      [exitoso ? 1 : 0, String(observacion || ""), Number(idUsuario), Number(empleadoId)]
    );
    return result;
  },
};

module.exports = autenticarModel;
