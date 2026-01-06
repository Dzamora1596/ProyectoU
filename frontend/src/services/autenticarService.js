//Servicio para manejar autenticación y usuarios
import axios from "axios";

const API = "http://localhost:4000/api/autenticar";

export const login = async ({ usuario, password }) => {
  const res = await axios.post(`${API}/login`, { usuario, password });
  return res.data;
};

export const registrarUsuario = async (usuarioEncapsulado) => {
  const res = await axios.post(`${API}/registrar`, usuarioEncapsulado);
  return res.data;
};

// Get para obtener los roles disponibles
export const obtenerRoles = async () => {
  const res = await axios.get(`${API}/roles`);
  return res.data;
};
