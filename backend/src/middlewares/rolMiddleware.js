//Me sirve para manejar la autorización segun los roles
module.exports = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'Acceso denegado' });
    }
    next();
  };
};
