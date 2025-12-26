//Codigo principal de la aplicación Express
//Configuracion de las rutas y middlewares
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");

const empleadoRoutes = require("./routes/empleadoRoutes");
const autenticarRoutes = require("./routes/autenticarRoutes");
const personaRoutes = require("./routes/personaRoutes");

const app = express();
//Para habilitar CORS y parseo de JSON que Cors es un middleware que permite solicitudes entre diferentes orígenes
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Sistema Planilla cargando");
});
// Verificar la conexión a la base de datos
app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS resultado");
    res.json({ ok: true, resultado: rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
//Rutas
app.use("/api/autenticar", require("./routes/autenticarRoutes"));
app.use("/api/personas", require("./routes/personaRoutes"));
app.use("/api/empleados", require("./routes/empleadoRoutes"));


app.use(errorHandler);

module.exports = app;
