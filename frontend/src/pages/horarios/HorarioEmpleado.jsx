// src/pages/horarios/HorarioEmpleado.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import {
  obtenerHorarioEmpleado,
  obtenerDetalleHorarioEmpleado,  
  listarCatalogosHorario,
  asignarCatalogoHorarioEmpleado,
  obtenerDetalleCatalogoHorario,
} from "../../api/horariosApi";
import { listarEmpleados } from "../../api/empleadosApi";

function horaParaInput(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  return "";
}

const DIAS = [
  { diaSemana: 1, label: "Domingo" },
  { diaSemana: 2, label: "Lunes" },
  { diaSemana: 3, label: "Martes" },
  { diaSemana: 4, label: "Miércoles" },
  { diaSemana: 5, label: "Jueves" },
  { diaSemana: 6, label: "Viernes" },
  { diaSemana: 7, label: "Sábado" },
];

function buildDetalleCompleto(rawDetalle) {
  const map = new Map(
    (Array.isArray(rawDetalle) ? rawDetalle : []).map((x) => [
      Number(x.diaSemana ?? x.Dia_Semana),
      {
        entrada: String(x.entrada ?? x.Entrada ?? ""),
        salida: String(x.salida ?? x.Salida ?? ""),
        activo: Number(x.activo ?? x.Activo ?? 1),
      },
    ])
  );

  return DIAS.map((d) => {
    const found = map.get(Number(d.diaSemana));
    return {
      diaSemana: d.diaSemana,
      entrada: found?.entrada || "",
      salida: found?.salida || "",
      activo: found?.activo ?? 1,
    };
  });
}

function getEmpleadoId(e) {
  return Number(e?.idEmpleado ?? e?.Empleado_idEmpleado ?? e?.id ?? e?.ID ?? 0) || 0;
}

function getEmpleadoNombre(e) {
  const nombre =
    e?.nombre ??
    e?.Nombre ??
    e?.nombres ??
    e?.Nombres ??
    e?.Nombre_Completo ??
    e?.nombreCompleto ??
    "";
  const ap1 = e?.apellido1 ?? e?.Apellido1 ?? e?.primerApellido ?? e?.Primer_Apellido ?? "";
  const ap2 = e?.apellido2 ?? e?.Apellido2 ?? e?.segundoApellido ?? e?.Segundo_Apellido ?? "";
  const full = String(e?.nombreCompleto ?? e?.NombreCompleto ?? e?.Nombre_Completo ?? "").trim();

  if (full) return full;

  const parts = [nombre, ap1, ap2].map((x) => String(x || "").trim()).filter(Boolean);

  if (parts.length) return parts.join(" ");

  const fallback = String(e?.correo ?? e?.email ?? e?.Email ?? "").trim();
  return fallback || "(sin nombre)";
}

function extractApiData(r) {
  if (r?.ok) return r;
  if (r?.data?.ok) return r.data;
  return r?.data || r || {};
}

export default function HorarioEmpleado() {
  const [empleados, setEmpleados] = useState([]);
  const [idEmpleado, setIdEmpleado] = useState("");
  const [catalogos, setCatalogos] = useState([]);
  const [catalogoSeleccionado, setCatalogoSeleccionado] = useState("");
  const [horarioAsignado, setHorarioAsignado] = useState(null);
  const [detalleAsignado, setDetalleAsignado] = useState(buildDetalleCompleto([]));
  const [detalleCatalogo, setDetalleCatalogo] = useState(buildDetalleCompleto([]));
  const [cargando, setCargando] = useState(false);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [cargandoDetalleCatalogo, setCargandoDetalleCatalogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const hayEmpleado = !!Number(idEmpleado);
  const hayCatalogoSeleccionado = !!Number(catalogoSeleccionado);
  const hayAsignado = !!horarioAsignado;
  const detalleMostrado = useMemo(() => {
    const cat = Number(catalogoSeleccionado);
    if (cat) return detalleCatalogo;
    if (horarioAsignado) return detalleAsignado;
    return buildDetalleCompleto([]);
  }, [catalogoSeleccionado, detalleCatalogo, horarioAsignado, detalleAsignado]);

  const detalleConLabels = useMemo(() => {
    const mapLabel = new Map(DIAS.map((d) => [d.diaSemana, d.label]));
    return (detalleMostrado || [])
      .map((x) => ({
        ...x,
        label: mapLabel.get(Number(x.diaSemana)) || `Día ${x.diaSemana}`,
      }))
      .sort((a, b) => Number(a.diaSemana) - Number(b.diaSemana));
  }, [detalleMostrado]);

  const cargarEmpleados = useCallback(async () => {
    setCargandoEmpleados(true);
    setError("");
    try {
      const r = await listarEmpleados();
      const data = extractApiData(r);

      const list = Array.isArray(data?.empleados)
        ? data.empleados
        : Array.isArray(data)
        ? data
        : [];

      setEmpleados(list);
    } catch (err) {
      setError(String(err?.message || err));
      setEmpleados([]);
    } finally {
      setCargandoEmpleados(false);
    }
  }, []);

  const cargarCatalogos = useCallback(async () => {
    setCargandoCatalogos(true);
    setError("");
    try {
      const r = await listarCatalogosHorario();
      const data = extractApiData(r);
      const list = Array.isArray(data?.catalogos) ? data.catalogos : [];
      setCatalogos(list);
    } catch (err) {
      setError(String(err?.message || err));
      setCatalogos([]);
    } finally {
      setCargandoCatalogos(false);
    }
  }, []);
  const cargarDetalleDeCatalogo = useCallback(async (idCat) => {
    const cat = Number(idCat || 0);
    if (!cat) {
      setDetalleCatalogo(buildDetalleCompleto([]));
      return;
    }
    setCargandoDetalleCatalogo(true);
    setError("");
    try {
      const r = await obtenerDetalleCatalogoHorario(cat);
      const data = extractApiData(r);
      const raw = Array.isArray(data?.detalle) ? data.detalle : [];
      setDetalleCatalogo(buildDetalleCompleto(raw));
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setCargandoDetalleCatalogo(false);
    }
  }, []);

  const cargarHorarioEmpleado = useCallback(async (empId) => {
    const emp = Number(empId || 0);

    if (!emp) {
      setHorarioAsignado(null);
      setDetalleAsignado(buildDetalleCompleto([]));
      setCatalogoSeleccionado("");
      setDetalleCatalogo(buildDetalleCompleto([]));
      setInfo("");
      return;
    }

    setCargando(true);
    setError("");
    setInfo("");

    try {
       
      let r = await obtenerHorarioEmpleado(emp);

       
      const data1 = extractApiData(r);
      const maybeHorario = data1?.horario;
      const maybeDetalle = data1?.detalle;

      if (maybeHorario === undefined && maybeDetalle === undefined) {
        r = await obtenerDetalleHorarioEmpleado(emp);
      }

      const data = extractApiData(r);
      const h = data?.horario || null;
      const rawDetalle = Array.isArray(data?.detalle) ? data.detalle : [];

      setHorarioAsignado(h);
      setDetalleAsignado(buildDetalleCompleto(rawDetalle));

      const backendCat = h?.idCatalogoHorario ? String(h.idCatalogoHorario) : "";
      setCatalogoSeleccionado((prev) => (prev ? prev : backendCat));

       
      setDetalleCatalogo(buildDetalleCompleto(rawDetalle));

      if (!h) setInfo("Este empleado aún no tiene horario asignado. Seleccioná un catálogo y asignalo.");
      else setInfo("Horario cargado.");
    } catch (err) {
      setHorarioAsignado(null);
      setDetalleAsignado(buildDetalleCompleto([]));
      setCatalogoSeleccionado("");
      setDetalleCatalogo(buildDetalleCompleto([]));
      setError(String(err?.message || err));
    } finally {
      setCargando(false);
    }
  }, []);

  const asignarCatalogo = useCallback(async () => {
    const emp = Number(idEmpleado);
    const cat = Number(catalogoSeleccionado);

    if (!emp) {
      setError("Debe seleccionar un empleado.");
      setInfo("");
      return;
    }
    if (!cat) {
      setError("Debe seleccionar un catálogo de horario.");
      setInfo("");
      return;
    }

    setGuardando(true);
    setError("");
    setInfo("");

    try {
      const r = await asignarCatalogoHorarioEmpleado(emp, cat);
      const data = extractApiData(r);
      setInfo(data?.mensaje || "Horario asignado.");

      await cargarHorarioEmpleado(emp);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  }, [idEmpleado, catalogoSeleccionado, cargarHorarioEmpleado]);

  useEffect(() => {
    cargarEmpleados();
    cargarCatalogos();
  }, [cargarEmpleados, cargarCatalogos]);

  useEffect(() => {
    setError("");
    setInfo("");
    cargarHorarioEmpleado(idEmpleado);
  }, [idEmpleado, cargarHorarioEmpleado]);

  useEffect(() => {
    const cat = Number(catalogoSeleccionado);
    if (!cat) return;
    cargarDetalleDeCatalogo(cat);
  }, [catalogoSeleccionado, cargarDetalleDeCatalogo]);

  const catalogoSeleccionadoObj = useMemo(() => {
    const id = Number(catalogoSeleccionado);
    if (!id) return null;
    return (catalogos || []).find((c) => Number(c.idCatalogoHorario) === id) || null;
  }, [catalogoSeleccionado, catalogos]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="m-0">Horario por empleado (Catálogo)</h3>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {info ? <Alert variant="success">{info}</Alert> : null}

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Empleado</Form.Label>
                <Form.Select
                  value={idEmpleado}
                  onChange={(ev) => setIdEmpleado(ev.target.value)}
                  disabled={cargandoEmpleados || guardando || cargando}
                >
                  <option value="">
                    {cargandoEmpleados ? "Cargando empleados..." : "Seleccione un empleado"}
                  </option>
                  {empleados.map((emp) => {
                    const id = getEmpleadoId(emp);
                    if (!id) return null;
                    return (
                      <option key={id} value={id}>
                        {getEmpleadoNombre(emp)} (ID: {id})
                      </option>
                    );
                  })}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={5}>
              <Form.Group>
                <Form.Label>Catálogo de horario</Form.Label>
                <Form.Select
                  value={catalogoSeleccionado}
                  onChange={(ev) => setCatalogoSeleccionado(ev.target.value)}
                  disabled={cargandoCatalogos || guardando || !catalogos.length || !hayEmpleado}
                >
                  <option value="">
                    {cargandoCatalogos
                      ? "Cargando catálogos..."
                      : !catalogos.length
                      ? "No hay catálogos activos"
                      : hayAsignado
                      ? "Ver asignado / (sin preview)"
                      : "Seleccione un catálogo"}
                  </option>
                  {catalogos.map((c) => (
                    <option key={c.idCatalogoHorario} value={c.idCatalogoHorario}>
                      {c.descripcion}
                      {c.tipoHorarioDescripcion ? ` (${c.tipoHorarioDescripcion})` : ""}
                      {typeof c.diasConfigurados === "number" ? ` - ${c.diasConfigurados} días` : ""}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md="auto">
              <Button
                variant="outline-primary"
                onClick={() => cargarHorarioEmpleado(idEmpleado)}
                disabled={cargando || guardando || !hayEmpleado}
              >
                {cargando ? (
                  <>
                    <Spinner size="sm" /> Cargando...
                  </>
                ) : (
                  "Refrescar"
                )}
              </Button>
            </Col>

            <Col md="auto">
              <Button
                variant="success"
                onClick={asignarCatalogo}
                disabled={cargando || guardando || !hayCatalogoSeleccionado || !hayEmpleado}
              >
                {guardando ? (
                  <>
                    <Spinner size="sm" /> Asignando...
                  </>
                ) : (
                  "Asignar horario"
                )}
              </Button>
            </Col>
          </Row>

          {hayAsignado ? (
            <div className="mt-3" style={{ fontSize: 14 }}>
              <div>
                <strong>Asignado:</strong> {horarioAsignado?.catalogoDescripcion || "(sin descripción)"}{" "}
                {horarioAsignado?.tipoHorarioDescripcion
                  ? `— Tipo: ${horarioAsignado.tipoHorarioDescripcion}`
                  : ""}
              </div>
              <div style={{ color: "#666" }}>
                idCatálogo: {horarioAsignado?.idCatalogoHorario} · idHorarioEmpleado:{" "}
                {horarioAsignado?.idHorarioEmpleado}
              </div>
            </div>
          ) : null}

          {hayEmpleado && hayCatalogoSeleccionado ? (
            <div className="mt-2" style={{ fontSize: 13, color: "#666" }}>
              Mostrando detalle de:{" "}
              {catalogoSeleccionadoObj?.descripcion || `Catálogo ${catalogoSeleccionado}`}
              {cargandoDetalleCatalogo ? " (cargando...)" : ""}
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <div className="mb-2" style={{ fontWeight: 600 }}>
            Detalle del horario (DAYOFWEEK: 1=Domingo … 7=Sábado)
          </div>

          {!hayEmpleado ? (
            <Alert variant="secondary">Seleccione un empleado.</Alert>
          ) : !hayAsignado && !hayCatalogoSeleccionado ? (
            <Alert variant="warning">
              El empleado no tiene horario asignado. Seleccione un catálogo para ver el detalle y asignarlo.
            </Alert>
          ) : null}

          <Table responsive bordered hover>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Día</th>
                <th style={{ width: 180 }}>Entrada</th>
                <th style={{ width: 180 }}>Salida</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {detalleConLabels.map((d) => (
                <tr key={`dia-${d.diaSemana}`}>
                  <td>{d.label}</td>
                  <td>
                    <Form.Control type="time" value={horaParaInput(d.entrada)} disabled readOnly />
                  </td>
                  <td>
                    <Form.Control type="time" value={horaParaInput(d.salida)} disabled readOnly />
                  </td>
                  <td style={{ fontSize: 13, color: "#666" }}>
                    {Number(d.activo) === 0 ? "Inactivo" : d.entrada && d.salida ? "" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div style={{ fontSize: 12, color: "#666" }}>
             
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
