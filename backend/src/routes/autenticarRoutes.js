const express = require('express');
const router = express.Router();
const autenticarController = require('../controllers/autenticarController');

router.post('/login', autenticarController.login);

module.exports = router;
