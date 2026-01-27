// frontend/src/pages/planilla/Incapacidades.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import api from "../../api/axios";
import {
  listarIncapacidades,
  obtenerIncapacidad,
  crearIncapacidad,
  subirArchivoIncapacidad,
  validarIncapacidad,
  rechazarIncapacidad,
} from "../../services/incapacidadesService";

function normalizarRol(user) {
  return String(user?.rolNombre || user?.rol || user?.nombreRol || "")
    .toLowerCase()
    .trim();
}

function esRolPlanilla(user) {
  const rol = normalizarRol(user);
  return rol.includes("planilla");
}

function puedeValidar(user) {
  const rol = normalizarRol(user);
  return rol === "admin" || rol === "jefatura";
}

function puedeCrearYSubir(user) {
  const rol = normalizarRol(user);
  return (
    rol === "colaborador" ||
    rol.includes("planilla") ||
    rol === "admin" ||
    rol === "jefatura"
  );
}

function estadoBadge(estado) {
  const e = String(estado || "").toUpperCase().trim();
  if (e.includes("PENDIENTE"))
    return (
      <Badge bg="warning" text="dark">
        {e}
      </Badge>
    );
  if (e.includes("VALID")) return <Badge bg="success">{e}</Badge>;
  if (e.includes("RECHAZ")) return <Badge bg="danger">{e}</Badge>;
  return <Badge bg="secondary">{e || "—"}</Badge>;
}

function buildFileUrl(ruta) {
  if (!ruta) return null;
  const r = String(ruta).replace(/^\/+/, "");
  return `http://localhost:4000/${r}`;
}

/**
 * ✅ Convierte a dd/mm/yyyy (SIN HORA)
 * Soporta:
 * - "dd/mm/yyyy"
 * - "yyyy-mm-dd"
 * - strings parseables por Date
 */
function toDMYOnly(anyDate) {
  const s = String(anyDate || "").trim();
  if (!s) return "";

  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return "";
}

/**
 * ✅ Para mostrar fechas en UI, siempre dd/mm/yyyy
 */
function fmtDate(s) {
  return toDMYOnly(s) || "";
}

/**
 * ✅ Para <input type="date"> necesitamos yyyy-mm-dd
 */
function toDateLocalToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchFirstOk(paths) {
  let lastErr = null;
  for (const p of paths) {
    try {
      const { data } = await api.get(p);
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

function pickId(obj, candidates) {
  for (const k of candidates) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function pickDesc(obj, candidates) {
  for (const k of candidates) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
}

function normalizarNombreEmpleado(emp) {
  const nombreCompleto = pickDesc(emp, [
    "NombreCompleto",
    "nombreCompleto",
    "nombreCompletoEmpleado",
  ]);
  if (nombreCompleto) return nombreCompleto;

  const p = emp?.persona || emp?.Persona || emp?.PERSONA;
  const n =
    pickDesc(emp, ["Nombre", "nombre"]) || pickDesc(p, ["Nombre", "nombre"]);
  const a1 =
    pickDesc(emp, ["Apellido1", "apellido1"]) ||
    pickDesc(p, ["Apellido1", "apellido1"]);
  const a2 =
    pickDesc(emp, ["Apellido2", "apellido2"]) ||
    pickDesc(p, ["Apellido2", "apellido2"]);

  return `${n} ${a1} ${a2}`.replace(/\s+/g, " ").trim();
}

function parseAnyDateToMs(value) {
  if (value === null || value === undefined) return NaN;
  if (value instanceof Date) return value.getTime();

  const s0 = String(value || "").trim();
  if (!s0) return NaN;

  const s = s0.replace(/\s+/g, " ");

  const iso = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (iso) {
    const [, y, mo, d, hh, mi, ss] = iso;
    const asIso = `${y}-${mo}-${d}T${hh ?? "00"}:${mi ?? "00"}:${ss ?? "00"}`;
    const t = Date.parse(asIso);
    return Number.isNaN(t) ? NaN : t;
  }

  const dmy = s.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmy) {
    const [, dd, mm, yyyy, hh, mi, ss] = dmy;
    const asIso = `${yyyy}-${mm}-${dd}T${hh ?? "00"}:${mi ?? "00"}:${ss ?? "00"}`;
    const t = Date.parse(asIso);
    return Number.isNaN(t) ? NaN : t;
  }

  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

function getPeriodoIdFromAnyDate(anyDateValue, periodosArr) {
  const t = parseAnyDateToMs(anyDateValue);
  if (Number.isNaN(t) || !Array.isArray(periodosArr) || periodosArr.length === 0)
    return "";

  for (const p of periodosArr) {
    const id = Number(pickId(p, ["idCatalogo_Periodo", "idPeriodo", "id", "Id"]));
    if (!id) continue;

    const iniRaw = pickDesc(p, [
      "fechaInicio",
      "Fecha_Inicio",
      "FechaInicio",
      "inicio",
      "Inicio",
    ]);
    const finRaw = pickDesc(p, [
      "fechaFin",
      "Fecha_Fin",
      "FechaFin",
      "fin",
      "Fin",
    ]);

    const ini = parseAnyDateToMs(iniRaw);
    const fin = parseAnyDateToMs(finRaw);

    if (!Number.isNaN(ini) && !Number.isNaN(fin) && t >= ini && t <= fin)
      return String(id);
  }

  return "";
}

export default function Incapacidades() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
      return null;
    }
  }, []);

  const rolNorm = useMemo(() => normalizarRol(user), [user]);
  const esAdmin = rolNorm === "admin";
  const esColaborador = rolNorm === "colaborador";
  const esPlanilla = useMemo(() => esRolPlanilla(user), [user]);
  const esSelfOnly = esColaborador || esPlanilla;

  const esValidador = useMemo(() => puedeValidar(user), [user]);
  const puedeCrear = useMemo(() => puedeCrearYSubir(user), [user]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [lista, setLista] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [tiposIncapacidad, setTiposIncapacidad] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [miEmpleado, setMiEmpleado] = useState(null);

  const [showCrear, setShowCrear] = useState(false);
  const [formCrear, setFormCrear] = useState({
    Empleado_idEmpleado: "",
    Tipo_Incapacidad_idTipo_Incapacidad: "",
    Catalogo_Periodo_idCatalogo_Periodo: "",
    Descripcion: "",
    // ✅ ISO yyyy-mm-dd (input date)
    Fecha_Inicio: "",
    Fecha_Fin: "",
  });
  const [creando, setCreando] = useState(false);

  // ✅ Validar con nota
  const [showValidar, setShowValidar] = useState(false);
  const [notaValidacion, setNotaValidacion] = useState("");

  // ✅ Rechazar con nota
  const [showRechazar, setShowRechazar] = useState(false);
  const [motivo, setMotivo] = useState(""); // (se mantiene el nombre para no “romper” nada; ahora funciona como Nota/Observación)
  const [procesando, setProcesando] = useState(false);

  const [archivo, setArchivo] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const cargarLista = useCallback(async () => {
    setError("");
    setMensaje("");
    setCargando(true);
    try {
      const data = await listarIncapacidades();
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Error cargando incapacidades.");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarDetalle = useCallback(async (idIncapacidad) => {
    if (!idIncapacidad) return;
    setError("");
    setMensaje("");
    setCargandoDetalle(true);
    try {
      const data = await obtenerIncapacidad(idIncapacidad);
      setDetalle(data || null);
    } catch (err) {
      setError(err?.message || "Error cargando detalle.");
      setDetalle(null);
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const cargarMiEmpleado = useCallback(async () => {
    if (!esSelfOnly) return;

    try {
      const { data } = await api.get("/empleados/me");
      const emp = data?.empleado || null;

      if (!emp?.idEmpleado) {
        setMiEmpleado(null);
        setEmpleados([]);
        setFormCrear((s) => ({ ...s, Empleado_idEmpleado: "" }));
        return;
      }

      const nombre =
        emp?.nombreCompleto ||
        emp?.nombre ||
        (emp?.idEmpleado ? `Empleado ${emp.idEmpleado}` : "Empleado");
      const row = { idEmpleado: Number(emp.idEmpleado), nombre: String(nombre) };

      setMiEmpleado(emp);
      setEmpleados([row]);
      setFormCrear((s) => ({ ...s, Empleado_idEmpleado: String(row.idEmpleado) }));
    } catch (err) {
      setMiEmpleado(null);
      setEmpleados([]);
      setFormCrear((s) => ({ ...s, Empleado_idEmpleado: "" }));
      setError(
        err?.response?.data?.mensaje ||
          err?.response?.data?.message ||
          "Error cargando mi empleado"
      );
    }
  }, [esSelfOnly]);

  const cargarOpciones = useCallback(async () => {
    setCargandoOpciones(true);
    setError("");
    try {
      const tiposResp = await fetchFirstOk(["/catalogos/tipos-incapacidad"]);
      const tiposArr = Array.isArray(tiposResp)
        ? tiposResp
        : tiposResp?.tiposIncapacidad || tiposResp?.tipos || [];
      setTiposIncapacidad(Array.isArray(tiposArr) ? tiposArr : []);

      const perResp = await fetchFirstOk(["/catalogos/periodos"]);
      const perArr = Array.isArray(perResp)
        ? perResp
        : perResp?.periodos || perResp?.data || [];
      setPeriodos(Array.isArray(perArr) ? perArr : []);

      if (esSelfOnly) {
        await cargarMiEmpleado();
      } else {
        const empResp = await fetchFirstOk(["/catalogos/empleados", "/empleados"]);
        const empArr = Array.isArray(empResp)
          ? empResp
          : empResp?.empleados || empResp?.data || [];
        setEmpleados(Array.isArray(empArr) ? empArr : []);
      }
    } catch (err) {
      setTiposIncapacidad([]);
      setPeriodos([]);
      setEmpleados([]);
      if (!esSelfOnly) setMiEmpleado(null);
      setError(
        err?.response?.data?.mensaje ||
          err?.response?.data?.message ||
          "Error cargando opciones"
      );
    } finally {
      setCargandoOpciones(false);
    }
  }, [esSelfOnly, cargarMiEmpleado]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    if (seleccion?.idIncapacidad) cargarDetalle(seleccion.idIncapacidad);
    else setDetalle(null);
  }, [seleccion, cargarDetalle]);

  useEffect(() => {
    if (esSelfOnly) cargarMiEmpleado();
  }, [esSelfOnly, cargarMiEmpleado]);

  useEffect(() => {
    if (!showCrear) return;

    const today = toDateLocalToday();
    setFormCrear((s) => ({
      ...s,
      Fecha_Inicio: s.Fecha_Inicio || today,
      Fecha_Fin: s.Fecha_Fin || today,
    }));

    cargarOpciones();
  }, [showCrear, cargarOpciones]);

  useEffect(() => {
    if (!showCrear) return;
    if (!periodos || periodos.length === 0) return;

    setFormCrear((s) => {
      const inicio = s.Fecha_Inicio || "";
      const idPeriodo = getPeriodoIdFromAnyDate(inicio, periodos);
      return {
        ...s,
        Catalogo_Periodo_idCatalogo_Periodo:
          idPeriodo || s.Catalogo_Periodo_idCatalogo_Periodo,
      };
    });
  }, [showCrear, periodos]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista || []).filter((x) => {
      const estado = String(x?.Estado || "").toLowerCase();
      if (soloPendientes && !estado.includes("pendiente")) return false;

      if (!q) return true;
      const nombre = `${x?.Nombre || ""} ${x?.Apellido1 || ""} ${x?.Apellido2 || ""}`.toLowerCase();
      const desc = String(x?.Descripcion || "").toLowerCase();
      const tipo = String(x?.TipoIncapacidad || "").toLowerCase();
      const idTxt = String(x?.idIncapacidad || "");
      return (
        nombre.includes(q) ||
        desc.includes(q) ||
        tipo.includes(q) ||
        estado.includes(q) ||
        idTxt.includes(q)
      );
    });
  }, [lista, busqueda, soloPendientes]);

  const onSeleccionar = (row) => {
    setSeleccion(row);
    setArchivo(null);
  };

  const onCrear = async () => {
    setError("");
    setMensaje("");
    setCreando(true);
    try {
      const inicioLocal = String(formCrear.Fecha_Inicio || "").trim(); // yyyy-mm-dd
      const finLocal = String(formCrear.Fecha_Fin || "").trim(); // yyyy-mm-dd

      // ✅ enviar al backend solo dd/mm/yyyy
      const inicioDMY = toDMYOnly(inicioLocal);
      const finDMY = toDMYOnly(finLocal);

      const empleadoIdFinal = esSelfOnly
        ? Number(miEmpleado?.idEmpleado || 0)
        : formCrear.Empleado_idEmpleado
        ? Number(formCrear.Empleado_idEmpleado)
        : 0;

      const periodoAuto = getPeriodoIdFromAnyDate(inicioLocal, periodos);

      const payload = {
        Empleado_idEmpleado: empleadoIdFinal || undefined,
        Tipo_Incapacidad_idTipo_Incapacidad: Number(
          formCrear.Tipo_Incapacidad_idTipo_Incapacidad || 0
        ),
        ...(periodoAuto
          ? { Catalogo_Periodo_idCatalogo_Periodo: Number(periodoAuto) }
          : {}),
        Descripcion: String(formCrear.Descripcion || "").trim(),
        Fecha_Inicio: inicioDMY,
        Fecha_Fin: finDMY,
        Activo: 1,
      };

      if (!payload.Tipo_Incapacidad_idTipo_Incapacidad)
        throw new Error("Debe seleccionar el Tipo de incapacidad.");
      if (!payload.Fecha_Inicio || !payload.Fecha_Fin)
        throw new Error("Debe seleccionar Fecha inicio y Fecha fin.");

      if (esSelfOnly && !payload.Empleado_idEmpleado) {
        throw new Error("No se pudo determinar su empleado. Verifique /empleados/me.");
      }

      const tInicio = Date.parse(inicioLocal);
      const tFin = Date.parse(finLocal);
      if (!Number.isNaN(tInicio) && !Number.isNaN(tFin) && tFin < tInicio) {
        throw new Error("La Fecha fin no puede ser menor que la Fecha inicio.");
      }

      const resp = await crearIncapacidad(payload);
      setMensaje(resp?.message || "Incapacidad creada.");
      setShowCrear(false);
      await cargarLista();

      const nuevoId = resp?.idIncapacidad;
      if (nuevoId) setSeleccion({ idIncapacidad: nuevoId });
    } catch (err) {
      setError(err?.message || "Error creando incapacidad.");
    } finally {
      setCreando(false);
    }
  };

  const onSubirArchivo = async () => {
    if (!detalle?.idIncapacidad) return;
    if (!archivo) {
      setError("Debe seleccionar un archivo primero.");
      return;
    }
    setError("");
    setMensaje("");
    setSubiendoArchivo(true);
    try {
      const resp = await subirArchivoIncapacidad(detalle.idIncapacidad, archivo);
      setMensaje(resp?.message || "Archivo adjuntado.");
      setArchivo(null);
      await cargarDetalle(detalle.idIncapacidad);
      await cargarLista();
    } catch (err) {
      setError(err?.message || "Error adjuntando archivo.");
    } finally {
      setSubiendoArchivo(false);
    }
  };

  /**
   * ✅ IMPORTANTE (ajuste seguro):
   * El backend ya aplica la incapacidad a Asistencia al VALIDAR (aprobarIncapacidad llama aplicarIncapacidadEnAsistencia).
   * Para evitar doble prefijo y dobles updates, aquí NO repetimos esa lógica en frontend.
   */

  // ✅ Confirmar validar (con nota)
  const onConfirmarValidar = async () => {
    if (!detalle?.idIncapacidad) return;
    setError("");
    setMensaje("");
    setProcesando(true);
    try {
      const nota = String(notaValidacion || "").trim();
      const resp = await validarIncapacidad(detalle.idIncapacidad, nota);
      setMensaje(resp?.message || "Incapacidad validada.");

      setShowValidar(false);
      setNotaValidacion("");

      await cargarDetalle(detalle.idIncapacidad);
      await cargarLista();
    } catch (err) {
      setError(err?.message || "Error validando incapacidad.");
    } finally {
      setProcesando(false);
    }
  };

  const onRechazar = async () => {
    if (!detalle?.idIncapacidad) return;
    setError("");
    setMensaje("");
    setProcesando(true);
    try {
      const nota = String(motivo || "").trim();
      const resp = await rechazarIncapacidad(detalle.idIncapacidad, nota);
      setMensaje(resp?.message || "Incapacidad rechazada.");

      setShowRechazar(false);
      setMotivo("");
      await cargarDetalle(detalle.idIncapacidad);
      await cargarLista();
    } catch (err) {
      setError(err?.message || "Error rechazando incapacidad.");
    } finally {
      setProcesando(false);
    }
  };

  const archivoUrl = useMemo(
    () => buildFileUrl(detalle?.ArchivoActual?.Ruta_Almacenamiento),
    [detalle]
  );

  // ✅ Permiso de subir/seleccionar archivo
  const puedeSubirArchivo = useMemo(() => {
    if (!puedeCrear) return false; // colaborador/planilla/admin/jefatura
    if (!detalle?.idIncapacidad) return false;
    return true;
  }, [puedeCrear, detalle?.idIncapacidad]);

  return (
    <Container fluid className="p-3">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h4 className="mb-1">Incapacidades</h4>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Backend: <b>http://localhost:4000</b> · Adjuntos: <b>/uploads</b>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={cargarLista} disabled={cargando}>
            <i className="bi bi-arrow-repeat me-1" /> Recargar
          </Button>
          {puedeCrear && (
            <Button variant="primary" onClick={() => setShowCrear(true)}>
              <i className="bi bi-plus-lg me-1" /> Nueva
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="py-2">
          {error}
        </Alert>
      )}
      {mensaje && (
        <Alert variant="success" className="py-2">
          {mensaje}
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={5} xl={4}>
          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <div className="d-flex gap-2 align-items-center">
                <Form.Control
                  placeholder="Buscar (nombre, estado, tipo, descripción, id)..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <Form.Check
                  type="switch"
                  id="soloPendientes"
                  label="Pendientes"
                  checked={soloPendientes}
                  onChange={(e) => setSoloPendientes(e.target.checked)}
                />
              </div>
            </Card.Header>

            <Card.Body className="p-0">
              {cargando ? (
                <div className="p-3 d-flex align-items-center gap-2">
                  <Spinner size="sm" /> Cargando...
                </div>
              ) : (
                <div style={{ maxHeight: "70vh", overflow: "auto" }}>
                  <Table hover responsive className="mb-0">
                    <thead className="table-light">
                      <tr>
                        {esAdmin && <th style={{ width: 70 }}>ID</th>}
                        <th>{esSelfOnly ? "Mi registro" : "Colaborador"}</th>
                        <th>Estado</th>
                        <th style={{ width: 140 }}>Inicio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaFiltrada.length === 0 ? (
                        <tr>
                          <td colSpan={esAdmin ? 4 : 3} className="text-muted p-3">
                            No hay registros.
                          </td>
                        </tr>
                      ) : (
                        listaFiltrada.map((x) => {
                          const activo =
                            Number(seleccion?.idIncapacidad) === Number(x?.idIncapacidad);
                          return (
                            <tr
                              key={x.idIncapacidad}
                              style={{
                                cursor: "pointer",
                                background: activo ? "#f8f9fa" : undefined,
                              }}
                              onClick={() => onSeleccionar(x)}
                            >
                              {esAdmin && <td className="fw-bold">{x.idIncapacidad}</td>}
                              <td>
                                <div className="fw-semibold">
                                  {`${x?.Nombre || ""} ${x?.Apellido1 || ""} ${x?.Apellido2 || ""}`
                                    .trim() || "—"}
                                </div>
                                <div className="text-muted" style={{ fontSize: 12 }}>
                                  {x?.TipoIncapacidad || "—"} · {x?.Descripcion || ""}
                                </div>
                              </td>
                              <td>{estadoBadge(x?.Estado)}</td>
                              <td style={{ fontSize: 12 }}>{fmtDate(x?.Fecha_Inicio)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7} xl={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-white d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold">Detalle</span>
                {detalle?.Estado ? <span>{estadoBadge(detalle.Estado)}</span> : null}
              </div>

              <div className="d-flex gap-2">
                {esValidador && (
                  <>
                    <Button
                      variant="success"
                      onClick={() => setShowValidar(true)}
                      disabled={procesando || !detalle?.idIncapacidad}
                    >
                      <i className="bi bi-check2-circle me-1" />
                      Validar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setShowRechazar(true)}
                      disabled={procesando || !detalle?.idIncapacidad}
                    >
                      <i className="bi bi-x-circle me-1" />
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </Card.Header>

            <Card.Body>
              {!seleccion && !detalle ? (
                <div className="text-muted">Seleccione una incapacidad para ver el detalle.</div>
              ) : cargandoDetalle ? (
                <div className="d-flex align-items-center gap-2">
                  <Spinner size="sm" /> Cargando detalle...
                </div>
              ) : !detalle ? (
                <div className="text-muted">No se pudo cargar el detalle.</div>
              ) : (
                <>
                  <Row className="g-3">
                    {esAdmin && (
                      <Col md={4}>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          ID
                        </div>
                        <div className="fw-bold">{detalle.idIncapacidad}</div>
                      </Col>
                    )}

                    <Col md={esAdmin ? 8 : 12}>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Colaborador
                      </div>
                      <div className="fw-semibold">
                        {`${detalle?.Nombre || ""} ${detalle?.Apellido1 || ""} ${detalle?.Apellido2 || ""}`
                          .trim() || "—"}
                      </div>
                    </Col>

                    <Col md={6}>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Tipo
                      </div>
                      <div>{detalle?.TipoIncapacidad || "—"}</div>
                    </Col>
                    <Col md={6}>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Descripción
                      </div>
                      <div>{detalle?.Descripcion || "—"}</div>
                    </Col>

                    <Col md={6}>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Fecha inicio
                      </div>
                      <div>{fmtDate(detalle?.Fecha_Inicio)}</div>
                    </Col>
                    <Col md={6}>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Fecha fin
                      </div>
                      <div>{fmtDate(detalle?.Fecha_Fin)}</div>
                    </Col>
                  </Row>

                  <hr />

                  <Row className="g-3 align-items-end">
                    <Col lg={6}>
                      <Form.Group controlId="archivo">
                        <Form.Label className="fw-semibold">
                          Adjuntar/Actualizar comprobante
                        </Form.Label>
                        <Form.Control
                          type="file"
                          accept=".pdf,.png,application/pdf,image/png"
                          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                          disabled={!puedeSubirArchivo}
                        />
                        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                          Campo esperado: <b>archivo</b> (multipart/form-data)
                        </div>
                      </Form.Group>
                    </Col>
                    <Col lg="auto">
                      <Button
                        variant="primary"
                        onClick={onSubirArchivo}
                        disabled={!puedeSubirArchivo || subiendoArchivo || !archivo}
                      >
                        {subiendoArchivo ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-upload me-1" />
                            Subir
                          </>
                        )}
                      </Button>
                    </Col>
                  </Row>

                  <div className="mt-3">
                    <div className="fw-semibold mb-2">Archivo actual</div>
                    {detalle?.ArchivoActual ? (
                      <Card className="bg-light border-0">
                        <Card.Body className="py-2">
                          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                            <div style={{ minWidth: 220 }}>
                              <div className="fw-semibold">
                                {detalle.ArchivoActual.Nombre_Original}
                              </div>
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                {detalle.ArchivoActual.MimeType} ·{" "}
                                {detalle.ArchivoActual.TamanoBytes} bytes · v
                                {detalle.ArchivoActual.Version}
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              {archivoUrl && (
                                <Button
                                  variant="outline-dark"
                                  size="sm"
                                  onClick={() =>
                                    window.open(archivoUrl, "_blank", "noopener,noreferrer")
                                  }
                                >
                                  <i className="bi bi-box-arrow-up-right me-1" /> Abrir
                                </Button>
                              )}
                            </div>
                          </div>

                          {archivoUrl &&
                            String(detalle.ArchivoActual.MimeType || "").includes("pdf") && (
                              <div className="mt-3">
                                <iframe
                                  title="preview-pdf"
                                  src={archivoUrl}
                                  style={{
                                    width: "100%",
                                    height: 420,
                                    border: "1px solid #dee2e6",
                                    borderRadius: 8,
                                  }}
                                />
                              </div>
                            )}

                          {archivoUrl &&
                            String(detalle.ArchivoActual.MimeType || "").startsWith("image/") && (
                              <div className="mt-3">
                                <img
                                  src={archivoUrl}
                                  alt="preview"
                                  style={{
                                    maxWidth: "100%",
                                    borderRadius: 8,
                                    border: "1px solid #dee2e6",
                                  }}
                                />
                              </div>
                            )}
                        </Card.Body>
                      </Card>
                    ) : (
                      <div className="text-muted">Sin archivo adjunto.</div>
                    )}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ✅ MODAL: Crear */}
      <Modal show={showCrear} onHide={() => setShowCrear(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Nueva incapacidad</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="py-2" style={{ fontSize: 13 }}>
            Use el calendario. Se enviará al backend como <b>dd/mm/yyyy</b>.
          </Alert>

          {cargandoOpciones && (
            <div className="d-flex align-items-center gap-2 text-muted mb-2">
              <Spinner size="sm" /> Cargando opciones...
            </div>
          )}

          <Form>
            <Row className="g-3">
              <Col md={12}>
                <Form.Group controlId="empleadoId">
                  <Form.Label>Empleado</Form.Label>

                  {esSelfOnly ? (
                    <Form.Control
                      value={
                        miEmpleado?.nombreCompleto ||
                        miEmpleado?.nombre ||
                        (miEmpleado?.idEmpleado ? `Empleado ${miEmpleado.idEmpleado}` : "")
                      }
                      disabled
                    />
                  ) : empleados.length > 0 ? (
                    <Form.Select
                      value={formCrear.Empleado_idEmpleado}
                      onChange={(e) =>
                        setFormCrear((s) => ({ ...s, Empleado_idEmpleado: e.target.value }))
                      }
                    >
                      <option value="">Seleccione...</option>
                      {empleados.map((emp) => {
                        const id = Number(
                          pickId(emp, ["idEmpleado", "IdEmpleado", "id", "Id", "Empleado_idEmpleado"])
                        );
                        const label = normalizarNombreEmpleado(emp) || `Empleado ${id}`;
                        return (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        );
                      })}
                    </Form.Select>
                  ) : (
                    <Form.Control
                      value={formCrear.Empleado_idEmpleado}
                      onChange={(e) =>
                        setFormCrear((s) => ({ ...s, Empleado_idEmpleado: e.target.value }))
                      }
                      placeholder="Ej: 1"
                    />
                  )}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="tipo">
                  <Form.Label>Tipo de incapacidad</Form.Label>
                  {tiposIncapacidad.length > 0 ? (
                    <Form.Select
                      value={formCrear.Tipo_Incapacidad_idTipo_Incapacidad}
                      onChange={(e) =>
                        setFormCrear((s) => ({
                          ...s,
                          Tipo_Incapacidad_idTipo_Incapacidad: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccione...</option>
                      {tiposIncapacidad.map((t) => {
                        const id = Number(
                          pickId(t, [
                            "idCatalogo_Tipo_Incapacidad",
                            "idCatalogo_TipoIncapacidad",
                            "idTipo_Incapacidad",
                            "idTipoIncapacidad",
                            "id",
                            "Id",
                          ])
                        );
                        const desc = pickDesc(t, ["Descripcion", "descripcion", "Nombre", "nombre"]);
                        return (
                          <option key={id} value={id}>
                            {desc || `Tipo ${id}`}
                          </option>
                        );
                      })}
                    </Form.Select>
                  ) : (
                    <Form.Control
                      type="number"
                      value={formCrear.Tipo_Incapacidad_idTipo_Incapacidad}
                      onChange={(e) =>
                        setFormCrear((s) => ({
                          ...s,
                          Tipo_Incapacidad_idTipo_Incapacidad: e.target.value,
                        }))
                      }
                    />
                  )}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="periodo">
                  <Form.Label>Período</Form.Label>
                  <Form.Control
                    value={(() => {
                      const id = getPeriodoIdFromAnyDate(formCrear.Fecha_Inicio, periodos);
                      if (!id) return "No determinado (se calculará en el backend)";
                      const p = (periodos || []).find(
                        (x) =>
                          String(pickId(x, ["idCatalogo_Periodo", "idPeriodo", "id", "Id"])) ===
                          String(id)
                      );
                      const a = pickDesc(p, ["fechaInicio", "Fecha_Inicio", "FechaInicio"]);
                      const b = pickDesc(p, ["fechaFin", "Fecha_Fin", "FechaFin"]);
                      return a && b ? `${a} - ${b}` : `Período ${id}`;
                    })()}
                    disabled
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group controlId="desc">
                  <Form.Label>Descripción</Form.Label>
                  <Form.Control
                    value={formCrear.Descripcion}
                    onChange={(e) => setFormCrear((s) => ({ ...s, Descripcion: e.target.value }))}
                    placeholder="Ej: Gripe"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="inicio">
                  <Form.Label>Fecha inicio</Form.Label>
                  <Form.Control
                    type="date"
                    value={formCrear.Fecha_Inicio}
                    onChange={(e) => {
                      const v = e.target.value; // yyyy-mm-dd
                      setFormCrear((s) => ({
                        ...s,
                        Fecha_Inicio: v,
                        Catalogo_Periodo_idCatalogo_Periodo:
                          getPeriodoIdFromAnyDate(v, periodos) ||
                          s.Catalogo_Periodo_idCatalogo_Periodo,
                      }));
                    }}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="fin">
                  <Form.Label>Fecha fin</Form.Label>
                  <Form.Control
                    type="date"
                    value={formCrear.Fecha_Fin}
                    onChange={(e) => setFormCrear((s) => ({ ...s, Fecha_Fin: e.target.value }))}
                    min={formCrear.Fecha_Inicio || undefined}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCrear(false)} disabled={creando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onCrear} disabled={creando}>
            {creando ? (
              <>
                <Spinner size="sm" className="me-2" /> Creando...
              </>
            ) : (
              "Crear"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ MODAL: Validar con nota */}
      <Modal
        show={showValidar}
        onHide={() => {
          if (procesando) return;
          setShowValidar(false);
          setNotaValidacion("");
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Validar incapacidad</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="py-2" style={{ fontSize: 13 }}>
            Esta nota se enviará al backend para que se refleje como <b>Observación</b> en Asistencias.
          </Alert>

          <Form.Group controlId="notaValidacion">
            <Form.Label>Nota / Observación</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={notaValidacion}
              onChange={(e) => setNotaValidacion(e.target.value)}
              placeholder='Ej: "Incapacidad aprobada - comprobante OK"'
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowValidar(false);
              setNotaValidacion("");
            }}
            disabled={procesando}
          >
            Cancelar
          </Button>
          <Button variant="success" onClick={onConfirmarValidar} disabled={procesando}>
            {procesando ? (
              <>
                <Spinner size="sm" className="me-2" /> Procesando...
              </>
            ) : (
              "Validar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ MODAL: Rechazar con nota */}
      <Modal
        show={showRechazar}
        onHide={() => {
          if (procesando) return;
          setShowRechazar(false);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Rechazar incapacidad</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="py-2" style={{ fontSize: 13 }}>
            Esta nota se enviará al backend para que se refleje como <b>Observación</b> en Asistencias.
          </Alert>

          <Form.Group controlId="motivo">
            <Form.Label>Nota / Observación</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder='Ej: "Rechazada: comprobante ilegible"'
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowRechazar(false)}
            disabled={procesando}
          >
            Cancelar
          </Button>
          <Button variant="danger" onClick={onRechazar} disabled={procesando}>
            {procesando ? (
              <>
                <Spinner size="sm" className="me-2" /> Procesando...
              </>
            ) : (
              "Rechazar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
