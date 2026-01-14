// usuarioController.js
const bcrypt = require("bcryptjs");
const usuarioModel = require("../models/usuarioModel");

const SALT_ROUNDS = 10;

function bitToBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (Buffer.isBuffer(v)) return v.length ? v[0] === 1 : false;

  
  if (typeof v === "object" && v !== null && typeof v[0] !== "undefined") {
    return v[0] === 1;
  }

  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

function normalizarActivo(v, fallback = 1) {
  if (v === null || v === undefined || String(v).trim() === "") return Number(fallback);
  const n = Number(v);
  return n === 0 ? 0 : 1;
}

function normalizarBit(v, fallback = 0) {
  if (v === null || v === undefined || String(v).trim() === "") return Number(fallback) === 1 ? 1 : 0;
  const n = Number(v);
  return n === 1 ? 1 : 0;
}

function normalizarIntentos(v, fallback = 0) {
  if (v === null || v === undefined || String(v).trim() === "") return Number(fallback) || 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function rolNombre(req) {
  return String(req?.usuario?.rolNombre || "").toLowerCase().trim();
}


async function tryBitacora({ tabla, idRegistro, accion, req }) {
  try {
    if (typeof usuarioModel.registrarBitacora !== "function") return;

    const idUsuario = req?.usuario?.idUsuario;
    if (!idUsuario) return;

    await usuarioModel.registrarBitacora({
      tablaAfectada: tabla,
      idRegistro: String(idRegistro),
      accionRealizada: accion,
      usuarioId: Number(idUsuario),
    });
  } catch (_) {
    
  }
}


const listarUsuarios = async (req, res) => {
  try {
    const { texto, activo, bloqueado, rolId } = req.query;

    
    const rows = await usuarioModel.listarUsuariosConDetalle({
      texto,
      activo,
      bloqueado,
      rolId,
    });

    const usuarios = rows.map((r) => ({
      idUsuario: r.idUsuario,
      nombreUsuario: r.nombreUsuario ?? r.NombreUsuario,
      empleadoId: r.empleadoId ?? r.Empleado_idEmpleado,
      rolId: r.rolId ?? r.Catalogo_Rol_idCatalogo_Rol,
      rolNombre: r.rolNombre,
      activo: bitToBool(r.activo ?? r.Activo),
      bloqueado: r.Bloqueado !== undefined ? bitToBool(r.Bloqueado) : undefined,
      intentosFallidos: r.Intentos_Fallidos !== undefined ? Number(r.Intentos_Fallidos) : undefined,
      empleado: {
        idEmpleado: r.empleadoId ?? r.Empleado_idEmpleado,
        personaId: r.personaId ?? r.Persona_idPersona,
        nombreCompleto:
          r.personaNombre !== undefined
            ? `${r.personaNombre} ${r.personaApellido1} ${r.personaApellido2}`.trim()
            : String(r.nombreCompleto ?? "").trim(),
      },
    }));

    return res.json({ ok: true, usuarios });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando usuarios",
      error: String(e),
    });
  }
};


const crearUsuario = async (req, res) => {
  try {
    const { empleadoId, nombreUsuario, password, rolId, activo } = req.body;

    if (!empleadoId || !nombreUsuario || !password || !rolId) {
      return res.status(400).json({ ok: false, mensaje: "Faltan datos requeridos." });
    }

    const empleadoNum = Number(empleadoId);
    const rolNum = Number(rolId);

    if (!Number.isFinite(empleadoNum) || empleadoNum <= 0) {
      return res.status(400).json({ ok: false, mensaje: "empleadoId inválido." });
    }
    if (!Number.isFinite(rolNum) || rolNum <= 0) {
      return res.status(400).json({ ok: false, mensaje: "rolId inválido." });
    }

    const userName = String(nombreUsuario).trim();
    if (!userName) return res.status(400).json({ ok: false, mensaje: "NombreUsuario inválido." });

    const passPlain = String(password).trim();
    if (passPlain.length < 6) {
      return res.status(400).json({ ok: false, mensaje: "El password debe tener al menos 6 caracteres." });
    }

    const empOk = await usuarioModel.existeEmpleado(empleadoNum);
    if (!empOk) return res.status(400).json({ ok: false, mensaje: "El empleado indicado no existe o está inactivo." });

    const rolOk = await usuarioModel.existeRol(rolNum);
    if (!rolOk) return res.status(400).json({ ok: false, mensaje: "El rol indicado no existe o está inactivo." });

    const empTieneUsuario = await usuarioModel.empleadoTieneUsuario(empleadoNum);
    if (empTieneUsuario) {
      return res.status(400).json({ ok: false, mensaje: "Ese empleado ya tiene un usuario activo asignado." });
    }

    const existeNombre = await usuarioModel.existeNombreUsuario(userName);
    if (existeNombre) {
      return res.status(400).json({ ok: false, mensaje: "Ese NombreUsuario ya existe." });
    }

    const passwordHash = await bcrypt.hash(passPlain, SALT_ROUNDS);

    const result = await usuarioModel.insertarUsuario({
      nombreUsuario: userName,
      passwordHash,
      empleadoId: empleadoNum,
      rolId: rolNum,
      activo: normalizarActivo(activo, 1),
    });

    const idCreado = result?.insertId;

    if (!idCreado) {
      return res.status(500).json({ ok: false, mensaje: "No se pudo obtener el id del usuario creado." });
    }

    await tryBitacora({
      tabla: "Usuario",
      idRegistro: idCreado,
      accion: "CREAR",
      req,
    });

    return res.status(201).json({ ok: true, mensaje: "Usuario creado correctamente.", idUsuario: idCreado });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error creando usuario", error: String(e) });
  }
};


const actualizarUsuario = async (req, res) => {
  try {
    const idUsuario = Number(req.params.idUsuario);
    if (!idUsuario) return res.status(400).json({ ok: false, mensaje: "idUsuario inválido." });

    const actual = await usuarioModel.obtenerUsuarioPorId(idUsuario);
    if (!actual) return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });

    const { nombreUsuario, password, empleadoId, rolId, activo, bloqueado, intentosFallidos } = req.body;

    const actualNombre = String(actual.NombreUsuario ?? actual.nombreUsuario ?? "").trim();
    const actualEmpleadoId = Number(actual.empleadoId ?? actual.Empleado_idEmpleado ?? 0);
    const actualRolId = Number(actual.rolId ?? actual.Catalogo_Rol_idCatalogo_Rol ?? 0);
    const actualActivo = Number(actual.Activo ?? actual.activo ?? 1);

    const actualBloqueado = actual.Bloqueado !== undefined ? (bitToBool(actual.Bloqueado) ? 1 : 0) : 0;
    const actualIntentos = actual.Intentos_Fallidos !== undefined ? Number(actual.Intentos_Fallidos) : 0;

    const nuevoNombre =
      nombreUsuario !== undefined && nombreUsuario !== null ? String(nombreUsuario).trim() : actualNombre;

    const nuevoEmpleadoId =
      empleadoId !== undefined && empleadoId !== null && String(empleadoId) !== ""
        ? Number(empleadoId)
        : actualEmpleadoId;

    const nuevoRolId =
      rolId !== undefined && rolId !== null && String(rolId) !== "" ? Number(rolId) : actualRolId;

    const nuevoActivo = normalizarActivo(activo, actualActivo);

    
    const nuevoBloqueado =
      bloqueado !== undefined ? normalizarBit(bloqueado, actualBloqueado) : undefined;

    const nuevoIntentos =
      intentosFallidos !== undefined ? normalizarIntentos(intentosFallidos, actualIntentos) : undefined;

    if (
      !nuevoNombre ||
      !Number.isFinite(nuevoEmpleadoId) ||
      nuevoEmpleadoId <= 0 ||
      !Number.isFinite(nuevoRolId) ||
      nuevoRolId <= 0
    ) {
      return res.status(400).json({ ok: false, mensaje: "Datos inválidos para actualizar." });
    }

    
    if (nuevoNombre !== actualNombre) {
      const dup = await usuarioModel.existeNombreUsuario(nuevoNombre, idUsuario);
      if (dup) return res.status(400).json({ ok: false, mensaje: "Ese NombreUsuario ya existe." });
    }

    
    if (nuevoEmpleadoId !== actualEmpleadoId) {
      const dupEmp = await usuarioModel.empleadoTieneUsuario(nuevoEmpleadoId, idUsuario);
      if (dupEmp) {
        return res.status(400).json({ ok: false, mensaje: "Ese empleado ya tiene un usuario activo asignado." });
      }

      const empOk = await usuarioModel.existeEmpleado(nuevoEmpleadoId);
      if (!empOk) return res.status(400).json({ ok: false, mensaje: "El empleado indicado no existe o está inactivo." });
    }

    
    if (nuevoRolId !== actualRolId) {
      const rolOk = await usuarioModel.existeRol(nuevoRolId);
      if (!rolOk) return res.status(400).json({ ok: false, mensaje: "El rol indicado no existe o está inactivo." });
    }

    
    if (password && String(password).trim().length > 0) {
      const passPlain = String(password).trim();
      if (passPlain.length < 6) {
        return res.status(400).json({ ok: false, mensaje: "El password debe tener al menos 6 caracteres." });
      }

      const passwordHash = await bcrypt.hash(passPlain, SALT_ROUNDS);

      const result = await usuarioModel.actualizarUsuarioConPassword({
        idUsuario,
        nombreUsuario: nuevoNombre,
        passwordHash,
        empleadoId: nuevoEmpleadoId,
        rolId: nuevoRolId,
        activo: nuevoActivo,
        bloqueado: nuevoBloqueado,
        intentosFallidos: nuevoIntentos,
      });

      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
      }
    } else {
      const result = await usuarioModel.actualizarUsuarioSinPassword({
        idUsuario,
        nombreUsuario: nuevoNombre,
        empleadoId: nuevoEmpleadoId,
        rolId: nuevoRolId,
        activo: nuevoActivo,
        bloqueado: nuevoBloqueado,
        intentosFallidos: nuevoIntentos,
      });

      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
      }
    }

    await tryBitacora({
      tabla: "Usuario",
      idRegistro: idUsuario,
      accion: "ACTUALIZAR",
      req,
    });

    return res.json({ ok: true, mensaje: "Usuario actualizado correctamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error actualizando usuario", error: String(e) });
  }
};


const eliminarUsuario = async (req, res) => {
  try {
    const idUsuario = Number(req.params.idUsuario);
    if (!idUsuario) return res.status(400).json({ ok: false, mensaje: "idUsuario inválido." });

    const result = await usuarioModel.desactivarUsuario(idUsuario);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
    }

    await tryBitacora({
      tabla: "Usuario",
      idRegistro: idUsuario,
      accion: "DESACTIVAR",
      req,
    });

    return res.json({ ok: true, mensaje: "Usuario desactivado correctamente." });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error desactivando usuario", error: String(e) });
  }
};


const eliminarUsuarioDefinitivo = async (req, res) => {
  try {
    const idUsuario = Number(req.params.idUsuario);
    if (!idUsuario) return res.status(400).json({ ok: false, mensaje: "idUsuario inválido." });

    
    if (rolNombre(req) !== "admin") {
      return res.status(403).json({
        ok: false,
        mensaje: "Solo Admin puede eliminar definitivamente usuarios.",
      });
    }

    const result = await usuarioModel.eliminarUsuarioDefinitivo(idUsuario);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
    }

    await tryBitacora({
      tabla: "Usuario",
      idRegistro: idUsuario,
      accion: "ELIMINAR_HARD",
      req,
    });

    return res.json({ ok: true, mensaje: "Usuario eliminado definitivamente." });
  } catch (e) {
    
    const msg = String(e?.message || e);
    if (msg.includes("ER_ROW_IS_REFERENCED") || msg.includes("a foreign key constraint fails")) {
      return res.status(409).json({
        ok: false,
        mensaje:
          "No se puede eliminar definitivamente porque el usuario tiene información relacionada. Desactívelo (soft delete).",
      });
    }

    return res.status(500).json({
      ok: false,
      mensaje: "Error eliminando usuario definitivamente",
      error: msg,
    });
  }
};


const listarEmpleadosDisponibles = async (req, res) => {
  try {
    const rows = await usuarioModel.listarEmpleadosDisponibles();

    const empleados = rows.map((r) => ({
      idEmpleado: r.idEmpleado,
      personaId: r.personaId ?? r.Persona_idPersona,
      nombreCompleto: `${r.nombre} ${r.apellido1} ${r.apellido2}`.trim(),
    }));

    return res.json({ ok: true, empleados });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando empleados disponibles",
      error: String(e),
    });
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
