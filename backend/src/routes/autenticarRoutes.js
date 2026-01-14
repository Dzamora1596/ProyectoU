// autenticarRoutes.js
const express = require("express");
const router = express.Router();

const {
  login,
  registrar,
  obtenerRoles,
} = require("../controllers/autenticarController");

const autenticar = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");


router.post("/login", login);


router.post("/registrar", autenticar, requireRole(["Admin", "Jefatura"]), registrar);


router.get("/roles", autenticar, requireRole(["Admin", "Jefatura"]), obtenerRoles);

module.exports = router;
