// empleadoController.js
const db = require("../config/db");


function nombreCompleto(p) {
  const n = String(p?.Nombre || "").trim();
  const a1 = String(p?.Apellido1 || "").trim();
  const a2 = String(p?.Apellido2 || "").trim();
  return [n, a1, a2].filter(Boolean).join(" ");
}


async function listarEmpleados(req, res, next) {
  try {
    const sql = `
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
    `;

    const [rows] = await db.query(sql);

    const data = rows.map((r) => ({
      idEmpleado: r.idEmpleado,
      Persona_idPersona: r.Persona_idPersona,
      Activo: r.Activo,
      nombre: nombreCompleto(r),
    }));

    return res.json({ ok: true, empleados: data });
  } catch (error) {
    return next(error);
  }
}


async function crearEmpleado(req, res, next) {
  try {
    const personaId = Number(req.body?.Persona_idPersona || 0);
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

    return res.status(201).json({ ok: true, idEmpleado: ins.insertId, mensaje: "Empleado creado" });
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

    
    const activo = req.body?.Activo === undefined ? 1 : Number(req.body.Activo) === 1 ? 1 : 0;

    const [upd] = await db.query(
      "UPDATE Empleado SET Activo = ? WHERE idEmpleado = ?",
      [activo, idEmpleado]
    );

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

    const [upd] = await db.query(
      "UPDATE Empleado SET Activo = 0 WHERE idEmpleado = ?",
      [idEmpleado]
    );

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
