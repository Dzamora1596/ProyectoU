//  registroPersonalRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

const registroPersonalController = require("../controllers/registroPersonalController");

 
router.use(autenticar);

 
router.get(
  "/",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  registroPersonalController.listar
);

 
router.get(
  "/:idEmpleado",
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  registroPersonalController.obtenerPorId
);

 
router.post(
  "/",
  requireRole(["Admin", "Jefatura"]),
  registroPersonalController.crear
);

 
router.put(
  "/:idEmpleado",
  requireRole(["Admin", "Jefatura"]),
  registroPersonalController.actualizar
);

 
router.delete(
  "/:idEmpleado",
  requireRole(["Admin", "Jefatura"]),
  registroPersonalController.desactivar
);

module.exports = router;
