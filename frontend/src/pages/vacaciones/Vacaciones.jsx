// /vacaciones/Vacaciones.jsx
import { useEffect, useMemo, useState } from "react";

function canonRole(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  const low = v.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

function parseJwt(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function getRoleFromStorage() {
  const token = getToken();
  const decoded = token ? parseJwt(token) : null;

  const fromToken =
    decoded?.rolNombre ??
    decoded?.rol ??
    decoded?.role ??
    decoded?.Rol ??
    decoded?.rolUsuario ??
    decoded?.RolUsuario ??
    "";

  if (fromToken) return canonRole(fromToken);

  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    const r = u?.rolNombre ?? u?.rol ?? u?.role ?? u?.Rol ?? "";
    return canonRole(r);
  } catch {
    return "";
  }
}

function getEmpleadoIdFromStorage() {
  const token = getToken();
  const decoded = token ? parseJwt(token) : null;

  const v =
    decoded?.Empleado_idEmpleado ??
    decoded?.empleadoId ??
    decoded?.idEmpleado ??
    decoded?.EmpleadoId ??
    null;

  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;

  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    const v2 =
      u?.Empleado_idEmpleado ??
      u?.empleadoId ??
      u?.idEmpleado ??
      u?.EmpleadoId ??
      null;
    const n2 = Number(v2);
    return Number.isFinite(n2) && n2 > 0 ? n2 : null;
  } catch {
    return null;
  }
}

function badgeClassByEstado(estado) {
  const e = String(estado || "").toUpperCase();
  if (e.includes("APROB")) return "badge bg-success";
  if (e.includes("PEND")) return "badge bg-warning";
  if (e.includes("RECH")) return "badge bg-danger";
  return "badge bg-secondary";
}

function normalizeEstado(v) {
  const e = String(v || "").toUpperCase();
  if (e.includes("PEND")) return "PENDIENTE";
  if (e.includes("APROB")) return "APROBADO";
  if (e.includes("RECH")) return "RECHAZADO";
  return "OTRO";
}

function formatFecha(v) {
  if (!v) return "";
  const s = String(v);
  if (s.includes("/")) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function asInputDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return "";
}

function getEmpleadoDisplay(v) {
  return (
    v?.EmpleadoNombre ||
    v?.NombreEmpleado ||
    v?.empleadoNombre ||
    v?.nombreEmpleado ||
    "—"
  );
}

function ordenarPendientesPrimero(arr) {
  const list = Array.isArray(arr) ? [...arr] : [];
  list.sort((a, b) => {
    const ap = normalizeEstado(a?.EstadoDescripcion) === "PENDIENTE" ? 0 : 1;
    const bp = normalizeEstado(b?.EstadoDescripcion) === "PENDIENTE" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const aid = Number(a?.idVacaciones ?? 0);
    const bid = Number(b?.idVacaciones ?? 0);
    return bid - aid;
  });
  return list;
}

export default function Vacaciones({ mode = "listado" }) {
  const apiBase =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:4000/api";

  const role = useMemo(() => getRoleFromStorage(), []);
  const empleadoIdDesdeToken = useMemo(() => getEmpleadoIdFromStorage(), []);

  const isAdmin = role === "Admin";
  const isJefatura = role === "Jefatura";
  const canAprobarRechazar = isAdmin || isJefatura;

  const canVerIdVacaciones = isAdmin;
  const canVerEmpleadoId = isAdmin;

  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");

  const [saldo, setSaldo] = useState(null);
  const [saldoWarnings, setSaldoWarnings] = useState(null);

  const [vacaciones, setVacaciones] = useState([]);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [toast, setToast] = useState("");

  const [estadoFiltro, setEstadoFiltro] = useState("PENDIENTE");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [empleadoIdFiltroTabla, setEmpleadoIdFiltroTabla] = useState("");
  const [empleadosTabla, setEmpleadosTabla] = useState([]);

  const authHeaders = useMemo(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...authHeaders,
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
      const msg =
        (body && typeof body === "object" && (body.message || body.mensaje)) ||
        (typeof body === "string" && body) ||
        `Error ${res.status}`;
      const e = new Error(msg);
      e.status = res.status;
      e.body = body;
      throw e;
    }

    return body;
  }

  function buildEmpleadosOptionsFromVacaciones(arr) {
    const map = new Map();
    for (const v of Array.isArray(arr) ? arr : []) {
      const id = Number(v?.Empleado_idEmpleado ?? 0);
      if (!id) continue;
      const nombre = getEmpleadoDisplay(v);
      if (!map.has(id)) map.set(id, nombre);
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  }

  // ✅ CAMBIO AQUÍ: usar /vacaciones/saldo (sin parámetro)
  async function cargarSaldoMiEmpleado() {
    const data = await apiFetch("/vacaciones/saldo", { method: "GET" });

    const w = data?.warnings || null;
    const clean = { ...data };
    delete clean.warnings;

    setSaldo(clean);
    setSaldoWarnings(w);
  }

  async function cargarListaMiEmpleado() {
    let path = "/vacaciones";

    if (canAprobarRechazar) {
      const n = Number(empleadoIdFiltroTabla || 0);
      if (Number.isFinite(n) && n > 0) {
        const qs = new URLSearchParams();
        qs.set("empleadoId", String(n));
        path = `/vacaciones?${qs.toString()}`;
      }
    } else {
      if (!empleadoIdDesdeToken) {
        setVacaciones([]);
        return;
      }
      const qs = new URLSearchParams();
      qs.set("empleadoId", String(Number(empleadoIdDesdeToken)));
      path = `/vacaciones?${qs.toString()}`;
    }

    const data = await apiFetch(path, { method: "GET" });
    const arr = Array.isArray(data) ? data : [];
    setVacaciones(ordenarPendientesPrimero(arr));

    if (canAprobarRechazar) {
      setEmpleadosTabla(buildEmpleadosOptionsFromVacaciones(arr));
    } else {
      setEmpleadosTabla([]);
    }
  }

  async function refrescarTodo() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([cargarSaldoMiEmpleado(), cargarListaMiEmpleado()]);
    } catch (e) {
      setError(e?.message || "Error cargando vacaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refrescarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [estadoFiltro]);

  async function onAplicarEmpleadoTabla() {
    setToast("");
    setError("");
    setLoading(true);
    try {
      await cargarListaMiEmpleado();
      setPage(1);
    } catch (e) {
      setError(e?.message || "Error aplicando filtro");
    } finally {
      setLoading(false);
    }
  }

  async function onSolicitar(e) {
    e.preventDefault();
    setToast("");
    setError("");

    if (!empleadoIdDesdeToken) {
      setError("No se pudo determinar el empleado del usuario.");
      return;
    }

    if (!fechaInicio || !fechaFin) {
      setError("Debe indicar Fecha Inicio y Fecha Fin");
      return;
    }

    if (new Date(fechaFin).getTime() < new Date(fechaInicio).getTime()) {
      setError("Fecha Fin no puede ser menor a Fecha Inicio");
      return;
    }

    const payload = {
      Empleado_idEmpleado: Number(empleadoIdDesdeToken),
      Fecha_Inicio: fechaInicio,
      Fecha_Fin: fechaFin,
    };

    setLoadingAction(true);
    try {
      await apiFetch("/vacaciones", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setToast("Solicitud creada");
      await refrescarTodo();

      setFechaInicio("");
      setFechaFin("");
    } catch (e2) {
      const extra = e2?.body;
      const feriados = Array.isArray(extra?.feriados) ? extra.feriados : [];
      if (feriados.length) {
        setError(
          `${e2?.message || "No se pudo solicitar"} (Feriados en rango: ${feriados
            .map(
              (f) =>
                `${formatFecha(f?.Fecha)}${f?.Nombre ? ` (${f.Nombre})` : ""}`
            )
            .join(", ")})`
        );
      } else {
        setError(e2?.message || "No se pudo solicitar");
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function onAprobar(id) {
    setToast("");
    setError("");
    setLoadingAction(true);
    try {
      await apiFetch(`/vacaciones/${Number(id)}/aprobar`, { method: "PUT" });
      setToast("Solicitud aprobada");
      await refrescarTodo();
    } catch (e) {
      setError(e?.message || "No se pudo aprobar");
    } finally {
      setLoadingAction(false);
    }
  }

  async function onRechazar(id) {
    setToast("");
    setError("");
    setLoadingAction(true);
    try {
      await apiFetch(`/vacaciones/${Number(id)}/rechazar`, { method: "PUT" });
      setToast("Solicitud rechazada");
      await refrescarTodo();
    } catch (e) {
      setError(e?.message || "No se pudo rechazar");
    } finally {
      setLoadingAction(false);
    }
  }

  const titulo = mode === "solicitar" ? "Solicitar Vacaciones" : "Vacaciones";

  const listaFiltrada = useMemo(() => {
    const base = Array.isArray(vacaciones) ? vacaciones : [];
    if (estadoFiltro === "TODAS") return base;
    return base.filter(
      (v) => normalizeEstado(v?.EstadoDescripcion) === estadoFiltro
    );
  }, [vacaciones, estadoFiltro]);

  const totalPages = Math.max(1, Math.ceil(listaFiltrada.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = listaFiltrada.slice(start, end);

  const colSpanNoData =
    (canVerIdVacaciones ? 1 : 0) +
    1 +
    (canVerEmpleadoId ? 1 : 0) +
    1 +
    1 +
    1 +
    1 +
    1;

  // ✅ CAMBIO AQUÍ: SOLO Admin VE ID EN EL CAMPO "Empleado" DE NUEVA SOLICITUD
  const empleadoSesionLabel = saldo?.EmpleadoNombre
    ? `${saldo.EmpleadoNombre}${
        isAdmin && empleadoIdDesdeToken ? ` (ID: ${empleadoIdDesdeToken})` : ""
      }`
    : isAdmin && empleadoIdDesdeToken
    ? `ID: ${empleadoIdDesdeToken}`
    : "—";

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h3 style={{ margin: 0 }}>{titulo}</h3>
          <div className="text-muted mt-1">Rol: {role || "No disponible"}</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-dark"
            onClick={refrescarTodo}
            disabled={loading || loadingAction}
          >
            Recargar
          </button>
        </div>
      </div>

      {toast ? (
        <div className="alert alert-success" role="alert">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card mb-3">
        <div className="card-header">
          Saldo {saldo?.EmpleadoNombre ? `— ${saldo.EmpleadoNombre}` : ""}
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : saldo ? (
            <div className="row g-3">
              <div className="col-12 col-md-3">
                <div className="text-muted">A Derecho</div>
                <div className="fs-5 fw-bold">
                  {Number(saldo.Vacaciones_a_Derecho ?? 0)}
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="text-muted">Disfrutadas (Aprobadas)</div>
                <div className="fs-5 fw-bold">
                  {Number(saldo.Vacaciones_Disfrutadas ?? 0)}
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="text-muted">Pendientes</div>
                <div className="fs-5 fw-bold">
                  {Number(saldo.Vacaciones_Pendientes ?? 0)}
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="text-muted">Disponibles</div>
                <div className="fs-5 fw-bold">
                  {Number(saldo.Vacaciones_Disponibles ?? 0)}
                </div>
              </div>

              {"Vacaciones_Disponibles_Total" in (saldo || {}) ? (
                <>
                  <div className="col-12 col-md-3">
                    <div className="text-muted">Disponibles (Acumuladas)</div>
                    <div className="fs-5 fw-bold">
                      {Number(saldo.Vacaciones_Disponibles_Total ?? 0)}
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="text-muted">A Derecho (Real)</div>
                    <div className="fs-5 fw-bold">
                      {Number(saldo.Vacaciones_a_Derecho_Real ?? 0)}
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="text-muted">Disfrutadas (Total)</div>
                    <div className="fs-5 fw-bold">
                      {Number(saldo.Vacaciones_Disfrutadas_Total ?? 0)}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-muted">Sin datos</div>
          )}

          {saldoWarnings?.mensajeAcumulado ? (
            <div className="alert alert-warning mt-3 mb-0">
              {saldoWarnings.mensajeAcumulado}
            </div>
          ) : null}

          {saldoWarnings?.vacacionesAcumuladas?.mensaje ? (
            <div className="alert alert-warning mt-3 mb-0">
              {saldoWarnings.vacacionesAcumuladas.mensaje}
            </div>
          ) : null}
        </div>
      </div>

      {mode === "solicitar" ? (
        <div className="card mb-3">
          <div className="card-header">Nueva solicitud</div>
          <div className="card-body">
            <form onSubmit={onSolicitar}>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label">Empleado</label>
                  <input className="form-control" value={empleadoSesionLabel} disabled />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label">Fecha Inicio</label>
                  <input
                    type="date"
                    className="form-control"
                    value={asInputDate(fechaInicio) || fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label">Fecha Fin</label>
                  <input
                    type="date"
                    className="form-control"
                    value={asInputDate(fechaFin) || fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>

                <div className="col-12 d-flex gap-2">
                  <button className="btn btn-primary" type="submit" disabled={loadingAction}>
                    {loadingAction ? "Enviando..." : "Solicitar"}
                  </button>
                  <button
                    className="btn btn-dark"
                    type="button"
                    onClick={() => {
                      setFechaInicio("");
                      setFechaFin("");
                      setError("");
                      setToast("");
                    }}
                    disabled={loadingAction}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span>Solicitudes</span>
          <div className="d-flex gap-2 align-items-center">
            {canAprobarRechazar ? (
              <>
                <select
                  className="form-select"
                  value={empleadoIdFiltroTabla}
                  onChange={(e) => setEmpleadoIdFiltroTabla(e.target.value)}
                  style={{ width: 260 }}
                >
                  <option value="">Todos los empleados</option>
                  {empleadosTabla.map((x) => (
                    <option key={x.id} value={String(x.id)}>
                      {x.nombre} (ID: {x.id})
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-outline-dark"
                  onClick={onAplicarEmpleadoTabla}
                  disabled={loading || loadingAction}
                >
                  Aplicar
                </button>
              </>
            ) : null}

            <select
              className="form-select"
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              style={{ width: 220 }}
            >
              <option value="PENDIENTE">Pendientes</option>
              <option value="APROBADO">Aprobadas</option>
              <option value="RECHAZADO">Rechazadas</option>
              <option value="TODAS">Todas</option>
            </select>

            {mode !== "solicitar" ? (
              <a className="btn btn-primary" href="/solicitudes/vacaciones">
                Solicitar vacaciones
              </a>
            ) : null}
          </div>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="p-3 text-muted">Cargando...</div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: 420, overflowY: "auto" }}>
                <table className="table mb-0">
                  <thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                    <tr>
                      {canVerIdVacaciones ? <th>ID</th> : null}
                      <th>Empleado</th>
                      {canVerEmpleadoId ? <th>Empleado ID</th> : null}
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Días</th>
                      <th>Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length ? (
                      pageItems.map((v) => (
                        <tr key={v.idVacaciones}>
                          {canVerIdVacaciones ? <td>{v.idVacaciones}</td> : null}
                          <td>{getEmpleadoDisplay(v)}</td>
                          {canVerEmpleadoId ? <td>{v?.Empleado_idEmpleado ?? "—"}</td> : null}
                          <td>{formatFecha(v.Fecha_Inicio)}</td>
                          <td>{formatFecha(v.Fecha_Fin)}</td>
                          <td>{Number(v.Vacaciones_Disfrutadas ?? 0)}</td>
                          <td>
                            <span className={badgeClassByEstado(v.EstadoDescripcion || v.Catalogo_Estado_idCatalogo_Estado)}>
                              {v.EstadoDescripcion || "—"}
                            </span>
                          </td>
                          <td className="text-end">
                            {canAprobarRechazar ? (
                              <div className="d-inline-flex gap-2">
                                <button
                                  className="btn btn-primary btn-sm"
                                  disabled={loadingAction}
                                  onClick={() => onAprobar(v.idVacaciones)}
                                >
                                  Aprobar
                                </button>
                                <button
                                  className="btn btn-dark btn-sm"
                                  disabled={loadingAction}
                                  onClick={() => onRechazar(v.idVacaciones)}
                                >
                                  Rechazar
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={colSpanNoData} className="text-muted p-3">
                          No hay solicitudes para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-2 d-flex align-items-center justify-content-between">
                <div className="text-muted small">
                  Mostrando {listaFiltrada.length ? start + 1 : 0}-{Math.min(end, listaFiltrada.length)} de {listaFiltrada.length}
                </div>

                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-dark btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    Anterior
                  </button>
                  <div className="text-muted small d-flex align-items-center">
                    Página {safePage} / {totalPages}
                  </div>
                  <button
                    className="btn btn-outline-dark btn-sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
