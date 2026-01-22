import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Menu from "../components/Menu";

function leerUsuarioDesdeStorage() {
  try {
    const u =
      localStorage.getItem("usuario") ||
      localStorage.getItem("user") ||
      localStorage.getItem("auth_user");

    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

function limpiarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_user");
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("token");
  const user = leerUsuarioDesdeStorage();

  const onLogout = () => {
    limpiarSesion();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const tieneToken = Boolean(token && String(token).trim());
    if (tieneToken && !user) {
      limpiarSesion();
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [token, user, navigate, location.pathname]);

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      <Menu user={user} onLogout={onLogout} />
      <main 
        className="app-content flex-grow-1" 
        style={{ 
          backgroundColor: 'var(--dm-gray-light)', 
          padding: '2rem',
          overflowY: 'auto',
          maxHeight: '100vh'
        }}
      >
        <div className="container-fluid p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}