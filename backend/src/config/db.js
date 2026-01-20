// config/db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

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

   
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),

   
  timezone: "Z",

   
  typeCast: (field, next) => {
    if (field.type === "BIT") {
      const buf = field.buffer();
      if (!buf) return null;

      if (buf.length === 1) return buf[0] === 1;

      let val = 0;
      for (const b of buf) val = (val << 8) + b;
      return val;
    }
    return next();
  },
});

module.exports = pool;
