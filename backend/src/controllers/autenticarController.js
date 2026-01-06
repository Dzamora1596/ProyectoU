// Codigo del controlador de autenticación que maneja el login, registro y obtención de roles.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const autenticarModel = require("../models/autenticarModel");
const rolModel = require("../models/rolModel");

// Helpers que convierten valores bit a booleanos para mayor compatibilidad
function bitToBool(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  if (typeof v === "object" && v !== null && typeof v[0] !== "undefined") {
    return v[0] === 1;
  }

  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí";
}

//LOGIN con JWT
const login = async (req, res, next) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe ingresar el usuario y password",
      });
    }

    // Obtener usuario para login
    const user = await autenticarModel.buscarUsuarioParaLogin(usuario);

    if (!user) {
      return res.status(401).json({ ok: false, mensaje: "Credenciales inválidas" });
    }

    // Validar si el usuario está activo
    const activo = bitToBool(user.Activo);
    if (!activo) {
      return res.status(401).json({ ok: false, mensaje: "Usuario inactivo" });
    }

    // Comparación de las contraseñas
    const passPlano = String(password).trim();
    const hashBD = String(user.Password || "").trim();

    // Validar que el hash almacenado sea bcrypt
    if (!hashBD.startsWith("$2a$") && !hashBD.startsWith("$2b$") && !hashBD.startsWith("$2y$")) {
      return res.status(500).json({
        ok: false,
        mensaje: "El password almacenado no es un hash bcrypt válido",
      });
    }

    const passwordValido = await bcrypt.compare(passPlano, hashBD);
    if (!passwordValido) {
      return res.status(401).json({ ok: false, mensaje: "Credenciales inválidas" });
    }

    // Generar token con datos mínimos necesarios
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok: false, mensaje: "JWT_SECRET no está configurado en .env" });
    }

    const payload = {
      idUsuario: user.idUsuario,
      nombreUsuario: user.NombreUsuario,
      rolId: user.Rol_idRol,
      rolNombre: user.RolNombre,
    };

    // Tiempo de expiración de 8 horas para permitir jornadas laborales completas
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    return res.json({
      ok: true,
      mensaje: "Login exitoso",
      token, // ✅ IMPORTANTÍSIMO
      usuario: payload,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar un nuevo usuario 
const registrar = async (req, res, next) => {
  try {
    const { empleadoId, nombreUsuario, password, rolId } = req.body;

    if (!empleadoId || !nombreUsuario || !password || !rolId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos: empleadoId, nombreUsuario, password, rolId",
      });
    }

    // Validar empleado existe
    const empOk = await autenticarModel.empleadoExiste(empleadoId);
    if (!empOk) {
      return res.status(400).json({ ok: false, mensaje: "Empleado no existe" });
    }

    // Validar que no se repita el nombre de usuario 
    const existe = await autenticarModel.nombreUsuarioExiste(nombreUsuario);
    if (existe) {
      return res.status(409).json({ ok: false, mensaje: "El nombre de usuario ya existe" });
    }

    // Valida que el rol exista y esté activo
    const rolOk = await rolModel.rolExisteActivo(rolId);
    if (!rolOk) {
      return res.status(400).json({ ok: false, mensaje: "Rol inválido o inactivo" });
    }

    // Hash bcrypt
    const hash = await bcrypt.hash(String(password).trim(), 10);

    const result = await autenticarModel.insertarUsuarioRegistro({
      nombreUsuario,
      passwordHash: hash,
      empleadoId,
      rolId,
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Usuario creado correctamente",
      idUsuario: result.insertId,
    });
  } catch (error) {
    next(error);
  }
};

// Roles disponibles
const obtenerRoles = async (req, res, next) => {
  try {
    const rows = await rolModel.listarRolesActivos();

    return res.json({
      ok: true,
      roles: rows.map((r) => ({
        idRol: r.idRol,
        nombreRol: r.Descripcion,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  registrar,
  obtenerRoles,
};
