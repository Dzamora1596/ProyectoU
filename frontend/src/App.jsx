// Gestión de rutas y autenticación en la aplicación React
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import RegistroUsuarios from "./pages/RegistroUsuarios";
import EmpleadoTable from "./components/empleados/EmpleadoTable";

// Solo permite el acceso si el usuario está autenticado
function RutaPrivada({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Pantalla de inicio después del login exitoso temporal
function Inicio() {
  return (
    <div>
      <h1>Inicio</h1>
      <p>Bienvenido al sistema.</p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  const logout = () => setUser(null);

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/inicio" replace />
          ) : (
            <Login onLogin={(u) => setUser(u)} />
          )
        }
      />

      {/*También soporta /login */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/inicio" replace />
          ) : (
            <Login onLogin={(u) => setUser(u)} />
          )
        }
      />


      {/*Inicio protegido */}
      <Route
        path="/inicio"
        element={
          <RutaPrivada user={user}>
            <div>
              <button onClick={logout}>Cerrar sesión</button>
              <Inicio />
            </div>
          </RutaPrivada>
        }
      />

      {/* Protege a los empleados */}
      <Route
        path="/empleados"
        element={
          <RutaPrivada user={user}>
            <div>
              <h1>Sistema de Planilla</h1>
              <button onClick={logout}>Cerrar sesión</button>
              <EmpleadoTable />
            </div>
          </RutaPrivada>
        }
      />

      {/* Ruta desconocida manda a / */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
