// frontend/src/pages/permisos/Permisos.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, Form, Modal, Row, Spinner, Badge, Alert } from "react-bootstrap";
import { DataGrid } from "@mui/x-data-grid";
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
  if (id === 2) return <Badge style={{ backgroundColor: "var(--dm-red)", color: "white" }}>Aprobado</Badge>;
  if (id === 3) return <Badge bg="danger">Rechazado</Badge>;
  return (
    <Badge bg="warning" text="dark">
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
    const empleadoId =
      payload?.empleadoId ?? payload?.Empleado_idEmpleado ?? payload?.idEmpleado ?? payload?.EmpleadoId ?? null;
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

  // ✅ NUEVO: planilla (mismo comportamiento que colaborador)
  const esPlanilla = roleLower === "personal de planilla" || roleLower.includes("planilla");

  // ✅ NUEVO: roles self-only
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

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 31 });

  const initDoneRef = useRef(false);

  const limpiarMensajes = useCallback(() => {
    setErrorMsg("");
    setOkMsg("");
  }, []);

  const cerrarCrear = useCallback(() => {
    setShowCrear(false);
  }, []);

  const abrirCrear = useCallback(() => {
    limpiarMensajes();

    // ✅ Colaborador/Planilla: empleado fijo
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
    // ✅ Colaborador/Planilla: cargar empleado "me"
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

      const nombre =
        emp?.nombreCompleto || emp?.nombre || (emp?.idEmpleado ? `Empleado ${emp.idEmpleado}` : "Empleado");
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
      // ✅ Colaborador/Planilla: no listar todos, solo su empleado
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

        // ✅ Colaborador/Planilla: NO mandar empleadoId (backend aplica scope)
        if (!esSelfOnly) {
          const empleadoIdEff = overrides.empleadoId ?? fEmpleadoId;
          if (empleadoIdEff) params.empleadoId = empleadoIdEff;
        }

        const lista = await listarPermisos(params);

        const mapped = (lista || []).map((r) => ({
          ...r,
          id: r?.idPermisos ?? r?.id ?? r?.Id ?? null,
        }));

        setPaginationModel((prev) => ({ ...prev, page: 0 }));
        setRows(mapped);

        if (mapped.length === 0) setOkMsg("No se encontraron permisos con los filtros seleccionados.");
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || err?.response?.data?.message || "Error cargando permisos");
      } finally {
        setLoading(false);
      }
    },
    [esSelfOnly, fEmpleadoId, fEstadoId, fFechaDesde, fFechaHasta, limpiarMensajes]
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

    // ✅ Colaborador/Planilla: empleado fijo desde miEmpleado
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
      if (Array.isArray(traslapes) && traslapes.length > 0) {
        setOkMsg("Permiso creado. Hay traslape con otros permisos.");
      } else {
        setOkMsg("Permiso creado correctamente");
      }

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

  const columns = useMemo(() => {
    const cols = [];

    if (esAdmin) {
      cols.push({ field: "idPermisos", headerName: "ID", flex: 0.6, minWidth: 90 });
    }

    // ✅ si es Admin y NO es self-only (colaborador/planilla), mostrar ID empleado
    if (esAdmin && !esSelfOnly) {
      cols.push({ field: "Empleado_idEmpleado", headerName: "Empleado ID", flex: 1, minWidth: 130 });
    }

    cols.push(
      {
        field: "Catalogo_Estado_idCatalogo_Estado",
        headerName: "Estado",
        flex: 1,
        minWidth: 140,
        renderCell: (p) => <EstadoBadge estadoId={p?.row?.Catalogo_Estado_idCatalogo_Estado} />,
      },
      {
        field: "Tipo_Permiso_idTipo_Permiso",
        headerName: "Tipo",
        flex: 1.2,
        minWidth: 160,
        renderCell: (p) => {
          const id = Number(p?.row?.Tipo_Permiso_idTipo_Permiso || 0);
          const t = tipos.find((x) => Number(x.id) === id);
          return t?.descripcion || String(id || "");
        },
      },
      { field: "Descripcion", headerName: "Descripción", flex: 2.2, minWidth: 260 },
      {
        field: "Fecha_Solicitud",
        headerName: "Solicitud",
        flex: 1.3,
        minWidth: 180,
        renderCell: (p) => formatFechaHora(p?.row?.Fecha_Solicitud),
      },
      {
        field: "Fecha_Inicio",
        headerName: "Inicio",
        flex: 1.3,
        minWidth: 180,
        renderCell: (p) => formatFechaHora(p?.row?.Fecha_Inicio),
      },
      {
        field: "Fecha_Fin",
        headerName: "Fin",
        flex: 1.3,
        minWidth: 180,
        renderCell: (p) => formatFechaHora(p?.row?.Fecha_Fin),
      }
    );

    if (esAdminOJefatura) {
      cols.push({
        field: "acciones",
        headerName: "Acciones",
        sortable: false,
        filterable: false,
        minWidth: 320,
        renderCell: (p) => {
          const row = p?.row;
          if (!row) return null;

          const id = row?.idPermisos ?? row?.id ?? null;
          const estado = Number(row?.Catalogo_Estado_idCatalogo_Estado || 0);
          const activo = !!row?.Activo;

          const esPendiente = estado === 1;
          const puedeAccionar = activo && esPendiente;

          return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" variant="success" disabled={!puedeAccionar || accionLoading} onClick={() => aprobar(id)}>
                Aprobar
              </Button>
              <Button size="sm" variant="danger" disabled={!puedeAccionar || accionLoading} onClick={() => rechazar(id)}>
                Rechazar
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={!activo || accionLoading}
                onClick={() => desactivar(id)}
              >
                Desactivar
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [tipos, aprobar, rechazar, desactivar, accionLoading, esSelfOnly, esAdminOJefatura, esAdmin]);

  // ✅ label para colaborador/planilla
  const empleadoLabelSelf = useMemo(() => {
    const nombre = miEmpleado?.nombreCompleto || miEmpleado?.nombre || "";
    if (nombre) return nombre;
    return "No asociado";
  }, [miEmpleado]);

  return (
    <div className="p-3">
      <Row className="mb-3 align-items-center">
        <Col>
          <h4 className="mb-0">Permisos</h4>
        </Col>
        <Col className="text-end d-flex justify-content-end gap-2">
          <Button variant="outline-secondary" onClick={aplicarMesActual} disabled={loading}>
            Mes actual
          </Button>
          <Button variant="primary" onClick={abrirCrear}>
            Nueva solicitud
          </Button>
        </Col>
      </Row>

      {errorMsg ? <Alert variant="danger">{errorMsg}</Alert> : null}
      {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}

      <div className="p-3 mb-3 border rounded bg-light">
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

          <Col xs={12} md="auto" className="mt-2 mt-md-0 d-flex gap-2">
            <Button onClick={cargar} disabled={loading}>
              {loading ? "Cargando..." : "Buscar"}
            </Button>
          </Col>
        </Row>
      </div>

      <div style={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[31, 62, 93]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          disableRowSelectionOnClick
          getRowId={(row) => row?.idPermisos ?? row?.id}
        />
      </div>

      <Modal show={showCrear} onHide={cerrarCrear} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Nueva solicitud de permiso</Modal.Title>
        </Modal.Header>

        <Modal.Body>
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
              <Form.Control
                value={cDescripcion}
                onChange={(e) => setCDescripcion(e.target.value)}
                placeholder="Ej: Permiso por cita médica"
              />
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
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarCrear} disabled={accionLoading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={crearPermisoFn} disabled={accionLoading}>
            {accionLoading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
