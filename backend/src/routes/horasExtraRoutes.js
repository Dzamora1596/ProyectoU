// routes/horasExtraRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

const {
  listarHorasExtra,
  calcularHorasExtraPeriodo,
  cambiarEstadoHoraExtra,
} = require("../controllers/horasExtraController");

router.post("/calcular", autenticar, requireRole(["Personal de Planilla", "Admin"]), calcularHorasExtraPeriodo);
router.get("/", autenticar, requireRole(["Personal de Planilla", "Admin", "Jefatura"]), listarHorasExtra);
router.put("/:id/estado", autenticar, requireRole(["Jefatura", "Admin"]), cambiarEstadoHoraExtra);

module.exports = router;
