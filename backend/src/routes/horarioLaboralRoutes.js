// Rutas de Horarios Laborales
const express = require("express");
const router = express.Router();

const autorizarRoles = require("../middlewares/autorizarRoles");
const horarioLaboralController = require("../controllers/horarioLaboralController");

//Listar horarios laborales
router.get("/", autorizarRoles([1]), horarioLaboralController.listarHorarios);

//CRUD Horario Laboral
router.post("/", autorizarRoles([1]), horarioLaboralController.crearHorario);

//Actualizar horario laboral
router.put(
  "/:idHorarioLaboral",
  autorizarRoles([1]),
  horarioLaboralController.actualizarHorario
);

// Desactivar horario laboral
router.delete(
  "/:idHorarioLaboral",
  autorizarRoles([1]),
  horarioLaboralController.eliminarHorario
);

module.exports = router;
