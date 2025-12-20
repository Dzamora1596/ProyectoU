//Autenticación de usuarios en la aplicación React mediante llamadas a la API backend
import axios from 'axios';

const API = 'http://localhost:4000/api/autenticar';

export async function login(usuario, password) {
  const res = await axios.post(`${API}/login`, { usuario, password });
  return res.data;
}

export async function registrarUsuario({ idUsuario, empleadoId, nombreUsuario, password }) {
  const res = await axios.post(`${API}/registrar`, {
    idUsuario,
    empleadoId,
    nombreUsuario,
    password,
  });
  return res.data;
}
