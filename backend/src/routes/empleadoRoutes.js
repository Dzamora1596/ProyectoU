// backend/src/routes/empleadoRoutes.js
const express = require('express');
const empleadoController = require('../controllers/empleadoController');

const router = express.Router();

// GET /api/empleados
router.get('/', empleadoController.listar);

// GET /api/empleados/1
router.get('/:id', empleadoController.obtenerPorId);

module.exports = router;
