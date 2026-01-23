//src/pages/asistencias/ValidarAsistencias.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, Form, Modal, Row, Spinner, Badge, Alert } from "react-bootstrap";
import { DataGrid } from "@mui/x-data-grid";
import api from "../../api/axios";

function formatHora(hhmmss) {
  if (!hhmmss || hhmmss === "00:00:00") return "—";
  return String(hhmmss).slice(0, 5);
}

function EstadoBadge({ estado }) {
  if (estado === "Confirmada") {
    return <Badge style={{ backgroundColor: "#5da334", color: "white" }}>Confirmada</Badge>;
  }
  return (
  
    <Badge bg="danger">
      Pendiente
    </Badge>
  );
}

function normalizeEmpleadoRow(r) {
  const idEmpleado =
    r?.idEmpleado ??
    r?.id ??
    r?.IdEmpleado ??
    r?.Empleado_idEmpleado ??
    null;

  const nombre =
    r?.nombre ??
    r?.NombreCompleto ??
    r?.EmpleadoNombre ??
    r?.Nombre ??
    (idEmpleado ? `Empleado ${idEmpleado}` : "No registrado");

  return { idEmpleado: Number(idEmpleado), nombre: String(nombre) };
}

function extractApiData(r) {
  if (r?.ok) return r;
  if (r?.data?.ok) return r.data;
  return r?.data || r || {};
}

function parseHHMMSS_toMinutes(v) {
  const s = String(v || "").trim();
  if (!s || s === "00:00:00") return null;
  const parts = s.split(":").map((x) => Number(x));
  if (parts.length < 2) return null;
  const hh = parts[0];
  const mm = parts[1];
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
}

function toYYYYMMDD_UTCFromParts(y, m, d) {
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const yy = dt.getUTCFullYear();
  const mm = pad2(dt.getUTCMonth() + 1);
  const dd = pad2(dt.getUTCDate());
  return `${yy}-${mm}-${dd}`;
}

function isValidYMD(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  if (yy < 1900 || yy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  return (
    dt.getUTCFullYear() === yy &&
    dt.getUTCMonth() + 1 === mm &&
    dt.getUTCDate() === dd
  );
}

function excelSerialToYYYYMMDD(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;

  const base = Date.UTC(1899, 11, 30);
  const ms = Math.round(n * 86400000);
  const dt = new Date(base + ms);

  return toYYYYMMDD_UTCFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function normalizeFechaToYYYYMMDD(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toYYYYMMDD_UTCFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 100000000000) {
      const dt = new Date(value);
      if (!Number.isNaN(dt.getTime())) {
        return toYYYYMMDD_UTCFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      }
    }

  
    const serial = excelSerialToYYYYMMDD(value);
    if (serial) return serial;
  }

  const s = String(value).trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidYMD(y, m, d)) return `${y}-${m}-${d}`;
    return null;
  }

   
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (dmyMatch) {
    let [, a, b, c] = dmyMatch;
    const p1 = Number(a);
    const p2 = Number(b);

     
    let year = Number(c);
    if (String(c).length === 2) {
      year = year >= 70 ? 1900 + year : 2000 + year;
    }

    let day, month;
    if (p1 > 12 && p2 <= 12) {
      day = p1; month = p2;  
    } else if (p2 > 12 && p1 <= 12) {
      day = p2; month = p1;  
    } else {
      day = p1; month = p2;  
    }

    if (isValidYMD(year, month, day)) return toYYYYMMDD_UTCFromParts(year, month, day);
    return null;
  }

   
  const t = Date.parse(s);
  if (Number.isFinite(t)) {
    const dt = new Date(t);
    if (!Number.isNaN(dt.getTime())) {
      return toYYYYMMDD_UTCFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
  }

  return null;
}

function formatFechaDDMMYYYY(value) {
  const ymd = normalizeFechaToYYYYMMDD(value);
  if (!ymd) return String(value || "");
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function dayOfWeek_1_7_fromYYYYMMDD(dateStr) {
  const s = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!isValidYMD(y, m, d)) return null;

  const dt = new Date(Date.UTC(y, m - 1, d));
  const js = dt.getUTCDay();  
  return js === 0 ? 1 : js + 1;  
}

function calcularTardiaAusenteSegunHorario({ fecha, entradaReal, detalleSemana, toleranciaMin = 0 }) {
  const fechaNorm = normalizeFechaToYYYYMMDD(fecha);
  const dia = dayOfWeek_1_7_fromYYYYMMDD(fechaNorm);

  if (!dia || !Array.isArray(detalleSemana)) {
    return {
      entradaEsperada: null,
      salidaEsperada: null,
      aplica: false,
      tardiaCalc: null,
      ausenteCalc: null,
    };
  }

  const d = detalleSemana.find((x) => Number(x.diaSemana) === Number(dia)) || null;

  const entradaEsperada = d?.entrada ?? null;
  const salidaEsperada = d?.salida ?? null;
  const activo = Number(d?.activo ?? 0) === 1;

  const entExpMin = parseHHMMSS_toMinutes(entradaEsperada);
  const salExpMin = parseHHMMSS_toMinutes(salidaEsperada);

  const aplica = !!(activo && entExpMin !== null && salExpMin !== null);

  if (!aplica) {
    return {
      entradaEsperada,
      salidaEsperada,
      aplica: false,
      tardiaCalc: null,
      ausenteCalc: null,
    };
  }

  const entRealMin = parseHHMMSS_toMinutes(entradaReal);
  const ausenteCalc = entRealMin === null ? 1 : 0;

  let tardiaCalc = 0;
  if (entRealMin !== null && entExpMin !== null) {
    tardiaCalc = entRealMin > entExpMin + Number(toleranciaMin || 0) ? 1 : 0;
  }

  return {
    entradaEsperada,
    salidaEsperada,
    aplica: true,
    tardiaCalc,
    ausenteCalc,
  };
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
  const fin = now;
  return { desde: toYYYYMMDD(inicio), hasta: toYYYYMMDD(fin) };
}

function getMesAnteriorRango() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fin = new Date(now.getFullYear(), now.getMonth(), 0);
  return { desde: toYYYYMMDD(inicio), hasta: toYYYYMMDD(fin) };
}

export default function ValidarAsistencias() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [empleados, setEmpleados] = useState([]);

  const [fEmpleadoId, setFEmpleadoId] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fFechaDesde, setFFechaDesde] = useState("");
  const [fFechaHasta, setFFechaHasta] = useState("");

  const [show, setShow] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [accionLoading, setAccionLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 31 });

  const horariosCacheRef = useRef(new Map());
  const horariosInFlightRef = useRef(new Map());

  const TOLERANCIA_MIN = 0;

  const limpiarMensajes = useCallback(() => {
    setErrorMsg("");
    setOkMsg("");
  }, []);

  const cerrarDetalle = useCallback(() => {
    setShow(false);
    setDetalle(null);
  }, []);

  const cargarEmpleados = useCallback(async () => {
    try {
      const { data } = await api.get("/empleados");

      const lista = Array.isArray(data?.empleados)
        ? data.empleados
        : Array.isArray(data)
          ? data
          : [];

      const mapped = lista
        .map(normalizeEmpleadoRow)
        .filter((x) => x.idEmpleado && !Number.isNaN(x.idEmpleado))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setEmpleados(mapped);
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error cargando empleados para filtro");
    }
  }, []);

  const fetchHorarioEmpleadoDetalle = useCallback(async (idEmpleado) => {
    const emp = Number(idEmpleado || 0);
    if (!emp) return null;

    const cached = horariosCacheRef.current.get(emp);
    if (cached) return cached;

    const inflight = horariosInFlightRef.current.get(emp);
    if (inflight) return inflight;

    const p = (async () => {
      try {
        const { data } = await api.get(`/horarios/empleado/${emp}/detalle`);
        const payload = extractApiData(data);

        const detalleSemana = Array.isArray(payload?.detalle) ? payload.detalle : [];
        const horario = payload?.horario ?? null;

        const finalObj = { detalleSemana, horario };
        horariosCacheRef.current.set(emp, finalObj);
        return finalObj;
      } catch {
        const finalObj = { detalleSemana: [], horario: null };
        horariosCacheRef.current.set(emp, finalObj);
        return finalObj;
      } finally {
        horariosInFlightRef.current.delete(emp);
      }
    })();

    horariosInFlightRef.current.set(emp, p);
    return p;
  }, []);

  const enriquecerRowsConHorario = useCallback(
    async (rawRows) => {
      const list = Array.isArray(rawRows) ? rawRows : [];
      if (!list.length) return list;

      const empIds = Array.from(
        new Set(
          list
            .map((r) => Number(r?.Empleado_idEmpleado ?? r?.idEmpleado ?? r?.EmpleadoId ?? 0))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      );

      await Promise.all(empIds.map((id) => fetchHorarioEmpleadoDetalle(id)));

      return list.map((r) => {
        const empId = Number(r?.Empleado_idEmpleado ?? r?.idEmpleado ?? r?.EmpleadoId ?? 0);
        const cache = empId ? horariosCacheRef.current.get(empId) : null;

        const entradaReal = r?.Entrada ?? r?.IN ?? "00:00:00";

        const fechaNorm = normalizeFechaToYYYYMMDD(r?.Fecha) || r?.Fecha || null;

        const calc = calcularTardiaAusenteSegunHorario({
          fecha: fechaNorm,
          entradaReal,
          detalleSemana: cache?.detalleSemana,
          toleranciaMin: TOLERANCIA_MIN,
        });

        return {
          ...r,
          Fecha: fechaNorm,
          __horarioAsignado: cache?.horario ?? null,
          __entradaEsperada: calc.entradaEsperada,
          __salidaEsperada: calc.salidaEsperada,
          __aplicaHorario: calc.aplica,
          __tardiaCalc: calc.tardiaCalc,
          __ausenteCalc: calc.ausenteCalc,
        };
      });
    },
    [fetchHorarioEmpleadoDetalle]
  );

  const cargarConOverrides = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      limpiarMensajes();

      try {
        const params = {};

        const empleadoIdEff = overrides.empleadoId ?? fEmpleadoId;
        const estadoEff = overrides.estado ?? fEstado;
        const fechaDesdeEff = overrides.fechaDesde ?? fFechaDesde;
        const fechaHastaEff = overrides.fechaHasta ?? fFechaHasta;

        if (empleadoIdEff) params.empleadoId = empleadoIdEff;
        if (estadoEff) params.estado = estadoEff;
        if (fechaDesdeEff) params.fechaDesde = fechaDesdeEff;
        if (fechaHastaEff) params.fechaHasta = fechaHastaEff;

        const { data } = await api.get("/asistencias", { params });
        const lista = Array.isArray(data?.asistencias) ? data.asistencias : [];
        const mapped = lista.map((r) => {
          const fechaNorm = normalizeFechaToYYYYMMDD(r?.Fecha) || r?.Fecha || null;
          return {
            ...r,
            id: r.idAsistencia ?? r.id,
            Fecha: fechaNorm,
          };
        });

        const enriched = await enriquecerRowsConHorario(mapped);

        setPaginationModel((prev) => ({ ...prev, page: 0 }));
        setRows(enriched);

        if (enriched.length === 0) {
          setOkMsg("No se encontraron asistencias con los filtros seleccionados.");
        }
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || "Error cargando asistencias");
      } finally {
        setLoading(false);
      }
    },
    [fEmpleadoId, fEstado, fFechaDesde, fFechaHasta, limpiarMensajes, enriquecerRowsConHorario]
  );

  const cargar = useCallback(async () => {
    return cargarConOverrides({});
  }, [cargarConOverrides]);

  useEffect(() => {
    cargarEmpleados();
    cargar();
  }, [cargarEmpleados, cargar]);

  const abrirDetalle = useCallback(
    async (idAsistencia) => {
      if (!idAsistencia) return;

      setAccionLoading(true);
      limpiarMensajes();

      try {
        const { data } = await api.get(`/asistencias/${idAsistencia}`);
        const asistencia = data?.asistencia ?? null;

        if (!asistencia) {
          setDetalle(null);
          setShow(true);
          return;
        }

        const empId = Number(
          asistencia?.Empleado_idEmpleado ?? asistencia?.idEmpleado ?? asistencia?.EmpleadoId ?? 0
        );
        const cache = empId ? await fetchHorarioEmpleadoDetalle(empId) : null;

        const entradaReal = asistencia?.Entrada ?? asistencia?.IN ?? "00:00:00";

        const fechaNorm = normalizeFechaToYYYYMMDD(asistencia?.Fecha) || asistencia?.Fecha || null;

        const calc = calcularTardiaAusenteSegunHorario({
          fecha: fechaNorm,
          entradaReal,
          detalleSemana: cache?.detalleSemana,
          toleranciaMin: TOLERANCIA_MIN,
        });

        setDetalle({
          ...asistencia,
          Fecha: fechaNorm,
          __horarioAsignado: cache?.horario ?? null,
          __entradaEsperada: calc.entradaEsperada,
          __salidaEsperada: calc.salidaEsperada,
          __aplicaHorario: calc.aplica,
          __tardiaCalc: calc.tardiaCalc,
          __ausenteCalc: calc.ausenteCalc,
        });

        setShow(true);
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || "Error obteniendo detalle");
      } finally {
        setAccionLoading(false);
      }
    },
    [limpiarMensajes, fetchHorarioEmpleadoDetalle]
  );

  const cambiarEstado = useCallback(
    async (idAsistencia, estado) => {
      if (!idAsistencia) return;

      setAccionLoading(true);
      limpiarMensajes();

      try {
        await api.put(`/asistencias/${idAsistencia}/estado`, { estado });
        setOkMsg(`Asistencia actualizada a: ${estado}`);
        cerrarDetalle();
        await cargar();
      } catch (err) {
        setErrorMsg(err?.response?.data?.mensaje || "Error actualizando estado");
      } finally {
        setAccionLoading(false);
      }
    },
    [limpiarMensajes, cargar, cerrarDetalle]
  );

  const importarExcel = useCallback(async () => {
    limpiarMensajes();

    if (!importFile) {
      setErrorMsg("Debe seleccionar un archivo Excel (.xlsx/.xls)");
      return;
    }

    setImportLoading(true);
    try {
      const form = new FormData();
      form.append("file", importFile);

      const { data } = await api.post("/asistencias/importar-excel", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOkMsg(
        data?.mensaje ||
          `Importación completada. Insertados: ${data?.insertados ?? 0}, Actualizados: ${
            data?.actualizados ?? 0
          }`
      );

      setShowImport(false);
      setImportFile(null);

      horariosCacheRef.current = new Map();
      horariosInFlightRef.current = new Map();

      await cargar();
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error importando el Excel");
    } finally {
      setImportLoading(false);
    }
  }, [importFile, limpiarMensajes, cargar]);

  const aplicarMesActual = useCallback(async () => {
    const r = getMesActualRango();
    setFFechaDesde(r.desde);
    setFFechaHasta(r.hasta);
    await cargarConOverrides({ fechaDesde: r.desde, fechaHasta: r.hasta });
  }, [cargarConOverrides]);

  const aplicarMesAnterior = useCallback(async () => {
    const r = getMesAnteriorRango();
    setFFechaDesde(r.desde);
    setFFechaHasta(r.hasta);
    await cargarConOverrides({ fechaDesde: r.desde, fechaHasta: r.hasta });
  }, [cargarConOverrides]);

  const columns = useMemo(
    () => [
      {
        field: "Fecha",
        headerName: "Fecha",
        flex: 1,
        minWidth: 130,
        renderCell: (p) => formatFechaDDMMYYYY(p?.row?.Fecha),
        sortComparator: (v1, v2) => {
          const a = normalizeFechaToYYYYMMDD(v1) || "";
          const b = normalizeFechaToYYYYMMDD(v2) || "";
          return a.localeCompare(b);
        },
      },
      { field: "EmpleadoNombre", headerName: "Empleado", flex: 2, minWidth: 230 },
      {
        field: "Entrada",
        headerName: "Entrada",
        flex: 1,
        minWidth: 110,
        renderCell: (p) => formatHora(p?.row?.Entrada ?? p?.row?.IN),
      },
      {
        field: "Salida",
        headerName: "Salida",
        flex: 1,
        minWidth: 110,
        renderCell: (p) => formatHora(p?.row?.Salida ?? p?.row?.OUT),
      },
      {
        field: "__tardiaCalc",
        headerName: "Tardía (horario)",
        flex: 1,
        minWidth: 140,
        renderCell: (p) =>
          p?.row?.__tardiaCalc === null ? "—" : p?.row?.__tardiaCalc === 1 ? "Sí" : "No",
      },
      {
        field: "__ausenteCalc",
        headerName: "Ausente (horario)",
        flex: 1,
        minWidth: 150,
        renderCell: (p) =>
          p?.row?.__ausenteCalc === null ? "—" : p?.row?.__ausenteCalc === 1 ? "Sí" : "No",
      },
      {
        field: "Estado",
        headerName: "Estado",
        flex: 1,
        minWidth: 130,
        renderCell: (p) => <EstadoBadge estado={p?.row?.Estado} />,
      },
      {
        field: "Observacion",
        headerName: "Observación",
        flex: 2,
        minWidth: 250,
        renderCell: (p) => (p?.row?.Observacion ? p.row.Observacion : ""),
      },
      {
        field: "acciones",
        headerName: "Acciones",
        sortable: false,
        filterable: false,
        minWidth: 260,
        renderCell: (p) => {
          const row = p?.row;
          if (!row) return null;

          const esPendiente = row.Estado !== "Confirmada";

          return (
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" variant="outline-primary" onClick={() => abrirDetalle(row.idAsistencia)}>
                Ver
              </Button>

              {esPendiente ? (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => cambiarEstado(row.idAsistencia, "Confirmada")}
                >
                  Confirmar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline-warning"
                  onClick={() => cambiarEstado(row.idAsistencia, "Pendiente")}
                >
                  Quitar confirmación
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [abrirDetalle, cambiarEstado]
  );

  return (
    <div className="p-3">
      <Row className="mb-3 align-items-center">
        <Col>
          <h4 className="mb-0">Confirmar Asistencias</h4>
        </Col>
        <Col className="text-end">
          <Button variant="primary" onClick={() => setShowImport(true)}>
            Importar Excel
          </Button>
        </Col>
      </Row>

      {errorMsg ? <Alert variant="danger">{errorMsg}</Alert> : null}
      {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}
      <div className="p-3 mb-3 border rounded bg-light">
        <Row className="g-2 align-items-end">
          <Col xs={12} md={5}>
            <Form.Label>Empleado</Form.Label>
            <Form.Select value={fEmpleadoId} onChange={(e) => setFEmpleadoId(e.target.value)}>
              <option value="">Todos</option>
              {empleados.map((emp) => (
                <option key={emp.idEmpleado} value={emp.idEmpleado}>
                  {emp.nombre} (ID: {emp.idEmpleado})
                </option>
              ))}
            </Form.Select>
          </Col>

          <Col xs={12} md={3}>
            <Form.Label>Estado</Form.Label>
            <Form.Select value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Confirmada">Confirmada</option>
            </Form.Select>
          </Col>

          <Col xs={6} md={2}>
            <Form.Label>Desde</Form.Label>
            <Form.Control type="date" value={fFechaDesde} onChange={(e) => setFFechaDesde(e.target.value)} />
          </Col>

          <Col xs={6} md={2}>
            <Form.Label>Hasta</Form.Label>
            <Form.Control type="date" value={fFechaHasta} onChange={(e) => setFFechaHasta(e.target.value)} />
          </Col>

          <Col xs={12} md="auto" className="mt-2 mt-md-0 d-flex gap-2">
            <Button variant="outline-secondary" onClick={aplicarMesAnterior} disabled={loading}>
              Mes anterior
            </Button>
            <Button variant="outline-secondary" onClick={aplicarMesActual} disabled={loading}>
              Mes actual
            </Button>
          </Col>

          <Col xs={12} className="d-grid mt-2">
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
          getRowId={(row) => row.idAsistencia ?? row.id}
        />
      </div>

      <Modal show={show} onHide={cerrarDetalle} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Detalle de asistencia</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {accionLoading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner size="sm" />
              <span>Procesando...</span>
            </div>
          ) : null}

          {detalle ? (
            <>
              <Row className="mb-2">
                <Col md={8}>
                  <div>
                    <strong>Empleado:</strong> {detalle.EmpleadoNombre}
                  </div>
                  <div>
                    <strong>Fecha:</strong> {formatFechaDDMMYYYY(detalle.Fecha)}
                  </div>
                </Col>
                <Col md={4} className="text-md-end">
                  <EstadoBadge estado={detalle.Estado} />
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <strong>Entrada:</strong> {formatHora(detalle.Entrada ?? detalle.IN)}
                </Col>
                <Col md={4}>
                  <strong>Salida:</strong> {formatHora(detalle.Salida ?? detalle.OUT)}
                </Col>
                <Col md={4}>
                  <strong>Tardía/Ausente (horario):</strong>{" "}
                  {detalle.__tardiaCalc === null ? "—" : detalle.__tardiaCalc === 1 ? "Sí" : "No"} /{" "}
                  {detalle.__ausenteCalc === null ? "—" : detalle.__ausenteCalc === 1 ? "Sí" : "No"}
                </Col>
              </Row>

              <Form.Group className="mb-0">
                <Form.Label>Observación</Form.Label>
                <Form.Control as="textarea" rows={2} value={detalle.Observacion || ""} readOnly />
              </Form.Group>
            </>
          ) : (
            <div>No hay información para mostrar.</div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarDetalle} disabled={accionLoading}>
            Cerrar
          </Button>

          {detalle ? (
            detalle.Estado === "Confirmada" ? (
              <Button
                variant="outline-warning"
                disabled={accionLoading}
                onClick={() => cambiarEstado(detalle.idAsistencia, "Pendiente")}
              >
                Quitar confirmación
              </Button>
            ) : (
              <Button
                variant="success"
                disabled={accionLoading}
                onClick={() => cambiarEstado(detalle.idAsistencia, "Confirmada")}
              >
                Confirmar
              </Button>
            )
          ) : null}
        </Modal.Footer>
      </Modal>

      <Modal show={showImport} onHide={() => setShowImport(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Importar asistencias desde Excel</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Archivo Excel (.xlsx/.xls)</Form.Label>
            <Form.Control
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
          </Form.Group>

          <div className="text-muted" style={{ fontSize: 13 }}>
            Inserte Excel. Si el empleado no existe en el sistema, la fila será ignorada.
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImport(false)} disabled={importLoading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={importarExcel} disabled={importLoading}>
            {importLoading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Importando...
              </>
            ) : (
              "Importar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}