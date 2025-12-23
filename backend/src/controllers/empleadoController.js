//Para el manejo de empleados
const Empleado = require('../models/Empleado');
// Para el manejo de empleados
const empleadoController = {
  async listar(req, res, next) {
    try {
      const empleados = await Empleado.findAll();
      res.json(empleados);
    } catch (error) {
      next(error);
    }
  },
// Obtener un empleado por ID
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
    