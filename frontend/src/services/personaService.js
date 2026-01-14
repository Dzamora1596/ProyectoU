//personaService.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

 
export const listarPersonas = async () => {
  const { data } = await api.get("/personas");
  return data; 
};

export const crearPersona = async (payload) => {
  const { data } = await api.post("/personas", payload);
  return data; 
};

export const actualizarPersona = async (idPersona, payload) => {
  const { data } = await api.put(`/personas/${idPersona}`, payload);
  return data;
};

export const eliminarPersona = async (idPersona) => {
  const { data } = await api.delete(`/personas/${idPersona}`);
  return data;
};

 
export const obtenerGeneros = async () => {
  const { data } = await api.get("/personas/generos");
  return data; 
};
