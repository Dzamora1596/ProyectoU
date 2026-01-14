//personaRoutes.js
const express = require("express");
const router = express.Router();
 
const {
  listarPersonas,
  listarGeneros,
  crearPersona,
  actualizarPersona,
  eliminarPersona,
} = require("../controllers/personaController");
 
router.get("/", listarPersonas);
router.get("/generos", listarGeneros);
 
router.post("/", crearPersona);
router.put("/:idPersona", actualizarPersona);
router.delete("/:idPersona", eliminarPersona);

module.exports = router;
