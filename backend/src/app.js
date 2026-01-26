// backend/src/app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

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
const permisosRoutes = require("./routes/permisosRoutes");
const vacacionesRoutes = require("./routes/vacacionesRoutes");
const incapacidadesRoutes = require("./routes/incapacidadesRoutes");

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

function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
}

function tryParseDMYtoMysql(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;

  const s = value.trim();
  if (!s) return value;

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return value;

  const [, dd, mm, yyyy, hh, mi, ss] = m;
  if (hh !== undefined && mi !== undefined) {
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss ?? "00"}`;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function formatDMY(value, withTime = true) {
  if (value === null || value === undefined || value === "") return value;

  if (value instanceof Date) {
    const dd = pad2(value.getDate());
    const mm = pad2(value.getMonth() + 1);
    const yyyy = value.getFullYear();
    if (!withTime) return `${dd}/${mm}/${yyyy}`;
    const hh = pad2(value.getHours());
    const mi = pad2(value.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  const s = String(value).trim();

  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m1) {
    const [, y, mo, d, hh, mm] = m1;
    if (!withTime || hh === undefined || mm === undefined) return `${d}/${mo}/${y}`;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const [, y, mo, d] = m2;
    return `${d}/${mo}/${y}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return formatDMY(dt, withTime);

  return value;
}

function mapDatesDeepInput(v) {
  if (Array.isArray(v)) return v.map(mapDatesDeepInput);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = mapDatesDeepInput(v[k]);
    return out;
  }
  return tryParseDMYtoMysql(v);
}

function mapDatesDeepOutput(v) {
  if (Array.isArray(v)) return v.map(mapDatesDeepOutput);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = mapDatesDeepOutput(v[k]);
    return out;
  }

  if (v instanceof Date) return formatDMY(v, true);

  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?$/.test(s)) return formatDMY(s, true);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDMY(s, false);
  }

  return v;
}

function dateMiddleware(req, res, next) {
  if (req.query && typeof req.query === "object") req.query = mapDatesDeepInput(req.query);
  if (req.body && typeof req.body === "object") req.body = mapDatesDeepInput(req.body);

  const originalJson = res.json.bind(res);
  res.json = (payload) => originalJson(mapDatesDeepOutput(payload));

  return next();
}

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/**
 * ✅ SERVIR ARCHIVOS SUBIDOS (uploads/incapacidades, etc.)
 * IMPORTANTE:
 * - Esto expone /uploads/** públicamente.
 * - Si luego quiere protegerlos por JWT, hacemos endpoint privado en lugar de static.
 */
const uploadsPath = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

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

app.use(dateMiddleware);

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
app.use("/api/permisos", permisosRoutes);
app.use("/api/vacaciones", vacacionesRoutes);
app.use("/api/incapacidades", incapacidadesRoutes);

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
