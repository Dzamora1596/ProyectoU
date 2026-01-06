//Autenticación de las solicitudes usando JWT y JWT es una librería para manejar tokens
const jwt = require('jsonwebtoken');
//Middleware para autenticar solicitudes
module.exports = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ mensaje: 'Token inválido o expirado' });
  }
};
