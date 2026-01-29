import { Router } from "express";
import autenticarMiddleware from "../middlewares/autenticarMiddleware.js";
import requireRole from "../middlewares/requireRole.js";
import adelantoController from "../controllers/adelantoController.js";

const router = Router();

router.use(autenticarMiddleware);

router.get("/", requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]), adelantoController.listar);
router.get("/:id", requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]), adelantoController.obtenerPorId);

router.post("/", requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]), adelantoController.crearSolicitud);

router.put("/:id/aprobar", requireRole(["Admin", "Jefatura"]), adelantoController.aprobar);
router.put("/:id/rechazar", requireRole(["Admin", "Jefatura"]), adelantoController.rechazar);

router.delete("/:id", requireRole(["Admin", "Jefatura", "Personal de Planilla", "Colaborador"]), adelantoController.eliminar);

export default router;
