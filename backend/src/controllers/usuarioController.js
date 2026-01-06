// Controladores para  Usuario 
const bcrypt = require("bcryptjs");
const usuarioModel = require("../models/usuarioModel");

const SALT_ROUNDS = 10;

function bitToBool(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v[0] === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

// GET para listar todos los usuarios con detalle de empleado y rol
const listarUsuarios = async (req, res) => {
  try {
    const rows = await usuarioModel.listarUsuariosConDetalle();

    const usuarios = rows.map((r) => ({
      idUsuario: r.idUsuario,
      nombreUsuario: r.nombreUsuario,
      empleadoId: r.empleadoId,
      rolId: r.rolId,
      rolNombre: r.rolNombre,
      activo: bitToBool(r.activo),
      empleado: {
        idEmpleado: r.empleadoId,
        personaId: r.personaId,
        nombreCompleto: `${r.personaNombre} ${r.personaApellido1} ${r.personaApellido2}`,
      },
    }));

    return res.json({ ok: true, usuarios });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error listando usuarios", error: String(e) });
  }
};

// POST para crear un nuevo usuario
const crearUsuario = async (req, res) => {
  try {
    const { empleadoId, nombreUsuario, password, rolId, activo } = req.body;

    if (!empleadoId || !nombreUsuario || !password || !rolId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    const empOk = await usuarioModel.existeEmpleado(empleadoId);
    if (!empOk) return res.status(400).json({ ok: false, mensaje: "El empleado indicado no existe." });

    const rolOk = await usuarioModel.existeRol(rolId);
    if (!rolOk) return res.status(400).json({ ok: false, mensaje: "El rol indicado no existe." });

    const empTieneUsuario = await usuarioModel.empleadoTieneUsuario(empleadoId);
    if (empTieneUsuario) {
      return res.status(400).json({ ok: false, mensaje: "Ese empleado ya tiene un usuario asignado." });
    }

    const existeNombre = await usuarioModel.existeNombreUsuario(nombreUsuario);
    if (existeNombre) {
      return res.status(400).json({ ok: false, mensaje: "Ese NombreUsuario ya existe." });
    }

    const nuevoId = await usuarioModel.obtenerSiguienteIdUsuario();
    const passwordHash = await bcrypt.hash(String(password).trim(), SALT_ROUNDS);

    await usuarioModel.insertarUsuario({
      idUsuario: nuevoId,
      nombreUsuario,
      passwordHash,
      empleadoId,
      rolId,
      activo: activo ?? 1,
    });

    return res.json({ ok: true, mensaje: "Usuario creado correctamente.", idUsuario: nuevoId });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error creando usuario", error: String(e) });
  }
};

// PUT para actualizar un usuario registrado
const actualizarUsuario = async (req, res) => {
  try {
    const idUsuario = Number(req.params.idUsuario);
    if (!idUsuario) return res.status(400).json({ ok: false, mensaje: "idUsuario inválido." });

    const actual = await usuarioModel.obtenerUsuarioPorId(idUsuario);
    if (!actual) return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });

    const { nombreUsuario, password, empleadoId, rolId, activo } = req.body;

    // resolver nuevos valores (si no viene, mantener)
    const nuevoNombre = (nombreUsuario !== undefined && nombreUsuario !== null)
      ? String(nombreUsuario).trim()
      : String(actual.NombreUsuario).trim();

    const nuevoEmpleadoId = (empleadoId !== undefined && empleadoId !== null && String(empleadoId) !== "")
      ? Number(empleadoId)
      : Number(actual.empleadoId);

    const nuevoRolId = (rolId !== undefined && rolId !== null && String(rolId) !== "")
      ? Number(rolId)
      : Number(actual.rolId);

    const nuevoActivo = (activo !== undefined && activo !== null && String(activo) !== "")
      ? Number(activo)
      : Number(actual.Activo ?? 1);

    if (!nuevoNombre || !nuevoEmpleadoId || !nuevoRolId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    //Para validar que el nombre de usuario no se duplique si cambió
    if (nuevoNombre !== String(actual.NombreUsuario).trim()) {
      const dup = await usuarioModel.existeNombreUsuario(nuevoNombre, idUsuario);
      if (dup) return res.status(400).json({ ok: false, mensaje: "Ese NombreUsuario ya existe." });
    }

    // validar empleado duplicado si cambió
    if (nuevoEmpleadoId !== Number(actual.empleadoId)) {
      const dupEmp = await usuarioModel.empleadoTieneUsuario(nuevoEmpleadoId, idUsuario);
      if (dupEmp) {
        return res.status(400).json({ ok: false, mensaje: "Ese empleado ya tiene un usuario asignado." });
      }

      const empOk = await usuarioModel.existeEmpleado(nuevoEmpleadoId);
      if (!empOk) return res.status(400).json({ ok: false, mensaje: "El empleado indicado no existe." });
    }

    // rol existe si cambió
    if (nuevoRolId !== Number(actual.rolId)) {
      const rolOk = await usuarioModel.existeRol(nuevoRolId);
      if (!rolOk) return res.status(400).json({ ok: false, mensaje: "El rol indicado no existe." });
    }

    // Confirma si el password viene para actualizarlo
    if (password && String(password).trim().length > 0) {
      const passwordHash = await bcrypt.hash(String(password).trim(), SALT_ROUNDS);

      const result = await usuarioModel.actualizarUsuarioConPassword({
        idUsuario,
        nombreUsuario: nuevoNombre,
        passwordHash,
        empleadoId: nuevoEmpleadoId,
        rolId: nuevoRolId,
        activo: nuevoActivo,
      });

      if (result.affectedRows === 0) {
        return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
      }
    } else {
      const result = await usuarioModel.actualizarUsuarioSinPassword({
        idUsuario,
        nombreUsuario: nuevoNombre,
        empleadoId: nuevoEmpleadoId,
        rolId: nuevoRolId,
        activo: nuevoActivo,
      });

      if (result.affectedRows === 0) {
        return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
      }
    }

    return res.json({ ok: true, mensaje: "Usuario actualizado correctamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error actualizando usuario", error: String(e) });
  }
};

// DELETE para desactivar un usuario
const eliminarUsuario = async (req, res) => {
  try {
    const idUsuario = Number(req.params.idUsuario);

    const result = await usuarioModel.desactivarUsuario(idUsuario);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Usuario desactivado correctamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error desactivando usuario", error: String(e) });
  }
};

// DELETE para eliminar un usuario definitivamente
const eliminarUsuarioDefinitivo = async (req, res) => {
  try {
    const idUsuario = Number(req.params.idUsuario);

    const result = await usuarioModel.eliminarUsuarioDefinitivo(idUsuario);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
    }

    return res.json({ ok: true, mensaje: "Usuario eliminado definitivamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error eliminando usuario definitivamente", error: String(e) });
  }
};

// GET para listar empleados que no tienen usuario asignado
const listarEmpleadosDisponibles = async (req, res) => {
  try {
    const rows = await usuarioModel.listarEmpleadosDisponibles();

    const empleados = rows.map((r) => ({
      idEmpleado: r.idEmpleado,
      personaId: r.personaId,
      nombreCompleto: `${r.nombre} ${r.apellido1} ${r.apellido2}`,
    }));

    return res.json({ ok: true, empleados });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error listando empleados disponibles", error: String(e) });
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  eliminarUsuarioDefinitivo,
  listarEmpleadosDisponibles,
};
