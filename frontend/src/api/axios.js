// src/api/axios.js
import axios from "axios";
 
function normalizarBaseURL(raw) {
  const b = String(raw || "").trim() || "http://localhost:4000/api";
  return b.replace(/\/+$/, "");  
}

const api = axios.create({
  baseURL: normalizarBaseURL(import.meta.env.VITE_API_URL),
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");

      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
