// Archivo para la página de registro de usuarios
import { useEffect, useState } from "react";
import { registrarUsuario, obtenerRoles } from "../services/autenticarService";
import "../styles/autenticar.css";
// Componente de Registro de Usuarios
export default function RegistroUsuarios() {
  const [empleadoId, setEmpleadoId] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");

  const [roles, setRoles] = useState([]);
  const [rolId, setRolId] = useState("");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const cargarRoles = async () => {
      try {
        const data = await obtenerRoles(); // GET /api/autenticar/roles
        const lista = data?.roles;

        if (Array.isArray(lista) && lista.length > 0) {
          setRoles(lista);
          setRolId(String(lista[0].idRol));
        } else {
          setRoles([]);
          setRolId("");
        }
      } catch {
        setRoles([]);
        setRolId("");
      }
    };

    cargarRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      const payload = {
        empleadoId: Number(empleadoId),
        nombreUsuario: String(nombreUsuario).trim(),
        password: String(password),
        rolId: Number(rolId),
      };

      const data = await registrarUsuario(payload);

      setMsg(data?.mensaje || "Usuario creado correctamente");
      setEmpleadoId("");
      setNombreUsuario("");
      setPassword("");
      setRolId(roles?.[0]?.idRol ? String(roles[0].idRol) : "");
    } catch (e2) {
      setErr(e2.response?.data?.mensaje || "Error creando usuario");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Registro de usuarios</h1>
        <p className="auth-subtitle">Crea un nuevo usuario para el sistema.</p>

        {/* 👇 auth-form-compact (para que no haya “huecos”) */}
        <form onSubmit={handleSubmit} className="auth-form auth-form-compact">
          <label className="auth-label">ID Empleado</label>
          <input
            className="auth-input"
            type="number"
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            placeholder="Ej: 2615"
            required
          />

          <label className="auth-label">Nombre de usuario</label>
          <input
            className="auth-input"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            placeholder="Ej: juan.perez"
            required
          />

          <label className="auth-label">Password</label>
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <label className="auth-label">Rol</label>
          <select
            className="auth-input"
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            required
          >
            {roles.length === 0 ? (
              <option value="">No hay roles disponibles</option>
            ) : (
              roles.map((r) => (
                <option key={r.idRol} value={r.idRol}>
                  {r.nombreRol}
                </option>
              ))
            )}
          </select>

          <button className="auth-button" type="submit" disabled={!rolId}>
            Crear usuario
          </button>

          {msg && <p className="auth-success">{msg}</p>}
          {err && <p className="auth-error">{err}</p>}
        </form>
      </div>
    </div>
  );
}
