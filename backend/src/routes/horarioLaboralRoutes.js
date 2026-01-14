//horarioLaboralRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

const horarioLaboralController = require("../controllers/horarioLaboralController");


router.use(autenticar);


router.get(
  "/",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  horarioLaboralController.listarHorarios
);



router.post(
  "/",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.crearHorario
);


router.put(
  "/:idHorario",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.actualizarHorario
);


router.delete(
  "/:idHorario",
  requireRole(["Admin", "Jefatura"]),
  horarioLaboralController.eliminarHorario
);

module.exports = router;
