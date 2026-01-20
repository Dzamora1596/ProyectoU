import api from "./axios";

export async function obtenerCatalogosRegistroPersonal() {
  const res = await api.get("/catalogos/registro-personal");
  return res.data;
}

export async function obtenerCatalogosRoles() {
  const res = await api.get("/catalogos/roles");
  return res.data;
}

export async function obtenerCatalogosCadenciasPago() {
  const res = await api.get("/catalogos/cadencias-pago");
  return res.data;
}

export async function obtenerCatalogosTiposHoraExtra() {
  const res = await api.get("/catalogos/tipos-hora-extra");
  return res.data;
}

export async function obtenerCatalogosEstadosPorModulo(modulo) {
  let valor = "";

  if (typeof modulo === "string") {
    valor = modulo;
  } else if (modulo && typeof modulo === "object") {
    valor = modulo.modulo || "";
  }

  valor = String(valor).trim();

  const res = await api.get("/catalogos/estados", {
    params: { modulo: valor },
  });
  return res.data;
}

export async function obtenerCatalogosPeriodos() {
  const res = await api.get("/catalogos/periodos");
  return res.data;
}
