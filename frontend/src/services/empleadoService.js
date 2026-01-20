// empleadoService.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta?.env?.VITE_API_URL || "http://localhost:4000/api",
});

// Para no duplicar interceptores en React
let _interceptorId = null;

function ensureInterceptors() {
  if (_interceptorId !== null) return;

  _interceptorId = api.interceptors.request.use(
    (config) => {
      config.headers = config.headers || {};

      // ✅ Token (necesario si backend usa autenticarMiddleware)
      const token = localStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;

      return config;
    },
    (error) => Promise.reject(error)
  );
}

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
    ensureInterceptors();
    const { data } = await api.get(`${BASE}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const crearEmpleado = async (payload) => {
  try {
    ensureInterceptors();
    const { data } = await api.post(`${BASE}`, payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const actualizarEmpleado = async (idEmpleado, payload) => {
  try {
    ensureInterceptors();

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
    ensureInterceptors();

    const id = Number(idEmpleado || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};
