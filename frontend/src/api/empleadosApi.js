// src/api/empleadosApi.js
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

export async function listarEmpleados() {
  try {
    const res = await api.get("/empleados");
    return res.data;
  } catch (err) {
    normalizarError(err);
  }
}
