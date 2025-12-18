const express = require('express');
const router = express.Router();
const autenticadorController = require('../controllers/autenticadorController');

router.post('/login', autenticadorController.login);
router.post('/logout', autenticadorController.logout);

module.exports = router;
