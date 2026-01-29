import React, { useEffect, useState } from "react";
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

  const [menuCollapsed, setMenuCollapsed] = useState(false);

  const MENU_W = 280;
  const MENU_W_COLLAPSED = 84;

  const onLogout = () => {
    limpiarSesion();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const tieneToken = Boolean(token && String(token).trim());

    if (!tieneToken) {
      limpiarSesion();
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return;
    }

    if (tieneToken && !user) {
      limpiarSesion();
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  }, [token, user, navigate, location.pathname]);

  return (
    <div className="d-flex min-vh-100 bg-body">
      {/* SIDEBAR */}
      <aside
        className="bg-white border-end flex-shrink-0"
        style={{
          width: menuCollapsed ? MENU_W_COLLAPSED : MENU_W,
          transition: "width .18s ease",
        }}
      >
        <Menu
          user={user}
          onLogout={onLogout}
          collapsed={menuCollapsed}
          onToggleCollapsed={() => setMenuCollapsed((v) => !v)}
        />
      </aside>

      {/* CONTENT */}
      <main className="flex-grow-1 overflow-auto">
        <div className="container-fluid py-3 py-lg-4 px-3 px-lg-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
