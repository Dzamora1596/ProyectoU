// Rutas de Roles
const express = require("express");
const router = express.Router();

const autorizarRoles = require("../middlewares/autorizarRoles");
const rolController = require("../controllers/rolController");

// Listar
router.get("/", autorizarRoles([1]), rolController.listarRoles);

// Crear
router.post("/", autorizarRoles([1]), rolController.crearRol);

//Actualiza 
router.put("/:idRol", autorizarRoles([1]), rolController.actualizarRol);

// Desactiva y Activa roles
router.put("/:idRol/desactivar", autorizarRoles([1]), rolController.desactivarRol);

// Elimina definitivo
router.delete("/:idRol", autorizarRoles([1]), rolController.eliminarRolDefinitivo);

module.exports = router;
