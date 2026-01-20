// src/api/horasExtraApi.js
import api from "./axios";

 
export async function calcularHorasExtra(input) {
  const desde = String(input?.desde || "").trim();
  const hasta = String(input?.hasta || "").trim();

  if (!desde || !hasta) {
    throw new Error("Debe enviar { desde, hasta } para calcular horas extra.");
  }

  const res = await api.post("/horas-extra/calcular", { desde, hasta });
  return res.data;
}

 
export async function listarHorasExtra(params = {}) {
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

  const res = await api.get("/horas-extra", { params: p });
  return res.data;
}

export async function cambiarEstadoHoraExtra(idExtra, estadoId, motivoRechazo = "") {
  const body = { estadoId };
  const m = String(motivoRechazo || "").trim();
  if (m) body.motivoRechazo = m;

  const res = await api.put(`/horas-extra/${idExtra}/estado`, body);
  return res.data;
}
