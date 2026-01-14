//  usuarioRoutes.js
const express = require("express");
const router = express.Router();

const autenticar = require("../middlewares/autenticarMiddleware");
const requireRole = require("../middlewares/requireRole");

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  eliminarUsuarioDefinitivo,
  listarEmpleadosDisponibles,
} = require("../controllers/usuarioController");

 
router.use(autenticar, requireRole(["Admin", "Jefatura"]));

 
router.get("/", listarUsuarios);

 
router.post("/", crearUsuario);

 
router.get("/empleados-disponibles", listarEmpleadosDisponibles);

 
router.put("/:idUsuario", actualizarUsuario);

 
router.delete("/:idUsuario", eliminarUsuario);

 
router.delete("/:idUsuario/hard", eliminarUsuarioDefinitivo);

module.exports = router;
