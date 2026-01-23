// config/db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
}

function ymdToDmy(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function ymdHmsToDmyHm(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  const [, y, mo, d, hh, mm] = m;
  return `${d}/${mo}/${y} ${hh}:${mm}`;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  database: process.env.DB_NAME || "baseproyectoplanilla",
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,

  charset: "utf8mb4",
  dateStrings: true,
  decimalNumbers: true,
  namedPlaceholders: true,

  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  timezone: "-06:00",

  typeCast: (field, next) => {
    if (field.type === "BIT") {
      const buf = field.buffer();
      if (!buf) return null;
      if (buf.length === 1) return buf[0] === 1;

      let val = 0;
      for (const b of buf) val = (val << 8) + b;
      return val;
    }

    if (field.type === "DATE" || field.type === "NEWDATE") {
      const s = field.string();
      return s ? ymdToDmy(s) : s;
    }

    if (field.type === "DATETIME" || field.type === "TIMESTAMP") {
      const s = field.string();
      return s ? ymdHmsToDmyHm(s) : s;
    }

    return next();
  },
});

module.exports = pool;
