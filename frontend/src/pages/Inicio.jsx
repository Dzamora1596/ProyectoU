//Pagina de inicio que muestra opciones según el rol del usuario
import { Link } from "react-router-dom";

export default function Inicio({ user, onLogout }) {
  //Muestrar el rol del usuario y las opciones disponibles según sus permisos
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol); // 1,2,3,4

  const esAdmin = rolId === 1;
  const esJefatura = rolId === 2;
  const esPlanilla = rolId === 3;
  const esColaborador = rolId === 4;

  // Permisos
  const puedeRegistrarUsuarios = esAdmin || esJefatura;
  const puedeRegistrarEmpleados = esAdmin || esJefatura;
  const puedeRegistrarPersona = esAdmin || esJefatura;

  const puedeRegistrarAsistencias = esAdmin || esJefatura; 
  const puedeValidarAsistencias = esAdmin || esJefatura || esPlanilla;

  const puedeVerMantenimientos = esAdmin;
  const puedeVerSoloMiInfo = esColaborador;

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Inicio</h1>
        <button onClick={onLogout}>Cerrar sesión</button>
      </div>

      <p>
        Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Registrar Persona */}
        {puedeRegistrarPersona && (
          <Link to="/registrar-persona">
            <button type="button">Registrar persona</button>
          </Link>
        )}

        {/* Registrar Empleados */}
        {puedeRegistrarEmpleados && (
          <Link to="/registrar-empleados">
            <button type="button">Registrar empleados</button>
          </Link>
        )}

        {/*Registro asistencias*/}
        {puedeRegistrarAsistencias && (
          <Link to="/asistencias/registro">
            <button type="button">Registro asistencias</button>
          </Link>
        )}

        {/* Validar asistencias */}
        {puedeValidarAsistencias && (
          <Link to="/asistencias/validar">
            <button type="button">Validar asistencias</button>
          </Link>
        )}

        {/* Registrar usuarios */}
        {puedeRegistrarUsuarios && (
          <Link to="/registro">
            <button type="button">Registrar usuario</button>
          </Link>
        )}

        {/* Mantenimientos solo Admin */}
        {puedeVerMantenimientos && (
          <Link to="/mantenimientos">
            <button type="button">Mantenimientos</button>
          </Link>
        )}

        {puedeVerSoloMiInfo && (
          <button type="button" disabled>
            Mi información (en desarrollo)
          </button>
        )}
      </div>
    </div>
  );
}
