// middlewares/errorHandler.js
function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
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

function mapDatesDeep(v) {
  if (Array.isArray(v)) return v.map(mapDatesDeep);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = mapDatesDeep(v[k]);
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

function pickStatus(err) {
  const s = Number(err?.statusCode || err?.status || 0);
  if (s >= 400 && s <= 599) return s;
  return 500;
}

function errorHandler(err, req, res, next) {
  console.error(err);

  const status = pickStatus(err);

  const payload = {
    ok: false,
    message: err?.message || "Ocurrió un error en el servidor",
    code: err?.code || (status >= 400 && status < 500 ? "VALIDATION_ERROR" : "SERVER_ERROR"),
  };

  if ((process.env.NODE_ENV || "development") !== "production") {
    payload.stack = err?.stack;
  }

  return res.status(status).json(mapDatesDeep(payload));
}

module.exports = errorHandler;
