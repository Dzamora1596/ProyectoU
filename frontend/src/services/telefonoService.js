//telefonoService.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

export const obtenerTiposTelefono = async () => {
  const { data } = await api.get("/telefonos/tipos");
  return data;
};
