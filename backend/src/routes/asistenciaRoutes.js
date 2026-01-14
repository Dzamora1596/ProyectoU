// asistenciaRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");

const autenticarMiddleware = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

const {
  listarAsistencias,
  obtenerAsistenciaPorId,
  cambiarEstadoAsistencia,
  validarRangoAsistencias, 
  listarNoRegistradas,     
} = require("../controllers/asistenciaController");


const { importarDesdeExcel } = require("../controllers/asistenciaImportController");


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
});


router.post(
  "/importar-excel",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  upload.single("file"),
  importarDesdeExcel
);


router.put(
  "/validar-rango",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  validarRangoAsistencias
);


router.get(
  "/no-registradas",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  listarNoRegistradas
);


router.get(
  "/",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  listarAsistencias
);


router.get(
  "/:id",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  obtenerAsistenciaPorId
);


router.put(
  "/:id/estado",
  autenticarMiddleware,
  requireRole(["Admin", "Jefatura", "Personal de Planilla"]),
  cambiarEstadoAsistencia
);

module.exports = router;
