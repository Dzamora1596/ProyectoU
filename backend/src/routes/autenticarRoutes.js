// Codigo para el manejo de las rutas de autenticación
const express = require("express");
const router = express.Router();


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
