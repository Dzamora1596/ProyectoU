const db = require("../config/db");

function bitTo01(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v ? 1 : 0;
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí" ? 1 : 0;
}

function nombreCompletoDesdePersona(p) {
  const n = String(p?.Nombre || "").trim();
  const a1 = String(p?.Apellido1 || "").trim();
  const a2 = String(p?.Apellido2 || "").trim();
  return [n, a1, a2].filter(Boolean).join(" ");
}

async function listarEmpleados(req, res, next) {
  try {
    const [rows] = await db.query(`
      SELECT
        e.idEmpleado,
        e.Persona_idPersona,
        e.Activo,
        p.Nombre,
        p.Apellido1,
        p.Apellido2
      FROM Empleado e
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      WHERE e.Activo = 1
      ORDER BY p.Nombre ASC, p.Apellido1 ASC, p.Apellido2 ASC
    `);

    const empleados = rows.map((r) => {
      const nombreCompleto = nombreCompletoDesdePersona(r);
      return {
        idEmpleado: Number(r.idEmpleado),
        personaId: Number(r.Persona_idPersona),
        activo: bitTo01(r.Activo),
        nombreCompleto,
        nombre: nombreCompleto,
      };
    });

    return res.json({ ok: true, empleados });
  } catch (error) {
    return next(error);
  }
}

async function crearEmpleado(req, res, next) {
  try {
    const personaId = Number(req.body?.Persona_idPersona || req.body?.personaId || 0);
    if (!personaId) {
      return res.status(400).json({ ok: false, mensaje: "Persona_idPersona es requerido" });
    }

    const [existe] = await db.query(
      "SELECT idEmpleado FROM Empleado WHERE Persona_idPersona = ? AND Activo = 1 LIMIT 1",
      [personaId]
    );
    if (existe.length) {
      return res.status(409).json({ ok: false, mensaje: "Ya existe un empleado para esa persona" });
    }

    const [ins] = await db.query(
      "INSERT INTO Empleado (Persona_idPersona, Activo) VALUES (?, 1)",
      [personaId]
    );

    return res.status(201).json({ ok: true, idEmpleado: Number(ins.insertId), mensaje: "Empleado creado" });
  } catch (error) {
    return next(error);
  }
}

async function actualizarEmpleado(req, res, next) {
  try {
    const idEmpleado = Number(req.params.idEmpleado || 0);
    if (!idEmpleado) {
      return res.status(400).json({ ok: false, mensaje: "idEmpleado inválido" });
    }

    const activo =
      req.body?.Activo === undefined && req.body?.activo === undefined
        ? 1
        : bitTo01(req.body?.Activo ?? req.body?.activo);

    const [upd] = await db.query("UPDATE Empleado SET Activo = ? WHERE idEmpleado = ?", [
      activo,
      idEmpleado,
    ]);

    if (!upd.affectedRows) {
      return res.status(404).json({ ok: false, mensaje: "Empleado no encontrado" });
    }

    return res.json({ ok: true, mensaje: "Empleado actualizado" });
  } catch (error) {
    return next(error);
  }
}

async function eliminarEmpleado(req, res, next) {
  try {
    const idEmpleado = Number(req.params.idEmpleado || 0);
    if (!idEmpleado) {
      return res.status(400).json({ ok: false, mensaje: "idEmpleado inválido" });
    }

    const [upd] = await db.query("UPDATE Empleado SET Activo = 0 WHERE idEmpleado = ?", [idEmpleado]);

    if (!upd.affectedRows) {
      return res.status(404).json({ ok: false, mensaje: "Empleado no encontrado" });
    }

    return res.json({ ok: true, mensaje: "Empleado eliminado (Activo=0)" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
};
