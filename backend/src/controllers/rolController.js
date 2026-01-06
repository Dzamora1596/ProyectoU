// Controllador para gestionar roles del sistema
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

function toBit01(v, defaultValue = 1) {
  if (v === null || v === undefined) return defaultValue; 
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v === 1 ? 1 : 0;
  const s = String(v).toLowerCase().trim();
  if (s === "1" || s === "true" || s === "si" || s === "sí") return 1;
  if (s === "0" || s === "false" || s === "no") return 0;
  return defaultValue;
}

// GET para listar todos los roles disponibles
const listarRoles = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT idRol, Descripcion, Activo
      FROM Rol
      ORDER BY idRol ASC
      `
    );

    const roles = rows.map((r) => ({
      idRol: r.idRol,
      descripcion: r.Descripcion ?? "",
      activo: bitToBool(r.Activo),
    }));

    return res.json({ ok: true, roles });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando roles",
      error: String(e),
    });
  }
};

//post para crear un nuevo rol
const crearRol = async (req, res) => {
  try {
    const descripcion = String(req.body?.descripcion ?? "").trim();
    const activo = toBit01(req.body?.activo, 1);

    if (!descripcion) {
      return res.status(400).json({ ok: false, mensaje: "La descripción es requerida." });
    }

    //Me ayuda a evitar duplicados
    const [ex] = await db.query(
      `SELECT idRol FROM Rol WHERE LOWER(Descripcion) = LOWER(?) LIMIT 1`,
      [descripcion]
    );
    if (ex.length) {
      return res.status(400).json({ ok: false, mensaje: "Ya existe un rol con esa descripción." });
    }

    const [r] = await db.query(
      `INSERT INTO Rol (Descripcion, Activo) VALUES (?, ?)`,
      [descripcion, activo]
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Rol creado.",
      idRol: r.insertId,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error creando rol",
      error: String(e),
    });
  }
};

// PUT para actualizar un rol existente
const actualizarRol = async (req, res) => {
  try {
    const idRol = Number(req.params.idRol);
    if (!idRol) return res.status(400).json({ ok: false, mensaje: "idRol inválido." });

    const descripcion = req.body?.descripcion;
    const activo = req.body?.activo;

    // nada que actualizar
    if (descripcion === undefined && activo === undefined) {
      return res.status(400).json({ ok: false, mensaje: "Debe enviar al menos descripcion o activo." });
    }

    // Validaciones para descripción si se envía
    let descFinal = null;
    if (descripcion !== undefined) {
      descFinal = String(descripcion ?? "").trim();
      if (!descFinal) {
        return res.status(400).json({ ok: false, mensaje: "La descripción no puede ir vacía." });
      }

      // Para evitar duplicados
      const [ex] = await db.query(
        `SELECT idRol FROM Rol WHERE LOWER(Descripcion) = LOWER(?) AND idRol <> ? LIMIT 1`,
        [descFinal, idRol]
      );
      if (ex.length) {
        return res.status(400).json({ ok: false, mensaje: "Ya existe otro rol con esa descripción." });
      }
    }
    // Const para activo si se envía 
    const activoFinal = activo === undefined ? null : toBit01(activo);

    // Construir query dinámicamente
    const sets = [];
    const params = [];

    if (descFinal !== null) {
      sets.push("Descripcion = ?");
      params.push(descFinal);
    }
    if (activoFinal !== null) {
      sets.push("Activo = ?");
      params.push(activoFinal);
    }

    params.push(idRol);

    const [r] = await db.query(
      `UPDATE Rol SET ${sets.join(", ")} WHERE idRol = ?`,
      params
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Rol no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Rol actualizado." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error actualizando rol",
      error: String(e),
    });
  }
};

// DELETE para desactivar un rol
const desactivarRol = async (req, res) => {
  try {
    const idRol = Number(req.params.idRol);
    if (!idRol) return res.status(400).json({ ok: false, mensaje: "idRol inválido." });

    //Me ayuda a notificar el no desactivar roles base del sistema
    if ([1, 2, 3, 4].includes(idRol)) {
      return res.status(400).json({ ok: false, mensaje: "No se puede desactivar un rol base del sistema." });
    }

    const [r] = await db.query(`UPDATE Rol SET Activo = 0 WHERE idRol = ?`, [idRol]);

    if (r.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Rol no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Rol desactivado." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error desactivando rol",
      error: String(e),
    });
  }
};

// DELETE para eliminar un rol definitivamente
const eliminarRolDefinitivo = async (req, res) => {
  try {
    const idRol = Number(req.params.idRol);
    if (!idRol) return res.status(400).json({ ok: false, mensaje: "idRol inválido." });


    if ([1, 2, 3, 4].includes(idRol)) {
      return res.status(400).json({ ok: false, mensaje: "No se puede eliminar un rol base del sistema." });
    }

    const [r] = await db.query(`DELETE FROM Rol WHERE idRol = ?`, [idRol]);

    if (r.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Rol no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Rol eliminado definitivamente." });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error eliminando rol (puede estar en uso por usuarios).",
      error: String(e),
    });
  }
};

module.exports = {
  listarRoles,
  crearRol,
  actualizarRol,
  desactivarRol,
  eliminarRolDefinitivo,
};
