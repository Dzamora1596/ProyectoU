// src/services/horasExtraService.js
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

export async function calcularHorasExtra(input) {
  try {
    const desde = String(input?.desde || "").trim();
    const hasta = String(input?.hasta || "").trim();

    if (!desde || !hasta) {
      throw new Error("Debe enviar { desde, hasta } para calcular horas extra.");
    }

    const { data } = await api.post("/horas-extra/calcular", { desde, hasta });
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function listarHorasExtra(params = {}) {
  try {
    const p = {};

    const periodoId = Number(params.periodoId || 0);
    const empleadoId = Number(params.empleadoId || 0);
    const estado = String(params.estado || "").trim();
    const desde = String(params.desde || "").trim();
    const hasta = String(params.hasta || "").trim();

    if (periodoId) p.periodoId = periodoId;
    if (empleadoId) p.empleadoId = empleadoId;
    if (estado) p.estado = estado;
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;

    const { data } = await api.get("/horas-extra", { params: p });
    return data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function cambiarEstadoHoraExtra(idExtra, estadoId, motivoRechazo = "") {
  try {
    const id = Number(idExtra || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idExtra inválido");

    const body = { estadoId };
    const m = String(motivoRechazo || "").trim();
    if (m) body.motivoRechazo = m;

    const { data } = await api.put(`/horas-extra/${id}/estado`, body);
    return data;
  } catch (err) {
    throwApiError(err);
  }
}
