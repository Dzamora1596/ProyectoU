// Codigo del controlador de personas
const db = require("../config/db");

// Convierte BIT (que viene como Buffer) a boolean
const bitToBool = (v) => (Buffer.isBuffer(v) ? v[0] === 1 : Boolean(v));

/// GET /api/generos
const listarGeneros = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT idCatalogo_Genero AS idGenero,
              Descripcion_Genero AS nombreGenero
       FROM Catalogo_Genero
       WHERE Activo = b'1'
       ORDER BY Descripcion_Genero`
    );

    return res.json({ ok: true, generos: rows });
  } catch (error) {
    next(error);
  }
};

// GET /api/personas
const listarPersonas = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT  p.idPersona,
               p.Nombre AS nombre,
               p.Apellido1 AS apellido1,
               p.Apellido2 AS apellido2,
               p.Catalogo_Genero_idCatalogo_Genero AS generoId,
               cg.Descripcion_Genero AS generoNombre,
               p.Activo AS activo
       FROM Persona p
       INNER JOIN Catalogo_Genero cg
         ON cg.idCatalogo_Genero = p.Catalogo_Genero_idCatalogo_Genero
       ORDER BY p.idPersona DESC`
    );

    const personas = rows.map((r) => ({
      ...r,
      activo: bitToBool(r.activo),
    }));

    return res.json({ ok: true, personas });
  } catch (error) {
    next(error);
  }
};

// GET /api/personas
const obtenerPersonaPorId = async (req, res, next) => {
  try {
    const { idPersona } = req.params;

    const [rows] = await db.query(
      `SELECT  p.idPersona,
               p.Nombre AS nombre,
               p.Apellido1 AS apellido1,
               p.Apellido2 AS apellido2,
               p.Catalogo_Genero_idCatalogo_Genero AS generoId,
               cg.Descripcion_Genero AS generoNombre,
               p.Activo AS activo
       FROM Persona p
       INNER JOIN Catalogo_Genero cg
         ON cg.idCatalogo_Genero = p.Catalogo_Genero_idCatalogo_Genero
       WHERE p.idPersona = ?`,
      [idPersona]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Persona no encontrada" });
    }

    const persona = rows[0];
    persona.activo = bitToBool(persona.activo);

    return res.json({ ok: true, persona });
  } catch (error) {
    next(error);
  }
};

// POST /api/personas
const crearPersona = async (req, res, next) => {
  try {
    const { idPersona, nombre, apellido1, apellido2, generoId, activo } = req.body;

    if (!idPersona || !nombre || !apellido1 || !apellido2 || !generoId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos: idPersona, nombre, apellido1, apellido2, generoId",
      });
    }

    // Validar género existe y está activo
    const [gen] = await db.query(
      `SELECT idCatalogo_Genero
       FROM Catalogo_Genero
       WHERE idCatalogo_Genero = ? AND Activo = b'1'`,
      [generoId]
    );
    if (gen.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Género inválido o inactivo" });
    }

    // Validar persona no exista
    const [existe] = await db.query(`SELECT idPersona FROM Persona WHERE idPersona = ?`, [
      idPersona,
    ]);
    if (existe.length > 0) {
      return res.status(409).json({ ok: false, mensaje: "Ese idPersona ya existe" });
    }

    const activoBit = Number(activo) === 0 ? 0 : 1;

    await db.query(
      `INSERT INTO Persona
       (idPersona, Nombre, Apellido1, Apellido2, Catalogo_Genero_idCatalogo_Genero, Activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idPersona, nombre.trim(), apellido1.trim(), apellido2.trim(), generoId, activoBit]
    );

    return res.status(201).json({ ok: true, mensaje: "Persona creada correctamente" });
  } catch (error) {
    next(error);
  }
};

// PUT /api/personas
const actualizarPersona = async (req, res, next) => {
  try {
    const { idPersona } = req.params;
    const { nombre, apellido1, apellido2, generoId, activo } = req.body;

    // Debe existir
    const [existe] = await db.query(`SELECT idPersona FROM Persona WHERE idPersona = ?`, [
      idPersona,
    ]);
    if (existe.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Persona no encontrada" });
    }

    if (!nombre || !apellido1 || !apellido2 || !generoId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos: nombre, apellido1, apellido2, generoId",
      });
    }

    // Validar género existe y está activo
    const [gen] = await db.query(
      `SELECT idCatalogo_Genero
       FROM Catalogo_Genero
       WHERE idCatalogo_Genero = ? AND Activo = b'1'`,
      [generoId]
    );
    if (gen.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Género inválido o inactivo" });
    }

    const activoBit = Number(activo) === 0 ? 0 : 1;

    await db.query(
      `UPDATE Persona
       SET Nombre = ?, Apellido1 = ?, Apellido2 = ?,
           Catalogo_Genero_idCatalogo_Genero = ?, Activo = ?
       WHERE idPersona = ?`,
      [nombre.trim(), apellido1.trim(), apellido2.trim(), generoId, activoBit, idPersona]
    );

    return res.json({ ok: true, mensaje: "Persona actualizada correctamente" });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/personas
const eliminarPersona = async (req, res, next) => {
  try {
    const { idPersona } = req.params;

    
    const [result] = await db.query(`DELETE FROM Persona WHERE idPersona = ?`, [idPersona]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Persona no encontrada" });
    }

    return res.json({ ok: true, mensaje: "Persona eliminada correctamente" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarGeneros,
  listarPersonas,
  obtenerPersonaPorId,
  crearPersona,
  actualizarPersona,
  eliminarPersona,
};
