// Routas de Asistencia
const express = require("express");
const router = express.Router();

const autorizarRoles = require("../middlewares/autorizarRoles");
const asistenciaController = require("../controllers/asistenciaController");

//Configuración de rutas de asistencia
router.get(
  "/colaboradores",
  autorizarRoles([1, 2, 3]),
  asistenciaController.listarColaboradores
);
// Listar asistencias de un empleado en un rango de fechas
router.get(
  "/empleado/:empleadoId",
  autorizarRoles([1, 2, 3]),
  asistenciaController.listarAsistenciasPorEmpleado
);

//CRUD de Asistencia 
router.post(
  "/",
  autorizarRoles([1, 2]),
  asistenciaController.crearAsistencia
);
// Actualizar una asistencia existente
router.put(
  "/:idAsistencia",
  autorizarRoles([1, 2]),
  asistenciaController.actualizarAsistencia
);
// Eliminar una asistencia 
router.delete(
  "/:idAsistencia",
  autorizarRoles([1, 2]),
  asistenciaController.eliminarAsistencia
);

// Validar asistencias
router.post(
  "/validar-periodo",
  autorizarRoles([1, 2, 3]),
  asistenciaController.validarTodoPeriodo
);
// Validar un lote de asistencias
router.put(
  "/validar-lote",
  autorizarRoles([1, 2, 3]),
  asistenciaController.validarLote
);

module.exports = router;
