// src/pages/horarios/CatalogosHorario.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
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
        idCatalogoHorarioDetalle: Number(x.idCatalogoHorarioDetalle ?? x.idCatalogo_Horario_Detalle ?? 0) || 0,
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

  const PAGE_SIZE = 31;
  const [page, setPage] = useState(1);
  const tableWrapRef = useRef(null);

  const detalleConOrden = useMemo(() => {
    return (detalle || []).slice().sort((a, b) => Number(a.diaSemana) - Number(b.diaSemana));
  }, [detalle]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((detalleConOrden.length || 0) / PAGE_SIZE);
    return n > 0 ? n : 1;
  }, [detalleConOrden.length]);

  const pagedDetalle = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return detalleConOrden.slice(start, start + PAGE_SIZE);
  }, [detalleConOrden, page]);

  const resetTableScroll = useCallback(() => {
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, []);

  const goToPage = useCallback(
    (p) => {
      const next = Math.max(1, Math.min(totalPages, Number(p || 1)));
      setPage(next);
      resetTableScroll();
    },
    [totalPages, resetTableScroll]
  );

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
      const list = Array.isArray(data?.tipos) ? data.tipos : Array.isArray(data?.tiposHorario) ? data.tiposHorario : [];
      setTiposHorario(list);
    } catch (err) {
      setError(String(err?.message || err));
      setTiposHorario([]);
    }
  }, []);

  const cargarDetalleCatalogo = useCallback(
    async (idCat) => {
      const id = Number(idCat || 0);
      if (!id) {
        setDetalle(buildDetalleCompleto([]));
        setDetalleDirty(false);
        setInfo("");
        setPage(1);
        resetTableScroll();
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
        setPage(1);
        resetTableScroll();
      } catch (err) {
        setDetalle(buildDetalleCompleto([]));
        setDetalleDirty(false);
        setError(String(err?.message || err));
        setPage(1);
        resetTableScroll();
      } finally {
        setCargandoDetalle(false);
      }
    },
    [resetTableScroll]
  );

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
      setPage(1);
      resetTableScroll();
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

    const tieneHoras = (entrada, salida) => !!(String(entrada || "").trim() && String(salida || "").trim());

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
              (prev || []).map((x) => (Number(x.diaSemana) === Number(c.diaSemana) ? { ...x, idCatalogoHorarioDetalle: newId } : x))
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
    <div className="container-fluid p-0">
      <div className="card">
        <div className="card-body">
          <Row className="g-2 align-items-center">
            <Col xs={12} md>
              <h4 className="mb-0 text-marenco-red">Catálogos de horario</h4>
              <div className="text-muted small">Tipo de Horarios.</div>
            </Col>
            <Col xs={12} md="auto" className="d-grid d-md-block">
              <div className="d-flex flex-column flex-md-row gap-2">
                <Button
                  variant="outline-secondary"
                  className="dm-btn-outline-red"
                  onClick={cargarCatalogos}
                  disabled={cargandoCatalogos || guardando}
                >
                  {cargandoCatalogos ? (
                    <span className="d-inline-flex align-items-center gap-2">
                      <Spinner size="sm" />
                      Recargando…
                    </span>
                  ) : (
                    "Recargar"
                  )}
                </Button>
                <Button variant="primary" onClick={abrirNuevoCatalogo} disabled={guardando}>
                  Nuevo catálogo
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {(error || info) && (
        <div className="mt-3">
          {error ? (
            <Alert variant="danger" className="dm-alert-accent mb-2" dismissible onClose={() => setError("")}>
              {error}
            </Alert>
          ) : null}
          {info ? (
            <Alert variant="success" className="dm-alert-accent mb-0" dismissible onClose={() => setInfo("")}>
              {info}
            </Alert>
          ) : null}
        </div>
      )}

      <div className="card mt-3">
        <div className="card-body">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={6}>
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

            <Col xs={12} md="auto" className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                className="dm-btn-outline-red"
                onClick={abrirEditarCatalogo}
                disabled={!catalogoId || guardando}
              >
                Editar
              </Button>

              <Button variant="danger" onClick={desactivarCatalogo} disabled={!catalogoId || guardando}>
                Desactivar
              </Button>
            </Col>

            {catalogoActual ? (
              <Col xs={12}>
                <div className="dm-surface p-3 mt-2">
                  <div className="fw-semibold">
                    <span className="text-muted">Seleccionado:</span> {catalogoActual.descripcion}
                    {catalogoActual.tipoHorarioDescripcion ? ` — ${catalogoActual.tipoHorarioDescripcion}` : ""}
                  </div>
                  <div className="text-muted small">
                    ID: {catalogoActual.idCatalogoHorario} · Activo: {Number(catalogoActual.activo) === 1 ? "Sí" : "No"}
                  </div>
                </div>
              </Col>
            ) : null}
          </Row>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-3 border-bottom">
            <div className="fw-bold">Detalle del catálogo</div>

            <Button variant="primary" onClick={guardarDetalle} disabled={!catalogoId || guardando || cargandoDetalle || !detalleDirty}>
              {guardando ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <Spinner size="sm" />
                  Guardando…
                </span>
              ) : (
                "Guardar detalle"
              )}
            </Button>
          </div>

          {!catalogoId ? (
            <div className="px-3 pb-3">
              <Alert variant="secondary" className="mb-0">
                Seleccione un catálogo para editar su detalle.
              </Alert>
            </div>
          ) : null}

          <div ref={tableWrapRef} className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <Table bordered hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 180 }} className="text-nowrap">
                    Día
                  </th>
                  <th style={{ width: 220 }} className="text-nowrap">
                    Entrada
                  </th>
                  <th style={{ width: 220 }} className="text-nowrap">
                    Salida
                  </th>
                  <th style={{ width: 120 }} className="text-nowrap text-center">
                    Activo
                  </th>
                  <th style={{ width: 150 }} className="text-nowrap text-center">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedDetalle.map((d) => (
                  <tr key={`dia-${d.diaSemana}`}>
                    <td className="fw-semibold">{d.label}</td>
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
                      <Button size="sm" variant="danger" disabled={!catalogoId || guardando || cargandoDetalle} onClick={() => desactivarDetalle(d.diaSemana)}>
                        Desactivar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-top">
            <div className="text-muted small">
              {cargandoDetalle
                ? "Cargando detalle..."
                : `${detalleConOrden.length} fila(s) • Página ${page} de ${totalPages} • Mostrando ${PAGE_SIZE} por página`}
            </div>

            <div className="d-flex align-items-center gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                className="dm-btn-outline-red"
                onClick={() => goToPage(page - 1)}
                disabled={guardando || cargandoDetalle || page <= 1}
              >
                Anterior
              </Button>

              <Form.Select
                size="sm"
                value={page}
                onChange={(e) => goToPage(e.target.value)}
                disabled={guardando || cargandoDetalle}
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
                disabled={guardando || cargandoDetalle || page >= totalPages}
              >
                Siguiente
              </Button>
            </div>

            {cargandoDetalle ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner size="sm" />
                <span className="small">Procesando…</span>
              </div>
            ) : null}
          </div>

          <div className="text-muted small px-3 pb-3">Nota: Si un turno cruza medianoche, la salida puede ser menor que la entrada (ej: 22:00 → 06:00).</div>
        </div>
      </div>

      <Modal show={showNuevoCatalogo} onHide={() => setShowNuevoCatalogo(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Nuevo catálogo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="dm-surface p-3">
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
                <Form.Check type="switch" label="Activo" checked={!!nuevoActivo} onChange={(ev) => setNuevoActivo(ev.target.checked)} />
              </Col>
            </Row>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setShowNuevoCatalogo(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardarNuevoCatalogo} disabled={guardando}>
            {guardando ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner size="sm" />
                Creando…
              </span>
            ) : (
              "Crear"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEditarCatalogo} onHide={() => setShowEditarCatalogo(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Editar catálogo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="dm-surface p-3">
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
                <Form.Check type="switch" label="Activo" checked={!!editActivo} onChange={(ev) => setEditActivo(ev.target.checked)} />
              </Col>
            </Row>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setShowEditarCatalogo(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardarEditarCatalogo} disabled={guardando}>
            {guardando ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner size="sm" />
                Guardando…
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
