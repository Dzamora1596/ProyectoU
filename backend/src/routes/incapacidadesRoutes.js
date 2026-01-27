// backend/src/routes/incapacidadesRoutes.js
const express = require("express");
const autenticarMiddleware = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");
const { uploadIncapacidad } = require("../config/uploadIncapacidades");

const {
  listarIncapacidades,
  obtenerIncapacidad,
  crearIncapacidad,
  subirArchivoIncapacidad,
  aprobarIncapacidad,
  rechazarIncapacidad,
} = require("../controllers/incapacidadesController");

const router = express.Router();

router.get(
  "/",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  listarIncapacidades
);

router.get(
  "/:id",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  obtenerIncapacidad
);

router.post(
  "/",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  crearIncapacidad
);

router.post(
  "/:id/archivo",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  uploadIncapacidad.single("archivo"),
  subirArchivoIncapacidad
);

router.put(
  "/:id/aprobar",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura"]),
  aprobarIncapacidad
);

router.put(
  "/:id/rechazar",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura"]),
  rechazarIncapacidad
);

module.exports = router;
