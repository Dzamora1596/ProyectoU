//Definicion de las funciones para la autenticacion de usuarios.
const bcrypt = require('bcryptjs');

// Helpers para la base de datos ayudan a manejar conversiones específicas
const bitToBool = (v) => (Buffer.isBuffer(v) ? v[0] === 1 : Boolean(v));
const isBcryptHash = (s) =>
  typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$'));

const login = async (req, res, next) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Usuario y password son obligatorios',
      });
    }
    const sql = `
      SELECT idUsuario, NombreUsuario, Password, Activo
      FROM Usuario
      WHERE NombreUsuario = ?
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [usuario]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    const user = rows[0];

    const activo = bitToBool(user.Activo);
    if (!activo) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario inactivo' });
    }

    const passPlano = String(password).trim();
    const hashBD = String(user.Password || '').trim();

    // Me evita errores raros de bcrypt si el campo no trae un hash válido
    if (!isBcryptHash(hashBD)) {
      return res.status(500).json({
        ok: false,
        mensaje: 'El password almacenado no es un hash bcrypt válido (cree el usuario desde Registrar)',
      });
    }

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
    console.error('Error en login:', error);
    next(error);
  }
};

const registrar = async (req, res, next) => {
  try {
    const { idUsuario, empleadoId, nombreUsuario, password } = req.body;

    if (!idUsuario || !empleadoId || !nombreUsuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Faltan datos: idUsuario, empleadoId, nombreUsuario, password',
      });
    }

    // 1) Validar empleado exista
    const [emp] = await db.query(
      `SELECT idEmpleado FROM Empleado WHERE idEmpleado = ? LIMIT 1`,
      [empleadoId]
    );
    if (!emp || emp.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'Empleado no existe' });
    }

    // 2) Validar username no exista
    const [existe] = await db.query(
      `SELECT idUsuario FROM Usuario WHERE NombreUsuario = ? LIMIT 1`,
      [nombreUsuario]
    );
    if (existe && existe.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El nombre de usuario ya existe' });
    }

    // 3) Hash
    const hash = await bcrypt.hash(String(password).trim(), 10);

    // 4) Insert  1 por defecto)
    await db.query(
      `INSERT INTO Usuario (idUsuario, NombreUsuario, Password, Empleado_idEmpleado, Rol_idRol, Activo)
       VALUES (?, ?, ?, ?, ?, b'1')`,
      [idUsuario, nombreUsuario, hash, empleadoId, 1]
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario creado correctamente',
    });
  } catch (error) {
    console.error('Error en registrar:', error);
    next(error);
  }
};

module.exports = { login, registrar };
