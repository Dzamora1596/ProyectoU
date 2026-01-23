// middlewares/autenticarMiddleware.js
const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function cargarEmpleadoIdSiFalta(user) {
  if (!user || !user.idUsuario) return;

  const yaTraeEmpleado =
    user.Empleado_idEmpleado ??
    user.empleadoId ??
    user.idEmpleado ??
    user.EmpleadoId ??
    null;

  if (Number(yaTraeEmpleado) > 0) return;

  
  const tryQueries = [
    { sql: "SELECT Empleado_idEmpleado FROM Usuario WHERE idUsuario = ? LIMIT 1", map: (r) => r?.Empleado_idEmpleado },
    { sql: "SELECT Empleado_idEmpleado FROM usuario WHERE idUsuario = ? LIMIT 1", map: (r) => r?.Empleado_idEmpleado },
    { sql: "SELECT Empleado_idEmpleado FROM usuarios WHERE idUsuario = ? LIMIT 1", map: (r) => r?.Empleado_idEmpleado },
  ];

  for (const q of tryQueries) {
    try {
      const [rows] = await db.query(q.sql, [user.idUsuario]);
      const empId = Number(q.map(rows?.[0]) || 0);
      if (empId > 0) {
        user.Empleado_idEmpleado = empId;
        user.empleadoId = empId;
        user.idEmpleado = empId;
        user.EmpleadoId = empId;
        return;
      }
    } catch {
     
    }
  }
}

module.exports = async (req, res, next) => {
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
    req.user = decoded;

    if (req.user && req.user.idUsuario === undefined) {
      req.user.idUsuario =
        req.user.id ??
        req.user.userId ??
        req.user.usuarioId ??
        req.user.IdUsuario ??
        req.user.Usuario_idUsuario ??
        null;
    }

    if (req.user && req.user.rol === undefined) {
      req.user.rol =
        req.user.role ??
        req.user.Rol ??
        req.user.rolUsuario ??
        req.user.RolUsuario ??
        "";
    }

    await cargarEmpleadoIdSiFalta(req.user);

    return next();
  } catch (error) {
    return res.status(403).json({ ok: false, mensaje: "Token inválido o expirado" });
  }
};
