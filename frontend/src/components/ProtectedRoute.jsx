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
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (isVerifying) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="text-center">
          <div
            className="spinner-border"
            role="status"
            style={{ color: "var(--dm-red)", width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 fw-bold text-dark">Decoraciones Marenco</p>
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
