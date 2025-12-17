const express = require('express');
const empleadoController = require('../controllers/empleadoController');

const router = express.Router();

// GET /empleados
router.get('/', empleadoController.listar);

// GET /empleados en posicion 1
router.get('/:id', empleadoController.obtenerPorId);

module.exports = router;
