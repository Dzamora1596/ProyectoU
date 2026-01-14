//horarioLaboralService.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

let _rolId = null;

export const setAuth = (user) => {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  _rolId = rolId || null;
};

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (_rolId) config.headers["x-rol-id"] = String(_rolId);
  return config;
});

export const listarHorarios = async () => {
  const { data } = await api.get("/horarios");
  return data;
};

export const crearHorario = async (payload) => {
  const { data } = await api.post("/horarios", payload);
  return data;
};

export const actualizarHorario = async (idHorario, payload) => {
  const { data } = await api.put(`/horarios/${idHorario}`, payload);
  return data;
};

export const eliminarHorario = async (idHorario) => {
  const { data } = await api.delete(`/horarios/${idHorario}`);
  return data;
};
