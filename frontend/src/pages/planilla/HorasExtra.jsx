import React, { useEffect, useMemo, useState } from "react";
import { 
  Button, Table, Card, Container, Row, Col, 
  Form, Alert, Badge, Spinner, ButtonGroup, InputGroup
} from "react-bootstrap";
import { obtenerCatalogosEstadosPorModulo } from "../../api/catalogosApi";
import {
  calcularHorasExtra,
  listarHorasExtra,
  cambiarEstadoHoraExtra,
} from "../../api/horasExtraApi";
 
function pad2(n) { return String(Number(n || 0)).padStart(2, "0"); }
function ymd(d) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
function parseYmd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

export default function HorasExtra() {
  const [estadosHoraExtra, setEstadosHoraExtra] = useState([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");  
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

   
  useEffect(() => {
    const now = new Date();
    setDesde(ymd(startOfMonth(now)));
    setHasta(ymd(endOfMonth(now)));
  }, []);

   
  useEffect(() => {
    async function cargarEstados() {
      try {
        const res = await obtenerCatalogosEstadosPorModulo({ modulo: "HORA_EXTRA" });
        setEstadosHoraExtra(res?.estados || []);
      } catch {
        setError("Error cargando estados de horas extra");
      }
    }
    cargarEstados();
  }, []);

  
  const rangoValido = useMemo(() => {
    const d = parseYmd(desde);
    const h = parseYmd(hasta);
    return !!(d && h && d <= h);
  }, [desde, hasta]);

   
  const datosFiltrados = useMemo(() => {
    if (!busqueda) return datos;
    return datos.filter(d => 
      d.EmpleadoNombre?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [datos, busqueda]);

  const estadoAprobadoId = useMemo(() => {
    const f = estadosHoraExtra.find((x) => x.descripcion === "APROBADO");
    return f ? Number(f.id) : 0;
  }, [estadosHoraExtra]);

  const estadoRechazadoId = useMemo(() => {
    const f = estadosHoraExtra.find((x) => x.descripcion === "RECHAZADO");
    return f ? Number(f.id) : 0;
  }, [estadosHoraExtra]);

  
  async function cargarListado(d = desde, h = hasta) {
    setCargando(true);
    setError("");
    try {
      const r = await listarHorasExtra({ desde: d, hasta: h });
      setDatos(Array.isArray(r) ? r : []);
    } catch {
      setError("Error cargando horas extra");
    } finally {
      setCargando(false);
    }
  }

  const configurarMesActual = () => {
    const now = new Date();
    const d = ymd(startOfMonth(now));
    const h = ymd(endOfMonth(now));
    setDesde(d);
    setHasta(h);
    cargarListado(d, h);
  };

  const configurarMesAnterior = () => {
    const now = new Date();
    const fechaMesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const d = ymd(startOfMonth(fechaMesPasado));
    const h = ymd(endOfMonth(fechaMesPasado));
    setDesde(d);
    setHasta(h);
    cargarListado(d, h);
  };

  async function ejecutarCalculo() {
    setCargando(true);
    setError("");
    try {
      const r = await calcularHorasExtra({ desde, hasta });
      setMensaje(`Cálculo ejecutado. Registros creados: ${r?.totalInsertadas || 0}`);
      await cargarListado();
    } catch {
      setError("Error calculando horas extra");
    } finally {
      setCargando(false);
    }
  }

  async function actualizarEstado(idExtra, estadoId) {
    setCargando(true);
    setError("");
    try {
      await cambiarEstadoHoraExtra(idExtra, estadoId);
      await cargarListado();
    } catch {
      setError("Error actualizando estado");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Container fluid className="py-4">
      <Card className="shadow-sm border-0" style={{ borderTop: "5px solid var(--dm-red)" }}>
        <Card.Header className="bg-white border-bottom py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h4 className="mb-0 fw-bold text-dark">Decoraciones Marenco</h4>
              <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                Gestión de Horas Extra
              </small>
            </div>
            <Badge bg="dark" className="px-3 py-2">Módulo de Planilla</Badge>
          </div>
        </Card.Header> 
        <Card.Body>
          {error && <Alert variant="danger" onClose={() => setError("")} dismissible>{error}</Alert>}
          {mensaje && <Alert variant="success" className="border-0 shadow-sm" style={{ borderLeft: "5px solid #28a745" }} onClose={() => setMensaje("")} dismissible>{mensaje}</Alert>}
          <Row className="g-3 align-items-end mb-3">
            <Col lg={3} md={6}>
              <Form.Label className="small fw-bold text-dark">FECHA INICIO</Form.Label>
              <Form.Control type="date" className="border-2" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Col>
            <Col lg={3} md={6}>
              <Form.Label className="small fw-bold text-dark">FECHA FIN</Form.Label>
              <Form.Control type="date" className="border-2" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Col>
            <Col lg={6} className="d-flex gap-2 justify-content-lg-end mt-3 mt-lg-0">
              <Button 
                variant="dark" 
                className="px-4 fw-bold"
                disabled={!rangoValido || cargando} 
                onClick={() => cargarListado()}
              >
                {cargando ? <Spinner size="sm" className="me-2" /> : null}
                Buscar
              </Button>
              <Button 
                style={{ backgroundColor: "var(--dm-red)", borderColor: "var(--dm-red)", fontWeight: 'bold' }} 
                disabled={!rangoValido || cargando} 
                onClick={ejecutarCalculo}
              >
                Ejecutar Cálculo
              </Button>
            </Col>
          </Row>
          <Row className="mb-4 pb-3 border-bottom align-items-center">
            <Col md={6} className="d-flex align-items-center gap-2 mb-3 mb-md-0">
              <span className="text-muted small fw-bold">RANGOS RÁPIDOS:</span>
              <ButtonGroup size="sm">
                <Button variant="outline-dark" onClick={configurarMesActual}>Este Mes</Button>
                <Button variant="outline-dark" onClick={configurarMesAnterior}>Mes Anterior</Button>
              </ButtonGroup>
            </Col>
            <Col md={6}>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-white border-end-0">
                </InputGroup.Text>
                <Form.Control
                  placeholder="Filtrar por nombre de empleado..."
                  className="border-start-0 ps-0"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <Button variant="outline-secondary" onClick={() => setBusqueda("")}>
                    Limpiar
                  </Button>
                )}
              </InputGroup>
            </Col>
          </Row>
          <div className="table-responsive">
            <Table hover className="align-middle border-0">
              <thead className="table-light">
                <tr className="text-uppercase small fw-bold" style={{ letterSpacing: '0.5px' }}>
                  <th>Empleado</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-end">Monto</th>
                  <th>Tipo</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      {cargando ? (
                        <div className="d-flex flex-column align-items-center">
                          <Spinner animation="border" variant="danger" className="mb-2" />
                          <span>Procesando datos...</span>
                        </div>
                      ) : (
                        busqueda ? `No se encontraron resultados para "${busqueda}"` : "No hay registros en este periodo"
                      )}
                    </td>
                  </tr>
                ) : (
                  datosFiltrados.map((d) => (
                    <tr key={d.idExtra} className="border-bottom">
                      <td className="fw-bold text-dark">{d.EmpleadoNombre}</td>
                      <td>{String(d.Fecha).slice(0, 10)}</td>
                      <td className="text-muted small">{d.Hora_Inicio} - {d.Hora_Final}</td>
                      <td className="text-center fw-semibold">{d.Cantidad}h</td>
                      <td className="text-end fw-bold text-dark">
                        ${Number(d.Monto).toFixed(2)}
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border fw-normal text-uppercase">
                          {d.TipoHoraExtra}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <Badge 
                          pill 
                          style={{ 
                            backgroundColor: d.Estado === "APROBADO" ? "#28a745" : d.Estado === "RECHAZADO" ? "var(--dm-red)" : "#ffc107",
                            padding: '6px 12px'
                          }}
                        >
                          {d.Estado}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <ButtonGroup size="sm">
                          <Button
                            variant="dark"
                            className="fw-bold px-3"
                            disabled={!estadoAprobadoId || d.Estado === "APROBADO" || cargando}
                            onClick={() => actualizarEstado(d.idExtra, estadoAprobadoId)}
                          >
                            Aprobar
                          </Button>
                          <Button
                            style={{ backgroundColor: 'var(--dm-red)', borderColor: 'var(--dm-red)', color: 'white' }}
                            className="fw-bold px-3"
                            disabled={!estadoRechazadoId || d.Estado === "RECHAZADO" || cargando}
                            onClick={() => actualizarEstado(d.idExtra, estadoRechazadoId)}
                          >
                            Rechazar
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}