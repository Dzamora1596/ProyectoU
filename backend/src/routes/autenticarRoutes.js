// Rutas de Autenticación
const express = require("express");
const router = express.Router();

// Importar controladores de autenticación
const {
  login,
  registrar,
  obtenerRoles,
} = require("../controllers/autenticarController");



// POST login
router.post("/login", login);

// POST registrar nuevo usuario
router.post("/registrar", registrar);

// GET roles disponibles
router.get("/roles", obtenerRoles);

module.exports = router;
