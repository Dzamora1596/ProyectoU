// routes/permisosRoutes.js

const express = require("express");
const router = express.Router();

const permisosController = require("../controllers/permisosController");
const autenticarMiddleware = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

router.use(autenticarMiddleware);

// ✅ Planilla = Colaborador (listar / ver / crear)
router.get(
  "/",
  requireRole(["Admin", "Jefatura", "Colaborador", "Personal de Planilla"]),
  permisosController.listar
);

router.get(
  "/:id",
  requireRole(["Admin", "Jefatura", "Colaborador", "Personal de Planilla"]),
  permisosController.obtenerPorId
);

router.post(
  "/",
  requireRole(["Admin", "Jefatura", "Colaborador", "Personal de Planilla"]),
  permisosController.crear
);

// 🔒 Gestión solo Admin/Jefatura
router.put("/:id", requireRole(["Admin", "Jefatura"]), permisosController.actualizar);

router.put("/:id/aprobar", requireRole(["Admin", "Jefatura"]), permisosController.aprobar);
router.put("/:id/rechazar", requireRole(["Admin", "Jefatura"]), permisosController.rechazar);

router.delete("/:id", requireRole(["Admin", "Jefatura"]), permisosController.desactivar);

module.exports = router;
