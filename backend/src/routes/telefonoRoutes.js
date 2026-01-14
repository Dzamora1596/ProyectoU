//telefonoRoutes.js
const express = require("express");
const router = express.Router();
const { listarTiposTelefono } = require("../controllers/telefonoController");

router.get("/tipos", listarTiposTelefono);

module.exports = router;
