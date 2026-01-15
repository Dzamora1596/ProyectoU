// src/api/catalogosApi.js
import api from "./axios";

export async function obtenerCatalogosRegistroPersonal() {
  // GET /api/catalogos/registro-personal
  const res = await api.get("/catalogos/registro-personal");
  return res.data;
}

export async function obtenerCatalogosRoles() {
  // GET /api/catalogos/roles
  const res = await api.get("/catalogos/roles");
  return res.data;
}
