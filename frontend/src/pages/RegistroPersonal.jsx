// frontend/src/pages/RegistroPersonal.jsx
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
} from "@/services/registroPersonalService";

import { obtenerCatalogosRegistroPersonal } from "@/services/catalogosService";
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
          <Badge bg={params.value ? "success" : "secondary"} className="px-3 py-2">
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
          <div className="d-flex gap-2 justify-content-center h-100 align-items-center">
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
    <div className="container-fluid py-4" style={{ backgroundColor: "var(--dm-gray-bg)", minHeight: "100vh" }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h3 className="m-0 text-marenco-black fw-bold">Registro Personal</h3>
        <Button variant="primary" className="px-4" onClick={abrirCrear}>
          + Nuevo Empleado
        </Button>
      </div>

      {errorMsg ? <Alert variant="danger" className="border-0 shadow-sm">{errorMsg}</Alert> : null}

      <Row className="g-3 mb-4">
        <Col md={6}>
          <InputGroup className="shadow-sm">
            <InputGroup.Text className="bg-white border-end-0">
               <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              className="border-start-0"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por cédula, nombre o apellido..."
            />
            <Button variant="dark" onClick={cargar}>
              Buscar
            </Button>
          </InputGroup>
        </Col>

        <Col md={3}>
          <InputGroup className="shadow-sm">
            <InputGroup.Text className="bg-white">Estado</InputGroup.Text>
            <Form.Select value={activo} onChange={(e) => setActivo(e.target.value)}>
              <option value="">Todos</option>
              <option value="1">Activos</option>
              <option value="0">Inactivos</option>
            </Form.Select>
          </InputGroup>
        </Col>

        <Col md={3} className="d-flex justify-content-end align-items-center">
          <Button variant="outline-dark" className="w-100" onClick={cargar} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" /> Cargando...
              </>
            ) : (
              "Actualizar Tabla"
            )}
          </Button>
        </Col>
      </Row>

      <div className="card border-0 shadow-sm overflow-hidden">
        <div className="card-body p-0">
          <Box sx={{ width: "100%", height: 600 }}>
            <DataGrid
              rows={gridRows}
              columns={columns}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
              }}
              getRowHeight={() => "auto"}
              sx={{
                border: "none",
                "& .MuiDataGrid-columnHeaders": { 
                  backgroundColor: "var(--dm-gray-light)",
                  color: "var(--dm-black)",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  fontSize: "0.75rem"
                },
                "& .MuiDataGrid-cell": { py: 1.5 },
                "& .MuiDataGrid-footerContainer": { borderTop: "1px solid var(--dm-border-color)" }
              }}
            />
          </Box>
        </div>
      </div>

      <Modal show={showModal} onHide={cerrarModal} size="lg" backdrop="static" centered className="dm-modal">
        <Modal.Header closeButton={!saving} className="bg-light">
          <Modal.Title className="fw-bold text-marenco-black">
            {mode === "create"
              ? "Crear Nuevo Colaborador"
              : `Editando: Empleado #${editingIdEmpleado}`}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-4">
          {catsLoading && (
            <Alert variant="info" className="d-flex align-items-center">
              <Spinner size="sm" className="me-2" /> Sincronizando catálogos de empresa...
            </Alert>
          )}

          <div className="mb-4">
             <h5 className="text-marenco-red fw-bold mb-3 border-bottom pb-2">Información Personal</h5>
             <Row className="g-3">
               <Col md={4}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">Número de Cédula</Form.Label>
                   <Form.Control
                     value={form.persona.idPersona}
                     onChange={(e) => setPersona("idPersona", e.target.value)}
                     disabled={mode === "edit"}
                     placeholder="0-0000-0000"
                   />
                 </Form.Group>
               </Col>

               <Col md={4}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">Género</Form.Label>
                   <Form.Select
                     value={form.persona.generoId}
                     onChange={(e) => setPersona("generoId", e.target.value)}
                     disabled={catsLoading}
                   >
                     <option value="">Seleccione...</option>
                     {cats.generos.map((g) => (
                       <option key={g.id} value={g.id}>{g.descripcion}</option>
                     ))}
                   </Form.Select>
                 </Form.Group>
               </Col>

               <Col md={4}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">Hijos</Form.Label>
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
                   <Form.Label className="fw-semibold">F. Nacimiento</Form.Label>
                   <Form.Control
                     type="date"
                     value={form.persona.fechaNacimiento}
                     onChange={(e) => setPersona("fechaNacimiento", e.target.value)}
                   />
                 </Form.Group>
               </Col>

               <Col md={8}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">Nombre Completo</Form.Label>
                   <Row className="g-2">
                     <Col>
                       <Form.Control
                         placeholder="Nombre"
                         value={form.persona.nombre}
                         onChange={(e) => setPersona("nombre", e.target.value)}
                       />
                     </Col>
                     <Col>
                       <Form.Control
                         placeholder="1er Apellido"
                         value={form.persona.apellido1}
                         onChange={(e) => setPersona("apellido1", e.target.value)}
                       />
                     </Col>
                     <Col>
                       <Form.Control
                         placeholder="2do Apellido"
                         value={form.persona.apellido2}
                         onChange={(e) => setPersona("apellido2", e.target.value)}
                       />
                     </Col>
                   </Row>
                 </Form.Group>
               </Col>

               <Col md={4}>
                 <Form.Check
                   className="mt-2 fw-bold"
                   type="switch"
                   label="Persona Habilitada"
                   checked={!!form.persona.activo}
                   onChange={(e) => setPersona("activo", e.target.checked)}
                 />
               </Col>
             </Row>
          </div>

          <div className="mb-4">
             <h5 className="text-marenco-red fw-bold mb-3 border-bottom pb-2">Detalles Laborales</h5>
             <Row className="g-3">
               <Col md={4}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">F. de Ingreso</Form.Label>
                   <Form.Control
                     type="date"
                     value={form.empleado.fechaIngreso}
                     onChange={(e) => setEmpleado("fechaIngreso", e.target.value)}
                   />
                 </Form.Group>
               </Col>

               <Col md={4}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">Salario Bruto</Form.Label>
                   <InputGroup>
                     <InputGroup.Text>₡</InputGroup.Text>
                     <Form.Control
                       value={form.empleado.salario}
                       onChange={(e) => setEmpleado("salario", e.target.value)}
                     />
                   </InputGroup>
                 </Form.Group>
               </Col>

               <Col md={4}>
                 <Form.Group>
                   <Form.Label className="fw-semibold">Cadencia de Pago</Form.Label>
                   <Form.Select
                     value={form.empleado.cadenciaPagoId}
                     onChange={(e) => setEmpleado("cadenciaPagoId", e.target.value)}
                     disabled={catsLoading}
                   >
                     <option value="">Seleccione...</option>
                     {cats.cadenciasPago.map((c) => (
                       <option key={c.id} value={c.id}>{c.descripcion}</option>
                     ))}
                   </Form.Select>
                 </Form.Group>
               </Col>

               <Col md={12}>
                 <Form.Check
                   className="fw-bold"
                   type="switch"
                   label="Empleado en planilla activa"
                   checked={!!form.empleado.activo}
                   onChange={(e) => setEmpleado("activo", e.target.checked)}
                 />
               </Col>
             </Row>
          </div>

          <div className="mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="text-marenco-red fw-bold m-0">Contactos Telefónicos</h5>
              <Button variant="outline-primary" size="sm" className="fw-bold" onClick={addTelefono}>
                + Añadir Línea
              </Button>
            </div>
            {(form.telefonos || []).map((t, idx) => (
              <Row className="g-2 align-items-end mb-2 p-2 bg-light rounded" key={`tel-${idx}`}>
                <Col md={4}>
                  <Form.Control
                    placeholder="Número"
                    value={t.idTelefono}
                    onChange={(e) => setTelefono(idx, "idTelefono", e.target.value)}
                  />
                </Col>
                <Col md={5}>
                  <Form.Select
                    value={t.tipoTelefonoId}
                    onChange={(e) => setTelefono(idx, "tipoTelefonoId", e.target.value)}
                  >
                    <option value="">Tipo de línea...</option>
                    {cats.tiposTelefono.map((tt) => (
                      <option key={tt.id} value={tt.id}>{tt.descripcion}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={1} className="text-center">
                  <Form.Check
                    type="switch"
                    checked={!!t.activo}
                    onChange={(e) => setTelefono(idx, "activo", e.target.checked)}
                  />
                </Col>
                <Col md={2} className="text-end">
                  <Button
                    variant="link"
                    className="text-danger p-0"
                    onClick={() => delTelefono(idx)}
                    disabled={(form.telefonos || []).length <= 1}
                  >
                    Quitar
                  </Button>
                </Col>
              </Row>
            ))}
          </div>

          <div>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="text-marenco-red fw-bold m-0">Correos Electrónicos</h5>
              <Button variant="outline-primary" size="sm" className="fw-bold" onClick={addCorreo}>
                + Añadir Email
              </Button>
            </div>
            {(form.correos || []).map((c, idx) => (
              <Row className="g-2 align-items-end mb-2 p-2 bg-light rounded" key={`cor-${idx}`}>
                <Col md={6}>
                  <Form.Control
                    placeholder="ejemplo@marenco.com"
                    value={c.correo}
                    onChange={(e) => setCorreo(idx, "correo", e.target.value)}
                  />
                </Col>
                <Col md={4}>
                  <Form.Select
                    value={c.tipoCorreoId}
                    onChange={(e) => setCorreo(idx, "tipoCorreoId", e.target.value)}
                  >
                    <option value="">Uso de correo...</option>
                    {cats.tiposCorreo.map((tc) => (
                      <option key={tc.id} value={tc.id}>{tc.descripcion}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={1} className="text-center">
                  <Form.Check
                    type="switch"
                    checked={!!c.activo}
                    onChange={(e) => setCorreo(idx, "activo", e.target.checked)}
                  />
                </Col>
                <Col md={1} className="text-end">
                  <Button
                    variant="close"
                    onClick={() => delCorreo(idx)}
                    disabled={(form.correos || []).length <= 1}
                  />
                </Col>
              </Row>
            ))}
          </div>
        </Modal.Body>

        <Modal.Footer className="bg-light border-top-0">
          <Button variant="secondary" className="px-4 fw-bold" onClick={cerrarModal} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" className="px-5 fw-bold" onClick={onGuardar} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" animation="grow" className="me-2" /> Guardando...
              </>
            ) : (
              "Confirmar y Guardar"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showConfirm} onHide={cerrarConfirm} centered backdrop="static">
        <Modal.Header closeButton={!confirmLoading} className="border-0 pb-0">
          <Modal.Title className="text-danger fw-bold">Atención</Modal.Title>
        </Modal.Header>

        <Modal.Body className="py-4">
          <p className="fs-5 mb-1">¿Está seguro de desactivar al empleado?</p>
          <p className="text-marenco-black fw-bold mb-3">ID Colaborador: #{idEmpleadoToDisable}</p>
          <div className="alert alert-warning border-0 small m-0">
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="light" className="fw-bold" onClick={cerrarConfirm} disabled={confirmLoading}>
            Regresar
          </Button>
          <Button variant="danger" className="px-4 fw-bold" onClick={confirmarDesactivar} disabled={confirmLoading}>
            {confirmLoading ? <Spinner size="sm" /> : "Confirmar Desactivación"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}