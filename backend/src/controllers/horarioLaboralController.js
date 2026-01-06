// archivo para gestionar horarios laborales
const db = require("../config/db");

// Helpers que convierten valores bit a booleanos para mayor compatibilidad

function bitToBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

function toTime(v) {
  const s = String(v ?? "").trim();
  if (!s) return "00:00:00";
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return "00:00:00";
}

function toBit01(v, defaultValue = 1) {
  if (v === null || v === undefined) return defaultValue;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v === 1 ? 1 : 0;
  const s = String(v).toLowerCase().trim();
  if (s === "1" || s === "true" || s === "si" || s === "sí") return 1;
  if (s === "0" || s === "false" || s === "no") return 0;
  return defaultValue;
}

// GET para listar todos los horarios laborales

const listarHorarios = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        idHorario_Laboral,
        Descripcion,
        Entrada,
        Salida,
        Activo
      FROM Horario_Laboral
      ORDER BY idHorario_Laboral ASC
    `);

    const horarios = rows.map((r) => ({
      idHorarioLaboral: r.idHorario_Laboral, 
      descripcion: r.Descripcion ?? "",
      entrada: r.Entrada ? String(r.Entrada) : "00:00:00",
      salida: r.Salida ? String(r.Salida) : "00:00:00",
      activo: bitToBool(r.Activo),
    }));

    return res.json({ ok: true, horarios });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando horarios",
      error: String(e),
    });
  }
};

// POST para crear un nuevo horario laboral
const crearHorario = async (req, res) => {
  try {
    const descripcion = String(req.body?.descripcion ?? "").trim();
    const entrada = toTime(req.body?.entrada);
    const salida = toTime(req.body?.salida);
    const activo = toBit01(req.body?.activo, 1);

    if (!descripcion) {
      return res.status(400).json({ ok: false, mensaje: "La descripción es requerida." });
    }

    const [r] = await db.query(
      `
      INSERT INTO Horario_Laboral (Descripcion, Entrada, Salida, Activo)
      VALUES (?, ?, ?, ?)
      `,
      [descripcion, entrada, salida, activo]
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Horario creado.",
      idHorarioLaboral: r.insertId,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error creando horario",
      error: String(e),
    });
  }
};

// PUT para actualizar un horario laboral existente
const actualizarHorario = async (req, res) => {
  try {
    const idHorarioLaboral = Number(req.params.idHorarioLaboral);
    if (!idHorarioLaboral) {
      return res.status(400).json({ ok: false, mensaje: "idHorarioLaboral inválido." });
    }

    const { descripcion, entrada, salida, activo } = req.body ?? {};

    if (descripcion === undefined && entrada === undefined && salida === undefined && activo === undefined) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe enviar al menos un campo para actualizar.",
      });
    }

    const sets = [];
    const params = [];

    if (descripcion !== undefined) {
      const d = String(descripcion ?? "").trim();
      if (!d) return res.status(400).json({ ok: false, mensaje: "La descripción no puede ir vacía." });
      sets.push("Descripcion = ?");
      params.push(d);
    }

    if (entrada !== undefined) {
      sets.push("Entrada = ?");
      params.push(toTime(entrada));
    }

    if (salida !== undefined) {
      sets.push("Salida = ?");
      params.push(toTime(salida));
    }

    if (activo !== undefined) {
      sets.push("Activo = ?");
      params.push(toBit01(activo, 1));
    }

    params.push(idHorarioLaboral);

    const [r] = await db.query(
      `
      UPDATE Horario_Laboral
      SET ${sets.join(", ")}
      WHERE idHorario_Laboral = ?
      `,
      params
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Horario no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Horario actualizado." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error actualizando horario",
      error: String(e),
    });
  }
};

// DELETE para desactivar un horario laboral
const eliminarHorario = async (req, res) => {
  try {
    const idHorarioLaboral = Number(req.params.idHorarioLaboral);
    if (!idHorarioLaboral) {
      return res.status(400).json({ ok: false, mensaje: "idHorarioLaboral inválido." });
    }

    const [r] = await db.query(
      `UPDATE Horario_Laboral SET Activo = 0 WHERE idHorario_Laboral = ?`,
      [idHorarioLaboral]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Horario no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Horario desactivado." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error desactivando horario",
      error: String(e),
    });
  }
};

module.exports = {
  listarHorarios,
  crearHorario,
  actualizarHorario,
  eliminarHorario,
};
