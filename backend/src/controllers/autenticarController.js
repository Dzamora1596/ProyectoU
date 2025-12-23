// Archivo para el controlador de autenticación
const db = require("../config/db");
const bcrypt = require("bcryptjs");

// Para el login de usuario
const login = async (req, res, next) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe ingresar el usuario y password",
      });
    }

    // Para obtener el usuario
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

    const [rows] = await db.query(sql, [usuario]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: "Credenciales inválidas" });
    }

    const user = rows[0];

    // Para validar si el usuario está activo
    const activo = Buffer.isBuffer(user.Activo) ? user.Activo[0] === 1 : Boolean(user.Activo);

    if (!activo) {
      return res.status(401).json({ ok: false, mensaje: "Usuario inactivo" });
    }

    // Comparación password
    const passPlano = String(password).trim();
    const hashBD = String(user.Password || "").trim();

    // Para validar que el hash almacenado sea bcrypt
    if (!hashBD.startsWith("$2a$") && !hashBD.startsWith("$2b$") && !hashBD.startsWith("$2y$")) {
      return res.status(500).json({
        ok: false,
        mensaje: "El password almacenado no es un hash bcrypt válido",
      });
    }

    const passwordValido = await bcrypt.compare(passPlano, hashBD);

    if (!passwordValido) {
      return res.status(401).json({ ok: false, mensaje: "Credenciales inválidas" });
    }

    // Aqui devuelvo el rolId y rolNombre para que el frontend pueda mostrar botones
    return res.json({
      ok: true,
      mensaje: "Login exitoso",
      usuario: {
        idUsuario: user.idUsuario,
        nombreUsuario: user.NombreUsuario,
        rolId: user.Rol_idRol,
        rolNombre: user.RolNombre,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Para registrar un nuevo usuario
const registrar = async (req, res, next) => {
  try {
    const { empleadoId, nombreUsuario, password, rolId } = req.body;

    if (!empleadoId || !nombreUsuario || !password || !rolId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos: empleadoId, nombreUsuario, password, rolId",
      });
    }

    // Para validar que el empleadoId exista
    const [emp] = await db.query(
      `SELECT idEmpleado FROM Empleado WHERE idEmpleado = ?`,
      [empleadoId]
    );

    if (!emp || emp.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Empleado no existe" });
    }

    // Para validar que el nombre de usuario no exista
    const [existe] = await db.query(
      `SELECT idUsuario FROM Usuario WHERE NombreUsuario = ?`,
      [nombreUsuario]
    );

    if (existe.length > 0) {
      return res.status(409).json({ ok: false, mensaje: "El nombre de usuario ya existe" });
    }

    //Para validar que el rolId exista y esté activo
    const [rol] = await db.query(
      `SELECT idRol FROM Rol WHERE idRol = ? AND Activo = b'1'`,
      [rolId]
    );

    if (!rol || rol.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Rol inválido o inactivo" });
    }

    //Para hashear el password una forma de encriptarlo
    const hash = await bcrypt.hash(String(password).trim(), 10);

    // Para insertar  nuevo usuario
    const insertSql = `
      INSERT INTO Usuario (NombreUsuario, Password, Empleado_idEmpleado, Rol_idRol, Activo)
      VALUES (?, ?, ?, ?, b'1')
    `;

    const [result] = await db.query(insertSql, [
      String(nombreUsuario).trim(),
      hash,
      Number(empleadoId),
      Number(rolId),
    ]);

    return res.status(201).json({
      ok: true,
      mensaje: "Usuario creado correctamente",
      idUsuario: result.insertId, // ✅ el nuevo id generado
    });
  } catch (error) {
    next(error);
  }
};

// Para obtener los roles disponibles
const obtenerRoles = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT idRol, Descripcion
       FROM Rol
       WHERE Activo = b'1'
       ORDER BY idRol ASC`
    );

    return res.json({
      ok: true,
      roles: rows.map((r) => ({
        idRol: r.idRol,
        nombreRol: r.Descripcion,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  registrar,
  obtenerRoles,
};
