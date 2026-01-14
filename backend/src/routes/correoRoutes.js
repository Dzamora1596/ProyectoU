//correoRoutes.js
const express = require("express");
const router = express.Router();
const { listarTiposCorreo } = require("../controllers/correoController");

router.get("/tipos", listarTiposCorreo);

module.exports = router;
