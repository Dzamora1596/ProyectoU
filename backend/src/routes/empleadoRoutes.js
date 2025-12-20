//Definicion de rutas para empleados.
const express = require('express');
const empleadoController = require('../controllers/empleadoController');
const autenticar = require('../middlewares/autenticarMiddleware');
const rol = require('../middlewares/rolMiddleware');

const router = express.Router();

// GET /empleados
router.get('/', empleadoController.listar);

// GET /empleados en posicion 1
router.get('/:id', empleadoController.obtenerPorId);

// Get para empleados con autenticación y autorización
router.get(
  '/',
  autenticar,
  rol(['Administrador', 'Jefatura']),
  (req, res) => {
    res.json({ mensaje: 'Listado de empleados' });
  }
);

module.exports = router;
