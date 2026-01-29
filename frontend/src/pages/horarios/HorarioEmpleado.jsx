// src/pages/horarios/HorarioEmpleado.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import {
  obtenerHorarioEmpleado,
  obtenerDetalleHorarioEmpleado,
  listarCatalogosHorario,
  asignarCatalogoHorarioEmpleado,
  obtenerDetalleCatalogoHorario,
} from "../../services/horariosService";
import { listarEmpleados } from "../../services/empleadosService";

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

  const parts = [nombre, ap1, ap2]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

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

  const PAGE_SIZE = 31;
  const [page, setPage] = useState(1);
  const tableWrapRef = useRef(null);

  const resetTableScroll = useCallback(() => {
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, []);

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

  const totalPages = useMemo(() => {
    const n = Math.ceil((detalleConLabels.length || 0) / PAGE_SIZE);
    return n > 0 ? n : 1;
  }, [detalleConLabels.length]);

  const pagedDetalle = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return detalleConLabels.slice(start, start + PAGE_SIZE);
  }, [detalleConLabels, page]);

  const goToPage = useCallback(
    (p) => {
      const next = Math.max(1, Math.min(totalPages, Number(p || 1)));
      setPage(next);
      resetTableScroll();
    },
    [totalPages, resetTableScroll]
  );

  const cargarEmpleados = useCallback(async () => {
    setCargandoEmpleados(true);
    setError("");
    try {
      const r = await listarEmpleados();
      const data = extractApiData(r);
      const list = Array.isArray(data?.empleados) ? data.empleados : Array.isArray(data) ? data : [];
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

  const cargarDetalleDeCatalogo = useCallback(
    async (idCat) => {
      const cat = Number(idCat || 0);
      if (!cat) {
        setDetalleCatalogo(buildDetalleCompleto([]));
        setPage(1);
        resetTableScroll();
        return;
      }
      setCargandoDetalleCatalogo(true);
      setError("");
      try {
        const r = await obtenerDetalleCatalogoHorario(cat);
        const data = extractApiData(r);
        const raw = Array.isArray(data?.detalle) ? data.detalle : [];
        setDetalleCatalogo(buildDetalleCompleto(raw));
        setPage(1);
        resetTableScroll();
      } catch (err) {
        setError(String(err?.message || err));
      } finally {
        setCargandoDetalleCatalogo(false);
      }
    },
    [resetTableScroll]
  );

  const cargarHorarioEmpleado = useCallback(
    async (empId) => {
      const emp = Number(empId || 0);

      if (!emp) {
        setHorarioAsignado(null);
        setDetalleAsignado(buildDetalleCompleto([]));
        setCatalogoSeleccionado("");
        setDetalleCatalogo(buildDetalleCompleto([]));
        setInfo("");
        setPage(1);
        resetTableScroll();
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

        setPage(1);
        resetTableScroll();

        if (!h) setInfo("Este empleado aún no tiene horario asignado. Seleccioná un catálogo y asignalo.");
        else setInfo("Horario cargado.");
      } catch (err) {
        setHorarioAsignado(null);
        setDetalleAsignado(buildDetalleCompleto([]));
        setCatalogoSeleccionado("");
        setDetalleCatalogo(buildDetalleCompleto([]));
        setError(String(err?.message || err));
        setPage(1);
        resetTableScroll();
      } finally {
        setCargando(false);
      }
    },
    [resetTableScroll]
  );

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

  const mostrarIdsEnUI = useMemo(() => {
    try {
      const raw = localStorage.getItem("usuario") || "";
      if (!raw) return false;
      const u = JSON.parse(raw);
      const rolId = Number(u?.rolId ?? u?.Rol_idRol ?? u?.rol_id ?? u?.idRol ?? 0);
      return rolId === 1;
    } catch {
      return false;
    }
  }, []);

  return (
    <div className="container-fluid p-0">
      <div className="card">
        <div className="card-body">
          <Row className="g-2 align-items-center">
            <Col xs={12} md>
              <h4 className="mb-0 text-marenco-red">Horario por empleado</h4>
              <div className="text-muted small">Gestión para asignar horarios.</div>
            </Col>
          </Row>
        </div>
      </div>

      {(error || info) && (
        <div className="mt-3">
          {error ? (
            <Alert variant="danger" className="dm-alert-accent mb-2">
              {error}
            </Alert>
          ) : null}
          {info ? (
            <Alert variant="success" className="dm-alert-accent mb-0">
              {info}
            </Alert>
          ) : null}
        </div>
      )}

      <div className="card mt-3">
        <div className="card-body">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={4}>
              <Form.Group>
                <Form.Label>Empleado</Form.Label>
                <Form.Select
                  value={idEmpleado}
                  onChange={(ev) => setIdEmpleado(ev.target.value)}
                  disabled={cargandoEmpleados || guardando || cargando}
                >
                  <option value="">{cargandoEmpleados ? "Cargando empleados..." : "Seleccione un empleado"}</option>
                  {empleados.map((emp) => {
                    const id = getEmpleadoId(emp);
                    if (!id) return null;
                    return (
                      <option key={id} value={id}>
                        {getEmpleadoNombre(emp)}
                        {mostrarIdsEnUI ? ` (ID: ${id})` : ""}
                      </option>
                    );
                  })}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} md={5}>
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

            <Col xs={12} md="auto" className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                className="dm-btn-outline-red"
                onClick={() => cargarHorarioEmpleado(idEmpleado)}
                disabled={cargando || guardando || !hayEmpleado}
              >
                {cargando ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner size="sm" />
                    Cargando…
                  </span>
                ) : (
                  "Refrescar"
                )}
              </Button>

              <Button variant="primary" onClick={asignarCatalogo} disabled={cargando || guardando || !hayCatalogoSeleccionado || !hayEmpleado}>
                {guardando ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner size="sm" />
                    Asignando…
                  </span>
                ) : (
                  "Asignar horario"
                )}
              </Button>
            </Col>

            {hayAsignado ? (
              <Col xs={12}>
                <div className="dm-surface p-3 mt-2">
                  <div className="fw-semibold">
                    <span className="text-muted">Asignado:</span> {horarioAsignado?.catalogoDescripcion || "(sin descripción)"}{" "}
                    {horarioAsignado?.tipoHorarioDescripcion ? `— Tipo: ${horarioAsignado.tipoHorarioDescripcion}` : ""}
                  </div>
                  {mostrarIdsEnUI ? (
                    <div className="text-muted small">
                      idCatálogo: {horarioAsignado?.idCatalogoHorario} · idHorarioEmpleado: {horarioAsignado?.idHorarioEmpleado}
                    </div>
                  ) : null}
                </div>
              </Col>
            ) : null}

            {hayEmpleado && hayCatalogoSeleccionado ? (
              <Col xs={12}>
                <div className="text-muted small mt-2">
                  Mostrando detalle de: {catalogoSeleccionadoObj?.descripcion || `Catálogo ${catalogoSeleccionado}`}
                  {cargandoDetalleCatalogo ? " (cargando...)" : ""}
                </div>
              </Col>
            ) : null}
          </Row>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          <div className="px-3 py-3 border-bottom">
            <div className="fw-bold">Detalle del horario</div>
          </div>

          <div className="px-3 pt-3">
            {!hayEmpleado ? (
              <Alert variant="secondary" className="mb-0">
                Seleccione un empleado.
              </Alert>
            ) : !hayAsignado && !hayCatalogoSeleccionado ? (
              <Alert variant="danger" className="dm-alert-accent mb-0">
                El empleado no tiene horario asignado. Seleccione un catálogo para ver el detalle y asignarlo.
              </Alert>
            ) : null}
          </div>

          <div ref={tableWrapRef} className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <Table bordered hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 180 }} className="text-nowrap">
                    Día
                  </th>
                  <th style={{ width: 200 }} className="text-nowrap">
                    Entrada
                  </th>
                  <th style={{ width: 200 }} className="text-nowrap">
                    Salida
                  </th>
                  <th className="text-nowrap">Nota</th>
                </tr>
              </thead>
              <tbody>
                {pagedDetalle.map((d) => (
                  <tr key={`dia-${d.diaSemana}`}>
                    <td className="fw-semibold">{d.label}</td>
                    <td className="text-nowrap">
                      <Form.Control type="time" value={horaParaInput(d.entrada)} disabled readOnly />
                    </td>
                    <td className="text-nowrap">
                      <Form.Control type="time" value={horaParaInput(d.salida)} disabled readOnly />
                    </td>
                    <td className="text-muted" style={{ fontSize: 13 }}>
                      {Number(d.activo) === 0 ? "Inactivo" : d.entrada && d.salida ? "" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-top">
            <div className="text-muted small">
              {cargandoDetalleCatalogo
                ? "Cargando detalle..."
                : `${detalleConLabels.length} fila(s) • Página ${page} de ${totalPages} • Mostrando ${PAGE_SIZE} por página`}
            </div>

            <div className="d-flex align-items-center gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                className="dm-btn-outline-red"
                onClick={() => goToPage(page - 1)}
                disabled={cargando || guardando || page <= 1}
              >
                Anterior
              </Button>

              <Form.Select
                size="sm"
                value={page}
                onChange={(e) => goToPage(e.target.value)}
                disabled={cargando || guardando}
                style={{ width: 120, height: 36 }}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    Página {p}
                  </option>
                ))}
              </Form.Select>

              <Button
                size="sm"
                variant="outline-secondary"
                className="dm-btn-outline-red"
                onClick={() => goToPage(page + 1)}
                disabled={cargando || guardando || page >= totalPages}
              >
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
