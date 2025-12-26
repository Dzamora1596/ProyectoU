//Codigo principal de la aplicación con rutas protegidas
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import RegistrarPersona from "./pages/RegistrarPersona";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import RegistroUsuarios from "./pages/RegistroUsuarios";
import RegistrarEmpleados from "./pages/RegistrarEmpleados";
import ValidarAsistencias from "./pages/ValidarAsistencias";

// Ruta privada
function RutaPrivada({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);

  const logout = () => setUser(null);

  return (
    <Routes>
      {/*Raíz */}
      <Route
        path="/"
        element={user ? <Navigate to="/inicio" replace /> : <Navigate to="/login" replace />}
      />

      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/inicio" replace /> : <Login onLogin={(u) => setUser(u)} />}
      />

      {/*Inicio */}
      <Route
        path="/inicio"
        element={
          <RutaPrivada user={user}>
            <Inicio user={user} onLogout={logout} />
          </RutaPrivada>
        }
      />

      {/* Registro */}
      <Route
        path="/registro"
        element={
          <RutaPrivada user={user}>
            <RegistroUsuarios />
          </RutaPrivada>
        }


      />

      <Route
        path="/registrar-empleados"
        element={
          <RutaPrivada user={user}>
            <RegistrarEmpleados />
          </RutaPrivada>
        }
      />


      {/* Validar asistencias */}
      <Route
        path="/asistencias/validar"
        element={
          <RutaPrivada user={user}>
            <ValidarAsistencias />
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

      {/* Cualquier otra ruta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
