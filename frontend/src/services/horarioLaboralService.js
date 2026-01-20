// horarioLaboralService.js
import axios from "axios";

const api = axios.create({
  
  baseURL: import.meta?.env?.VITE_API_URL || "http://localhost:4000/api",
});

 
let _rolId = null;
let _interceptorId = null;

export const setAuth = (user) => {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  _rolId = rolId || null;
};

 
function ensureInterceptors() {
  if (_interceptorId !== null) return;

  _interceptorId = api.interceptors.request.use(
    (config) => {
      config.headers = config.headers || {};

      
      if (_rolId) config.headers["x-rol-id"] = String(_rolId);

       
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

 
const BASE = "/horarios";

 

export const listarHorarios = async () => {
  try {
    ensureInterceptors();
    const { data } = await api.get(`${BASE}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const crearHorario = async (payload) => {
  try {
    ensureInterceptors();
    const { data } = await api.post(`${BASE}`, payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const actualizarHorario = async (idHorario, payload) => {
  try {
    ensureInterceptors();

    const id = Number(idHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idHorario inválido");

    const { data } = await api.put(`${BASE}/${id}`, payload);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const eliminarHorario = async (idHorario) => {
  try {
    ensureInterceptors();

    const id = Number(idHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idHorario inválido");

    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

 

export const listarCatalogosHorario = async () => {
  try {
    ensureInterceptors();
    const { data } = await api.get(`${BASE}/catalogos`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerDetalleCatalogoHorario = async (idCatalogoHorario) => {
  try {
    ensureInterceptors();

    const id = Number(idCatalogoHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");

    const { data } = await api.get(`${BASE}/catalogos/${id}/detalle`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

 

export const obtenerHorarioEmpleado = async (idEmpleado) => {
  try {
    ensureInterceptors();

    const emp = Number(idEmpleado || 0);
    if (!Number.isFinite(emp) || emp <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.get(`${BASE}/empleado/${emp}`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerDetalleHorarioEmpleado = async (idEmpleado) => {
  try {
    ensureInterceptors();

    const emp = Number(idEmpleado || 0);
    if (!Number.isFinite(emp) || emp <= 0) throw new Error("idEmpleado inválido");

    const { data } = await api.get(`${BASE}/empleado/${emp}/detalle`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const asignarCatalogoHorarioEmpleado = async (idEmpleado, idCatalogoHorario) => {
  try {
    ensureInterceptors();

    const emp = Number(idEmpleado || 0);
    if (!Number.isFinite(emp) || emp <= 0) throw new Error("idEmpleado inválido");

     let cat = 0;
    if (typeof idCatalogoHorario === "object" && idCatalogoHorario !== null) {
      cat = Number(idCatalogoHorario.idCatalogoHorario || 0);
    } else {
      cat = Number(idCatalogoHorario || 0);
    }
    if (!Number.isFinite(cat) || cat <= 0) throw new Error("idCatalogoHorario inválido");

    const { data } = await api.put(`${BASE}/empleado/${emp}/detalle`, {
      idCatalogoHorario: cat,
    });
    return data;
  } catch (err) {
    throwApiError(err);
  }
};
