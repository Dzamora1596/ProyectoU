// src/pages/horarios/CatalogosHorario.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import {
  listarCatalogosHorario,
  obtenerDetalleCatalogoHorario,
  crearCatalogoHorario,
  actualizarCatalogoHorario,
  eliminarCatalogoHorario,
  crearDetalleCatalogoHorario,
  actualizarDetalleCatalogoHorario,
  eliminarDetalleCatalogoHorario,
  listarTiposHorario,
} from "../../services/horariosService";

const DIAS = [
  { diaSemana: 1, label: "Domingo" },
  { diaSemana: 2, label: "Lunes" },
  { diaSemana: 3, label: "Martes" },
  { diaSemana: 4, label: "Miércoles" },
  { diaSemana: 5, label: "Jueves" },
  { diaSemana: 6, label: "Viernes" },
  { diaSemana: 7, label: "Sábado" },
];

function horaParaInput(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  return "";
}

function normalizarTimeInput(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return "";
}

function getTipoId(t) {
  const v = t?.idCatalogoTipoHorario ?? t?.idCatalogo_Tipo_Horario ?? t?.id;
  return Number(v || 0) || 0;
}

function getTipoDesc(t) {
  return String(t?.descripcion ?? t?.Descripcion ?? "").trim();
}

function buildDetalleCompleto(rawDetalle) {
  const map = new Map(
    (Array.isArray(rawDetalle) ? rawDetalle : []).map((x) => [
      Number(x.diaSemana ?? x.Dia_Semana),
      {
        idCatalogoHorarioDetalle:
          Number(x.idCatalogoHorarioDetalle ?? x.idCatalogo_Horario_Detalle ?? 0) || 0,
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
      label: d.label,
      idCatalogoHorarioDetalle: found?.idCatalogoHorarioDetalle || 0,
      entrada: found?.entrada || "",
      salida: found?.salida || "",
      activo: found?.activo ?? 1,
    };
  });
}

function extractApiData(r) {
  if (r?.ok) return r;
  if (r?.data?.ok) return r.data;
  return r?.data || r || {};
}

export default function CatalogosHorario() {
  const [catalogos, setCatalogos] = useState([]);
  const [tiposHorario, setTiposHorario] = useState([]);
  const [catalogoId, setCatalogoId] = useState("");
  const [catalogoActual, setCatalogoActual] = useState(null);
  const [detalle, setDetalle] = useState(buildDetalleCompleto([]));
  const [detalleDirty, setDetalleDirty] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showNuevoCatalogo, setShowNuevoCatalogo] = useState(false);
  const [nuevoDescripcion, setNuevoDescripcion] = useState("");
  const [nuevoTipoHorarioId, setNuevoTipoHorarioId] = useState("");
  const [nuevoActivo, setNuevoActivo] = useState(true);
  const [showEditarCatalogo, setShowEditarCatalogo] = useState(false);
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editTipoHorarioId, setEditTipoHorarioId] = useState("");
  const [editActivo, setEditActivo] = useState(true);

  const detalleConOrden = useMemo(() => {
    return (detalle || []).slice().sort((a, b) => Number(a.diaSemana) - Number(b.diaSemana));
  }, [detalle]);

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

  const cargarTiposHorario = useCallback(async () => {
    setError("");
    try {
      const r = await listarTiposHorario();
      const data = extractApiData(r);
      const list = Array.isArray(data?.tipos)
        ? data.tipos
        : Array.isArray(data?.tiposHorario)
        ? data.tiposHorario
        : [];
      setTiposHorario(list);
    } catch (err) {
      setError(String(err?.message || err));
      setTiposHorario([]);
    }
  }, []);

  const cargarDetalleCatalogo = useCallback(async (idCat) => {
    const id = Number(idCat || 0);
    if (!id) {
      setDetalle(buildDetalleCompleto([]));
      setDetalleDirty(false);
      setInfo("");
      return;
    }

    setCargandoDetalle(true);
    setError("");
    setInfo("");

    try {
      const r = await obtenerDetalleCatalogoHorario(id);
      const data = extractApiData(r);
      const raw = Array.isArray(data?.detalle) ? data.detalle : [];
      setDetalle(buildDetalleCompleto(raw));
      setDetalleDirty(false);
      setInfo("Detalle cargado.");
    } catch (err) {
      setDetalle(buildDetalleCompleto([]));
      setDetalleDirty(false);
      setError(String(err?.message || err));
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const seleccionarCatalogo = useCallback(
    async (idCat) => {
      const id = String(idCat || "");
      setCatalogoId(id);
      setError("");
      setInfo("");

      const c = catalogos.find((x) => String(x.idCatalogoHorario) === String(id));
      setCatalogoActual(c || null);

      if (c) {
        setEditDescripcion(String(c.descripcion || ""));
        setEditTipoHorarioId(String(c.tipoHorarioId ?? ""));
        setEditActivo(Number(c.activo ?? 1) === 1);
      } else {
        setEditDescripcion("");
        setEditTipoHorarioId("");
        setEditActivo(true);
      }

      await cargarDetalleCatalogo(id);
    },
    [catalogos, cargarDetalleCatalogo]
  );

  useEffect(() => {
    cargarTiposHorario();
    cargarCatalogos();
  }, [cargarTiposHorario, cargarCatalogos]);

  useEffect(() => {
    if (!catalogoId) return;
    const c = catalogos.find((x) => String(x.idCatalogoHorario) === String(catalogoId));
    setCatalogoActual(c || null);
  }, [catalogos, catalogoId]);

  const onChangeDetalle = (diaSemana, field, value) => {
    setDetalle((prev) =>
      (prev || []).map((x) => {
        if (Number(x.diaSemana) !== Number(diaSemana)) return x;
        if (field === "entrada") return { ...x, entrada: value };
        if (field === "salida") return { ...x, salida: value };
        if (field === "activo") return { ...x, activo: value ? 1 : 0 };
        return x;
      })
    );
    setDetalleDirty(true);
  };

  const abrirNuevoCatalogo = () => {
    setNuevoDescripcion("");
    setNuevoTipoHorarioId("");
    setNuevoActivo(true);
    setShowNuevoCatalogo(true);
    setError("");
    setInfo("");
  };

  const guardarNuevoCatalogo = async () => {
    const descripcion = String(nuevoDescripcion || "").trim();
    const tipoHorarioId = Number(nuevoTipoHorarioId || 0);
    const activo = nuevoActivo ? 1 : 0;

    if (!descripcion) {
      setError("La descripción es requerida.");
      return;
    }
    if (!tipoHorarioId) {
      setError("Debe seleccionar un tipo de horario.");
      return;
    }

    setGuardando(true);
    setError("");
    setInfo("");

    try {
      const r = await crearCatalogoHorario({ descripcion, tipoHorarioId, activo });
      const data = extractApiData(r);
      setInfo(data?.mensaje || "Catálogo creado.");
      setShowNuevoCatalogo(false);
      await cargarCatalogos();

      const newId = data?.idCatalogoHorario;
      if (newId) {
        await seleccionarCatalogo(String(newId));
      }
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditarCatalogo = () => {
    if (!catalogoActual) {
      setError("Seleccione un catálogo.");
      return;
    }
    setShowEditarCatalogo(true);
    setError("");
    setInfo("");
  };

  const guardarEditarCatalogo = async () => {
    const id = Number(catalogoId || 0);
    if (!id) {
      setError("Seleccione un catálogo.");
      return;
    }

    const descripcion = String(editDescripcion || "").trim();
    const tipoHorarioId = Number(editTipoHorarioId || 0);
    const activo = editActivo ? 1 : 0;

    if (!descripcion) {
      setError("La descripción es requerida.");
      return;
    }
    if (!tipoHorarioId) {
      setError("Debe seleccionar un tipo de horario.");
      return;
    }

    setGuardando(true);
    setError("");
    setInfo("");

    try {
      const r = await actualizarCatalogoHorario(id, { descripcion, tipoHorarioId, activo });
      const data = extractApiData(r);
      setInfo(data?.mensaje || "Catálogo actualizado.");
      setShowEditarCatalogo(false);
      await cargarCatalogos();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const desactivarCatalogo = async () => {
    const id = Number(catalogoId || 0);
    if (!id) {
      setError("Seleccione un catálogo.");
      return;
    }

    setGuardando(true);
    setError("");
    setInfo("");

    try {
      const r = await eliminarCatalogoHorario(id);
      const data = extractApiData(r);
      setInfo(data?.mensaje || "Catálogo desactivado.");
      setCatalogoId("");
      setCatalogoActual(null);
      setDetalle(buildDetalleCompleto([]));
      setDetalleDirty(false);
      await cargarCatalogos();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const guardarDetalle = async () => {
    const id = Number(catalogoId || 0);
    if (!id) {
      setError("Seleccione un catálogo.");
      return;
    }

    const tieneHoras = (entrada, salida) =>
      !!(String(entrada || "").trim() && String(salida || "").trim());

    const cambios = (detalle || []).map((d) => {
      const entradaHHMM = horaParaInput(d.entrada);
      const salidaHHMM = horaParaInput(d.salida);
      const entrada = normalizarTimeInput(entradaHHMM);
      const salida = normalizarTimeInput(salidaHHMM);

      return {
        diaSemana: Number(d.diaSemana),
        idCatalogoHorarioDetalle: Number(d.idCatalogoHorarioDetalle || 0),
        entrada,
        salida,
        activo: Number(d.activo ?? 1) === 1 ? 1 : 0,
      };
    });

    for (const c of cambios) {
      const alguna = !!(c.entrada || c.salida);
      const ambas = !!(c.entrada && c.salida);
      if (alguna && !ambas) {
        const label = DIAS.find((x) => x.diaSemana === c.diaSemana)?.label || `día ${c.diaSemana}`;
        setError(`En ${label} debe poner Entrada y Salida.`);
        return;
      }
    }

    setGuardando(true);
    setError("");
    setInfo("");

    try {
      for (const c of cambios) {
        const existe = c.idCatalogoHorarioDetalle > 0;
        const horas = tieneHoras(c.entrada, c.salida);

        if (existe && !horas) {
          await eliminarDetalleCatalogoHorario(id, c.idCatalogoHorarioDetalle);
          continue;
        }

        if (existe && horas) {
          await actualizarDetalleCatalogoHorario(id, c.idCatalogoHorarioDetalle, {
            entrada: c.entrada,
            salida: c.salida,
            activo: c.activo,
          });
          continue;
        }

        if (!existe && horas) {
          const r = await crearDetalleCatalogoHorario(id, {
            diaSemana: c.diaSemana,
            entrada: c.entrada,
            salida: c.salida,
            activo: c.activo,
          });

          const data = extractApiData(r);
          const newId = Number(data?.idCatalogoHorarioDetalle || 0);
          if (newId) {
            setDetalle((prev) =>
              (prev || []).map((x) =>
                Number(x.diaSemana) === Number(c.diaSemana)
                  ? { ...x, idCatalogoHorarioDetalle: newId }
                  : x
              )
            );
          }
          continue;
        }
      }

      setInfo("Detalle guardado.");
      setDetalleDirty(false);
      await cargarCatalogos();
      await cargarDetalleCatalogo(id);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const desactivarDetalle = async (diaSemana) => {
    const id = Number(catalogoId || 0);
    if (!id) {
      setError("Seleccione un catálogo.");
      return;
    }

    const row = (detalle || []).find((x) => Number(x.diaSemana) === Number(diaSemana));
    const idDet = Number(row?.idCatalogoHorarioDetalle || 0);

    if (!idDet) {
      onChangeDetalle(diaSemana, "entrada", "");
      onChangeDetalle(diaSemana, "salida", "");
      onChangeDetalle(diaSemana, "activo", false);
      return;
    }

    setGuardando(true);
    setError("");
    setInfo("");

    try {
      const r = await eliminarDetalleCatalogoHorario(id, idDet);
      const data = extractApiData(r);
      setInfo(data?.mensaje || "Detalle desactivado.");
      await cargarDetalleCatalogo(id);
      await cargarCatalogos();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="m-0">Catálogos de horario</h3>
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            onClick={cargarCatalogos}
            disabled={cargandoCatalogos || guardando}
          >
            {cargandoCatalogos ? (
              <>
                <Spinner size="sm" className="me-1" /> Recargando...
              </>
            ) : (
              "Recargar"
            )}
          </Button>
          <Button variant="primary" onClick={abrirNuevoCatalogo} disabled={guardando}>
            Nuevo catálogo
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {info ? (
        <Alert variant="success" dismissible onClose={() => setInfo("")}>
          {info}
        </Alert>
      ) : null}

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Catálogo</Form.Label>
                <Form.Select
                  value={catalogoId}
                  onChange={(ev) => seleccionarCatalogo(ev.target.value)}
                  disabled={cargandoCatalogos || guardando}
                >
                  <option value="">{cargandoCatalogos ? "Cargando..." : "Seleccione un catálogo"}</option>
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
              <Button variant="outline-primary" onClick={abrirEditarCatalogo} disabled={!catalogoId || guardando}>
                Editar
              </Button>
            </Col>

            <Col md="auto">
              <Button variant="outline-danger" onClick={desactivarCatalogo} disabled={!catalogoId || guardando}>
                Desactivar
              </Button>
            </Col>
          </Row>

          {catalogoActual ? (
            <div className="mt-3" style={{ fontSize: 14, color: "#555" }}>
              <div>
                <strong>Seleccionado:</strong> {catalogoActual.descripcion}
                {catalogoActual.tipoHorarioDescripcion ? ` — ${catalogoActual.tipoHorarioDescripcion}` : ""}
              </div>
              <div>
                ID: {catalogoActual.idCatalogoHorario} · Activo:{" "}
                {Number(catalogoActual.activo) === 1 ? "Sí" : "No"}
              </div>
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div style={{ fontWeight: 600 }}>Detalle del catálogo (1=Domingo … 7=Sábado)</div>
            <div className="d-flex gap-2">
              <Button
                variant="success"
                onClick={guardarDetalle}
                disabled={!catalogoId || guardando || cargandoDetalle || !detalleDirty}
              >
                {guardando ? (
                  <>
                    <Spinner size="sm" className="me-1" /> Guardando...
                  </>
                ) : (
                  "Guardar detalle"
                )}
              </Button>
            </div>
          </div>

          {!catalogoId ? <Alert variant="secondary">Seleccione un catálogo para editar su detalle.</Alert> : null}

          <Table responsive bordered hover>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Día</th>
                <th style={{ width: 200 }}>Entrada</th>
                <th style={{ width: 200 }}>Salida</th>
                <th style={{ width: 120 }}>Activo</th>
                <th style={{ width: 140 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {detalleConOrden.map((d) => (
                <tr key={`dia-${d.diaSemana}`}>
                  <td>{d.label}</td>
                  <td>
                    <Form.Control
                      type="time"
                      value={horaParaInput(d.entrada)}
                      disabled={!catalogoId || guardando || cargandoDetalle}
                      onChange={(ev) => onChangeDetalle(d.diaSemana, "entrada", ev.target.value)}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="time"
                      value={horaParaInput(d.salida)}
                      disabled={!catalogoId || guardando || cargandoDetalle}
                      onChange={(ev) => onChangeDetalle(d.diaSemana, "salida", ev.target.value)}
                    />
                  </td>
                  <td className="text-center">
                    <Form.Check
                      type="switch"
                      checked={Number(d.activo) === 1}
                      disabled={!catalogoId || guardando || cargandoDetalle}
                      onChange={(ev) => onChangeDetalle(d.diaSemana, "activo", ev.target.checked)}
                    />
                  </td>
                  <td className="text-center">
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={!catalogoId || guardando || cargandoDetalle}
                      onClick={() => desactivarDetalle(d.diaSemana)}
                    >
                      Desactivar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div style={{ fontSize: 12, color: "#666" }}>
            Nota: Si un turno cruza medianoche, la salida puede ser menor que la entrada (ej: 22:00 → 06:00).
          </div>
        </Card.Body>
      </Card>

      <Modal show={showNuevoCatalogo} onHide={() => setShowNuevoCatalogo(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Nuevo catálogo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-2">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Descripción</Form.Label>
                <Form.Control
                  value={nuevoDescripcion}
                  onChange={(ev) => setNuevoDescripcion(ev.target.value)}
                  placeholder="Ej: Administrativo diurno"
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Tipo de horario</Form.Label>
                <Form.Select
                  value={nuevoTipoHorarioId}
                  onChange={(ev) => setNuevoTipoHorarioId(ev.target.value)}
                  disabled={!tiposHorario.length}
                >
                  <option value="">{tiposHorario.length ? "Seleccione" : "No hay tipos"}</option>
                  {tiposHorario.map((t) => (
                    <option key={getTipoId(t)} value={getTipoId(t)}>
                      {getTipoDesc(t)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Check
                type="switch"
                label="Activo"
                checked={!!nuevoActivo}
                onChange={(ev) => setNuevoActivo(ev.target.checked)}
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNuevoCatalogo(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardarNuevoCatalogo} disabled={guardando}>
            {guardando ? <Spinner size="sm" /> : "Crear"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEditarCatalogo} onHide={() => setShowEditarCatalogo(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar catálogo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-2">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Descripción</Form.Label>
                <Form.Control value={editDescripcion} onChange={(ev) => setEditDescripcion(ev.target.value)} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Tipo de horario</Form.Label>
                <Form.Select
                  value={editTipoHorarioId}
                  onChange={(ev) => setEditTipoHorarioId(ev.target.value)}
                  disabled={!tiposHorario.length}
                >
                  <option value="">{tiposHorario.length ? "Seleccione" : "No hay tipos"}</option>
                  {tiposHorario.map((t) => (
                    <option key={getTipoId(t)} value={getTipoId(t)}>
                      {getTipoDesc(t)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Check
                type="switch"
                label="Activo"
                checked={!!editActivo}
                onChange={(ev) => setEditActivo(ev.target.checked)}
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditarCatalogo(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardarEditarCatalogo} disabled={guardando}>
            {guardando ? <Spinner size="sm" /> : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
