//catalogosRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");

const {
  obtenerCatalogosRegistroPersonal,
  obtenerCatalogosRoles,
} = require("../controllers/catalogosController");


router.use(autenticar);


router.get("/registro-personal", obtenerCatalogosRegistroPersonal);


router.get("/roles", obtenerCatalogosRoles);

module.exports = router;
