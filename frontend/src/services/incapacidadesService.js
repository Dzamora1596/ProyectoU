// frontend/src/services/incapacidadesService.js
import api from "../api/axios";

function throwApiError(e) {
  const mensaje =
    e?.response?.data?.mensaje ||
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Error de red / servidor.";
  const err = new Error(mensaje);
  err.original = e;
  throw err;
}

function stripTimeIfPresent(dmy) {
  const s = String(dmy || "").trim();
  if (!s) return s;
  const m = s.match(/^(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s;
}

// ✅ LISTAR (backend aplica scope según rol)
export const listarIncapacidades = async () => {
  try {
    const { data } = await api.get("/incapacidades");
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const obtenerIncapacidad = async (idIncapacidad) => {
  try {
    const { data } = await api.get(`/incapacidades/${idIncapacidad}`);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const crearIncapacidad = async (payload) => {
  try {
    const clean = { ...(payload || {}) };

    // ✅ eliminar período inválido
    if (
      clean.Catalogo_Periodo_idCatalogo_Periodo === "" ||
      clean.Catalogo_Periodo_idCatalogo_Periodo === null ||
      clean.Catalogo_Periodo_idCatalogo_Periodo === undefined ||
      Number(clean.Catalogo_Periodo_idCatalogo_Periodo) === 0
    ) {
      delete clean.Catalogo_Periodo_idCatalogo_Periodo;
    }

    // ✅ backend espera fecha sin hora
    if (clean.Fecha_Inicio !== undefined) {
      clean.Fecha_Inicio = stripTimeIfPresent(clean.Fecha_Inicio);
    }
    if (clean.Fecha_Fin !== undefined) {
      clean.Fecha_Fin = stripTimeIfPresent(clean.Fecha_Fin);
    }

    const { data } = await api.post("/incapacidades", clean);
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const subirArchivoIncapacidad = async (idIncapacidad, file) => {
  try {
    const formData = new FormData();
    formData.append("archivo", file);

    // ✅ NO forzar Content-Type (axios lo maneja)
    const { data } = await api.post(
      `/incapacidades/${idIncapacidad}/archivo`,
      formData
    );

    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const validarIncapacidad = async (idIncapacidad, Observacion) => {
  try {
    const obs = String(Observacion ?? "").trim();
    const body = obs ? { Observacion: obs } : undefined;

    const { data } = await api.put(
      `/incapacidades/${idIncapacidad}/aprobar`,
      body
    );
    return data;
  } catch (e) {
    throwApiError(e);
  }
};

export const rechazarIncapacidad = async (idIncapacidad, Observacion) => {
  try {
    const obs = String(Observacion ?? "").trim();
    const body = obs ? { Observacion: obs, Motivo: obs } : { Motivo: "" };

    const { data } = await api.put(
      `/incapacidades/${idIncapacidad}/rechazar`,
      body
    );
    return data;
  } catch (e) {
    throwApiError(e);
  }
};
