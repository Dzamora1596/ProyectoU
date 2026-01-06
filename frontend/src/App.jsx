//app para manejar rutas y autenticación básica
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Inicio from "./pages/Inicio";

import RegistroUsuarios from "./pages/RegistroUsuarios";
import RegistrarPersona from "./pages/RegistrarPersona";
import RegistrarEmpleados from "./pages/RegistrarEmpleados";

import ValidarAsistencias from "./pages/ValidarAsistencias";
import RegistroAsistencias from "./pages/RegistroAsistencias";

import Mantenimientos from "./pages/Mantenimientos";
import MantenimientoPersonas from "./pages/MantenimientoPersonas";
import MantenimientoEmpleados from "./pages/MantenimientoEmpleados";
import MantenimientoUsuarios from "./pages/MantenimientoUsuarios";
import MantenimientoHorarios from "./pages/MantenimientoHorarios";
import MantenimientoAsistencias from "./pages/MantenimientoAsistencias";
import MantenimientoRoles from "./pages/MantenimientoRoles";

function RutaPrivada({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const logout = () => setUser(null);

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/inicio" replace /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={user ? <Navigate to="/inicio" replace /> : <Login onLogin={(u) => setUser(u)} />}
      />

      <Route
        path="/inicio"
        element={
          <RutaPrivada user={user}>
            <Inicio user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      <Route
        path="/registro"
        element={
          <RutaPrivada user={user}>
            <RegistroUsuarios user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      <Route
        path="/registrar-persona"
        element={
          <RutaPrivada user={user}>
            <RegistrarPersona user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      <Route
        path="/registrar-empleados"
        element={
          <RutaPrivada user={user}>
            <RegistrarEmpleados user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Registro de asistencias */}
      <Route
        path="/asistencias/registro"
        element={
          <RutaPrivada user={user}>
            <RegistroAsistencias user={user} />
          </RutaPrivada>
        }
      />

      {/* Validar asistencia */}
      <Route
        path="/asistencias/validar"
        element={
          <RutaPrivada user={user}>
            <ValidarAsistencias user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />
{/* Mantenimientos */}
      <Route
        path="/mantenimientos"
        element={
          <RutaPrivada user={user}>
            <Mantenimientos user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />
{/* Mantenimiento personas */}
      <Route
        path="/mantenimientos/personas"
        element={
          <RutaPrivada user={user}>
            <MantenimientoPersonas user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />
{/* Mantenimiento empleados */}
      <Route
        path="/mantenimientos/empleados"
        element={
          <RutaPrivada user={user}>
            <MantenimientoEmpleados user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />
{/* Mantenimiento usuarios */}
      <Route
        path="/mantenimientos/usuarios"
        element={
          <RutaPrivada user={user}>
            <MantenimientoUsuarios user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />
{/* Mantenimiento horarios */}
      <Route
        path="/mantenimientos/horarios"
        element={
          <RutaPrivada user={user}>
            <MantenimientoHorarios user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Mantenimiento asistencia */}
      <Route
        path="/mantenimientos/asistencias"
        element={
          <RutaPrivada user={user}>
            <MantenimientoAsistencias user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Mantenimiento de roles */}
      <Route
        path="/mantenimientos/roles"
        element={
          <RutaPrivada user={user}>
            <MantenimientoRoles user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
