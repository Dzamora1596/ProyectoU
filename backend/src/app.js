//Configuaración del servidor express, las rutas y los middlewares globales para la aplicacion.
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

const empleadoRoutes = require('./routes/empleadoRoutes');
const autenticarRoutes = require('./routes/autenticarRoutes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Ruta raíz
app.get('/', (req, res) => {
  res.send('Sistema Planilla cargando');
});

// Test env
app.get('/api/test-env', (req, res) => {
  res.json({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
  });
});

// Test BD
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS resultado');
    res.json({ ok: true, resultado: rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Rutas API
app.use('/api/empleados', empleadoRoutes);
app.use('/api/autenticar', autenticarRoutes);

// Middleware de errores
app.use(errorHandler);

module.exports = app;
