// Autorizar roles específicos para ciertas rutas
module.exports = function autorizarRoles(rolesPermitidos = []) {
  return (req, res, next) => {
    // ✅ Lo más simple: el frontend envía el rol en un header
    const rolId = Number(req.headers["x-rol-id"] || 0);

    if (!rolId) {
      return res.status(401).json({
        ok: false,
        mensaje: "No autenticado (faltó el header x-rol-id)",
      });
    }

    if (!rolesPermitidos.includes(rolId)) {
      return res.status(403).json({
        ok: false,
        mensaje: "No tiene permisos para esta acción.",
      });
    }

    next();
  };
};
