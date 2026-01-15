//rolService.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
  timeout: 15000,
});


let _rolId = null;

export const setAuth = (user) => {
  const rolId = Number(
    user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0
  );
  _rolId = rolId || null;
};

 
api.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    if (_rolId) config.headers["x-rol-id"] = String(_rolId);
    return config;
  },
  (error) => Promise.reject(error)
);

 
export const listarRoles = async () => {
  const { data } = await api.get("/roles");
  return data;
};


export const crearRol = async (payload) => {
  const { data } = await api.post("/roles", payload);
  return data;
};


export const actualizarRol = async (idRol, payload) => {
  const { data } = await api.put(`/roles/${idRol}`, payload);
  return data;
};


export const desactivarRol = async (idRol) => {
  
  try {
    const { data } = await api.put(`/roles/${idRol}/desactivar`);
    return data;
  } catch (e) {
    
    if (e?.response?.status === 404) {
      const { data } = await api.put(`/roles/${idRol}`, { activo: 0 });
      return data;
    }
    throw e;
  }
};


export const eliminarRolDefinitivo = async (idRol) => {
  const { data } = await api.delete(`/roles/${idRol}`);
  return data;
};
