// src/api/axios.js
import axios from "axios";

function normalizarBaseURL(raw) {
  // Acepta:
  // - VITE_API_URL = "http://localhost:4000"  -> queda "http://localhost:4000/api"
  // - VITE_API_URL = "http://localhost:4000/api" -> queda igual
  const base = String(raw || "").trim() || "http://localhost:4000/api";
  const noTrailing = base.replace(/\/+$/, "");
  return noTrailing.endsWith("/api") ? noTrailing : `${noTrailing}/api`;
}

const api = axios.create({
  baseURL: normalizarBaseURL(import.meta.env.VITE_API_URL),
  // ✅ NO fijar Content-Type global.
  // Si lo fijas a JSON, puede romper FormData/multipart (archivos) porque impide boundary correcto.
});

// ✅ Request interceptor: token + rol
api.interceptors.request.use(
  (config) => {
    // Axios v1 puede traer headers como objeto especial; esto evita pisarlo.
    config.headers = config.headers ?? {};

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      "";

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ x-rol-id (si existe)
    const usuarioRaw = localStorage.getItem("usuario") || "";
    if (usuarioRaw && !config.headers["x-rol-id"]) {
      try {
        const u = JSON.parse(usuarioRaw);
        const rolId = Number(u?.rolId ?? u?.Rol_idRol ?? u?.rol_id ?? u?.idRol ?? 0);
        if (rolId > 0) config.headers["x-rol-id"] = String(rolId);
      } catch {
        // ignore
      }
    }

    // ✅ Content-Type inteligente:
    // - Si es FormData: NO seteamos Content-Type (axios/browser ponen boundary).
    // - Si NO es FormData y no viene seteado: ponemos JSON por defecto.
    // - Evitar setear Content-Type en GET/DELETE para no disparar preflight innecesario.
    const method = String(config.method || "get").toLowerCase();
    const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;

    if (!isFormData && method !== "get" && method !== "delete") {
      const ct = config.headers["Content-Type"] || config.headers["content-type"] || "";
      if (!ct) config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response interceptor: 401 -> logout + redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const isLoginCall =
      String(url).includes("/login") || String(url).includes("/autenticar");
    const isOnLoginPage = window.location.pathname.includes("/login");

    if (status === 401 && !isLoginCall) {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("jwt");
      localStorage.removeItem("usuario");

      if (!isOnLoginPage) window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
