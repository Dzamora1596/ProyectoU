//Servicio para manejar usuarios
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

export const listarUsuarios = async () => {
  const { data } = await api.get("/usuarios");
  return data;
};

export const crearUsuario = async (payload) => {
  const { data } = await api.post("/usuarios", payload);
  return data;
};

export const actualizarUsuario = async (idUsuario, payload) => {
  const { data } = await api.put(`/usuarios/${idUsuario}`, payload);
  return data;
};

// desactiva
export const eliminarUsuario = async (idUsuario) => {
  const { data } = await api.delete(`/usuarios/${idUsuario}`);
  return data;
};

// elimina definitivamente
export const eliminarUsuarioDefinitivo = async (idUsuario) => {
  const { data } = await api.delete(`/usuarios/${idUsuario}/hard`);
  return data;
};
