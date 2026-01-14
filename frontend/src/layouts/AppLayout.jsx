//layouts/AppLayout.jsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
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
    <div className="app-shell">
      <Menu user={user} onLogout={onLogout} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
