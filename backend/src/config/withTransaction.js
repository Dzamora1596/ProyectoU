// withTransaction.js
const db = require("./db");

async function withTransaction(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

async function ejecutarEnTransaccion(fn) {
  return withTransaction(fn);
}

module.exports = withTransaction;
module.exports.ejecutarEnTransaccion = ejecutarEnTransaccion;
