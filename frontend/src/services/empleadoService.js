// empleadoService.js
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

const BASE = "/empleados";

export const listarEmpleados = async () => {
  try {
    const { data } = await api.get(`${BASE}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerMiEmpleado = async () => {
  try {
    const { data } = await api.get(`${BASE}/me`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const crearEmpleado = async (payload) => {
  try {
    const { data } = await api.post(`${BASE}`, payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const actualizarEmpleado = async (idEmpleado, payload) => {
  try {
    const id = Number(idEmpleado || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.put(`${BASE}/${id}`, payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const eliminarEmpleado = async (idEmpleado) => {
  try {
    const id = Number(idEmpleado || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};
