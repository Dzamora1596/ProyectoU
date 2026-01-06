// Rutas de Empleados
const express = require("express");
const router = express.Router();

const {
  listarHorarios,
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
} = require("../controllers/empleadoController");

// Catálogo de horarios laborales
router.get("/horarios", listarHorarios);

// CRUD empleados
router.get("/", listarEmpleados);
router.post("/", crearEmpleado);
router.put("/:idEmpleado", actualizarEmpleado);
router.delete("/:idEmpleado", eliminarEmpleado);

module.exports = router;
