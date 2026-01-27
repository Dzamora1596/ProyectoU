// backend/src/routes/asistenciaRoutes.js
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

  // ✅ nuevos (para que funcione tu frontend)
  listarColaboradoresParaValidacion,
  listarAsistenciasPorEmpleado,
  crearAsistencia,
  actualizarAsistencia,
  eliminarAsistencia,
  validarTodoPeriodo,
  guardarValidacionesLote,
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

// =========================
// IMPORT EXCEL (existente)
// =========================
router.post(
  "/importar-excel",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  upload.single("file"),
  manejarErrorUpload,
  importarDesdeExcel
);

// =========================
// VALIDACIONES (existente + nuevos aliases)
// =========================
router.put(
  "/validar-rango",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  validarRangoAsistencias
);

// ✅ tu frontend usa POST /asistencias/validar-periodo {desde,hasta}
router.post(
  "/validar-periodo",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  validarTodoPeriodo
);

// ✅ tu frontend usa PUT /asistencias/validar-lote {cambios:[]}
router.put(
  "/validar-lote",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  guardarValidacionesLote
);

// =========================
// CONSULTAS AUXILIARES (✅ deben ir ANTES de "/:id")
// =========================

// ✅ tu frontend usa GET /asistencias/colaboradores?buscar=
router.get(
  "/colaboradores",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  listarColaboradoresParaValidacion
);

// ✅ tu frontend usa GET /asistencias/empleado/:empleadoId?desde&hasta
router.get(
  "/empleado/:empleadoId",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  listarAsistenciasPorEmpleado
);

// =========================
// NO REGISTRADAS (existente)
// =========================
router.get(
  "/no-registradas",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  listarNoRegistradas
);

// =========================
// CRUD (✅ nuevos para tu asistenciaService.js)
// =========================
router.post(
  "/",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  crearAsistencia
);

router.put(
  "/:id",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  actualizarAsistencia
);

router.delete(
  "/:id",
  autenticarMiddleware,
  requireRole(rolesPlanilla),
  eliminarAsistencia
);

// =========================
// LISTAR Y DETALLE (existentes)
// =========================
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
