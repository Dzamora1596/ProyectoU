//RegistroPersonal.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Modal,
  Form,
  Row,
  Col,
  InputGroup,
  Spinner,
  Badge,
  Alert,
} from "react-bootstrap";

import { DataGrid } from "@mui/x-data-grid";
import { Box } from "@mui/material";

import {
  listarRegistroPersonal,
  obtenerRegistroPersonalPorId,
  crearRegistroPersonal,
  actualizarRegistroPersonal,
  desactivarRegistroPersonal,
} from "../api/registroPersonalApi";

import { obtenerCatalogosRegistroPersonal } from "../api/catalogosApi";

function toBool(v) {
  if (v === true || v === 1 || v === "1") return true;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "si" || s === "sí";
}

function emptyForm() {
  return {
    persona: {
      idPersona: "",
      nombre: "",
      apellido1: "",
      apellido2: "",
      generoId: "",
      fechaNacimiento: "",
      cantidadHijos: 0,
      activo: true,
    },
    empleado: {
      fechaIngreso: "",
      salario: "",
      cadenciaPagoId: "",
      cadenciaPago: "",
      activo: true,
    },
    telefonos: [{ idTelefono: "", tipoTelefonoId: "", activo: true }],
    correos: [{ correo: "", tipoCorreoId: "", activo: true }],
  };
}

function validateEmail(email) {
  const s = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function calcAgeFromYYYYMMDD(dateStr) {
  const s = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;

  const [yy, mm, dd] = s.split("-").map((x) => Number(x));
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();

  let age = y - yy;
  if (m < mm || (m === mm && d < dd)) age -= 1;
  return age;
}

export default function RegistroPersonal() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingIdEmpleado, setEditingIdEmpleado] = useState(null);

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [cats, setCats] = useState({
    generos: [],
    cadenciasPago: [],
    tiposTelefono: [],
    tiposCorreo: [],
  });
  const [catsLoading, setCatsLoading] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [idEmpleadoToDisable, setIdEmpleadoToDisable] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setCatsLoading(true);

        const r = await obtenerCatalogosRegistroPersonal();

        const raw =
          (r?.ok ? r : null) ||
          (r?.data?.ok ? r.data : null) ||
          r?.data ||
          r ||
          {};

        const normGenero = (x) => ({
          id: x?.id ?? x?.idCatalogo_Genero ?? x?.idCatalogoGenero ?? x?.idGenero ?? "",
          descripcion:
            x?.descripcion ??
            x?.Descripcion_Genero ??
            x?.Descripcion ??
            x?.DescripcionGenero ??
            "",
        });

        const normCadencia = (x) => ({
          id:
            x?.id ??
            x?.idCatalogo_Cadencia_Pago ??
            x?.idCatalogoCadenciaPago ??
            x?.idCadenciaPago ??
            "",
          descripcion: x?.descripcion ?? x?.Descripcion ?? x?.Descripcion_Cadencia_Pago ?? "",
        });

        const normTipoTelefono = (x) => ({
          id:
            x?.id ??
            x?.idCatalogo_Tipo_Telefono ??
            x?.idCatalogoTipoTelefono ??
            x?.idTipoTelefono ??
            "",
          descripcion: x?.descripcion ?? x?.Descripcion_Tipo_Telefono ?? x?.Descripcion ?? "",
        });

        const normTipoCorreo = (x) => ({
          id:
            x?.id ??
            x?.idCatalogo_Tipo_Correo ??
            x?.idCatalogoTipoCorreo ??
            x?.idTipoCorreo ??
            "",
          descripcion: x?.descripcion ?? x?.Descripcion_Tipo_Correo ?? x?.Descripcion ?? "",
        });

        const generos = Array.isArray(raw?.generos) ? raw.generos.map(normGenero) : [];
        const cadenciasPago = Array.isArray(raw?.cadenciasPago)
          ? raw.cadenciasPago.map(normCadencia)
          : [];
        const tiposTelefono = Array.isArray(raw?.tiposTelefono)
          ? raw.tiposTelefono.map(normTipoTelefono)
          : [];
        const tiposCorreo = Array.isArray(raw?.tiposCorreo)
          ? raw.tiposCorreo.map(normTipoCorreo)
          : [];

        setCats({
          generos,
          cadenciasPago,
          tiposTelefono,
          tiposCorreo,
        });
      } catch (e) {
        setErrorMsg(String(e?.response?.data?.mensaje || e?.message || e));
      } finally {
        setCatsLoading(false);
      }
    })();
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const r = await listarRegistroPersonal({
        texto: texto.trim(),
        activo: activo === "" ? undefined : activo,
      });

      const data = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
      setRows(data);
    } catch (e) {
      setErrorMsg(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [texto, activo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = useCallback(() => {
    setMode("create");
    setEditingIdEmpleado(null);
    setForm(emptyForm());
    setErrorMsg("");
    setShowModal(true);
  }, []);

  const cerrarModal = useCallback(() => {
    if (saving) return;
    setShowModal(false);
  }, [saving]);

  const onEditar = useCallback(async (idEmpleado) => {
    setMode("edit");
    setEditingIdEmpleado(idEmpleado);
    setErrorMsg("");
    setSaving(false);
    setShowModal(true);

    try {
      const r = await obtenerRegistroPersonalPorId(idEmpleado);
      const data = r?.data ? r.data : r;

      const next = emptyForm();

      next.empleado = {
        ...next.empleado,
        ...data?.empleado,
        activo: toBool(data?.empleado?.activo),
        fechaIngreso: String(data?.empleado?.fechaIngreso || "").slice(0, 10),
        cadenciaPagoId: data?.empleado?.cadenciaPagoId ?? "",
        cadenciaPago: data?.empleado?.cadenciaPago ?? "",
      };

      next.persona = {
        ...next.persona,
        ...data?.persona,
        activo: toBool(data?.persona?.activo),
        generoId: data?.persona?.generoId ?? "",
        fechaNacimiento: String(data?.persona?.fechaNacimiento || "").slice(0, 10),
      };

      next.telefonos =
        Array.isArray(data?.telefonos) && data.telefonos.length
          ? data.telefonos.map((t) => ({
              idTelefono: t.idTelefono ?? "",
              tipoTelefonoId: t.tipoTelefonoId ?? "",
              activo: toBool(t.activo),
            }))
          : [{ idTelefono: "", tipoTelefonoId: "", activo: true }];

      next.correos =
        Array.isArray(data?.correos) && data.correos.length
          ? data.correos.map((c) => ({
              correo: c.correo ?? "",
              tipoCorreoId: c.tipoCorreoId ?? "",
              activo: toBool(c.activo),
            }))
          : [{ correo: "", tipoCorreoId: "", activo: true }];

      setForm(next);
    } catch (e) {
      setErrorMsg(String(e?.message || e));
    }
  }, []);

  const onDesactivar = useCallback((idEmpleado) => {
    setIdEmpleadoToDisable(idEmpleado);
    setShowConfirm(true);
  }, []);

  const cerrarConfirm = useCallback(() => {
    if (confirmLoading) return;
    setShowConfirm(false);
    setIdEmpleadoToDisable(null);
  }, [confirmLoading]);

  const confirmarDesactivar = useCallback(async () => {
    if (!idEmpleadoToDisable) return;

    try {
      setConfirmLoading(true);
      await desactivarRegistroPersonal(idEmpleadoToDisable);
      setShowConfirm(false);
      setIdEmpleadoToDisable(null);
      await cargar();
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setConfirmLoading(false);
    }
  }, [idEmpleadoToDisable, cargar]);

  const validar = useCallback(() => {
    const p = form.persona;
    const e = form.empleado;

    if (!String(p.idPersona || "").trim()) return "Debe indicar idPersona.";
    if (!String(p.nombre || "").trim()) return "Debe indicar nombre.";
    if (!String(p.apellido1 || "").trim()) return "Debe indicar apellido1.";
    if (!String(p.apellido2 || "").trim()) return "Debe indicar apellido2.";
    if (!String(p.generoId || "").trim()) return "Debe seleccionar género.";

    const fn = String(p.fechaNacimiento || "").trim();
    if (!fn) return "Debe indicar fecha de nacimiento.";
    const age = calcAgeFromYYYYMMDD(fn);
    if (!Number.isFinite(age)) return "Fecha de nacimiento inválida (use YYYY-MM-DD).";
    if (age < 18) return "No se permite registrar personal menor de 18 años.";

    if (!String(e.fechaIngreso || "").trim()) return "Debe indicar fechaIngreso.";
    if (e.salario === "" || e.salario === null || e.salario === undefined)
      return "Debe indicar salario.";

    const cadId = String(e.cadenciaPagoId || "").trim();
    const cadTxt = String(e.cadenciaPago || "").trim();
    if (!cadId && !cadTxt) return "Debe indicar cadencia de pago.";

    const tels = form.telefonos || [];
    if (!tels.length) return "Debe registrar al menos un teléfono.";
    for (const t of tels) {
      if (!String(t.idTelefono || "").trim()) return "Cada teléfono debe incluir idTelefono.";
      if (!String(t.tipoTelefonoId || "").trim()) return "Cada teléfono debe seleccionar tipo.";
    }

    const cors = form.correos || [];
    if (!cors.length) return "Debe registrar al menos un correo.";
    for (const c of cors) {
      if (!String(c.correo || "").trim()) return "Cada correo debe incluir correo.";
      if (!validateEmail(c.correo)) return `Correo inválido: ${c.correo}`;
      if (!String(c.tipoCorreoId || "").trim()) return "Cada correo debe seleccionar tipo.";
    }

    return null;
  }, [form]);

  const onGuardar = useCallback(async () => {
    const err = validar();
    if (err) {
      setErrorMsg(err);
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const payload = {
      persona: {
        idPersona: Number(form.persona.idPersona),
        nombre: String(form.persona.nombre).trim(),
        apellido1: String(form.persona.apellido1).trim(),
        apellido2: String(form.persona.apellido2).trim(),
        generoId: Number(form.persona.generoId),
        fechaNacimiento: String(form.persona.fechaNacimiento).slice(0, 10),
        cantidadHijos: Number(form.persona.cantidadHijos),
        activo: form.persona.activo ? 1 : 0,
      },
      empleado: {
        fechaIngreso: String(form.empleado.fechaIngreso).slice(0, 10),
        salario: form.empleado.salario,
        cadenciaPagoId:
          form.empleado.cadenciaPagoId !== ""
            ? Number(form.empleado.cadenciaPagoId)
            : undefined,
        cadenciaPago: form.empleado.cadenciaPagoId
          ? undefined
          : String(form.empleado.cadenciaPago || "").trim(),
        activo: form.empleado.activo ? 1 : 0,
      },
      telefonos: (form.telefonos || []).map((t) => ({
        idTelefono: Number(t.idTelefono),
        tipoTelefonoId: Number(t.tipoTelefonoId),
        activo: t.activo ? 1 : 0,
      })),
      correos: (form.correos || []).map((c) => ({
        correo: String(c.correo).trim(),
        tipoCorreoId: Number(c.tipoCorreoId),
        activo: c.activo ? 1 : 0,
      })),
    };

    try {
      if (mode === "create") {
        await crearRegistroPersonal(payload);
      } else {
        await actualizarRegistroPersonal(editingIdEmpleado, payload);
      }

      setShowModal(false);
      await cargar();
    } catch (e) {
      setErrorMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [mode, editingIdEmpleado, form, cargar, validar]);

  const gridRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        id: r.idEmpleado,
        nombreCompleto: `${r.nombre ?? ""} ${r.apellido1 ?? ""} ${r.apellido2 ?? ""}`.trim(),
        activoOk: toBool(r.empleadoActivo) && toBool(r.personaActivo),
        fechaIngresoFmt: r.fechaIngreso ? String(r.fechaIngreso).slice(0, 10) : "",
      })),
    [rows]
  );

  const columns = useMemo(
    () => [
      {
        field: "idEmpleado",
        headerName: "Empleado",
        width: 110,
        sortable: true,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "idPersona",
        headerName: "Cédula",
        width: 140,
        sortable: true,
        align: "center",
        headerAlign: "center",
      },
      { field: "nombreCompleto", headerName: "Nombre", flex: 1, minWidth: 260 },
      {
        field: "fechaIngresoFmt",
        headerName: "Ingreso",
        width: 130,
        sortable: true,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "activoOk",
        headerName: "Activo",
        width: 110,
        sortable: true,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Badge bg={params.value ? "success" : "secondary"}>
            {params.value ? "Sí" : "No"}
          </Badge>
        ),
      },
      {
        field: "acciones",
        headerName: "Acciones",
        width: 240,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <div className="d-flex gap-2 justify-content-center">
            <Button size="sm" variant="primary" onClick={() => onEditar(params.row.idEmpleado)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => onDesactivar(params.row.idEmpleado)}
            >
              Desactivar
            </Button>
          </div>
        ),
      },
    ],
    [onEditar, onDesactivar]
  );

  const setPersona = (key, value) =>
    setForm((prev) => ({ ...prev, persona: { ...prev.persona, [key]: value } }));

  const setEmpleado = (key, value) =>
    setForm((prev) => ({ ...prev, empleado: { ...prev.empleado, [key]: value } }));

  const addTelefono = () =>
    setForm((prev) => ({
      ...prev,
      telefonos: [...(prev.telefonos || []), { idTelefono: "", tipoTelefonoId: "", activo: true }],
    }));

  const delTelefono = (idx) =>
    setForm((prev) => ({
      ...prev,
      telefonos: (prev.telefonos || []).filter((_, i) => i !== idx),
    }));

  const setTelefono = (idx, key, value) =>
    setForm((prev) => {
      const next = [...(prev.telefonos || [])];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, telefonos: next };
    });

  const addCorreo = () =>
    setForm((prev) => ({
      ...prev,
      correos: [...(prev.correos || []), { correo: "", tipoCorreoId: "", activo: true }],
    }));

  const delCorreo = (idx) =>
    setForm((prev) => ({
      ...prev,
      correos: (prev.correos || []).filter((_, i) => i !== idx),
    }));

  const setCorreo = (idx, key, value) =>
    setForm((prev) => {
      const next = [...(prev.correos || [])];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, correos: next };
    });

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="m-0">Registro Personal</h3>
        <Button variant="success" onClick={abrirCrear}>
          + Nuevo
        </Button>
      </div>

      {errorMsg ? <Alert variant="danger">{errorMsg}</Alert> : null}

      <Row className="g-2 mb-3">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>Buscar</InputGroup.Text>
            <Form.Control
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Empleado, cédula, nombre o apellido..."
            />
            <Button variant="outline-secondary" onClick={cargar}>
              Aplicar
            </Button>
          </InputGroup>
        </Col>

        <Col md={3}>
          <InputGroup>
            <InputGroup.Text>Activo</InputGroup.Text>
            <Form.Select value={activo} onChange={(e) => setActivo(e.target.value)}>
              <option value="">Todos</option>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </Form.Select>
          </InputGroup>
        </Col>

        <Col md={3} className="d-flex justify-content-end">
          <Button variant="outline-primary" onClick={cargar} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" /> Cargando...
              </>
            ) : (
              "Refrescar"
            )}
          </Button>
        </Col>
      </Row>

      <div className="card">
        <div className="card-body">
          <Box sx={{ width: "100%", height: 520 }}>
            <DataGrid
              rows={gridRows}
              columns={columns}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
              }}
              getRowHeight={() => "auto"}
              sx={{
                "& .MuiDataGrid-columnHeaders": { fontWeight: 700 },
                "& .MuiDataGrid-cell": { py: 1 },
              }}
            />
          </Box>
        </div>
      </div>

      <Modal show={showModal} onHide={cerrarModal} size="lg" backdrop="static" centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {mode === "create"
              ? "Nuevo Registro Personal"
              : `Editar Registro (Empleado #${editingIdEmpleado})`}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {catsLoading ? (
            <Alert variant="info" className="py-2">
              Cargando catálogos...
            </Alert>
          ) : null}

          <h5 className="mb-2">Persona</h5>
          <Row className="g-2">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Cédula</Form.Label>
                <Form.Control
                  value={form.persona.idPersona}
                  onChange={(e) => setPersona("idPersona", e.target.value)}
                  disabled={mode === "edit"}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Género</Form.Label>
                <Form.Select
                  value={form.persona.generoId}
                  onChange={(e) => setPersona("generoId", e.target.value)}
                  disabled={catsLoading}
                >
                  <option value="">Seleccione...</option>
                  {cats.generos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.descripcion}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Cantidad hijos</Form.Label>
                <Form.Control
                  type="number"
                  value={form.persona.cantidadHijos}
                  onChange={(e) => setPersona("cantidadHijos", e.target.value)}
                  min={0}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Fecha de nacimiento</Form.Label>
                <Form.Control
                  type="date"
                  value={form.persona.fechaNacimiento}
                  onChange={(e) => setPersona("fechaNacimiento", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  value={form.persona.nombre}
                  onChange={(e) => setPersona("nombre", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Apellido 1</Form.Label>
                <Form.Control
                  value={form.persona.apellido1}
                  onChange={(e) => setPersona("apellido1", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Apellido 2</Form.Label>
                <Form.Control
                  value={form.persona.apellido2}
                  onChange={(e) => setPersona("apellido2", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Check
                className="mt-4"
                type="switch"
                label="Persona Activa"
                checked={!!form.persona.activo}
                onChange={(e) => setPersona("activo", e.target.checked)}
              />
            </Col>
          </Row>

          <hr />

          <h5 className="mb-2">Empleado</h5>
          <Row className="g-2">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Fecha ingreso</Form.Label>
                <Form.Control
                  type="date"
                  value={form.empleado.fechaIngreso}
                  onChange={(e) => setEmpleado("fechaIngreso", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Salario</Form.Label>
                <Form.Control
                  value={form.empleado.salario}
                  onChange={(e) => setEmpleado("salario", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Cadencia de pago</Form.Label>
                <Form.Select
                  value={form.empleado.cadenciaPagoId}
                  onChange={(e) => setEmpleado("cadenciaPagoId", e.target.value)}
                  disabled={catsLoading}
                >
                  <option value="">Seleccione...</option>
                  {cats.cadenciasPago.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.descripcion}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Cadencia (texto opcional)</Form.Label>
                <Form.Control
                  value={form.empleado.cadenciaPago}
                  onChange={(e) => setEmpleado("cadenciaPago", e.target.value)}
                  disabled={!!form.empleado.cadenciaPagoId}
                  placeholder="Solo si no usa el select"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Check
                className="mt-4"
                type="switch"
                label="Empleado Activo"
                checked={!!form.empleado.activo}
                onChange={(e) => setEmpleado("activo", e.target.checked)}
              />
            </Col>
          </Row>

          <hr />

          <div className="d-flex align-items-center justify-content-between">
            <h5 className="m-0">Teléfonos</h5>
            <Button variant="outline-success" size="sm" onClick={addTelefono}>
              + Agregar
            </Button>
          </div>

          <div className="mt-2">
            {(form.telefonos || []).map((t, idx) => (
              <Row className="g-2 align-items-end mb-2" key={`tel-${idx}`}>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Teléfono</Form.Label>
                    <Form.Control
                      value={t.idTelefono}
                      onChange={(e) => setTelefono(idx, "idTelefono", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={5}>
                  <Form.Group>
                    <Form.Label>Tipo de teléfono</Form.Label>
                    <Form.Select
                      value={t.tipoTelefonoId}
                      onChange={(e) => setTelefono(idx, "tipoTelefonoId", e.target.value)}
                      disabled={catsLoading}
                    >
                      <option value="">Seleccione...</option>
                      {cats.tiposTelefono.map((tt) => (
                        <option key={tt.id} value={tt.id}>
                          {tt.descripcion}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={1}>
                  <Form.Check
                    type="switch"
                    label=" "
                    checked={!!t.activo}
                    onChange={(e) => setTelefono(idx, "activo", e.target.checked)}
                  />
                </Col>

                <Col md={2} className="d-flex justify-content-end">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => delTelefono(idx)}
                    disabled={(form.telefonos || []).length <= 1}
                  >
                    Eliminar
                  </Button>
                </Col>
              </Row>
            ))}
          </div>

          <hr />

          <div className="d-flex align-items-center justify-content-between">
            <h5 className="m-0">Correos</h5>
            <Button variant="outline-success" size="sm" onClick={addCorreo}>
              + Agregar
            </Button>
          </div>

          <div className="mt-2">
            {(form.correos || []).map((c, idx) => (
              <Row className="g-2 align-items-end mb-2" key={`cor-${idx}`}>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Correo</Form.Label>
                    <Form.Control
                      value={c.correo}
                      onChange={(e) => setCorreo(idx, "correo", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Tipo de correo</Form.Label>
                    <Form.Select
                      value={c.tipoCorreoId}
                      onChange={(e) => setCorreo(idx, "tipoCorreoId", e.target.value)}
                      disabled={catsLoading}
                    >
                      <option value="">Seleccione...</option>
                      {cats.tiposCorreo.map((tc) => (
                        <option key={tc.id} value={tc.id}>
                          {tc.descripcion}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={1}>
                  <Form.Check
                    type="switch"
                    label=" "
                    checked={!!c.activo}
                    onChange={(e) => setCorreo(idx, "activo", e.target.checked)}
                  />
                </Col>

                <Col md={1} className="d-flex justify-content-end">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => delCorreo(idx)}
                    disabled={(form.correos || []).length <= 1}
                  >
                    X
                  </Button>
                </Col>
              </Row>
            ))}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarModal} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onGuardar} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" /> Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showConfirm} onHide={cerrarConfirm} centered backdrop="static">
        <Modal.Header closeButton={!confirmLoading}>
          <Modal.Title>Confirmar desactivación</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          ¿Seguro que desea desactivar el empleado <b>#{idEmpleadoToDisable}</b>?
          <div className="text-muted mt-2" style={{ fontSize: 13 }}>
            Esto es una desactivación lógica (soft delete).
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarConfirm} disabled={confirmLoading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmarDesactivar} disabled={confirmLoading}>
            {confirmLoading ? (
              <>
                <Spinner size="sm" /> Desactivando...
              </>
            ) : (
              "Sí, desactivar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
