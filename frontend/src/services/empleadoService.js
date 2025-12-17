// src/Services/empleadoService.js
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/empleados';

export const obtenerEmpleados = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const obtenerEmpleadoPorId = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};
