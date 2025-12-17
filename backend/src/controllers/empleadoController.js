//Me sirve para manejar las rutas relacionadas con empleados
const Empleado = require('../models/Empleado');
// Controlador para manejar las rutas de empleados
const empleadoController = {
  async listar(req, res, next) {
    try {
      const empleados = await Empleado.findAll();
      res.json(empleados);
    } catch (error) {
      next(error);
    }
  },

  async obtenerPorId(req, res, next) {
    try {
      const { id } = req.params;
      const empleado = await Empleado.findById(id);

      if (!empleado) {
        return res.status(404).json({ message: 'Empleado no encontrado' });
      }

      res.json(empleado);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = empleadoController;
    