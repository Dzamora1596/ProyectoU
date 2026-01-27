// backend/src/controllers/empleadoController.js
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

function getUserEmpleadoId(req) {
  const v =
    req?.user?.empleadoId ??
    req?.user?.Empleado_idEmpleado ??
    req?.user?.idEmpleado ??
    req?.user?.EmpleadoId ??
    req?.user?.empleado?.idEmpleado ??
    req?.user?.empleado?.IdEmpleado ??
    req?.usuario?.empleadoId ??
    req?.usuario?.Empleado_idEmpleado ??
    req?.usuario?.idEmpleado ??
    req?.usuario?.EmpleadoId ??
    null;

  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getUserId(req) {
  const v =
    req?.user?.idUsuario ??
    req?.user?.IdUsuario ??
    req?.user?.usuarioId ??
    req?.user?.userId ??
    req?.user?.id ??
    req?.usuario?.idUsuario ??
    req?.usuario?.IdUsuario ??
    req?.usuario?.usuarioId ??
    req?.usuario?.userId ??
    req?.usuario?.id ??
    null;

  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getUserEmail(req) {
  const v =
    req?.user?.correo ??
    req?.user?.Correo ??
    req?.user?.email ??
    req?.user?.Email ??
    req?.user?.username ??
    req?.user?.Usuario ??
    req?.usuario?.correo ??
    req?.usuario?.Correo ??
    req?.usuario?.email ??
    req?.usuario?.Email ??
    req?.usuario?.username ??
    req?.usuario?.Usuario ??
    null;

  const s = String(v || "").trim();
  return s ? s : null;
}

async function tryFirstEmpleadoIdFrom(sqls, params) {
  for (const sql of sqls) {
    try {
      const [rows] = await db.query(sql, params);
      const r = rows?.[0];
      if (!r) continue;
      const n = Number(r.idEmpleado ?? r.Empleado_idEmpleado ?? r.empleadoId ?? r.id ?? 0);
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      // ignorar (puede no existir la tabla/columna en este esquema)
    }
  }
  return null;
}

async function inferEmpleadoIdFromUser(req) {
  const direct = getUserEmpleadoId(req);
  if (direct) return direct;

  const userId = getUserId(req);
  if (userId) {
    const byUserId = await tryFirstEmpleadoIdFrom(
      [
        "SELECT Empleado_idEmpleado AS idEmpleado FROM Usuario WHERE idUsuario = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM Usuarios WHERE idUsuario = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM usuario WHERE idUsuario = ? LIMIT 1",
        "SELECT idEmpleado AS idEmpleado FROM Empleado WHERE Usuario_idUsuario = ? LIMIT 1",
        "SELECT idEmpleado AS idEmpleado FROM Empleado WHERE usuarioId = ? LIMIT 1",
      ],
      [userId]
    );
    if (byUserId) return byUserId;
  }

  const email = getUserEmail(req);
  if (email) {
    const byEmail = await tryFirstEmpleadoIdFrom(
      [
        "SELECT Empleado_idEmpleado AS idEmpleado FROM Usuario WHERE Correo = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM Usuario WHERE email = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM Usuarios WHERE Correo = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM Usuarios WHERE email = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM usuario WHERE Correo = ? LIMIT 1",
        "SELECT Empleado_idEmpleado AS idEmpleado FROM usuario WHERE email = ? LIMIT 1",
      ],
      [email]
    );
    if (byEmail) return byEmail;
  }

  return null;
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
        persona: {
          Nombre: String(r.Nombre || ""),
          Apellido1: String(r.Apellido1 || ""),
          Apellido2: String(r.Apellido2 || ""),
        },
      };
    });

    return res.json({ ok: true, empleados });
  } catch (error) {
    return next(error);
  }
}

async function obtenerMiEmpleado(req, res, next) {
  try {
    const empleadoId = await inferEmpleadoIdFromUser(req);
    if (!empleadoId) {
      return res.status(400).json({ ok: false, mensaje: "El usuario no tiene empleado asignado" });
    }

    const [rows] = await db.query(
      `
      SELECT
        e.idEmpleado,
        e.Persona_idPersona,
        e.Activo,
        p.Nombre,
        p.Apellido1,
        p.Apellido2
      FROM Empleado e
      JOIN Persona p ON p.idPersona = e.Persona_idPersona
      WHERE e.idEmpleado = ?
      LIMIT 1
      `,
      [empleadoId]
    );

    const r = rows?.[0];
    if (!r || bitTo01(r.Activo) !== 1) {
      return res.status(404).json({ ok: false, mensaje: "Empleado no encontrado o inactivo" });
    }

    const nombreCompleto = nombreCompletoDesdePersona(r);

    // ✅ AJUSTE: además de "empleado", devolvemos también las claves planas
    // para que el frontend funcione aunque espere el objeto directo.
    const empleado = {
      idEmpleado: Number(r.idEmpleado),
      personaId: Number(r.Persona_idPersona),
      activo: 1,
      nombreCompleto,
      nombre: nombreCompleto,
      persona: {
        Nombre: String(r.Nombre || ""),
        Apellido1: String(r.Apellido1 || ""),
        Apellido2: String(r.Apellido2 || ""),
      },
    };

    return res.json({
      ok: true,
      empleado,
      ...empleado, // ✅ compatibilidad hacia atrás: idEmpleado/nombreCompleto/nombre/etc. al root
    });
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

    const [ins] = await db.query("INSERT INTO Empleado (Persona_idPersona, Activo) VALUES (?, 1)", [personaId]);

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

    const [upd] = await db.query("UPDATE Empleado SET Activo = ? WHERE idEmpleado = ?", [activo, idEmpleado]);

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
  obtenerMiEmpleado,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
};
