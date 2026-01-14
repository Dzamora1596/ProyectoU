//ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute() {
  const location = useLocation();
  const token = localStorage.getItem("token");

  const tieneToken = Boolean(token && String(token).trim().length > 0);
  if (!tieneToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (location.pathname === "/login") {
    return <Navigate to="/inicio" replace />;
  }
  return <Outlet />;
}
