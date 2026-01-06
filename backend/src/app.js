// app - Configuración principal de la aplicación Express
const express = require("express");
const cors = require("cors");
require("dotenv").config();
// Conexión a la base de datos
const db = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");
// Importar rutas
const empleadoRoutes = require("./routes/empleadoRoutes");
const autenticarRoutes = require("./routes/autenticarRoutes");
const personaRoutes = require("./routes/personaRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const horarioLaboralRoutes = require("./routes/horarioLaboralRoutes");
const asistenciaRoutes = require("./routes/asistenciaRoutes");
const rolRoutes = require("./routes/rolRoutes");

const app = express();
// Middlewares
app.use(cors());
app.use(express.json());
// Ruta raíz para verificar que el servidor está funcionando
app.get("/", (req, res) => res.send("Sistema Planilla cargando"));
// Ruta de prueba para verificar la conexión a la base de datos
app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS resultado");
    res.json({ ok: true, resultado: rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Rutas
app.use("/api/autenticar", autenticarRoutes);
app.use("/api/personas", personaRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/horarios", horarioLaboralRoutes);
app.use("/api/asistencias", asistenciaRoutes);
app.use("/api/roles", rolRoutes);

// Middleware final de errores
app.use(errorHandler);

module.exports = app;
