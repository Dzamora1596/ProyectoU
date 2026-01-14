// registroPersonalController.js
const registroPersonalModel = require("../models/registroPersonalModel");


function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

function toBool01(v, def = null) {
  if (v === undefined || v === null || v === "") return def;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "si" || s === "sí" ? 1 : 0;
}

function badRequest(res, mensaje) {
  return res.status(400).json({ ok: false, mensaje });
}

function toDate(v) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

function calcularEdad(fechaNacimientoYYYYMMDD) {
  const d = toDate(fechaNacimientoYYYYMMDD);
  if (!d) return NaN;

  const parts = d.split("-");
  if (parts.length !== 3) return NaN;

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return NaN;

  const birth = new Date(Date.UTC(y, m - 1, day));
  if (Number.isNaN(birth.getTime())) return NaN;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayThisYear = new Date(Date.UTC(today.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (today < birthdayThisYear) age -= 1;

  return age;
}


const validarPayloadRegistro = (body, { requiereTelefonos = false, requiereCorreos = false } = {}) => {
  const p = body?.persona || {};
  const e = body?.empleado || {};

  
  if (isEmpty(p.idPersona)) return "Debe indicar idPersona (cédula).";
  if (isEmpty(p.nombre) || isEmpty(p.apellido1) || isEmpty(p.apellido2)) {
    return "Faltan datos de persona (nombre, apellido1, apellido2).";
  }
  if (isEmpty(p.generoId)) return "Debe seleccionar género.";

  
  if (isEmpty(p.fechaNacimiento)) return "Debe indicar fecha de nacimiento.";
  const edad = calcularEdad(p.fechaNacimiento);
  if (!Number.isFinite(edad)) return "Fecha de nacimiento inválida.";
  if (edad < 18) return "No se permite registrar empleados menores de 18 años.";

  if (p.cantidadHijos === undefined || p.cantidadHijos === null || p.cantidadHijos === "") {
    return "Debe indicar cantidad de hijos (0 si no tiene).";
  }

  
  if (isEmpty(e.fechaIngreso)) return "Debe indicar fecha de ingreso.";
  if (e.salario === undefined || e.salario === null || e.salario === "") return "Debe indicar salario.";

  
  if (isEmpty(e.cadenciaPagoId) && isEmpty(e.cadenciaPago)) {
    return "Debe indicar cadencia de pago (cadenciaPagoId o cadenciaPago).";
  }

  
  const telefonos = body?.telefonos;
  if (requiereTelefonos && (!Array.isArray(telefonos) || telefonos.length === 0)) {
    return "Debe registrar al menos un teléfono.";
  }
  if (Array.isArray(telefonos)) {
    for (const t of telefonos) {
      if (isEmpty(t?.idTelefono)) return "Cada teléfono debe incluir idTelefono.";
      if (isEmpty(t?.tipoTelefonoId)) return "Cada teléfono debe incluir tipoTelefonoId.";
    }
  }

  
  const correos = body?.correos;
  if (requiereCorreos && (!Array.isArray(correos) || correos.length === 0)) {
    return "Debe registrar al menos un correo.";
  }
  if (Array.isArray(correos)) {
    for (const c of correos) {
      if (isEmpty(c?.correo)) return "Cada correo debe incluir correo.";
      if (isEmpty(c?.tipoCorreoId)) return "Cada correo debe incluir tipoCorreoId.";
    }
  }

  return null;
};


const crear = async (req, res) => {
  try {
    const requiereTelefonos = toBool01(process.env.REQ_TELEFONOS_EN_CREAR, 0) === 1;
    const requiereCorreos = toBool01(process.env.REQ_CORREOS_EN_CREAR, 0) === 1;

    const error = validarPayloadRegistro(req.body, { requiereTelefonos, requiereCorreos });
    if (error) return badRequest(res, error);

    const r = await registroPersonalModel.crearRegistroPersonal(req.body);
    return res.status(201).json(r);
  } catch (err) {
    const msg = err?.message || "Error registrando personal";
    return res.status(500).json({ ok: false, mensaje: msg, error: String(err) });
  }
};


const listar = async (req, res) => {
  try {
    const filtros = {
      texto: String(req.query?.texto ?? "").trim(),
      activo: req.query?.activo, // 1/0 opcional
    };

    const r = await registroPersonalModel.listarRegistroPersonal(filtros);
    return res.json(r);
  } catch (err) {
    const msg = err?.message || "Error listando personal";
    return res.status(500).json({ ok: false, mensaje: msg, error: String(err) });
  }
};


const obtenerPorId = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.idEmpleado);
    if (!idEmpleado) return badRequest(res, "Debe indicar idEmpleado válido.");

    const r = await registroPersonalModel.obtenerRegistroPersonalPorId(idEmpleado);

    if (!r?.data) {
      return res.status(404).json({ ok: false, mensaje: "Registro no encontrado." });
    }

    return res.json(r);
  } catch (err) {
    const msg = err?.message || "Error consultando personal";
    return res.status(500).json({ ok: false, mensaje: msg, error: String(err) });
  }
};


const actualizar = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.idEmpleado);
    if (!idEmpleado) return badRequest(res, "Debe indicar idEmpleado válido.");

    
    const error = validarPayloadRegistro(req.body, { requiereTelefonos: false, requiereCorreos: false });
    if (error) return badRequest(res, error);

    const r = await registroPersonalModel.actualizarRegistroPersonal(idEmpleado, req.body);
    return res.json(r);
  } catch (err) {
    const msg = err?.message || "Error actualizando personal";
    return res.status(500).json({ ok: false, mensaje: msg, error: String(err) });
  }
};


const desactivar = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.idEmpleado);
    if (!idEmpleado) return badRequest(res, "Debe indicar idEmpleado válido.");

    const r = await registroPersonalModel.desactivarRegistroPersonal(idEmpleado);
    return res.json(r);
  } catch (err) {
    const msg = err?.message || "Error desactivando personal";
    return res.status(500).json({ ok: false, mensaje: msg, error: String(err) });
  }
};

module.exports = {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  desactivar,
};
