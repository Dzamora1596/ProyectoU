//cliente.js
import axios from "axios";

const cliente = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

cliente.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default cliente;
