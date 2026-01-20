// routes/catalogosRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");

const {
  obtenerCatalogosRegistroPersonal,
  obtenerCatalogosRoles,
  obtenerCatalogosCadenciaPago,
  obtenerCatalogosTiposHoraExtra,
  obtenerCatalogosEstadosPorModulo,
  obtenerCatalogosPeriodos,
} = require("../controllers/catalogosController");

router.use(autenticar);

router.get("/registro-personal", obtenerCatalogosRegistroPersonal);
router.get("/roles", obtenerCatalogosRoles);

router.get("/cadencias-pago", obtenerCatalogosCadenciaPago);
router.get("/tipos-hora-extra", obtenerCatalogosTiposHoraExtra);
router.get("/estados", obtenerCatalogosEstadosPorModulo);
router.get("/periodos", obtenerCatalogosPeriodos);

module.exports = router;
