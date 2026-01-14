//empleadoService.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

 
export const listarEmpleados = async () => {
  const { data } = await api.get("/empleados");
  return data;
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
