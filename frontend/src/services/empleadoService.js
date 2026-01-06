//Servicio para manejar empleados y horarios laborales
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

// Empleados
export const listarEmpleados = async () => {
  const { data } = await api.get("/empleados");
  return data; // { ok, empleados }
};

export const crearEmpleado = async (payload) => {
  const { data } = await api.post("/empleados", payload);
  return data;
};

export const actualizarEmpleado = async (idEmpleado, payload) => {
  const { data } = await api.put(`/empleados/${idEmpleado}`, payload);
  return data;
};

export const eliminarEmpleado = async (idEmpleado) => {
  const { data } = await api.delete(`/empleados/${idEmpleado}`);
  return data;
};

// Horarios laborales en combo box
export const obtenerHorarios = async () => {
  const { data } = await api.get("/empleados/horarios");
  return data; 
};
