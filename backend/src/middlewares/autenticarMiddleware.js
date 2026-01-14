// autenticarMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ ok: false, mensaje: "Token requerido" });
    }

    
    const [scheme, token] = header.split(" ");

    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
      return res.status(401).json({
        ok: false,
        mensaje: "Formato de autorización inválido. Use: Bearer <token>",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok: false, mensaje: "JWT_SECRET no configurado" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    
    req.usuario = decoded;

    return next();
  } catch (error) {
    return res.status(403).json({ ok: false, mensaje: "Token inválido o expirado" });
  }
};
