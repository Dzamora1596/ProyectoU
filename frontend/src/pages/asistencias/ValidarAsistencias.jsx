//ValidarAsistencias.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row, Spinner, Badge, Alert } from "react-bootstrap";
import { DataGrid } from "@mui/x-data-grid";
import api from "../../api/axios";

function formatHora(hhmmss) {
  if (!hhmmss || hhmmss === "00:00:00") return "—";
  return String(hhmmss).slice(0, 5);
}

// ✅ Solo Pendiente / Confirmada
function EstadoBadge({ estado }) {
  if (estado === "Confirmada") return <Badge bg="success">Confirmada</Badge>;
  return <Badge bg="warning" text="dark">Pendiente</Badge>;
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

export default function ValidarAsistencias() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [empleados, setEmpleados] = useState([]);

  const [fEmpleadoId, setFEmpleadoId] = useState("");
  const [fEstado, setFEstado] = useState(""); // "" | "Pendiente" | "Confirmada"
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

  const limpiarMensajes = useCallback(() => {
    setErrorMsg("");
    setOkMsg("");
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
        .filter((e) => e.idEmpleado && !Number.isNaN(e.idEmpleado))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setEmpleados(mapped);
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error cargando empleados para filtro");
    }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    limpiarMensajes();

    try {
      const params = {};
      if (fEmpleadoId) params.empleadoId = fEmpleadoId;
      if (fEstado) params.estado = fEstado; // ✅ backend ya entiende Confirmada/Pendiente
      if (fFechaDesde) params.fechaDesde = fFechaDesde;
      if (fFechaHasta) params.fechaHasta = fFechaHasta;

      const { data } = await api.get("/asistencias", { params });

      const lista = Array.isArray(data?.asistencias)
        ? data.asistencias
        : Array.isArray(data)
          ? data
          : [];

      const mapped = lista.map((r) => ({
        ...r,
        id: r.idAsistencia,
      }));

      setRows(mapped);

      if (mapped.length === 0) setOkMsg("No se encontraron asistencias con los filtros seleccionados.");
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error cargando asistencias");
    } finally {
      setLoading(false);
    }
  }, [fEmpleadoId, fEstado, fFechaDesde, fFechaHasta, limpiarMensajes]);

  useEffect(() => {
    cargarEmpleados();
    cargar();
  }, [cargarEmpleados, cargar]);

  const abrirDetalle = useCallback(async (idAsistencia) => {
    if (!idAsistencia) return;

    setAccionLoading(true);
    limpiarMensajes();

    try {
      const { data } = await api.get(`/asistencias/${idAsistencia}`);
      const asistencia = data?.asistencia ?? data;

      setDetalle(asistencia);
      setShow(true);
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error obteniendo detalle");
    } finally {
      setAccionLoading(false);
    }
  }, [limpiarMensajes]);

  // ✅ Solo Confirmar / Quitar confirmación
  const cambiarEstado = useCallback(async (idAsistencia, estado) => {
    if (!idAsistencia) return;

    setAccionLoading(true);
    limpiarMensajes();

    try {
      await api.put(`/asistencias/${idAsistencia}/estado`, { estado });
      setOkMsg(`Asistencia actualizada a: ${estado}`);
      setShow(false);
      setDetalle(null);
      await cargar();
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error actualizando estado");
    } finally {
      setAccionLoading(false);
    }
  }, [limpiarMensajes, cargar]);

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
        `Importación completada. Insertados: ${data?.insertados ?? 0}, Actualizados: ${data?.actualizados ?? 0}`
      );

      setShowImport(false);
      setImportFile(null);

      await cargar();
    } catch (err) {
      setErrorMsg(err?.response?.data?.mensaje || "Error importando el Excel");
    } finally {
      setImportLoading(false);
    }
  }, [importFile, limpiarMensajes, cargar]);

  const columns = useMemo(
    () => [
      { field: "Fecha", headerName: "Fecha", flex: 1, minWidth: 110 },
      { field: "EmpleadoNombre", headerName: "Empleado", flex: 2, minWidth: 230 },
      {
        field: "Entrada",
        headerName: "Entrada",
        flex: 1,
        minWidth: 110,
        renderCell: (p) => formatHora(p?.row?.Entrada),
      },
      {
        field: "Salida",
        headerName: "Salida",
        flex: 1,
        minWidth: 110,
        renderCell: (p) => formatHora(p?.row?.Salida),
      },
      {
        field: "Tardia",
        headerName: "Tardía",
        flex: 0.8,
        minWidth: 90,
        renderCell: (p) => (Number(p?.row?.Tardia) === 1 ? "Sí" : "No"),
      },
      {
        field: "Ausente",
        headerName: "Ausente",
        flex: 0.8,
        minWidth: 90,
        renderCell: (p) => (Number(p?.row?.Ausente) === 1 ? "Sí" : "No"),
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
              {empleados.map((e) => (
                <option key={e.idEmpleado} value={e.idEmpleado}>
                  {e.nombre} (ID: {e.idEmpleado})
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
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          disableRowSelectionOnClick
          getRowId={(row) => row.idAsistencia}
        />
      </div>

      {/* DETALLE */}
      <Modal show={show} onHide={() => setShow(false)} centered size="lg">
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
                  <div><strong>Empleado:</strong> {detalle.EmpleadoNombre}</div>
                  <div><strong>Fecha:</strong> {detalle.Fecha}</div>
                </Col>
                <Col md={4} className="text-md-end">
                  <EstadoBadge estado={detalle.Estado} />
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}><strong>Entrada:</strong> {formatHora(detalle.Entrada)}</Col>
                <Col md={4}><strong>Salida:</strong> {formatHora(detalle.Salida)}</Col>
                <Col md={4}>
                  <strong>Tardía/Ausente:</strong>{" "}
                  {Number(detalle.Tardia) === 1 ? "Sí" : "No"} / {Number(detalle.Ausente) === 1 ? "Sí" : "No"}
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
          <Button variant="secondary" onClick={() => setShow(false)} disabled={accionLoading}>
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

      {/* IMPORTAR */}
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
            El sistema intentará detectar el empleado desde el Excel (por ejemplo: <b>(3)</b>).
            Si no se detecta, se registrará como no asignado.
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
