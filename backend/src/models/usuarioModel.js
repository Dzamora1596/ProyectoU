//usuarioModel.js
const db = require("../config/db");

const usuarioModel = {
 
  async listarUsuariosConDetalle({ texto, activo, bloqueado, rolId } = {}) {
    const where = [];
    const params = [];

    
    where.push("r.Activo = 1");
    where.push("e.Activo = 1");
    where.push("p.Activo = 1");

    
    if (
      activo !== undefined &&
      activo !== null &&
      String(activo).trim() !== "" &&
      String(activo).toLowerCase() !== "all"
    ) {
      where.push("u.Activo = ?");
      params.push(Number(activo) === 0 ? 0 : 1);
    } else {
      
      where.push("u.Activo IN (0,1)");
    }

    
    if (
      bloqueado !== undefined &&
      bloqueado !== null &&
      String(bloqueado).trim() !== "" &&
      String(bloqueado).toLowerCase() !== "all"
    ) {
      where.push("u.Bloqueado = ?");
      params.push(Number(bloqueado) === 1 ? 1 : 0);
    }

    
    if (rolId !== undefined && rolId !== null && String(rolId).trim() !== "") {
      where.push("u.Catalogo_Rol_idCatalogo_Rol = ?");
      params.push(Number(rolId));
    }

    
    if (texto !== undefined && texto !== null && String(texto).trim() !== "") {
      const t = `%${String(texto).trim()}%`;
      where.push(
        `(u.NombreUsuario LIKE ? OR p.Nombre LIKE ? OR p.Apellido1 LIKE ? OR p.Apellido2 LIKE ?)`
      );
      params.push(t, t, t, t);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.query(
      `
      SELECT
        u.idUsuario,
        u.NombreUsuario AS nombreUsuario,
        u.Empleado_idEmpleado AS empleadoId,
        u.Catalogo_Rol_idCatalogo_Rol AS rolId,
        u.Activo AS activo,
        u.Bloqueado,
        u.Intentos_Fallidos,
        r.Descripcion AS rolNombre,
        e.Persona_idPersona AS personaId,
        p.Nombre AS personaNombre,
        p.Apellido1 AS personaApellido1,
        p.Apellido2 AS personaApellido2
      FROM Usuario u
      INNER JOIN Catalogo_Rol r 
        ON r.idCatalogo_Rol = u.Catalogo_Rol_idCatalogo_Rol
      INNER JOIN Empleado e 
        ON e.idEmpleado = u.Empleado_idEmpleado
      INNER JOIN Persona p 
        ON p.idPersona = e.Persona_idPersona
      ${whereSql}
      ORDER BY u.idUsuario DESC
      `,
      params
    );

    return rows;
  },

  
  async obtenerUsuarioPorId(idUsuario) {
    const [rows] = await db.query(
      `
      SELECT 
        u.idUsuario,
        u.NombreUsuario,
        u.Password,
        u.Empleado_idEmpleado AS empleadoId,
        u.Catalogo_Rol_idCatalogo_Rol AS rolId,
        r.Descripcion AS rolNombre,
        u.Activo,
        u.Bloqueado,
        u.Intentos_Fallidos
      FROM Usuario u
      INNER JOIN Catalogo_Rol r
        ON r.idCatalogo_Rol = u.Catalogo_Rol_idCatalogo_Rol
      WHERE u.idUsuario = ?
      LIMIT 1
      `,
      [Number(idUsuario)]
    );
    return rows[0] || null;
  },

  
  async existeEmpleado(empleadoId) {
    const [rows] = await db.query(
      `
      SELECT 1
      FROM Empleado e
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      WHERE e.idEmpleado = ?
        AND e.Activo = 1
        AND p.Activo = 1
      LIMIT 1
      `,
      [Number(empleadoId)]
    );
    return rows.length > 0;
  },

  
  async existeRol(rolId) {
    const [rows] = await db.query(
      `
      SELECT 1
      FROM Catalogo_Rol
      WHERE idCatalogo_Rol = ? AND Activo = 1
      LIMIT 1
      `,
      [Number(rolId)]
    );
    return rows.length > 0;
  },

  
  async existeNombreUsuario(nombreUsuario, excludeIdUsuario = null) {
    if (excludeIdUsuario) {
      const [rows] = await db.query(
        `
        SELECT 1
        FROM Usuario
        WHERE NombreUsuario = ? AND idUsuario <> ?
        LIMIT 1
        `,
        [String(nombreUsuario).trim(), Number(excludeIdUsuario)]
      );
      return rows.length > 0;
    }

    const [rows] = await db.query(
      `
      SELECT 1
      FROM Usuario
      WHERE NombreUsuario = ?
      LIMIT 1
      `,
      [String(nombreUsuario).trim()]
    );
    return rows.length > 0;
  },

  
  async empleadoTieneUsuario(empleadoId, excludeIdUsuario = null) {
    if (excludeIdUsuario) {
      const [rows] = await db.query(
        `
        SELECT 1
        FROM Usuario
        WHERE Empleado_idEmpleado = ?
          AND Activo = 1
          AND idUsuario <> ?
        LIMIT 1
        `,
        [Number(empleadoId), Number(excludeIdUsuario)]
      );
      return rows.length > 0;
    }

    const [rows] = await db.query(
      `
      SELECT 1
      FROM Usuario
      WHERE Empleado_idEmpleado = ?
        AND Activo = 1
      LIMIT 1
      `,
      [Number(empleadoId)]
    );
    return rows.length > 0;
  },

  
  async insertarUsuario({ nombreUsuario, passwordHash, empleadoId, rolId, activo }) {
    const [result] = await db.query(
      `
      INSERT INTO Usuario
        (Empleado_idEmpleado, NombreUsuario, Password, Catalogo_Rol_idCatalogo_Rol, Intentos_Fallidos, Bloqueado, Activo)
      VALUES
        (?, ?, ?, ?, 0, 0, ?)
      `,
      [
        Number(empleadoId),
        String(nombreUsuario).trim(),
        String(passwordHash),
        Number(rolId),
        Number(activo ?? 1),
      ]
    );
    return result;
  },

  
  async actualizarUsuarioSinPassword({
    idUsuario,
    nombreUsuario,
    empleadoId,
    rolId,
    activo,
    bloqueado,
    intentosFallidos,
  }) {
    const sets = [];
    const params = [];

    sets.push("NombreUsuario = ?");
    params.push(String(nombreUsuario).trim());

    sets.push("Empleado_idEmpleado = ?");
    params.push(Number(empleadoId));

    sets.push("Catalogo_Rol_idCatalogo_Rol = ?");
    params.push(Number(rolId));

    sets.push("Activo = ?");
    params.push(Number(activo ?? 1));

    if (bloqueado !== undefined && bloqueado !== null && String(bloqueado).trim() !== "") {
      sets.push("Bloqueado = ?");
      params.push(Number(bloqueado) === 1 ? 1 : 0);
    }

    if (intentosFallidos !== undefined && intentosFallidos !== null && String(intentosFallidos).trim() !== "") {
      const n = Number(intentosFallidos);
      sets.push("Intentos_Fallidos = ?");
      params.push(Number.isFinite(n) && n >= 0 ? n : 0);
    }

    params.push(Number(idUsuario));

    const [result] = await db.query(
      `
      UPDATE Usuario
      SET ${sets.join(", ")}
      WHERE idUsuario = ?
      `,
      params
    );

    return result;
  },

  
  async actualizarUsuarioConPassword({
    idUsuario,
    nombreUsuario,
    passwordHash,
    empleadoId,
    rolId,
    activo,
    bloqueado,
    intentosFallidos,
  }) {
    const sets = [];
    const params = [];

    sets.push("NombreUsuario = ?");
    params.push(String(nombreUsuario).trim());

    sets.push("Password = ?");
    params.push(String(passwordHash));

    sets.push("Empleado_idEmpleado = ?");
    params.push(Number(empleadoId));

    sets.push("Catalogo_Rol_idCatalogo_Rol = ?");
    params.push(Number(rolId));

    sets.push("Activo = ?");
    params.push(Number(activo ?? 1));

    if (bloqueado !== undefined && bloqueado !== null && String(bloqueado).trim() !== "") {
      sets.push("Bloqueado = ?");
      params.push(Number(bloqueado) === 1 ? 1 : 0);
    }

    if (intentosFallidos !== undefined && intentosFallidos !== null && String(intentosFallidos).trim() !== "") {
      const n = Number(intentosFallidos);
      sets.push("Intentos_Fallidos = ?");
      params.push(Number.isFinite(n) && n >= 0 ? n : 0);
    }

    params.push(Number(idUsuario));

    const [result] = await db.query(
      `
      UPDATE Usuario
      SET ${sets.join(", ")}
      WHERE idUsuario = ?
      `,
      params
    );

    return result;
  },

  
  async desactivarUsuario(idUsuario) {
    const [result] = await db.query(`UPDATE Usuario SET Activo = 0 WHERE idUsuario = ?`, [Number(idUsuario)]);
    return result;
  },

  
  async eliminarUsuarioDefinitivo(idUsuario) {
    const [result] = await db.query(`DELETE FROM Usuario WHERE idUsuario = ?`, [Number(idUsuario)]);
    return result;
  },

  
  async listarEmpleadosDisponibles() {
    const [rows] = await db.query(
      `
      SELECT
        e.idEmpleado,
        e.Persona_idPersona AS personaId,
        p.Nombre AS nombre,
        p.Apellido1 AS apellido1,
        p.Apellido2 AS apellido2
      FROM Empleado e
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      LEFT JOIN Usuario u 
        ON u.Empleado_idEmpleado = e.idEmpleado AND u.Activo = 1
      WHERE u.idUsuario IS NULL
        AND e.Activo = 1
        AND p.Activo = 1
      ORDER BY e.idEmpleado ASC
      `
    );
    return rows;
  },

  
  async registrarBitacora({ tablaAfectada, idRegistro, accionRealizada, usuarioId }) {
    const [result] = await db.query(
      `
      INSERT INTO Bitacora
        (Tabla_Afectada, IdRegistro, Accion_Realizada, Fecha_y_Hora, Usuario_idUsuario, Activo)
      VALUES
        (?, ?, ?, NOW(), ?, 1)
      `,
      [String(tablaAfectada), String(idRegistro), String(accionRealizada), Number(usuarioId)]
    );
    return result;
  },
};

module.exports = usuarioModel;
