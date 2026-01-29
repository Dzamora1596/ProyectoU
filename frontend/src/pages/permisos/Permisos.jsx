// src/pages/permisos/Permisos.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import {
  aprobarPermiso,
  crearPermiso,
  desactivarPermiso,
  listarEmpleados,
  listarPermisos,
  listarTiposPermiso,
  obtenerMiEmpleado,
  rechazarPermiso,
} from "../../services/permisosService";

function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
}

function toYYYYMMDD(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth() + 1);
  const day = pad2(dt.getDate());
  return `${y}-${m}-${day}`;
}

function getMesActualRango() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { desde: toYYYYMMDD(inicio), hasta: toYYYYMMDD(fin) };
}

function isValidDateTime(value) {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function toMysqlDateTimeFromLocalInput(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.includes("T")) return s.replace("T", " ").slice(0, 16) + ":00";
  return s;
}

function formatFechaHora(v) {
  if (!v) return "—";
  const s = String(v).trim();

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s(\d{2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, hh, mm] = m;
    if (hh !== undefined && mm !== undefined) return `${d}/${mo}/${y} ${hh}:${mm}`;
    return `${d}/${mo}/${y}`;
  }

  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!m2) return s;

  const [, y, mo, d, hh, mm] = m2;
  if (hh !== undefined && mm !== undefined) return `${d}/${mo}/${y} ${hh}:${mm}`;
  return `${d}/${mo}/${y}`;
}

function normalizeEmpleadoRow(r) {
  const idEmpleado = r?.idEmpleado ?? r?.id ?? r?.IdEmpleado ?? r?.Empleado_idEmpleado ?? null;

  const nombre =
    r?.nombre ??
    r?.nombreCompleto ??
    r?.NombreCompleto ??
    r?.EmpleadoNombre ??
    r?.Nombre ??
    (idEmpleado ? `Empleado ${idEmpleado}` : "No registrado");

  return { idEmpleado: Number(idEmpleado), nombre: String(nombre) };
}

function EstadoBadge({ estadoId }) {
  const id = Number(estadoId || 0);
  if (id === 2)
    return (
      <Badge className="dm-pill bg-marenco-red text-white">
        Aprobado
      </Badge>
    );
  if (id === 3) return <Badge className="dm-pill bg-danger text-white">Rechazado</Badge>;
  return (
    <Badge className="dm-pill bg-warning text-dark">
      Pendiente
    </Badge>
  );
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
    const empleadoId = payload?.empleadoId ?? payload?.Empleado_idEmpleado ?? payload?.idEmpleado ?? payload?.EmpleadoId ?? null;
    const nombre = payload?.nombre ?? payload?.Nombre ?? payload?.NombreCompleto ?? payload?.nombreUsuario ?? "";

    const roleStr = String(role || "").trim();
    const empNum = Number(empleadoId);

    return {
      role: roleStr,
      empleadoId: Number.isFinite(empNum) && empNum > 0 ? empNum : null,
      nombre: String(nombre || "").trim(),
    };
  }

  return { role: "", empleadoId: null, nombre: "" };
}

export default function Permisos() {
  const auth = useMemo(() => getAuthContext(), []);
  const roleLower = String(auth?.role || "").toLowerCase();

  const esAdmin = roleLower === "admin";
  const esColaborador = roleLower === "colaborador";
  const esPlanilla = roleLower === "personal de planilla" || roleLower.includes("planilla");
  const esSelfOnly = esColaborador || esPlanilla;

  const esAdminOJefatura = roleLower === "admin" || roleLower === "jefatura";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [empleados, setEmpleados] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [fEmpleadoId, setFEmpleadoId] = useState("");
  const [fEstadoId, setFEstadoId] = useState("");
  const [fFechaDesde, setFFechaDesde] = useState("");
  const [fFechaHasta, setFFechaHasta] = useState("");

  const [showCrear, setShowCrear] = useState(false);
  const [accionLoading, setAccionLoading] = useState(false);

  const [cEmpleadoId, setCEmpleadoId] = useState("");
  const [cTipoId, setCTipoId] = useState("");
  const [cDescripcion, setCDescripcion] = useState("");
  const [cInicio, setCInicio] = useState("");
  const [cFin, setCFin] = useState("");

  const [miEmpleado, setMiEmpleado] = useState(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const initDoneRef = useRef(false);

  const PAGE_SIZE = 31;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("Fecha_Solicitud");
  const [sortDir, setSortDir] = useState("desc");

  const tableWrapRef = useRef(null);
  const resetTableScroll = useCallback(() => {
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, []);

  const limpiarMensajes = useCallback(() => {
    setErrorMsg("");
    setOkMsg("");
  }, []);

  const cerrarCrear = useCallback(() => {
    setShowCrear(false);
  }, []);

  const abrirCrear = useCallback(() => {
    limpiarMensajes();

    if (esSelfOnly) {
      const id = miEmpleado?.idEmpleado ? String(miEmpleado.idEmpleado) : "";
      setCEmpleadoId(id);
    } else {
      setCEmpleadoId(fEmpleadoId || "");
    }

    setCTipoId("");
    setCDescripcion("");
    setCInicio("");
    setCFin("");
    setShowCrear(true);
  }, [esSelfOnly, miEmpleado?.idEmpleado, fEmpleadoId, limpiarMensajes]);

  const cargarMiEmpleado = useCallback(async () => {
    if (!esSelfOnly) return;

    try {
      const emp = await obtenerMiEmpleado();

      if (!emp?.idEmpleado) {
        setMiEmpleado(null);
        setEmpleados([]);
        setFEmpleadoId("");
        setCEmpleadoId("");
        return;
      }

      const nombre = emp?.nombreCompleto || emp?.nombre || (emp?.idEmpleado ? `Empleado ${emp.idEmpleado}` : "Empleado");
      const row = { idEmpleado: Number(emp.idEmpleado), nombre: String(nombre) };

      setMiEmpleado(emp);
      setEmpleados([row]);

      setFEmpleadoId(String(row.idEmpleado));
      setCEmpleadoId(String(row.idEmpleado));
    } catch (err) {
      setMiEmpleado(null);
      setEmpleados([]);
      setFEmpleadoId("");
      setCEmpleadoId("");
      setErrorMsg(err?.response?.data?.mensaje || err?.response?.data?.message || "Error cargando mi empleado");
    }
  }, [esSelfOnly]);

  const cargarEmpleados = useCallback(async () => {
    try {
      if (esSelfOnly) {
        await cargarMiEmpleado();
        return;
      }

      const lista = await listarEmpleados();
      const mapped = (lista || [])
        .map(normalizeEmpleadoRow)
        .filter((x) => x.idEmpleado && !Number.isNaN(x.idEmpleado))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setEmpleados(mapped);
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error cargando empleados");
    }
  }, [esSelfOnly, cargarMiEmpleado]);

  const cargarTiposPermiso = useCallback(async () => {
    try {
      const mapped = await listarTiposPermiso();
      setTipos(Array.isArray(mapped) ? mapped : []);
    } catch {
      setTipos([]);
    }
  }, []);

  const cargarConOverrides = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      limpiarMensajes();

      try {
        const params = {};

        const estadoIdEff = overrides.estadoId ?? fEstadoId;
        const desdeEff = overrides.desde ?? fFechaDesde;
        const hastaEff = overrides.hasta ?? fFechaHasta;

        if (estadoIdEff) params.estadoId = estadoIdEff;
        if (desdeEff) params.desde = desdeEff;
        if (hastaEff) params.hasta = hastaEff;

        if (!esSelfOnly) {
          const empleadoIdEff = overrides.empleadoId ?? fEmpleadoId;
          if (empleadoIdEff) params.empleadoId = empleadoIdEff;
        }

        const lista = await listarPermisos(params);
        const mapped = (lista || []).map((r) => ({
          ...r,
          id: r?.idPermisos ?? r?.id ?? r?.Id ?? null,
        }));

        setRows(mapped);
        setPage(1);
        resetTableScroll();

        if (mapped.length === 0) setOkMsg("No se encontraron permisos con los filtros seleccionados.");
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || err?.response?.data?.message || "Error cargando permisos");
      } finally {
        setLoading(false);
      }
    },
    [esSelfOnly, fEmpleadoId, fEstadoId, fFechaDesde, fFechaHasta, limpiarMensajes, resetTableScroll]
  );

  const cargar = useCallback(async () => {
    return cargarConOverrides({});
  }, [cargarConOverrides]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    (async () => {
      await Promise.all([cargarEmpleados(), cargarTiposPermiso()]);

      const r = getMesActualRango();
      setFFechaDesde(r.desde);
      setFFechaHasta(r.hasta);

      await cargarConOverrides({ desde: r.desde, hasta: r.hasta });
    })();
  }, [cargarEmpleados, cargarTiposPermiso, cargarConOverrides]);

  const crearPermisoFn = useCallback(async () => {
    limpiarMensajes();

    const tipo = Number(cTipoId || 0);
    const desc = String(cDescripcion || "").trim();
    const iniLocal = String(cInicio || "").trim();
    const finLocal = String(cFin || "").trim();

    const emp = esSelfOnly ? Number(miEmpleado?.idEmpleado || 0) : Number(cEmpleadoId || 0);

    if (!emp || !tipo || !desc || !iniLocal || !finLocal) {
      setErrorMsg("Debe completar: Empleado, Tipo, Descripción, Fecha Inicio y Fecha Fin");
      return;
    }

    const iniMysql = toMysqlDateTimeFromLocalInput(iniLocal);
    const finMysql = toMysqlDateTimeFromLocalInput(finLocal);

    if (!isValidDateTime(iniMysql) || !isValidDateTime(finMysql)) {
      setErrorMsg("Fecha Inicio o Fecha Fin inválidas");
      return;
    }

    if (new Date(finMysql).getTime() < new Date(iniMysql).getTime()) {
      setErrorMsg("Fecha Fin no puede ser menor a Fecha Inicio");
      return;
    }

    setAccionLoading(true);
    try {
      const body = {
        Empleado_idEmpleado: emp,
        Descripcion: desc,
        Fecha_Inicio: iniMysql,
        Fecha_Fin: finMysql,
        Tipo_Permiso_idTipo_Permiso: tipo,
      };

      const data = await crearPermiso(body);

      const traslapes = data?.warnings?.traslapes;
      if (Array.isArray(traslapes) && traslapes.length > 0) setOkMsg("Permiso creado. Hay traslape con otros permisos.");
      else setOkMsg("Permiso creado correctamente");

      setShowCrear(false);
      await cargar();
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message ||
          err?.response?.data?.mensaje ||
          err?.response?.data?.error ||
          "Error creando permiso"
      );
    } finally {
      setAccionLoading(false);
    }
  }, [esSelfOnly, miEmpleado?.idEmpleado, cEmpleadoId, cTipoId, cDescripcion, cInicio, cFin, limpiarMensajes, cargar]);

  const aprobar = useCallback(
    async (id) => {
      if (!id) return;
      setAccionLoading(true);
      limpiarMensajes();
      try {
        await aprobarPermiso(id);
        setOkMsg("Permiso aprobado");
        await cargar();
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || err?.response?.data?.message || "Error aprobando permiso");
      } finally {
        setAccionLoading(false);
      }
    },
    [cargar, limpiarMensajes]
  );

  const rechazar = useCallback(
    async (id) => {
      if (!id) return;
      setAccionLoading(true);
      limpiarMensajes();
      try {
        await rechazarPermiso(id);
        setOkMsg("Permiso rechazado");
        await cargar();
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || err?.response?.data?.message || "Error rechazando permiso");
      } finally {
        setAccionLoading(false);
      }
    },
    [cargar, limpiarMensajes]
  );

  const desactivar = useCallback(
    async (id) => {
      if (!id) return;
      setAccionLoading(true);
      limpiarMensajes();
      try {
        await desactivarPermiso(id);
        setOkMsg("Permiso desactivado");
        await cargar();
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || err?.response?.data?.message || "Error desactivando permiso");
      } finally {
        setAccionLoading(false);
      }
    },
    [cargar, limpiarMensajes]
  );

  const aplicarMesActual = useCallback(async () => {
    const r = getMesActualRango();
    setFFechaDesde(r.desde);
    setFFechaHasta(r.hasta);
    await cargarConOverrides({ desde: r.desde, hasta: r.hasta });
  }, [cargarConOverrides]);

  const empleadoLabelSelf = useMemo(() => {
    const nombre = miEmpleado?.nombreCompleto || miEmpleado?.nombre || "";
    if (nombre) return nombre;
    return "No asociado";
  }, [miEmpleado]);

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

  const sortedRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows.slice() : [];

    const asNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const asTime = (v) => {
      if (!v) return null;
      const t = Date.parse(String(v).replace(" ", "T"));
      return Number.isFinite(t) ? t : null;
    };

    const getter = (r) => {
      if (sortKey === "Estado") return asNumber(r?.Catalogo_Estado_idCatalogo_Estado) ?? 0;
      if (sortKey === "Tipo") return String(r?.Tipo_Permiso_idTipo_Permiso ?? "").toLowerCase();
      if (sortKey === "Descripcion") return String(r?.Descripcion ?? "").toLowerCase();
      if (sortKey === "Fecha_Solicitud") return asTime(r?.Fecha_Solicitud) ?? 0;
      if (sortKey === "Fecha_Inicio") return asTime(r?.Fecha_Inicio) ?? 0;
      if (sortKey === "Fecha_Fin") return asTime(r?.Fecha_Fin) ?? 0;
      if (sortKey === "Empleado") return asNumber(r?.Empleado_idEmpleado) ?? 0;
      if (sortKey === "ID") return asNumber(r?.idPermisos ?? r?.id) ?? 0;
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
  }, [rows, sortKey, sortDir]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((sortedRows.length || 0) / PAGE_SIZE);
    return n > 0 ? n : 1;
  }, [sortedRows.length]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const goToPage = useCallback(
    (p) => {
      const next = Math.max(1, Math.min(totalPages, Number(p || 1)));
      setPage(next);
      resetTableScroll();
    },
    [totalPages, resetTableScroll]
  );

  const colSpanEmpty = (esAdmin ? 1 : 0) + (esAdmin && !esSelfOnly ? 1 : 0) + 6 + (esAdminOJefatura ? 1 : 0);

  return (
    <div className="container-fluid p-0">
      <div className="card">
        <div className="card-body">
          <Row className="g-2 align-items-center">
            <Col xs={12} md>
              <h4 className="mb-0 text-marenco-red">Permisos</h4>
              <div className="text-muted small">Gestión de permisos.</div>
            </Col>
            <Col xs={12} md="auto" className="d-grid d-md-block">
              <div className="d-flex flex-column flex-md-row gap-2">
                <Button variant="outline-secondary" className="dm-btn-outline-red" onClick={aplicarMesActual} disabled={loading}>
                  Mes actual
                </Button>
                <Button variant="primary" onClick={abrirCrear}>
                  Nueva solicitud
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {(errorMsg || okMsg) && (
        <div className="mt-3">
          {errorMsg ? (
            <Alert variant="danger" className="dm-alert-accent mb-2">
              {errorMsg}
            </Alert>
          ) : null}
          {okMsg ? (
            <Alert variant="success" className="dm-alert-accent mb-0">
              {okMsg}
            </Alert>
          ) : null}
        </div>
      )}

      <div className="card mt-3">
        <div className="card-body">
          <Row className="g-2 align-items-end">
            {!esSelfOnly ? (
              <Col xs={12} md={4}>
                <Form.Label>Empleado</Form.Label>
                <Form.Select value={fEmpleadoId} onChange={(e) => setFEmpleadoId(e.target.value)}>
                  <option value="">Todos</option>
                  {empleados.map((emp) => (
                    <option key={emp.idEmpleado} value={emp.idEmpleado}>
                      {esAdmin ? `${emp.nombre} (ID: ${emp.idEmpleado})` : emp.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            ) : (
              <Col xs={12} md={4}>
                <Form.Label>Empleado</Form.Label>
                <Form.Control value={empleadoLabelSelf} disabled />
              </Col>
            )}

            <Col xs={12} md={3}>
              <Form.Label>Estado</Form.Label>
              <Form.Select value={fEstadoId} onChange={(e) => setFEstadoId(e.target.value)}>
                <option value="">Todos</option>
                <option value="1">Pendiente</option>
                <option value="2">Aprobado</option>
                <option value="3">Rechazado</option>
              </Form.Select>
            </Col>

            <Col xs={6} md={2}>
              <Form.Label>Desde (Solicitud)</Form.Label>
              <Form.Control type="date" value={fFechaDesde} onChange={(e) => setFFechaDesde(e.target.value)} />
            </Col>

            <Col xs={6} md={2}>
              <Form.Label>Hasta (Solicitud)</Form.Label>
              <Form.Control type="date" value={fFechaHasta} onChange={(e) => setFFechaHasta(e.target.value)} />
            </Col>

            <Col xs={12} md="auto" className="d-grid">
              <Button variant="primary" onClick={cargar} disabled={loading}>
                {loading ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner size="sm" />
                    Cargando…
                  </span>
                ) : (
                  "Buscar"
                )}
              </Button>
            </Col>
          </Row>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          <div ref={tableWrapRef} className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  {esAdmin ? (
                    <th style={{ width: 90 }} role="button" className="text-nowrap" onClick={() => toggleSort("ID")}>
                      ID <span className="text-muted ms-1">{sortIcon("ID")}</span>
                    </th>
                  ) : null}

                  {esAdmin && !esSelfOnly ? (
                    <th style={{ width: 130 }} role="button" className="text-nowrap" onClick={() => toggleSort("Empleado")}>
                      Empleado ID <span className="text-muted ms-1">{sortIcon("Empleado")}</span>
                    </th>
                  ) : null}

                  <th style={{ width: 140 }} role="button" className="text-nowrap" onClick={() => toggleSort("Estado")}>
                    Estado <span className="text-muted ms-1">{sortIcon("Estado")}</span>
                  </th>

                  <th style={{ width: 170 }} role="button" className="text-nowrap" onClick={() => toggleSort("Tipo")}>
                    Tipo <span className="text-muted ms-1">{sortIcon("Tipo")}</span>
                  </th>

                  <th role="button" className="text-nowrap" onClick={() => toggleSort("Descripcion")}>
                    Descripción <span className="text-muted ms-1">{sortIcon("Descripcion")}</span>
                  </th>

                  <th style={{ width: 180 }} role="button" className="text-nowrap" onClick={() => toggleSort("Fecha_Solicitud")}>
                    Solicitud <span className="text-muted ms-1">{sortIcon("Fecha_Solicitud")}</span>
                  </th>

                  <th style={{ width: 180 }} role="button" className="text-nowrap" onClick={() => toggleSort("Fecha_Inicio")}>
                    Inicio <span className="text-muted ms-1">{sortIcon("Fecha_Inicio")}</span>
                  </th>

                  <th style={{ width: 180 }} role="button" className="text-nowrap" onClick={() => toggleSort("Fecha_Fin")}>
                    Fin <span className="text-muted ms-1">{sortIcon("Fecha_Fin")}</span>
                  </th>

                  {esAdminOJefatura ? (
                    <th style={{ width: 320 }} className="text-nowrap">
                      Acciones
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {!loading && pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpanEmpty} className="text-center py-4 text-muted">
                      Sin resultados
                    </td>
                  </tr>
                ) : null}

                {pagedRows.map((row) => {
                  const id = row?.idPermisos ?? row?.id ?? null;
                  const estado = Number(row?.Catalogo_Estado_idCatalogo_Estado || 0);
                  const activoRow = !!row?.Activo;

                  const esPendiente = estado === 1;
                  const puedeAccionar = activoRow && esPendiente;

                  const tipoId = Number(row?.Tipo_Permiso_idTipo_Permiso || 0);
                  const tipo = tipos.find((x) => Number(x.id) === tipoId);
                  const tipoTxt = tipo?.descripcion || String(tipoId || "");

                  return (
                    <tr key={id ?? `${row?.Empleado_idEmpleado}-${row?.Fecha_Solicitud}-${row?.Fecha_Inicio}`}>
                      {esAdmin ? <td className="text-nowrap">{row?.idPermisos}</td> : null}
                      {esAdmin && !esSelfOnly ? <td className="text-nowrap">{row?.Empleado_idEmpleado}</td> : null}

                      <td className="text-nowrap">
                        <EstadoBadge estadoId={row?.Catalogo_Estado_idCatalogo_Estado} />
                      </td>

                      <td className="text-nowrap">{tipoTxt}</td>

                      <td style={{ minWidth: 260 }}>{row?.Descripcion}</td>

                      <td className="text-nowrap">{formatFechaHora(row?.Fecha_Solicitud)}</td>
                      <td className="text-nowrap">{formatFechaHora(row?.Fecha_Inicio)}</td>
                      <td className="text-nowrap">{formatFechaHora(row?.Fecha_Fin)}</td>

                      {esAdminOJefatura ? (
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <Button size="sm" variant="primary" disabled={!puedeAccionar || accionLoading} onClick={() => aprobar(id)}>
                              Aprobar
                            </Button>

                            <Button size="sm" variant="danger" disabled={!puedeAccionar || accionLoading} onClick={() => rechazar(id)}>
                              Rechazar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-secondary"
                              className="dm-btn-outline-red"
                              disabled={!activoRow || accionLoading}
                              onClick={() => desactivar(id)}
                            >
                              Desactivar
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-top">
            <div className="text-muted small">
              {loading ? "Cargando..." : `${sortedRows.length} permiso(s) • Página ${page} de ${totalPages} • Mostrando ${PAGE_SIZE} por página`}
            </div>

            <div className="d-flex align-items-center gap-2">
              <Button size="sm" variant="outline-secondary" className="dm-btn-outline-red" onClick={() => goToPage(page - 1)} disabled={loading || page <= 1}>
                Anterior
              </Button>

              <Form.Select size="sm" value={page} onChange={(e) => goToPage(e.target.value)} disabled={loading} style={{ width: 130, height: 36 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    Página {p}
                  </option>
                ))}
              </Form.Select>

              <Button size="sm" variant="outline-secondary" className="dm-btn-outline-red" onClick={() => goToPage(page + 1)} disabled={loading || page >= totalPages}>
                Siguiente
              </Button>
            </div>

            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner size="sm" />
                <span className="small">Procesando…</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal show={showCrear} onHide={cerrarCrear} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Nueva solicitud de permiso</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="dm-surface p-3">
            <Row className="g-3">
              <Col xs={12} md={6}>
                <Form.Label>Empleado</Form.Label>

                {esSelfOnly ? (
                  <Form.Control value={empleadoLabelSelf} disabled />
                ) : (
                  <Form.Select value={cEmpleadoId} onChange={(e) => setCEmpleadoId(e.target.value)}>
                    <option value="">Seleccione...</option>
                    {empleados.map((emp) => (
                      <option key={emp.idEmpleado} value={emp.idEmpleado}>
                        {esAdmin ? `${emp.nombre} (ID: ${emp.idEmpleado})` : emp.nombre}
                      </option>
                    ))}
                  </Form.Select>
                )}
              </Col>

              <Col xs={12} md={6}>
                <Form.Label>Tipo de permiso</Form.Label>
                <Form.Select value={cTipoId} onChange={(e) => setCTipoId(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {tipos
                    .filter((t) => Number(t.activo ?? 1) === 1)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.descripcion}
                      </option>
                    ))}
                </Form.Select>
              </Col>

              <Col xs={12}>
                <Form.Label>Descripción</Form.Label>
                <Form.Control value={cDescripcion} onChange={(e) => setCDescripcion(e.target.value)} placeholder="Ej: Permiso por cita médica" />
              </Col>

              <Col xs={12} md={6}>
                <Form.Label>Fecha inicio</Form.Label>
                <Form.Control type="datetime-local" value={cInicio} onChange={(e) => setCInicio(e.target.value)} />
              </Col>

              <Col xs={12} md={6}>
                <Form.Label>Fecha fin</Form.Label>
                <Form.Control type="datetime-local" value={cFin} onChange={(e) => setCFin(e.target.value)} />
              </Col>
            </Row>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="dark" onClick={cerrarCrear} disabled={accionLoading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={crearPermisoFn} disabled={accionLoading}>
            {accionLoading ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner size="sm" />
                Guardando...
              </span>
            ) : (
              "Guardar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
