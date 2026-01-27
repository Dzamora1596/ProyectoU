// middlewares/autenticarMiddleware.js
const jwt = require("jsonwebtoken");
const db = require("../config/db");

function normalizeRolNombre(raw) {
  const s = String(raw || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!s) return "";

  const key = s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (key === "admin") return "Admin";
  if (key === "jefatura") return "Jefatura";

  if (key === "colaborador" || key === "empleado" || key === "employee") {
    return "Colaborador";
  }

  if (
    key === "personal de planilla" ||
    key === "personal planilla" ||
    key === "planilla" ||
    key === "personal_de_planilla" ||
    key === "personalplanilla" ||
    key === "payroll" ||
    key === "payroll staff"
  ) {
    return "Personal de Planilla";
  }

  return key
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

async function cargarEmpleadoIdSiFalta(user) {
  if (!user) return;

  const idUsuario =
    user.idUsuario ??
    user.id ??
    user.userId ??
    user.usuarioId ??
    user.IdUsuario ??
    user.Usuario_idUsuario ??
    null;

  if (!idUsuario) return;

  user.idUsuario = idUsuario;

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
      const res = await db.query(q.sql, [idUsuario]);
      const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res?.rows || res;
      const empId = Number(q.map(rows?.[0]) || 0);

      if (empId > 0) {
        user.Empleado_idEmpleado = empId;
        user.empleadoId = empId;
        user.idEmpleado = empId;
        user.EmpleadoId = empId;
        return;
      }
    } catch (_) {}
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

    const rolRaw =
      req.user?.rolNombre ??
      req.user?.rol ??
      req.user?.role ??
      req.user?.Rol ??
      req.user?.rolUsuario ??
      req.user?.RolUsuario ??
      req.usuario?.rolNombre ??
      req.usuario?.rol ??
      req.usuario?.role ??
      req.usuario?.Rol ??
      "";

    const rolNombre = normalizeRolNombre(rolRaw);

    req.usuario.rolNombre = rolNombre;
    req.user.rolNombre = rolNombre;

    req.user.rol = rolNombre;
    req.user.role = rolNombre;
    req.user.Rol = rolNombre;

    await cargarEmpleadoIdSiFalta(req.user);

    const empleadoId =
      req.user.Empleado_idEmpleado ??
      req.user.empleadoId ??
      req.user.idEmpleado ??
      req.user.EmpleadoId ??
      null;

    req.idUsuario = req.user.idUsuario ?? null;
    req.rol = rolNombre || null;
    req.idEmpleado = empleadoId ? Number(empleadoId) : null;
    req.empleadoId = req.idEmpleado;

    return next();
  } catch (_error) {
    return res.status(403).json({ ok: false, mensaje: "Token inválido o expirado" });
  }
};
