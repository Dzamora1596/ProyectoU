// Codigo para el manejo de las rutas de personas
const express = require("express");
const router = express.Router();

// Controladores de persona
const {
  listarPersonas,
  obtenerPersonaPorId,
  crearPersona,
  actualizarPersona,
  eliminarPersona,
  listarGeneros,
} = require("../controllers/personaController");

// Codigo para listar géneros
router.get("/generos", listarGeneros);

// CRUD de personas
router.get("/", listarPersonas);
router.get("/:idPersona", obtenerPersonaPorId);
router.post("/", crearPersona);
router.put("/:idPersona", actualizarPersona);
router.delete("/:idPersona", eliminarPersona);

module.exports = router;
