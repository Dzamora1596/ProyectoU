//Archivo principal de la aplicación con rutas protegidas
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import RegistroUsuarios from "./pages/RegistroUsuarios";
import EmpleadoTable from "./components/empleados/EmpleadoTable";

// Para rutas privadas que siven de protección de accesos
function RutaPrivada({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);

  const logout = () => setUser(null);

  return (
    <Routes>
      {/*Raíz */}// Redirige según si hay usuario o no
      <Route
        path="/"
        element={user ? <Navigate to="/inicio" replace /> : <Navigate to="/login" replace />}
      />

      {/*Login */}
      <Route
        path="/login"
        element={
          user ? <Navigate to="/inicio" replace /> : <Login onLogin={(u) => setUser(u)} />
        }
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

      {/*Registro */}
      <Route
        path="/registro"
        element={
          <RutaPrivada user={user}>
            <RegistroUsuarios />
          </RutaPrivada>
        }
      />

      {/*Empleados */}
      <Route
        path="/empleados"
        element={
          <RutaPrivada user={user}>
            <div style={{ padding: 20 }}>
              <h1>Sistema de Planilla</h1>
              <button onClick={logout}>Cerrar sesión</button>
              <EmpleadoTable />
            </div>
          </RutaPrivada>
        }
      />

      {/*Cualquier otra ruta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
