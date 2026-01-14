// backend/src/models/telefonoModel.js
const db = require("../config/db");

function convertirBitABooleano(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

function aNumero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function listarTipos(conn = db) {
  const [rows] = await conn.query(
    `SELECT idCatalogo_Tipo_Telefono AS idTipoTelefono,
            Descripcion_Tipo_Telefono AS descripcion,
            Activo
     FROM Catalogo_Tipo_Telefono
     ORDER BY idCatalogo_Tipo_Telefono ASC`
  );

  return rows.map((r) => ({
    idTipoTelefono: r.idTipoTelefono,
    descripcion: r.descripcion,
    activo: convertirBitABooleano(r.Activo),
  }));
}

async function existeTelefono(telefono, conn = db) {
  const tel = aNumero(telefono);
  if (!Number.isFinite(tel)) return false;

  const [rows] = await conn.query(
    `SELECT 1 FROM Telefono WHERE idTelefono = ? LIMIT 1`,
    [tel]
  );
  return rows.length > 0;
}

async function crear({ personaId, telefono, tipoTelefonoId, activo = 1 }, conn = db) {
  const pid = aNumero(personaId);
  const tel = aNumero(telefono);
  const tipo = aNumero(tipoTelefonoId);

  if (!Number.isFinite(pid) || !Number.isFinite(tel) || !Number.isFinite(tipo)) {
    throw new Error("Datos inválidos para crear Teléfono.");
  }

  await conn.query(
    `INSERT INTO Telefono
      (idTelefono, Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono, Persona_idPersona, Activo)
     VALUES (?, ?, ?, ?)`,
    [tel, tipo, pid, Number(activo ?? 1)]
  );
}

module.exports = {
  listarTipos,
  existeTelefono,
  crear,
};
