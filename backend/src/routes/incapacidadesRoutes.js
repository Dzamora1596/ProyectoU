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

router.use(autenticarMiddleware);

// ✅ Planilla = Colaborador (listar / ver / crear / subir archivo)
router.get(
  "/",
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  listarIncapacidades
);

router.get(
  "/:id",
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  obtenerIncapacidad
);

router.post(
  "/",
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  crearIncapacidad
);

router.post(
  "/:id/archivo",
  requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]),
  uploadIncapacidad.single("archivo"),
  subirArchivoIncapacidad
);

// 🔒 Solo Admin / Jefatura (igual que antes)
router.put("/:id/aprobar", requireRole(["Admin", "Jefatura"]), aprobarIncapacidad);

router.put("/:id/rechazar", requireRole(["Admin", "Jefatura"]), rechazarIncapacidad);

module.exports = router;
