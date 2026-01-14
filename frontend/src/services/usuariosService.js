//usuariosService.js
import api from "../api/cliente";

 
function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s === "") return;
    qs.append(k, s);
  });
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function listarUsuarios({ texto, activo, bloqueado, rolId } = {}) {
  const query = buildQuery({ texto, activo, bloqueado, rolId });
  const { data } = await api.get(`/usuarios${query}`);
  return data;  
}

export async function crearUsuario(payload) {
   
  const { data } = await api.post("/usuarios", payload);
  return data;  
}

export async function actualizarUsuario(idUsuario, payload) {
   
  const { data } = await api.put(`/usuarios/${idUsuario}`, payload);
  return data;  
}

export async function desactivarUsuario(idUsuario) {
  const { data } = await api.delete(`/usuarios/${idUsuario}`);
  return data;  
}

export async function eliminarUsuarioHard(idUsuario) {
  const { data } = await api.delete(`/usuarios/${idUsuario}/hard`);
  return data; 
}

export async function listarEmpleadosDisponibles() {
  const { data } = await api.get("/usuarios/empleados-disponibles");
  return data; 
}
