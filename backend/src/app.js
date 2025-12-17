// backend/src/app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Para leer el archivo .env

const db = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const empleadoRoutes = require('./routes/empleadoRoutes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// ----------- RUTA RAÍZ (http://localhost:4000/) -----------
app.get('/', (req, res) => {
  res.send('Sistema Planilla cargando');
});

// ----------- RUTA PARA PROBAR VARIABLES DEL .env -----------
app.get('/api/test-env', (req, res) => {
  res.json({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  });
});

// ----------- RUTA PARA PROBAR CONEXIÓN CON LA BD -----------
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS resultado');
    res.json({
      ok: true,
      mensaje: 'Conexión a la BD exitosa',
      resultado: rows,
    });
  } catch (error) {
    console.error('Error al probar la BD:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al conectar con la base de datos',
      error: error.message,
    });
  }
});

// ----------- RUTAS  API -----------
app.use('/api/empleados', empleadoRoutes);

// ----------- MIDDLEWARE DE ERRORES -----------
app.use(errorHandler);

module.exports = app;
