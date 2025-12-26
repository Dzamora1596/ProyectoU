//Codigo para la página de inicio con gestión de roles y permisos
import { Link } from "react-router-dom";

export default function Inicio({ user, onLogout }) {
  //Muestrar el rol del usuario y las opciones disponibles según sus permisos
  const rolId = Number(
    user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol
  ); // 1,2,3,4

  const esAdmin = rolId === 1;
  const esJefatura = rolId === 2;
  const esPlanilla = rolId === 3;
  const esColaborador = rolId === 4;

  // Manejo de permisos
  const puedeRegistrarUsuarios = esAdmin || esJefatura;
  const puedeRegistrarEmpleados = esAdmin || esJefatura;
  const puedeRegistrarPersona = esAdmin || esJefatura;
  const puedeValidarAsistencias = esAdmin || esJefatura || esPlanilla;
  const puedeVerSoloMiInfo = esColaborador;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Inicio</h1>
        <button onClick={onLogout}>Cerrar sesión</button>
      </div>

      <p>
        Bienvenido, <b>{user?.nombreUsuario}</b>{" "}
        {user?.rolNombre || user?.rol || user?.nombreRol || ""}
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/*Registrar Persona */}
        {puedeRegistrarPersona && (
          <Link to="/registrar-persona">
            <button>Registrar persona</button>
          </Link>
        )}

        {/*Registrar Empleados */}
        {puedeRegistrarEmpleados && (
          <Link to="/registrar-empleados">
            <button>Registrar empleados</button>
          </Link>
        )}

        {/*Validar asistencias */}
        {puedeValidarAsistencias && (
          <Link to="/asistencias/validar">
            <button>Validar asistencias</button>
          </Link>
        )}

        {/*Registrar usuarios */}
        {puedeRegistrarUsuarios && (
          <Link to="/registro">
            <button>Registrar usuario</button>
          </Link>
        )}

        {puedeVerSoloMiInfo && <button disabled>Mi información (pendiente)</button>}
      </div>
    </div>
  );
}
