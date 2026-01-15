// src/api/registroPersonalApi.js
import api from "./axios";

function normalizarError(err) {
  const msg =
    err?.response?.data?.mensaje ||
    err?.response?.data?.message ||
    err?.message ||
    "Error de red / servidor";
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.data = err?.response?.data;
  throw e;
}

export async function listarRegistroPersonal({ texto = "", activo } = {}) {
  try {
    const params = {};

    if (texto && String(texto).trim()) params.texto = String(texto).trim();
    if (activo !== undefined && activo !== null && String(activo) !== "") params.activo = activo;

    const res = await api.get("/registro-personal", { params });
    return res.data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function obtenerRegistroPersonalPorId(idEmpleado) {
  try {
    const res = await api.get(`/registro-personal/${idEmpleado}`);
    return res.data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function crearRegistroPersonal(payload) {
  try {
    const res = await api.post("/registro-personal", payload);
    return res.data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function actualizarRegistroPersonal(idEmpleado, payload) {
  try {
    const res = await api.put(`/registro-personal/${idEmpleado}`, payload);
    return res.data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function desactivarRegistroPersonal(idEmpleado) {
  try {
    const res = await api.delete(`/registro-personal/${idEmpleado}`);
    return res.data;
  } catch (err) {
    normalizarError(err);
  }
}
