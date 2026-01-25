// routes/vacacionesRoutes.js

const express = require("express");
const router = express.Router();

const vacacionesController = require("../controllers/vacacionesController");
const autenticarMiddleware = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

router.use(autenticarMiddleware);

/*
  Roles:
  - Admin / Jefatura: gestión completa
  - Colaborador / Personal de Planilla: empleado solicitante
*/

/* =========================
   SALDO
========================= */

// Colaborador y Personal de Planilla -> su propio saldo
router.get(
  "/saldo",
  requireRole(["Admin", "Jefatura", "Colaborador", "Personal de Planilla"]),
  vacacionesController.saldo
);

// Admin / Jefatura -> saldo por empleado
router.get(
  "/saldo/:empleadoId",
  requireRole(["Admin", "Jefatura"]),
  vacacionesController.saldo
);

/* =========================
   LISTADO
========================= */

// Colaborador / Personal de Planilla -> solo sus registros
// Admin / Jefatura -> todos o filtrados
router.get(
  "/",
  requireRole(["Admin", "Jefatura", "Colaborador", "Personal de Planilla"]),
  vacacionesController.listar
);

/* =========================
   DETALLE
========================= */

router.get(
  "/:id",
  requireRole(["Admin", "Jefatura", "Colaborador", "Personal de Planilla"]),
  vacacionesController.obtenerPorId
);

/* =========================
   CREAR SOLICITUD
========================= */

// Colaborador y Personal de Planilla pueden solicitar
router.post(
  "/",
  requireRole(["Admin", "Colaborador", "Personal de Planilla"]),
  vacacionesController.crear
);

/* =========================
   GESTIÓN (solo jefes)
========================= */

router.put(
  "/:id",
  requireRole(["Admin", "Jefatura"]),
  vacacionesController.actualizar
);

router.put(
  "/:id/aprobar",
  requireRole(["Admin", "Jefatura"]),
  vacacionesController.aprobar
);

router.put(
  "/:id/rechazar",
  requireRole(["Admin", "Jefatura"]),
  vacacionesController.rechazar
);

router.delete(
  "/:id",
  requireRole(["Admin", "Jefatura"]),
  vacacionesController.desactivar
);

module.exports = router;
