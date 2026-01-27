// frontend/src/services/asistenciaService.js
import api from "../api/axios";

let _rolId = null;
let _interceptorId = null;

export const setAuth = (user) => {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  _rolId = rolId > 0 ? rolId : null;

  if (_interceptorId !== null) return;

  _interceptorId = api.interceptors.request.use(
    (config) => {
      config.headers = config.headers || {};
      if (_rolId) config.headers["x-rol-id"] = String(_rolId);
      return config;
    },
    (error) => Promise.reject(error)
  );
};

function throwApiError(e) {
  const mensaje =
    e?.response?.data?.mensaje ||
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Error de red / servidor.";
  const err = new Error(mensaje);
  err.original = e;
  throw err;
}

/**
 * ✅ Convierte a dd/mm/yyyy (SIN HORA)
 * Soporta:
 * - "dd/mm/yyyy"
 * - "yyyy-mm-dd"
 * - "yyyy-mm-ddTHH:mm:ss..."
 * - Date
 * - strings parseables por Date
 */
function toDMYOnly(anyDate) {
  if (anyDate === null || anyDate === undefined) return "";

  // Date object
  if (anyDate instanceof Date && !Number.isNaN(anyDate.getTime())) {
    const dd = String(anyDate.getDate()).padStart(2, "0");
    const mm = String(anyDate.getMonth() + 1).padStart(2, "0");
    const yyyy = anyDate.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  const s = String(anyDate || "").trim();
  if (!s) return "";

  // ya viene dd/mm/yyyy (ignoramos lo que venga después)
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;

  // viene iso yyyy-mm-dd (ignoramos hora)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  // intento genérico
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return "";
}

/**
 * ✅ Normaliza params de rango para que SIEMPRE salgan dd/mm/yyyy sin hora
 */
function normalizeRangeParams({ desde, hasta } = {}) {
  const d = toDMYOnly(desde);
  const h = toDMYOnly(hasta);
  return {
    ...(d ? { desde: d } : {}),
    ...(h ? { hasta: h } : {}),
  };
}

export const listarColaboradoresParaValidacion = async ({ buscar = "" } = {}) => {
  try {
    const { data } = await api.get("/asistencias/colaboradores", { params: { buscar } });
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const listarAsistenciasPorEmpleado = async ({ empleadoId, desde, hasta }) => {
  try {
    const params = normalizeRangeParams({ desde, hasta });
    const { data } = await api.get(`/asistencias/empleado/${empleadoId}`, { params });
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const crearAsistencia = async (payload) => {
  try {
    // Si en algún momento aquí mandas fechas, también puedes normalizarlas antes de postear.
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
    const body = normalizeRangeParams({ desde, hasta });
    const { data } = await api.post("/asistencias/validar-periodo", body);
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
