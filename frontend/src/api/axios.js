// src/api/axios.js
import axios from "axios";

function normalizarBaseURL(raw) {
  const base = String(raw || "").trim() || "http://localhost:4000/api";
  const noTrailing = base.replace(/\/+$/, "");
  return noTrailing.endsWith("/api") ? noTrailing : `${noTrailing}/api`;
}

let inMemoryToken = "";

export function setAccessToken(token) {
  inMemoryToken = String(token || "");
}

export function clearAccessToken() {
  inMemoryToken = "";
}


function getStoredToken() {
  return (
    inMemoryToken ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    ""
  );
}


function getStoredRolId() {
  const usuarioRaw = localStorage.getItem("usuario") || "";
  if (!usuarioRaw) return 0;

  try {
    const u = JSON.parse(usuarioRaw);
    const rolId = Number(
      u?.rolId ?? u?.Rol_idRol ?? u?.rol_id ?? u?.idRol ?? 0
    );
    return Number.isFinite(rolId) ? rolId : 0;
  } catch {
    return 0;
  }
}

const api = axios.create({
  baseURL: normalizarBaseURL(import.meta.env.VITE_API_URL),
});


api.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {};

    const token = getStoredToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const rolId = getStoredRolId();
    if (rolId > 0 && !config.headers["x-rol-id"]) {
      config.headers["x-rol-id"] = String(rolId);
    }

    const method = String(config.method || "get").toLowerCase();
    const isFormData =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    if (!isFormData && method !== "get" && method !== "delete") {
      const ct =
        config.headers["Content-Type"] || config.headers["content-type"] || "";
      if (!ct) config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

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
      clearAccessToken();

      if (!isOnLoginPage) window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
