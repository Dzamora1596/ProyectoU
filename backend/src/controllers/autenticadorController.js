const jwt = require('jsonwebtoken');
const db = require('../config/db');
//Me sirve para manejar la autenticación de usuarios
const autenticadorController = {
  async login(req, res) {
    const { nombreUsuario, contrasenia } = req.body;

    const [rows] = await db.query(`
      SELECT 
        u.idUsuario,
        u.NombreUsuario,
        u.Contrasenia,
        r.idRol,
        cr.Descripcion AS rol
      FROM Usuario u
      JOIN Rol r ON u.Rol_idRol = r.idRol
      JOIN Catalogo_Rol cr 
        ON r.Catalogo_Rol_idCatalogo_Rol = cr.idCatalogo_Rol
      WHERE u.NombreUsuario = ?
        AND u.Activo = 1
    `, [nombreUsuario]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario no válido' });
    }

    const usuario = rows[0];

    if (usuario.Contrasenia !== contrasenia) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      {
        idUsuario: usuario.idUsuario,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      usuario: {
        idUsuario: usuario.idUsuario,
        nombreUsuario: usuario.NombreUsuario,
        rol: usuario.rol
      }
    });
  },

  logout(req, res) {
    res.json({ message: 'Sesión cerrada correctamente' });
  }
};

module.exports = autenticadorController;
