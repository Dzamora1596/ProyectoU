// frontend/src/services/permisosService.js
import api from "../api/axios";

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

function asArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [];
}

export const listarPermisos = async (params = {}) => {
  try {
    const { data } = await api.get("/permisos", { params });

    if (Array.isArray(data?.permisos)) return data.permisos;
    if (Array.isArray(data)) return data;

    return [];
  } catch (e) {
    throwApiError(e);
  }
};

export const crearPermiso = async (body) => {
  try {
    const { data } = await api.post("/permisos", body);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const aprobarPermiso = async (id) => {
  try {
    const { data } = await api.put(`/permisos/${id}/aprobar`, {});
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const rechazarPermiso = async (id) => {
  try {
    const { data } = await api.put(`/permisos/${id}/rechazar`, {});
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const desactivarPermiso = async (id) => {
  try {
    const { data } = await api.delete(`/permisos/${id}`);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const obtenerMiEmpleado = async () => {
  try {
    const { data } = await api.get("/empleados/me");
    return data?.empleado || null;
  } catch (e) {
    throwApiError(e);
  }
};

export const listarEmpleados = async () => {
  try {
    const { data } = await api.get("/empleados");
    if (Array.isArray(data?.empleados)) return data.empleados;
    return asArray(data);
  } catch (e) {
    throwApiError(e);
  }
};

export const listarTiposPermiso = async () => {
  try {
    const { data } = await api.get("/catalogos/tipos-permiso");

    const lista = Array.isArray(data?.tiposPermiso)
      ? data.tiposPermiso
      : Array.isArray(data?.tipos)
      ? data.tipos
      : Array.isArray(data)
      ? data
      : [];

    return lista
      .map((t) => ({
        id: Number(t?.idCatalogo_Tipo_Permiso ?? t?.id ?? t?.Id ?? 0),
        descripcion: String(t?.Descripcion ?? t?.descripcion ?? t?.Nombre ?? t?.nombre ?? ""),
        activo: Number(t?.Activo ?? t?.activo ?? 1),
      }))
      .filter((x) => x.id && x.descripcion)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
  } catch (e) {
    throwApiError(e);
  }
};
