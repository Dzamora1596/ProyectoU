// Archivo para la página de inicio con opciones según rol
import { Link } from "react-router-dom";

export default function Inicio({ user, onLogout }) {
  const rolId = Number(user?.rolId); // 1,2,3,4

  const esAdmin = rolId === 1;
  const esJefatura = rolId === 2;
  const esPlanilla = rolId === 3;
  const esColaborador = rolId === 4;

  // ✅ Permisos (ajústalos a tu criterio)
  const puedeRegistrarUsuarios = esAdmin || esJefatura;
  const puedeVerEmpleados = esAdmin || esJefatura || esPlanilla; // ejemplo
  const puedeVerSoloMiInfo = esColaborador; // ejemplo

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Inicio</h1>
        <button onClick={onLogout}>Cerrar sesión</button>
      </div>

      <p>
        Bienvenido, <b>{user?.nombreUsuario}</b> {user?.rolNombre}
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {puedeVerEmpleados && (
          <Link to="/empleados">
            <button>Empleados</button>
          </Link>
        )}

        {puedeRegistrarUsuarios && (
          <Link to="/registro">
            <button>Registrar usuario</button>
          </Link>
        )}

        {puedeVerSoloMiInfo && (
          <button disabled>Mi información (pendiente)</button>
        )}
      </div>
    </div>
  );
}
