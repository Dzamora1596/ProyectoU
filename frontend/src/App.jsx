import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Inicio from "./pages/Inicio";

import RegistroUsuarios from "./pages/RegistroUsuarios";
import RegistrarEmpleados from "./pages/RegistrarEmpleados";
import RegistrarPersona from "./pages/RegistrarPersona";

import ValidarAsistencias from "./pages/ValidarAsistencias";

import Mantenimientos from "./pages/Mantenimientos";
import MantenimientoPersonas from "./pages/MantenimientoPersonas";

// Ruta privada que verifica si el usuario está autenticado
function RutaPrivada({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const logout = () => setUser(null);

  return (
    <Routes>
      {/* Raíz */}
      <Route
        path="/"
        element={user ? <Navigate to="/inicio" replace /> : <Navigate to="/login" replace />}
      />

      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/inicio" replace /> : <Login onLogin={(u) => setUser(u)} />}
      />

      {/* Inicio */}
      <Route
        path="/inicio"
        element={
          <RutaPrivada user={user}>
            <Inicio user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Registrar Usuario */}
      <Route
        path="/registro"
        element={
          <RutaPrivada user={user}>
            <RegistroUsuarios user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Registrar Persona (registro simple) */}
      <Route
        path="/registrar-persona"
        element={
          <RutaPrivada user={user}>
            <RegistrarPersona user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Registrar Empleados */}
      <Route
        path="/registrar-empleados"
        element={
          <RutaPrivada user={user}>
            <RegistrarEmpleados user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Validar asistencias */}
      <Route
        path="/asistencias/validar"
        element={
          <RutaPrivada user={user}>
            <ValidarAsistencias user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Mantenimientos (solo Admin en el componente) */}
      <Route
        path="/mantenimientos"
        element={
          <RutaPrivada user={user}>
            <Mantenimientos user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Mantenimientos → Personas (CRUD completo, solo Admin en el componente) */}
      <Route
        path="/mantenimientos/personas"
        element={
          <RutaPrivada user={user}>
            <MantenimientoPersonas user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Cualquier otra ruta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
