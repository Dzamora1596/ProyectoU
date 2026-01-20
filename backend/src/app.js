// app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");

const autenticarRoutes = require("./routes/autenticarRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const horarioLaboralRoutes = require("./routes/horarioLaboralRoutes");
const asistenciaRoutes = require("./routes/asistenciaRoutes");
const registroPersonalRoutes = require("./routes/registroPersonalRoutes");
const empleadoRoutes = require("./routes/empleadoRoutes");
const telefonoRoutes = require("./routes/telefonoRoutes");
const correoRoutes = require("./routes/correoRoutes");
const catalogosRoutes = require("./routes/catalogosRoutes");
const horasExtraRoutes = require("./routes/horasExtraRoutes");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "SistemaPlanilla",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => res.send("Sistema Planilla cargando"));

if ((process.env.NODE_ENV || "development") !== "production") {
  app.get("/api/test-db", async (req, res) => {
    try {
      const [rows] = await db.query("SELECT 1 AS resultado");
      res.json({ ok: true, resultado: rows });
    } catch (error) {
      res.status(500).json({ ok: false, mensaje: error.message });
    }
  });
}

app.use("/api/autenticar", autenticarRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/horarios", horarioLaboralRoutes);
app.use("/api/asistencias", asistenciaRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api/registro-personal", registroPersonalRoutes);
app.use("/api/telefonos", telefonoRoutes);
app.use("/api/correos", correoRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/horas-extra", horasExtraRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: "Ruta no encontrada",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  if (String(err?.message || "").includes("Not allowed by CORS")) {
    return res.status(403).json({ ok: false, mensaje: "CORS: origen no permitido" });
  }
  return next(err);
});

app.use(errorHandler);

module.exports = app;
