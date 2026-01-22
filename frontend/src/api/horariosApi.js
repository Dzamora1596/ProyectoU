// src/api/horariosApi.js
import api from "./axios";

function normalizarError(err) {
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

const BASE = "/horarios";

export async function obtenerHorarioEmpleado(idEmpleado) {
  try {
    const emp = Number(idEmpleado || 0);
    if (!Number.isFinite(emp) || emp <= 0) throw new Error("idEmpleado inválido");
    const { data } = await api.get(`${BASE}/empleado/${emp}`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function obtenerHorarioEmpleadoBasico(idEmpleado) {
   
  return await obtenerHorarioEmpleado(idEmpleado);
}

export async function obtenerDetalleHorarioEmpleado(idEmpleado) {
  try {
    const emp = Number(idEmpleado || 0);
    if (!Number.isFinite(emp) || emp <= 0) throw new Error("idEmpleado inválido");
    const { data } = await api.get(`${BASE}/empleado/${emp}/detalle`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function asignarCatalogoHorarioEmpleado(idEmpleado, idCatalogoHorario) {
  try {
    const emp = Number(idEmpleado || 0);
    if (!Number.isFinite(emp) || emp <= 0) throw new Error("idEmpleado inválido");

    let cat = 0;
    if (typeof idCatalogoHorario === "object" && idCatalogoHorario !== null) {
      cat = Number(idCatalogoHorario.idCatalogoHorario || 0);
    } else {
      cat = Number(idCatalogoHorario || 0);
    }
    if (!Number.isFinite(cat) || cat <= 0) throw new Error("idCatalogoHorario inválido");

    const { data } = await api.put(`${BASE}/empleado/${emp}/detalle`, { idCatalogoHorario: cat });
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function listarCatalogosHorario() {
  try {
    const { data } = await api.get(`${BASE}/catalogos`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function crearCatalogoHorario(payload) {
  try {
    const body = {
      descripcion: String(payload?.descripcion ?? "").trim(),
      tipoHorarioId: Number(payload?.tipoHorarioId || 0),
      activo: payload?.activo === undefined ? 1 : Number(payload.activo) ? 1 : 0,
    };
    const { data } = await api.post(`${BASE}/catalogos`, body);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function actualizarCatalogoHorario(idCatalogoHorario, payload) {
  try {
    const id = Number(idCatalogoHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");

    const body = {
      ...(payload?.descripcion !== undefined
        ? { descripcion: String(payload.descripcion ?? "").trim() }
        : {}),
      ...(payload?.tipoHorarioId !== undefined
        ? { tipoHorarioId: Number(payload.tipoHorarioId || 0) }
        : {}),
      ...(payload?.activo !== undefined ? { activo: Number(payload.activo) ? 1 : 0 } : {}),
    };

    const { data } = await api.put(`${BASE}/catalogos/${id}`, body);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function eliminarCatalogoHorario(idCatalogoHorario) {
  try {
    const id = Number(idCatalogoHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");
    const { data } = await api.delete(`${BASE}/catalogos/${id}`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function listarTiposHorario() {
  try {
    const { data } = await api.get(`${BASE}/tipos`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function obtenerDetalleCatalogoHorario(idCatalogoHorario) {
  try {
    const id = Number(idCatalogoHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");
    const { data } = await api.get(`${BASE}/catalogos/${id}/detalle`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function crearDetalleCatalogoHorario(idCatalogoHorario, payload) {
  try {
    const id = Number(idCatalogoHorario || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");

    const body = {
      diaSemana: Number(payload?.diaSemana || 0),
      entrada: payload?.entrada ?? "",
      salida: payload?.salida ?? "",
      activo: payload?.activo === undefined ? 1 : Number(payload.activo) ? 1 : 0,
    };

    const { data } = await api.post(`${BASE}/catalogos/${id}/detalle`, body);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function actualizarDetalleCatalogoHorario(
  idCatalogoHorario,
  idCatalogoHorarioDetalle,
  payload
) {
  try {
    const id = Number(idCatalogoHorario || 0);
    const det = Number(idCatalogoHorarioDetalle || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");
    if (!Number.isFinite(det) || det <= 0) throw new Error("idCatalogoHorarioDetalle inválido");

    const body = {
      ...(payload?.diaSemana !== undefined ? { diaSemana: Number(payload.diaSemana || 0) } : {}),
      ...(payload?.entrada !== undefined ? { entrada: payload.entrada ?? "" } : {}),
      ...(payload?.salida !== undefined ? { salida: payload.salida ?? "" } : {}),
      ...(payload?.activo !== undefined ? { activo: Number(payload.activo) ? 1 : 0 } : {}),
    };

    const { data } = await api.put(`${BASE}/catalogos/${id}/detalle/${det}`, body);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function eliminarDetalleCatalogoHorario(idCatalogoHorario, idCatalogoHorarioDetalle) {
  try {
    const id = Number(idCatalogoHorario || 0);
    const det = Number(idCatalogoHorarioDetalle || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idCatalogoHorario inválido");
    if (!Number.isFinite(det) || det <= 0) throw new Error("idCatalogoHorarioDetalle inválido");

    const { data } = await api.delete(`${BASE}/catalogos/${id}/detalle/${det}`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}
 

export async function listarHorariosLaborales() {
  try {
    const { data } = await api.get(`${BASE}`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function crearHorarioLaboral(payload) {
  try {
    const { data } = await api.post(`${BASE}`, payload);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function actualizarHorarioLaboral(idHorarioLaboral, payload) {
  try {
    const id = Number(idHorarioLaboral || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idHorarioLaboral inválido");
    const { data } = await api.put(`${BASE}/${id}`, payload);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}

export async function eliminarHorarioLaboral(idHorarioLaboral) {
  try {
    const id = Number(idHorarioLaboral || 0);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idHorarioLaboral inválido");
    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  } catch (err) {
    normalizarError(err);
  }
}
