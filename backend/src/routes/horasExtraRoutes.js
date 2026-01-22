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

function validarIdNumerico(req, res, next) {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ ok: false, mensaje: "ID inválido" });
  }
  next();
}

function validarRangoFechas(req, res, next) {
  const desde = String(req.body?.desde ?? req.query?.desde ?? "").trim();
  const hasta = String(req.body?.hasta ?? req.query?.hasta ?? "").trim();

  const re = /^\d{4}-\d{2}-\d{2}$/;

  if (!re.test(desde) || !re.test(hasta)) {
    return res.status(400).json({
      ok: false,
      mensaje: "Debe enviar { desde, hasta } con formato YYYY-MM-DD",
      esperado: { desde: "YYYY-MM-DD", hasta: "YYYY-MM-DD" },
      recibido: { desde, hasta },
      tip: "Si el frontend está enviando DD/MM/YYYY, cambie inputs a type='date' o convierta a YYYY-MM-DD antes de llamar el API.",
    });
  }

  if (hasta < desde) {
    return res.status(400).json({
      ok: false,
      mensaje: "El rango es inválido: hasta no puede ser menor que desde",
      recibido: { desde, hasta },
    });
  }

  req.__rangoFechas = { desde, hasta };

  next();
}

function validarCambioEstado(req, res, next) {
  const estadoId = Number(req.body?.estadoId);
  if (!estadoId || Number.isNaN(estadoId) || estadoId <= 0) {
    return res.status(400).json({ ok: false, mensaje: "estadoId inválido" });
  }

  const motivo = String(req.body?.motivoRechazo || "").trim();
  if (motivo.length > 255) {
    return res.status(400).json({
      ok: false,
      mensaje: "motivoRechazo demasiado largo (máx 255)",
    });
  }

  next();
}


router.post(
  "/calcular",
  autenticar,
  requireRole(["Personal de Planilla", "Admin"]),
  validarRangoFechas,
  calcularHorasExtraPeriodo
);


router.get(
  "/",
  autenticar,
  requireRole(["Personal de Planilla", "Admin", "Jefatura"]),
  listarHorasExtra
);


router.put(
  "/:id/estado",
  autenticar,
  requireRole(["Jefatura", "Admin"]),
  validarIdNumerico,
  validarCambioEstado,
  cambiarEstadoHoraExtra
);

module.exports = router;
