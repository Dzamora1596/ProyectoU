import { Link } from "react-router-dom";


export default function Mantenimientos({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  if (!esAdmin) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Mantenimientos</h1>
        <p>No tiene permisos para acceder a este módulo.</p>
        <Link to="/inicio">
          <button>Volver a Inicio</button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Mantenimientos</h1>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/inicio">
            <button>Volver a Inicio</button>
          </Link>
          <button onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link to="/mantenimientos/personas">
          <button>Personas</button>
        </Link>

        {/* Falta Roles, Géneros, Tipos de permiso, Tipos incapacidad, etc. */}
      </div>
    </div>
  );
}
