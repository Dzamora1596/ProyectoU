// Rutas de Usuarios
const express = require("express");
const router = express.Router();
// Importar controladores de usuario
const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario, // soft
  eliminarUsuarioDefinitivo, // hard
  listarEmpleadosDisponibles,
} = require("../controllers/usuarioController");

//crud usuarios
router.get("/", listarUsuarios);
router.post("/", crearUsuario);

//Get empleados disponibles para asignar usuario
router.get("/empleados-disponibles", listarEmpleadosDisponibles);

// Actualizar, desactivar y eliminar usuarios
router.put("/:idUsuario", actualizarUsuario);
router.delete("/:idUsuario", eliminarUsuario);
router.delete("/:idUsuario/hard", eliminarUsuarioDefinitivo);

module.exports = router;
