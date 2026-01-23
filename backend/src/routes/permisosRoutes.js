// routes/permisosRoutes.js

const express = require("express");
const router = express.Router();

const permisosController = require("../controllers/permisosController");
const autenticarMiddleware = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

router.use(autenticarMiddleware);

router.get("/", requireRole(["Admin", "Jefatura", "Colaborador"]), permisosController.listar);

router.get("/:id", requireRole(["Admin", "Jefatura", "Colaborador"]), permisosController.obtenerPorId);

router.post("/", requireRole(["Admin", "Jefatura", "Colaborador"]), permisosController.crear);

router.put("/:id", requireRole(["Admin", "Jefatura"]), permisosController.actualizar);

router.put("/:id/aprobar", requireRole(["Admin", "Jefatura"]), permisosController.aprobar);
router.put("/:id/rechazar", requireRole(["Admin", "Jefatura"]), permisosController.rechazar);

router.delete("/:id", requireRole(["Admin", "Jefatura"]), permisosController.desactivar);

module.exports = router;
