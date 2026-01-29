// frontend/src/pages/planilla/HorasExtra.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { obtenerCatalogosEstadosPorModulo } from "@/services/catalogosService";
import { calcularHorasExtra, listarHorasExtra, cambiarEstadoHoraExtra } from "@/services/horasExtraService";

function pad2(n) {
  return String(Number(n || 0)).padStart(2, "0");
}

function ymd(v) {
  if (!v) return "";

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }

  const s = String(v).trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo}-${d}`;
  }

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function parseYmd(s) {
  const str = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return safeJsonParse(json);
  } catch {
    return null;
  }
}

function getAuthContext() {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const payload = token ? decodeJwtPayload(token) : null;

  if (payload && typeof payload === "object") {
    const role = payload?.rolNombre ?? payload?.rol ?? payload?.role ?? payload?.Rol ?? "";
    const roleStr = String(role || "").trim();
    return { role: roleStr };
  }

  return { role: "" };
}

function formatFechaDDMMYYYY(v) {
  const s = String(v || "").trim();
  if (!s) return "—";
  const only = s.slice(0, 10);
  const m = only.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return only;
}

function formatMoneyUSD(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function EstadoPill({ estado }) {
  const e = String(estado || "").toUpperCase();
  const className =
    e === "APROBADO" ? "bg-success text-white" : e === "RECHAZADO" ? "bg-marenco-red text-white" : "bg-warning text-dark";

  return (
    <Badge className={["dm-pill", className].join(" ")}>
      {estado || "—"}
    </Badge>
  );
}

export default function HorasExtra() {
  const auth = useMemo(() => getAuthContext(), []);
  const roleLower = String(auth?.role || "").toLowerCase();

  const esAdmin = roleLower === "admin";
  const esJefatura = roleLower === "jefatura";
  const esPlanilla = roleLower === "personal de planilla";

  const puedeVer = esAdmin || esJefatura || esPlanilla;
  const puedeAprobarRechazar = esAdmin || esJefatura;
  const puedeEjecutarCalculo = esAdmin || esPlanilla;

  const [estadosHoraExtra, setEstadosHoraExtra] = useState([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const PAGE_SIZE = 31;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("Fecha");
  const [sortDir, setSortDir] = useState("desc");

  const tableWrapRef = useRef(null);
  const resetTableScroll = useCallback(() => {
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, []);

  const goToPage = useCallback(
    (p, total) => {
      const next = Math.max(1, Math.min(total || 1, Number(p || 1)));
      setPage(next);
      resetTableScroll();
    },
    [resetTableScroll]
  );

  const toggleSort = useCallback(
    (key) => {
      setPage(1);
      resetTableScroll();
      setSortKey((prevKey) => {
        if (prevKey !== key) {
          setSortDir("asc");
          return key;
        }
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      });
    },
    [resetTableScroll]
  );

  const sortIcon = useCallback(
    (key) => {
      if (sortKey !== key) return "↕";
      return sortDir === "asc" ? "↑" : "↓";
    },
    [sortKey, sortDir]
  );

  useEffect(() => {
    const now = new Date();
    setDesde(ymd(startOfMonth(now)));
    setHasta(ymd(endOfMonth(now)));
  }, []);

  useEffect(() => {
    if (!puedeVer) return;

    (async () => {
      try {
        const res = await obtenerCatalogosEstadosPorModulo({ modulo: "HORA_EXTRA" });
        setEstadosHoraExtra(res?.estados || []);
      } catch {
        setError("Error cargando estados de horas extra");
      }
    })();
  }, [puedeVer]);

  const rangoValido = useMemo(() => {
    const d = parseYmd(desde);
    const h = parseYmd(hasta);
    return !!(d && h && d <= h);
  }, [desde, hasta]);

  const datosFiltrados = useMemo(() => {
    if (!busqueda) return datos;
    const b = busqueda.toLowerCase();
    return (datos || []).filter((d) => String(d.EmpleadoNombre || "").toLowerCase().includes(b));
  }, [datos, busqueda]);

  const estadoAprobadoId = useMemo(() => {
    const f = (estadosHoraExtra || []).find((x) => String(x.descripcion || "").toUpperCase() === "APROBADO");
    return f ? Number(f.id) : 0;
  }, [estadosHoraExtra]);

  const estadoRechazadoId = useMemo(() => {
    const f = (estadosHoraExtra || []).find((x) => String(x.descripcion || "").toUpperCase() === "RECHAZADO");
    return f ? Number(f.id) : 0;
  }, [estadosHoraExtra]);

  const cargarListado = useCallback(
    async (d = desde, h = hasta) => {
      if (!puedeVer) return;

      setCargando(true);
      setError("");
      try {
        const r = await listarHorasExtra({ desde: ymd(d), hasta: ymd(h) });
        setDatos(Array.isArray(r) ? r : []);
        setPage(1);
        resetTableScroll();
      } catch {
        setError("Error cargando horas extra");
        setDatos([]);
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta, puedeVer, resetTableScroll]
  );

  const configurarMesActual = useCallback(() => {
    const now = new Date();
    const d = ymd(startOfMonth(now));
    const h = ymd(endOfMonth(now));
    setDesde(d);
    setHasta(h);
    cargarListado(d, h);
  }, [cargarListado]);

  const configurarMesAnterior = useCallback(() => {
    const now = new Date();
    const fechaMesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const d = ymd(startOfMonth(fechaMesPasado));
    const h = ymd(endOfMonth(fechaMesPasado));
    setDesde(d);
    setHasta(h);
    cargarListado(d, h);
  }, [cargarListado]);

  const ejecutarCalculo = useCallback(async () => {
    if (!puedeEjecutarCalculo) return;

    setCargando(true);
    setError("");
    setMensaje("");
    try {
      const r = await calcularHorasExtra({ desde: ymd(desde), hasta: ymd(hasta) });
      setMensaje(`Cálculo ejecutado. Registros creados: ${r?.totalInsertadas || 0}`);
      await cargarListado();
    } catch {
      setError("Error calculando horas extra");
    } finally {
      setCargando(false);
    }
  }, [puedeEjecutarCalculo, desde, hasta, cargarListado]);

  const actualizarEstado = useCallback(
    async (idExtra, estadoId) => {
      if (!puedeAprobarRechazar) return;

      setCargando(true);
      setError("");
      setMensaje("");
      try {
        await cambiarEstadoHoraExtra(idExtra, estadoId);
        await cargarListado();
      } catch {
        setError("Error actualizando estado");
      } finally {
        setCargando(false);
      }
    },
    [puedeAprobarRechazar, cargarListado]
  );

  useEffect(() => {
    if (!puedeVer) return;
    if (!rangoValido) return;
    if (!desde || !hasta) return;
    cargarListado(desde, hasta);
  }, [puedeVer, rangoValido, desde, hasta, cargarListado]);

  const sortedRows = useMemo(() => {
    const list = Array.isArray(datosFiltrados) ? datosFiltrados.slice() : [];

    const asLower = (v) => String(v ?? "").toLowerCase();
    const asNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const asDate = (v) => {
      const s = String(v ?? "").slice(0, 10);
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : 0;
    };

    const getter = (r) => {
      if (sortKey === "Empleado") return asLower(r?.EmpleadoNombre);
      if (sortKey === "Fecha") return asDate(r?.Fecha);
      if (sortKey === "Horario") return asLower(`${r?.Hora_Inicio || ""}-${r?.Hora_Final || ""}`);
      if (sortKey === "Cantidad") return asNumber(r?.Cantidad);
      if (sortKey === "Monto") return asNumber(r?.Monto);
      if (sortKey === "Tipo") return asLower(r?.TipoHoraExtra);
      if (sortKey === "Estado") return asLower(r?.Estado);
      return 0;
    };

    list.sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);

      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;

      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return list;
  }, [datosFiltrados, sortKey, sortDir]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((sortedRows.length || 0) / PAGE_SIZE);
    return n > 0 ? n : 1;
  }, [sortedRows.length]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  if (!puedeVer) {
    return (
      <div className="container-fluid p-0">
        <div className="card">
          <div className="card-body">
            <Alert variant="danger" className="dm-alert-accent mb-0">
              No tiene permisos para acceder a Horas Extra.
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0">
      <div className="card">
        <div className="card-body">
          <Row className="g-2 align-items-center">
            <Col xs={12} md>
              <h4 className="mb-0 text-marenco-red">Horas extra</h4>
              <div className="text-muted small">Gestión de horas extra.</div>
            </Col>
            <Col xs={12} md="auto">
              <Badge bg="dark" className="dm-pill">
                Módulo Planilla
              </Badge>
            </Col>
          </Row>
        </div>
      </div>

      {(error || mensaje) && (
        <div className="mt-3">
          {error ? (
            <Alert variant="danger" className="dm-alert-accent mb-2" dismissible onClose={() => setError("")}>
              {error}
            </Alert>
          ) : null}
          {mensaje ? (
            <Alert variant="success" className="dm-alert-accent mb-0" dismissible onClose={() => setMensaje("")}>
              {mensaje}
            </Alert>
          ) : null}
        </div>
      )}

      <div className="card mt-3">
        <div className="card-body">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={3}>
              <Form.Label>Desde</Form.Label>
              <Form.Control type="date" value={desde} onChange={(e) => setDesde(ymd(e.target.value))} />
            </Col>

            <Col xs={12} md={3}>
              <Form.Label>Hasta</Form.Label>
              <Form.Control type="date" value={hasta} onChange={(e) => setHasta(ymd(e.target.value))} />
            </Col>

            <Col xs={12} md={6} className="d-flex flex-column flex-md-row justify-content-md-end gap-2">
              <Button variant="primary" disabled={!rangoValido || cargando} onClick={() => cargarListado()}>
                {cargando ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner size="sm" />
                    Cargando…
                  </span>
                ) : (
                  "Buscar"
                )}
              </Button>

              {puedeEjecutarCalculo ? (
                <Button variant="outline-secondary" className="dm-btn-outline-red" disabled={!rangoValido || cargando} onClick={ejecutarCalculo}>
                  {cargando ? (
                    <span className="d-inline-flex align-items-center gap-2">
                      <Spinner size="sm" />
                      Procesando…
                    </span>
                  ) : (
                    "Ejecutar cálculo"
                  )}
                </Button>
              ) : null}
            </Col>
          </Row>

          <Row className="g-2 align-items-center mt-3">
            <Col xs={12} md={6} className="d-flex flex-wrap align-items-center gap-2">
              <span className="text-muted small">Rangos rápidos:</span>
              <ButtonGroup size="sm">
                <Button variant="outline-secondary" className="dm-btn-outline-red" onClick={configurarMesActual} disabled={cargando}>
                  Mes actual
                </Button>
                <Button variant="outline-secondary" className="dm-btn-outline-red" onClick={configurarMesAnterior} disabled={cargando}>
                  Mes anterior
                </Button>
              </ButtonGroup>
            </Col>

            <Col xs={12} md={6}>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-white">
                  <i className="bi bi-search" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Filtrar por nombre de empleado…"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPage(1);
                    resetTableScroll();
                  }}
                />
                {busqueda ? (
                  <Button variant="outline-secondary" className="dm-btn-outline-red" onClick={() => setBusqueda("")} disabled={cargando}>
                    Limpiar
                  </Button>
                ) : null}
              </InputGroup>
            </Col>
          </Row>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          <div ref={tableWrapRef} className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <Table hover className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th role="button" className="text-nowrap" onClick={() => toggleSort("Empleado")} style={{ cursor: "pointer" }}>
                    Empleado <span className="text-muted ms-1">{sortIcon("Empleado")}</span>
                  </th>
                  <th role="button" className="text-nowrap" onClick={() => toggleSort("Fecha")} style={{ width: 130, cursor: "pointer" }}>
                    Fecha <span className="text-muted ms-1">{sortIcon("Fecha")}</span>
                  </th>
                  <th role="button" className="text-nowrap" onClick={() => toggleSort("Horario")} style={{ width: 170, cursor: "pointer" }}>
                    Horario <span className="text-muted ms-1">{sortIcon("Horario")}</span>
                  </th>
                  <th role="button" className="text-nowrap text-center" onClick={() => toggleSort("Cantidad")} style={{ width: 120, cursor: "pointer" }}>
                    Cant. <span className="text-muted ms-1">{sortIcon("Cantidad")}</span>
                  </th>
                  <th role="button" className="text-nowrap text-end" onClick={() => toggleSort("Monto")} style={{ width: 140, cursor: "pointer" }}>
                    Monto <span className="text-muted ms-1">{sortIcon("Monto")}</span>
                  </th>
                  <th role="button" className="text-nowrap" onClick={() => toggleSort("Tipo")} style={{ width: 160, cursor: "pointer" }}>
                    Tipo <span className="text-muted ms-1">{sortIcon("Tipo")}</span>
                  </th>
                  <th role="button" className="text-nowrap text-center" onClick={() => toggleSort("Estado")} style={{ width: 150, cursor: "pointer" }}>
                    Estado <span className="text-muted ms-1">{sortIcon("Estado")}</span>
                  </th>
                  {puedeAprobarRechazar ? (
                    <th className="text-nowrap text-center" style={{ width: 240 }}>
                      Acciones
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {!cargando && pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={puedeAprobarRechazar ? 8 : 7} className="text-center py-4 text-muted">
                      {busqueda ? `No se encontraron resultados para "${busqueda}"` : "No hay registros en este periodo"}
                    </td>
                  </tr>
                ) : null}

                {cargando && pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={puedeAprobarRechazar ? 8 : 7} className="text-center py-4 text-muted">
                      <div className="d-inline-flex align-items-center gap-2">
                        <Spinner size="sm" />
                        <span>Procesando…</span>
                      </div>
                    </td>
                  </tr>
                ) : null}

                {pagedRows.map((d) => {
                  const estadoUpper = String(d?.Estado || "").toUpperCase();
                  const disabledAprobar = !estadoAprobadoId || estadoUpper === "APROBADO" || cargando;
                  const disabledRechazar = !estadoRechazadoId || estadoUpper === "RECHAZADO" || cargando;

                  return (
                    <tr key={d.idExtra}>
                      <td className="fw-semibold" style={{ minWidth: 240 }}>
                        {d.EmpleadoNombre}
                      </td>
                      <td className="text-nowrap">{formatFechaDDMMYYYY(d.Fecha)}</td>
                      <td className="text-nowrap">
                        <span className="text-muted small">
                          {d.Hora_Inicio} - {d.Hora_Final}
                        </span>
                      </td>
                      <td className="text-center text-nowrap fw-semibold">{Number(d.Cantidad || 0)}h</td>
                      <td className="text-end text-nowrap fw-bold">{formatMoneyUSD(d.Monto)}</td>
                      <td className="text-nowrap">
                        <Badge bg="light" text="dark" className="border fw-normal text-uppercase">
                          {d.TipoHoraExtra}
                        </Badge>
                      </td>
                      <td className="text-center text-nowrap">
                        <EstadoPill estado={d.Estado} />
                      </td>

                      {puedeAprobarRechazar ? (
                        <td className="text-center">
                          <ButtonGroup size="sm">
                            <Button variant="primary" className="px-3" disabled={disabledAprobar} onClick={() => actualizarEstado(d.idExtra, estadoAprobadoId)}>
                              Aprobar
                            </Button>
                            <Button variant="danger" className="px-3" disabled={disabledRechazar} onClick={() => actualizarEstado(d.idExtra, estadoRechazadoId)}>
                              Rechazar
                            </Button>
                          </ButtonGroup>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-top">
            <div className="text-muted small">
              {cargando ? "Cargando..." : `${sortedRows.length} registro(s) • Página ${page} de ${totalPages} • Mostrando ${PAGE_SIZE} por página`}
            </div>

            <div className="d-flex align-items-center gap-2">
              <Button size="sm" variant="outline-secondary" className="dm-btn-outline-red" onClick={() => goToPage(page - 1, totalPages)} disabled={cargando || page <= 1}>
                Anterior
              </Button>

              <Form.Select size="sm" value={page} onChange={(e) => goToPage(e.target.value, totalPages)} disabled={cargando} style={{ width: 130, height: 36 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    Página {p}
                  </option>
                ))}
              </Form.Select>

              <Button size="sm" variant="outline-secondary" className="dm-btn-outline-red" onClick={() => goToPage(page + 1, totalPages)} disabled={cargando || page >= totalPages}>
                Siguiente
              </Button>
            </div>

            {cargando ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner size="sm" />
                <span className="small">Procesando…</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
