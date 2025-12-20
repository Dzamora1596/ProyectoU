//Definición de las rutas relacionadas con la autenticacion de usuarios.
const express = require('express');
const router = express.Router();
const autenticarController = require('../controllers/autenticarController');

router.post('/login', autenticarController.login);
router.post('/registrar', autenticarController.registrar);

module.exports = router;
