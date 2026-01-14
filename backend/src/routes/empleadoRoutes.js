//empleadoRoutes.js
const express = require("express");
const router = express.Router();

const autenticarMiddleware = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");


const empleadoController = require("../controllers/empleadoController");


function assertFn(fn, name) {
  if (typeof fn !== "function") {
    throw new Error(
      `empleadoRoutes: '${name}' no es una función. Revisa exports en empleadoController.js`
    );
  }
}

assertFn(empleadoController.listarEmpleados, "listarEmpleados");
assertFn(empleadoController.crearEmpleado, "crearEmpleado");
assertFn(empleadoController.actualizarEmpleado, "actualizarEmpleado");
assertFn(empleadoController.eliminarEmpleado, "eliminarEmpleado");


router.get(
  "/",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  empleadoController.listarEmpleados
);


router.post(
  "/",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura"]),
  empleadoController.crearEmpleado
);


router.put(
  "/:idEmpleado",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura"]),
  empleadoController.actualizarEmpleado
);


router.delete(
  "/:idEmpleado",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura"]),
  empleadoController.eliminarEmpleado
);

module.exports = router;
