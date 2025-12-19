// backend/src/controllers/autenticarController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const login = async (req, res, next) => {
  try {
    console.log('BODY COMPLETO:', req.body);

    const { usuario, password } = req.body;

    console.log('Usuario recibido:', usuario);
    console.log('Password recibido:', password);

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Usuario y password son obligatorios',
      });
    }

    const [rows] = await db.query(
      `SELECT idUsuario, NombreUsuario, Password, Activo
       FROM Usuario
       WHERE NombreUsuario = ?`,
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario no existe' });
    }

    const user = rows[0];

    // ✅ OPCIÓN 2: verificar exactamente qué hash está leyendo el backend
    console.log('HASH EN BD:', user.Password);
    console.log('LENGTH HASH:', user.Password?.length);

    // Activo en MySQL BIT muchas veces llega como Buffer
    const activo =
      Buffer.isBuffer(user.Activo) ? user.Activo[0] === 1 : Boolean(user.Activo);

    if (!activo) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario inactivo' });
    }

    // Compare blindado (por si viene con espacios)
    const passwordLimpio = String(password).trim();
    const hashLimpio = String(user.Password).trim();

    const passwordValido = await bcrypt.compare(passwordLimpio, hashLimpio);

    if (!passwordValido) {
      return res.status(401).json({ ok: false, mensaje: 'Password incorrecto' });
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

module.exports = { login };
