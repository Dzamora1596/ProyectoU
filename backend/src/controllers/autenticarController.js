//Hacemos el login y registro de usuarios
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// POST autenticar y login
const login = async (req, res, next) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Debe ingresar el usuario y password',
      });
    }

    const [rows] = await db.query(
      `SELECT idUsuario, NombreUsuario, Password, Activo
       FROM Usuario
       WHERE NombreUsuario = ?`,
      [usuario]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    const user = rows[0];

    // BIT puede venir como Buffer
    const activo = Buffer.isBuffer(user.Activo) ? user.Activo[0] === 1 : Boolean(user.Activo);

    if (!activo) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario inactivo' });
    }

    const hashBD = String(user.Password || '').trim();
    const passPlano = String(password).trim();

    const passwordValido = await bcrypt.compare(passPlano, hashBD);

    if (!passwordValido) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    return res.json({
      ok: true,
      mensaje: 'Login exitoso',
      usuario: {
        idUsuario: user.idUsuario,
        nombreUsuario: user.NombreUsuario,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST autenticar y registrar
const registrar = async (req, res, next) => {
  try {
    const { idUsuario, empleadoId, nombreUsuario, password } = req.body;

    if (!idUsuario || !empleadoId || !nombreUsuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Faltan datos: idUsuario, empleadoId, nombreUsuario, password',
      });
    }

    // Verifica si el empleado existe
    const [emp] = await db.query(
      `SELECT idEmpleado FROM Empleado WHERE idEmpleado = ?`,
      [empleadoId]
    );
    if (!emp || emp.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'Empleado no existe' });
    }

    // Verifica que sea un usuario único
    const [existe] = await db.query(
      `SELECT idUsuario FROM Usuario WHERE NombreUsuario = ?`,
      [nombreUsuario]
    );
    if (existe && existe.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El nombre de usuario ya existe' });
    }

    // 3) Hash
    const hash = await bcrypt.hash(String(password).trim(), 10);

    // 4) Insert (Rol_idRol por defecto 1)
    await db.query(
      `INSERT INTO Usuario (idUsuario, NombreUsuario, Password, Empleado_idEmpleado, Rol_idRol, Activo)
       VALUES (?, ?, ?, ?, ?, b'1')`,
      [idUsuario, nombreUsuario, hash, empleadoId, 1]
    );

    return res.status(201).json({ ok: true, mensaje: 'Usuario creado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, registrar };
