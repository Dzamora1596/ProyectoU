// requireRole.js
module.exports = (rolesPermitidos = []) => {
  const permitidos = (rolesPermitidos || []).map((r) =>
    String(r).toLowerCase().trim()
  );
  const set = new Set(permitidos);

  return (req, res, next) => {
    const rolNombreRaw = req.usuario?.rolNombre;
    const rolNombre = String(rolNombreRaw || "").toLowerCase().trim();

    if (!rolNombre) {
      return res.status(403).json({
        ok: false,
        mensaje: "Acceso denegado (rol no disponible)",
      });
    }

    
    if (rolNombre === "Admin") return next();

    
    if (set.size === 0) return next();

    if (!set.has(rolNombre)) {
      return res.status(403).json({
        ok: false,
        mensaje: "Acceso denegado (sin permisos)",
        rolActual: rolNombreRaw || null,
        rolesPermitidos: rolesPermitidos,
      });
    }

    return next();
  };
};
