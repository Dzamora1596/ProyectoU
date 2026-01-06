//Rutas de Personas
const express = require("express");
const router = express.Router();
// Importar controladores de persona
const {
  listarPersonas,
  listarGeneros,
  crearPersona,
  actualizarPersona,
  eliminarPersona,
} = require("../controllers/personaController");
// Rutas de Personas
router.get("/", listarPersonas);
router.get("/generos", listarGeneros);
// CRUD de Personas
router.post("/", crearPersona);
router.put("/:idPersona", actualizarPersona);
router.delete("/:idPersona", eliminarPersona);

module.exports = router;
