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

// Todos los roles pueden ver/crear/consultar
router.get("/", autenticarMiddleware, listarIncapacidades);
router.get("/:id", autenticarMiddleware, obtenerIncapacidad);
router.post("/", autenticarMiddleware, crearIncapacidad);

// Adjuntar comprobante (todos pueden subir)
router.post(
  "/:id/archivo",
  autenticarMiddleware,
  uploadIncapacidad.single("archivo"),
  subirArchivoIncapacidad
);

// Solo Admin y Jefatura aprueban/rechazan
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
