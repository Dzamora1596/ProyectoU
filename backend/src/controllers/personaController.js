//Controllador para gestionar personas
const PersonaModel = require("../models/personaModel");

//Get para listar todas las personas
const listarPersonas = async (req, res) => {
  try {
    const personas = await PersonaModel.listar();
    return res.json({ ok: true, personas });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error listando personas", error: String(e) });
  }
};

//Get para listar todos los géneros
const listarGeneros = async (req, res) => {
  try {
    const generos = await PersonaModel.listarGeneros();
    return res.json({ ok: true, generos });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error listando géneros", error: String(e) });
  }
};

// POST para crear una nueva persona
const crearPersona = async (req, res) => {
  try {
    const { idPersona, nombre, apellido1, apellido2, generoId, activo } = req.body;

    if (!idPersona || !nombre || !apellido1 || !apellido2 || !generoId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    const generoOk = await PersonaModel.existeGenero(generoId);
    if (!generoOk) {
      return res.status(400).json({ ok: false, mensaje: "El género indicado no existe." });
    }

    const existe = await PersonaModel.existePersona(idPersona);
    if (existe) {
      return res.status(400).json({ ok: false, mensaje: "Ya existe una persona con ese ID." });
    }

    await PersonaModel.crear({
      idPersona: Number(idPersona),
      nombre: String(nombre).trim(),
      apellido1: String(apellido1).trim(),
      apellido2: String(apellido2).trim(),
      generoId: Number(generoId),
      activo: Number(activo ?? 1),
    });

    return res.json({ ok: true, mensaje: "Persona creada correctamente." });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error creando persona", error: String(e) });
  }
};

// PUT para actualizar una persona registrada
const actualizarPersona = async (req, res) => {
  try {
    const idPersona = Number(req.params.idPersona);
    const { nombre, apellido1, apellido2, generoId, activo } = req.body;

    if (!idPersona || !nombre || !apellido1 || !apellido2 || !generoId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    const generoOk = await PersonaModel.existeGenero(generoId);
    if (!generoOk) {
      return res.status(400).json({ ok: false, mensaje: "El género indicado no existe." });
    }

    const affected = await PersonaModel.actualizarById(idPersona, {
      nombre: String(nombre).trim(),
      apellido1: String(apellido1).trim(),
      apellido2: String(apellido2).trim(),
      generoId: Number(generoId),
      activo: Number(activo ?? 1),
    });

    if (affected === 0) {
      return res.status(404).json({ ok: false, mensaje: "Persona no encontrada." });
    }

    return res.json({ ok: true, mensaje: "Persona actualizada correctamente." });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error actualizando persona", error: String(e) });
  }
};

// DELETE para desactivar una persona
const eliminarPersona = async (req, res) => {
  try {
    const idPersona = Number(req.params.idPersona);

    const affected = await PersonaModel.desactivarById(idPersona);
    if (affected === 0) {
      return res.status(404).json({ ok: false, mensaje: "Persona no encontrada." });
    }

    return res.json({ ok: true, mensaje: "Persona desactivada correctamente." });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error eliminando persona", error: String(e) });
  }
};

module.exports = {
  listarPersonas,
  listarGeneros,      
  crearPersona,
  actualizarPersona,
  eliminarPersona,
};
