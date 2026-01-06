// Archivo para manejar a empleados y sus horarios laborales
const empleadoModel = require("../models/empleadoModel");
const horarioLaboralModel = require("../models/horarioLaboralModel");

// Helpers que convierten valores bit a booleanos para mayor compatibilidad
function bitToBool(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

// Get para listar todos los horarios laborales
const listarHorarios = async (req, res) => {
  try {
    const rows = await horarioLaboralModel.listarHorarios();

    const horarios = rows.map((h) => ({
      idHorarioLaboral: h.idHorarioLaboral,
      descripcion: h.Descripcion,
      entrada: h.Entrada,
      salida: h.Salida,
      activo: bitToBool(h.Activo),
    }));

    return res.json({ ok: true, horarios });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error listando horarios", error: String(e) });
  }
};

// Get para listar todos los empleados con su persona y horario laboral
const listarEmpleados = async (req, res) => {
  try {
    const rows = await empleadoModel.listarEmpleadosConPersonaYHorario();

    const empleados = rows.map((r) => ({
      idEmpleado: r.idEmpleado,
      personaId: r.personaId,
      fechaIngreso: r.fechaIngreso,
      horarioId: r.horarioId,
      activo: bitToBool(r.activo),
      persona: {
        nombre: r.nombre,
        apellido1: r.apellido1,
        apellido2: r.apellido2,
      },
      horario: {
        descripcion: r.horarioDescripcion,
        entrada: r.horarioEntrada,
        salida: r.horarioSalida,
      },
    }));

    return res.json({ ok: true, empleados });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error listando empleados", error: String(e) });
  }
};

// POST para crear un nuevo empleado
const crearEmpleado = async (req, res) => {
  try {
    const { personaId, fechaIngreso, horarioId, activo } = req.body;

    if (!personaId || !fechaIngreso || !horarioId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    // Ver si la Persona existe
    const personaExiste = await empleadoModel.existePersona(personaId);
    if (!personaExiste) {
      return res.status(400).json({ ok: false, mensaje: "La persona indicada no existe." });
    }

    // Validar que el horario laboral exista
    const horarioExiste = await horarioLaboralModel.existeHorario(horarioId);
    if (!horarioExiste) {
      return res.status(400).json({ ok: false, mensaje: "El horario laboral indicado no existe." });
    }

    const result = await empleadoModel.insertarEmpleado({
      personaId,
      fechaIngreso,
      horarioId,
      activo: activo ?? 1,
    });

    return res.json({
      ok: true,
      mensaje: "Empleado creado correctamente.",
      idEmpleado: result.insertId,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error creando empleado", error: String(e) });
  }
};

// PUT para actualizar un empleado existente
const actualizarEmpleado = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.idEmpleado);
    const { personaId, fechaIngreso, horarioId, activo } = req.body;

    if (!idEmpleado || !personaId || !fechaIngreso || !horarioId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    // Validar existe empleado
    const actual = await empleadoModel.obtenerEmpleadoPorId(idEmpleado);
    if (!actual) {
      return res.status(404).json({ ok: false, mensaje: "Empleado no encontrado." });
    }

    // Valida que la Persona existe
    const personaExiste = await empleadoModel.existePersona(personaId);
    if (!personaExiste) {
      return res.status(400).json({ ok: false, mensaje: "La persona indicada no existe." });
    }

    // Valida que el horario laboral exista
    const horarioExiste = await horarioLaboralModel.existeHorario(horarioId);
    if (!horarioExiste) {
      return res.status(400).json({ ok: false, mensaje: "El horario laboral indicado no existe." });
    }
// Actualizar empleado
    const result = await empleadoModel.actualizarEmpleado({
      idEmpleado,
      personaId,
      fechaIngreso,
      horarioId,
      activo: activo ?? 1,
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Empleado no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Empleado actualizado correctamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error actualizando empleado", error: String(e) });
  }
};

// DELETE para desactivar un empleado
const eliminarEmpleado = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.idEmpleado);

    const result = await empleadoModel.desactivarEmpleado(idEmpleado);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Empleado no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Empleado desactivado correctamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error eliminando empleado", error: String(e) });
  }
};

module.exports = {
  listarHorarios,
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
};
