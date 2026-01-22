// routes/horarioLaboralRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");
const horarioLaboralController = require("../controllers/horarioLaboralController");

router.use(autenticar);

router.get(
  "/empleado/:idEmpleado",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.obtenerHorarioPorEmpleado
);

router.get(
  "/empleado/:idEmpleado/detalle",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.obtenerDetallePorEmpleado
);

router.put(
  "/empleado/:idEmpleado/detalle",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.upsertDetallePorEmpleado
);

 
router.get(
  "/",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.listarHorarios
);

router.get(
  "/tipos",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.listarTiposHorario
);

router.post(
  "/",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.crearHorario
);

router.put(
  "/:idHorarioLaboral",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.actualizarHorario
);

router.delete(
  "/:idHorarioLaboral",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.eliminarHorario
);

 
router.get(
  "/catalogos",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.listarCatalogosHorario
);

router.post(
  "/catalogos",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.crearCatalogoHorario
);

router.put(
  "/catalogos/:idCatalogoHorario",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.actualizarCatalogoHorario
);

router.delete(
  "/catalogos/:idCatalogoHorario",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.eliminarCatalogoHorario
);

router.get(
  "/catalogos/:idCatalogoHorario/detalle",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.obtenerDetalleCatalogoHorario
);

router.post(
  "/catalogos/:idCatalogoHorario/detalle",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.crearDetalleCatalogoHorario
);

router.put(
  "/catalogos/:idCatalogoHorario/detalle/:idCatalogoHorarioDetalle",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.actualizarDetalleCatalogoHorario
);

router.delete(
  "/catalogos/:idCatalogoHorario/detalle/:idCatalogoHorarioDetalle",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.eliminarDetalleCatalogoHorario
);

module.exports = router;
