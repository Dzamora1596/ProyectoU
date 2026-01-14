// asistenciaService.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

 
let _rolId = null;

export const setAuth = (user) => {
  const rolId = Number(
    user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0
  );
  _rolId = rolId > 0 ? rolId : null;
};

 
api.interceptors.request.use(
  (config) => {
    const headers = config.headers ?? {};
    if (_rolId) headers["x-rol-id"] = String(_rolId);
    config.headers = headers;
    return config;
  },
  (error) => Promise.reject(error)
);
 
function throwApiError(e) {
  const mensaje =
    e?.response?.data?.mensaje ||
    e?.response?.data?.error ||
    e?.message ||
    "Error de red / servidor.";
  const err = new Error(mensaje);
  err.original = e;
  throw err;
}

 
export const listarColaboradoresParaValidacion = async ({ buscar = "" } = {}) => {
  try {
    const { data } = await api.get("/asistencias/colaboradores", {
      params: { buscar },
    });
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const listarAsistenciasPorEmpleado = async ({ empleadoId, desde, hasta }) => {
  try {
    const { data } = await api.get(`/asistencias/empleado/${empleadoId}`, {
      params: { desde, hasta },
    });
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const crearAsistencia = async (payload) => {
  try {
    const { data } = await api.post("/asistencias", payload);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const actualizarAsistencia = async (idAsistencia, payload) => {
  try {
    const { data } = await api.put(`/asistencias/${idAsistencia}`, payload);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const eliminarAsistencia = async (idAsistencia) => {
  try {
    const { data } = await api.delete(`/asistencias/${idAsistencia}`);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const validarTodoPeriodo = async ({ desde, hasta }) => {
  try {
    const { data } = await api.post("/asistencias/validar-periodo", { desde, hasta });
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const guardarValidacionesLote = async ({ cambios }) => {
  try {
    const { data } = await api.put("/asistencias/validar-lote", { cambios });
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

 
export const validarLote = guardarValidacionesLote;
