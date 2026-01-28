// src/services/catalogosService.js
import api from "../api/axios";

function throwApiError(err) {
  const msg =
    err?.response?.data?.mensaje ||
    err?.response?.data?.message ||
    err?.message ||
    "Error de red / servidor";
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.data = err?.response?.data;
  throw e;
}

const BASE = "/catalogos";

export const obtenerCatalogosRegistroPersonal = async () => {
  try {
    const { data } = await api.get(`${BASE}/registro-personal`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerCatalogosRoles = async () => {
  try {
    const { data } = await api.get(`${BASE}/roles`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerCatalogosCadenciasPago = async () => {
  try {
    const { data } = await api.get(`${BASE}/cadencias-pago`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerCatalogosTiposHoraExtra = async () => {
  try {
    const { data } = await api.get(`${BASE}/tipos-hora-extra`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerCatalogosEstadosPorModulo = async (modulo) => {
  try {
    let valor = "";

    if (typeof modulo === "string") {
      valor = modulo;
    } else if (modulo && typeof modulo === "object") {
      valor = modulo.modulo || "";
    }

    valor = String(valor).trim();

    const { data } = await api.get(`${BASE}/estados`, {
      params: { modulo: valor },
    });
    return data;
  } catch (err) {
    throwApiError(err);
  }
};

export const obtenerCatalogosPeriodos = async () => {
  try {
    const { data } = await api.get(`${BASE}/periodos`);
    return data;
  } catch (err) {
    throwApiError(err);
  }
};
