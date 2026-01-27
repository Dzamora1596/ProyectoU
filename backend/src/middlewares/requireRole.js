// middlewares/requireRole.js
module.exports = (rolesPermitidos = []) => {
  const normalizeRolNombre = (raw) => {
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
  };

  const permitidos = (rolesPermitidos || []).map(normalizeRolNombre).filter(Boolean);
  const set = new Set(permitidos);

  return (req, res, next) => {
    const rolNombreRaw =
      req.usuario?.rolNombre ??
      req.user?.rolNombre ??
      req.user?.rol ??
      req.user?.role ??
      req.user?.Rol ??
      req.user?.rolUsuario ??
      req.user?.RolUsuario ??
      req.usuario?.rol ??
      req.usuario?.role ??
      req.usuario?.Rol ??
      req.usuario?.rolUsuario ??
      req.usuario?.RolUsuario ??
      null;

    const rolNombre = normalizeRolNombre(rolNombreRaw);

    if (!rolNombre) {
      return res.status(403).json({
        ok: false,
        mensaje: "Acceso denegado (rol no disponible)",
        rolActual: rolNombreRaw || null,
      });
    }

    if (rolNombre === "Admin") return next();

    if (set.size === 0) return next();

    if (!set.has(rolNombre)) {
      return res.status(403).json({
        ok: false,
        mensaje: "Acceso denegado (sin permisos)",
        rolActual: rolNombreRaw || null,
        rolNormalizado: rolNombre,
        rolesPermitidos,
        rolesPermitidosNormalizados: permitidos,
      });
    }

    return next();
  };
};
