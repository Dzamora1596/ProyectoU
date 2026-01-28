// src/services/registroPersonalService.js
import api from "../api/axios";

function throwApiError(err) {
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

    const { data } = await api.get("/registro-personal", { params });
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function obtenerRegistroPersonalPorId(idEmpleado) {
  try {
    const id = Number(idEmpleado || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.get(`/registro-personal/${id}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function crearRegistroPersonal(payload) {
  try {
    const { data } = await api.post("/registro-personal", payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function actualizarRegistroPersonal(idEmpleado, payload) {
  try {
    const id = Number(idEmpleado || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.put(`/registro-personal/${id}`, payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function desactivarRegistroPersonal(idEmpleado) {
  try {
    const id = Number(idEmpleado || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.delete(`/registro-personal/${id}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function registroPersonal(payload) {
  try {
    const { data } = await api.post("/registro-personal", payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
}
