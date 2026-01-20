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
  limits: { fileSize: 5 * 1024 * 1024 },  
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const ok = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!ok) return cb(new Error("Formato inválido. Solo .xlsx o .xls"));
    cb(null, true);
  },
});

 function manejarErrorUpload(err, req, res, next) {
  if (!err) return next();
  const msg =
    err.code === "LIMIT_FILE_SIZE"
      ? "El archivo supera el límite de 5MB."
      : err.message || "Error subiendo archivo.";
  return res.status(400).json({ ok: false, mensaje: msg });
}

const rolesPlanilla = ["Admin", "Jefatura", "Personal de Planilla"];

 router.post(
  "/importar-excel",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  upload.single("file"),
  manejarErrorUpload,
  importarDesdeExcel
);

router.put(
  "/validar-rango",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  validarRangoAsistencias
);

router.get(
  "/no-registradas",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  listarNoRegistradas
);

router.get(
  "/",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  listarAsistencias
);

router.get(
  "/:id",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  obtenerAsistenciaPorId
);

router.put(
  "/:id/estado",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  cambiarEstadoAsistencia
);

module.exports = router;
