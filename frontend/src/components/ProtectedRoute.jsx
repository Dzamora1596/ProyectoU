//ProtectedRoute
import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

export default function ProtectedRoute() {
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);

  const token = getToken();
  const tieneToken = Boolean(token && String(token).trim().length > 0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVerifying(false), 250);
    return () => clearTimeout(timer);
  }, []);

  if (isVerifying) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body">
        <div className="text-center">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <div className="mt-3 fw-bold text-dark">Decoraciones Marenco</div>
          <div className="text-muted small">Verificando sesión...</div>
        </div>
      </div>
    );
  }

  if (!tieneToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (location.pathname === "/login") {
    return <Navigate to="/inicio" replace />;
  }

  return <Outlet />;
}
