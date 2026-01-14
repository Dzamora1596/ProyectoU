// withTransaction.js
const db = require("./db");


async function ejecutarEnTransaccion(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { ejecutarEnTransaccion };
