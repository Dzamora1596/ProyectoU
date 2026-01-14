// autenticarController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const autenticarModel = require("../models/autenticarModel");


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

function safeStr(v) {
  return String(v ?? "").trim();
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}


const MAX_INTENTOS = (() => {
  const n = Number(process.env.MAX_LOGIN_INTENTOS || 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

const JWT_EXPIRES_IN = safeStr(process.env.JWT_EXPIRES_IN) || "8h";


async function tryRegistrarLogAcceso({ idUsuario, empleadoId, exitoso, observacion }) {
  try {
    
    if (!idUsuario || !empleadoId) return;

    await autenticarModel.registrarLogAcceso({
      idUsuario: Number(idUsuario),
      empleadoId: Number(empleadoId),
      exitoso: !!exitoso,
      observacion: safeStr(observacion),
    });
  } catch (_) {
    
  }
}


const login = async (req, res, next) => {
  try {
    const usuario = safeStr(req.body?.usuario);
    const password = safeStr(req.body?.password);

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe ingresar el usuario y password",
      });
    }

    
    const user = await autenticarModel.buscarUsuarioParaLogin(usuario);

    
    if (!user) {
      return res.status(401).json({ ok: false, mensaje: "Credenciales inválidas" });
    }

    const idUsuario = Number(user.idUsuario);
    const empleadoId = Number(user.empleadoId);

    const activo = bitToBool(user.Activo);
    const bloqueado = bitToBool(user.Bloqueado);
    const intentosFallidos = safeNum(user.Intentos_Fallidos) || 0;

    
    if (!activo) {
      await tryRegistrarLogAcceso({
        idUsuario,
        empleadoId,
        exitoso: false,
        observacion: "Usuario inactivo",
      });

      return res.status(401).json({ ok: false, mensaje: "Usuario inactivo" });
    }

    
    if (bloqueado) {
      await tryRegistrarLogAcceso({
        idUsuario,
        empleadoId,
        exitoso: false,
        observacion: "Usuario bloqueado",
      });

      return res.status(403).json({
        ok: false,
        mensaje: "Usuario bloqueado por intentos fallidos. Contacte a un administrador.",
      });
    }

    
    const hashBD = safeStr(user.Password);

    
    if (!hashBD.startsWith("$2a$") && !hashBD.startsWith("$2b$") && !hashBD.startsWith("$2y$")) {
      return res.status(500).json({
        ok: false,
        mensaje: "El password almacenado no es un hash bcrypt válido",
      });
    }

    const passwordValido = await bcrypt.compare(password, hashBD);

    
    if (!passwordValido) {
      const nuevosIntentos = intentosFallidos + 1;
      const nuevoBloqueo = nuevosIntentos >= MAX_INTENTOS;

      await autenticarModel.actualizarIntentos({
        idUsuario,
        intentosFallidos: nuevosIntentos,
        bloqueado: nuevoBloqueo,
      });

      await tryRegistrarLogAcceso({
        idUsuario,
        empleadoId,
        exitoso: false,
        observacion: nuevoBloqueo
          ? `Credenciales inválidas (bloqueado al intento ${nuevosIntentos})`
          : `Credenciales inválidas (intento ${nuevosIntentos}/${MAX_INTENTOS})`,
      });

      return res.status(401).json({
        ok: false,
        mensaje: nuevoBloqueo
          ? "Usuario bloqueado por intentos fallidos. Contacte a un administrador."
          : "Credenciales inválidas",
        intentosRestantes: Math.max(0, MAX_INTENTOS - nuevosIntentos),
      });
    }

    
    await autenticarModel.resetIntentos(idUsuario);

    
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok: false, mensaje: "JWT_SECRET no está configurado en .env" });
    }

    const payload = {
      idUsuario,
      empleadoId,
      nombreUsuario: user.NombreUsuario,
      rolId: user.rolId,
      rolNombre: user.rolNombre, 
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    await tryRegistrarLogAcceso({
      idUsuario,
      empleadoId,
      exitoso: true,
      observacion: "Login exitoso",
    });

    return res.json({
      ok: true,
      mensaje: "Login exitoso",
      token,
      usuario: payload,
    });
  } catch (error) {
    next(error);
  }
};


const registrar = async (req, res, next) => {
  try {
    const empleadoId = safeNum(req.body?.empleadoId);
    const nombreUsuario = safeStr(req.body?.nombreUsuario);
    const password = safeStr(req.body?.password);
    const rolId = safeNum(req.body?.rolId);

    if (!empleadoId || !nombreUsuario || !password || !rolId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos: empleadoId, nombreUsuario, password, rolId",
      });
    }

    
    const empOk = await autenticarModel.empleadoExiste(empleadoId, { soloActivos: true });
    if (!empOk) {
      return res.status(400).json({ ok: false, mensaje: "Empleado no existe o está inactivo" });
    }

    
    const existe = await autenticarModel.nombreUsuarioExiste(nombreUsuario);
    if (existe) {
      return res.status(409).json({ ok: false, mensaje: "El nombre de usuario ya existe" });
    }

    
    const rolOk = await autenticarModel.rolExisteActivo(rolId);
    if (!rolOk) {
      return res.status(400).json({ ok: false, mensaje: "Rol inválido o inactivo" });
    }

    
    if (password.length < 6) {
      return res.status(400).json({ ok: false, mensaje: "El password debe tener al menos 6 caracteres." });
    }

    const hash = await bcrypt.hash(password, 10);

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


const obtenerRoles = async (req, res, next) => {
  try {
    const rows = await autenticarModel.listarRolesActivos();

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
