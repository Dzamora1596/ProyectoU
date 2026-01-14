//Mantenimientos.jsx
import { Link } from "react-router-dom";
import "../styles/autenticar.css";

export default function Mantenimientos({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  if (!esAdmin) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 900 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 className="auth-title" style={{ marginBottom: 6 }}>Mantenimientos</h1>
              <p className="auth-subtitle" style={{ marginTop: 0 }}>
                Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Link to="/inicio">
                <button className="auth-secondary">Volver a Inicio</button>
              </Link>
              <button className="auth-danger" onClick={onLogout}>Cerrar sesión</button>
            </div>
          </div>

          <div className="auth-error" style={{ marginTop: 14 }}>
            No tiene permisos para acceder a este módulo.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>Mantenimientos</h1>
            <p className="auth-subtitle" style={{ marginTop: 0 }}>
              Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/inicio">
              <button className="auth-secondary">Volver a Inicio</button>
            </Link>
            <button className="auth-danger" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/mantenimientos/personas">
            <button className="auth-button" type="button">Mantenimiento Personas</button>
          </Link>

          <Link to="/mantenimientos/empleados">
            <button className="auth-button" type="button">Mantenimiento Empleados</button>
          </Link>

          <Link to="/mantenimientos/usuarios">
            <button className="auth-button" type="button">Mantenimiento Usuarios</button>
          </Link>

          <Link to="/mantenimientos/roles">
            <button className="auth-button" type="button">Mantenimiento Roles</button>
          </Link>

          <Link to="/mantenimientos/horarios">
            <button className="auth-button" type="button">Mantenimiento Horarios</button>
          </Link>
          <Link to="/mantenimientos/asistencias">
            <button className="auth-button" type="button">Mantenimiento Asistencias</button>
          </Link>

        </div>
      </div>
    </div>
  );
}
