//Usuarios.jsx
import { useEffect, useState } from "react";
import { Button, Form, Modal, Row, Col, Alert, Spinner } from "react-bootstrap";
import { DataGrid } from "@mui/x-data-grid";

import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  eliminarUsuarioHard,
  listarEmpleadosDisponibles,
} from "../services/usuariosService";

import { obtenerCatalogosRoles } from "../api/catalogosApi";

const ESTADOS = [
  { value: "all", label: "Todos" },
  { value: "1", label: "Activos" },
  { value: "0", label: "Inactivos" },
];

const SI_NO_TODOS = [
  { value: "all", label: "Todos" },
  { value: "1", label: "Sí" },
  { value: "0", label: "No" },
];

export default function Usuarios() {
  
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState("all");
  const [bloqueado, setBloqueado] = useState("all");
  const [rolId, setRolId] = useState("");

   
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);

   
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

   
  const [showModal, setShowModal] = useState(false);
  const [modo, setModo] = useState("crear"); // crear | editar
  const [editId, setEditId] = useState(null);

   
  const [form, setForm] = useState({
    empleadoId: "",
    nombreUsuario: "",
    rolId: "",
    password: "",
    activo: true,
    bloqueado: false,
    intentosFallidos: 0,
  });

  async function cargarRoles() {
    const data = await obtenerCatalogosRoles();
     
    const list = data?.roles || data?.data?.roles || data?.catalogos?.roles || [];
    const normalizados = list.map((r) => ({
      id: r.idCatalogo_Rol ?? r.id ?? r.rolId ?? r.idRol,
      descripcion: r.Descripcion ?? r.descripcion ?? r.nombre ?? r.rolNombre,
    }));
    setRoles(normalizados.filter((r) => r.id));
  }

  async function cargarEmpleadosDisponibles() {
    const data = await listarEmpleadosDisponibles();
    setEmpleados(data?.empleados || []);
  }

  async function cargarUsuarios(params) {
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      const data = await listarUsuarios(
        params || {
          texto,
          activo,
          bloqueado,
          rolId: rolId || undefined,
        }
      );

      const usuarios = data?.usuarios || [];

       
      setRows(
        (usuarios || [])
          .filter((u) => u?.idUsuario)
          .map((u) => ({
            ...u,
            id: u.idUsuario,  
          }))
      );
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
     
    (async () => {
      try {
        await cargarRoles();
        await cargarUsuarios();
      } catch (e) {
        setError(e?.response?.data?.mensaje || "Error inicial");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpiarMensajes() {
    setError("");
    setOkMsg("");
  }

  function abrirCrear() {
    limpiarMensajes();
    setModo("crear");
    setEditId(null);
    setForm({
      empleadoId: "",
      nombreUsuario: "",
      rolId: "",
      password: "",
      activo: true,
      bloqueado: false,
      intentosFallidos: 0,
    });
    setShowModal(true);

     
    cargarEmpleadosDisponibles().catch(() => {});
  }

  function abrirEditar(u) {
    limpiarMensajes();
    setModo("editar");
    setEditId(u.idUsuario);

    setForm({
      empleadoId: String(u.empleadoId ?? ""),
      nombreUsuario: String(u.nombreUsuario ?? ""),
      rolId: String(u.rolId ?? ""),
      password: "", // vacío por defecto
      activo: Boolean(u.activo),
      bloqueado: Boolean(u.bloqueado),
      intentosFallidos: Number(u.intentosFallidos ?? 0),
    });

    setShowModal(true);

     
    cargarEmpleadosDisponibles().catch(() => {});
  }

  async function onSubmitModal(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOkMsg("");

    try {
      if (modo === "crear") {
        await crearUsuario({
          empleadoId: Number(form.empleadoId),
          nombreUsuario: form.nombreUsuario,
          password: form.password,
          rolId: Number(form.rolId),
          activo: form.activo ? 1 : 0,
        });
        setOkMsg("Usuario creado correctamente.");
      } else {
        await actualizarUsuario(editId, {
          empleadoId: Number(form.empleadoId),
          nombreUsuario: form.nombreUsuario,
          rolId: Number(form.rolId),
          activo: form.activo ? 1 : 0,
          bloqueado: form.bloqueado ? 1 : 0,
          intentosFallidos: Number(form.intentosFallidos ?? 0),
          ...(form.password?.trim() ? { password: form.password.trim() } : {}),
        });
        setOkMsg("Usuario actualizado correctamente.");
      }

      setShowModal(false);
      await cargarUsuarios();
    } catch (e2) {
      setError(e2?.response?.data?.mensaje || "Error guardando usuario");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivo(u) {
    if (!u?.idUsuario) return;
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      if (u.activo) {
        await desactivarUsuario(u.idUsuario);
        setOkMsg("Usuario desactivado.");
      } else {
        await actualizarUsuario(u.idUsuario, {
          nombreUsuario: u.nombreUsuario,
          empleadoId: u.empleadoId,
          rolId: u.rolId,
          activo: 1,
          bloqueado: u.bloqueado ? 1 : 0,
          intentosFallidos: Number(u.intentosFallidos ?? 0),
        });
        setOkMsg("Usuario activado.");
      }
      await cargarUsuarios();
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error cambiando estado");
    } finally {
      setLoading(false);
    }
  }

  async function toggleBloqueo(u) {
    if (!u?.idUsuario) return;
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      await actualizarUsuario(u.idUsuario, {
        nombreUsuario: u.nombreUsuario,
        empleadoId: u.empleadoId,
        rolId: u.rolId,
        activo: u.activo ? 1 : 0,
        bloqueado: u.bloqueado ? 0 : 1,
        intentosFallidos: u.bloqueado ? 0 : Number(u.intentosFallidos ?? 0),
      });
      setOkMsg(u.bloqueado ? "Usuario desbloqueado." : "Usuario bloqueado.");
      await cargarUsuarios();
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error cambiando bloqueo");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(u) {
    const nueva = window.prompt(
      `Nueva contraseña para "${u.nombreUsuario}" (mínimo 6):`
    );
    if (!nueva) return;

    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      await actualizarUsuario(u.idUsuario, {
        nombreUsuario: u.nombreUsuario,
        empleadoId: u.empleadoId,
        rolId: u.rolId,
        activo: u.activo ? 1 : 0,
        bloqueado: u.bloqueado ? 1 : 0,
        intentosFallidos: Number(u.intentosFallidos ?? 0),
        password: nueva,
      });
      setOkMsg("Contraseña actualizada.");
      await cargarUsuarios();
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error actualizando contraseña");
    } finally {
      setLoading(false);
    }
  }

  async function hardDelete(u) {
    const ok = window.confirm(
      `¿Eliminar DEFINITIVAMENTE el usuario "${u.nombreUsuario}"? (solo Admin; puede fallar por FK)`
    );
    if (!ok) return;

    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      await eliminarUsuarioHard(u.idUsuario);
      setOkMsg("Usuario eliminado definitivamente.");
      await cargarUsuarios();
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error en hard delete");
    } finally {
      setLoading(false);
    }
  }

  function aplicarFiltros() {
    cargarUsuarios({
      texto,
      activo,
      bloqueado,
      rolId: rolId || undefined,
    });
  }

  function limpiarFiltros() {
    setTexto("");
    setActivo("all");
    setBloqueado("all");
    setRolId("");
    setTimeout(
      () =>
        cargarUsuarios({
          texto: "",
          activo: "all",
          bloqueado: "all",
          rolId: undefined,
        }),
      0
    );
  }

   
  const columns = [
    { field: "idUsuario", headerName: "ID", width: 90 },
    { field: "nombreUsuario", headerName: "Usuario", flex: 1, minWidth: 150 },
    { field: "empleadoId", headerName: "Empleado", width: 110 },
    { field: "rolNombre", headerName: "Rol", width: 170 },
    {
      field: "intentosFallidos",
      headerName: "Intentos",
      width: 110,
      valueGetter: (params) => params?.row?.intentosFallidos ?? 0,
    },
    {
      field: "bloqueado",
      headerName: "Bloqueado",
      width: 120,
      valueGetter: (params) => (params?.row?.bloqueado ? "Sí" : "No"),
    },
    {
      field: "activo",
      headerName: "Activo",
      width: 110,
      valueGetter: (params) => (params?.row?.activo ? "Sí" : "No"),
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 360,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const u = params?.row;
        if (!u) return null;

        return (
           
          <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
            <Button size="sm" variant="primary" onClick={() => abrirEditar(u)}>
              Editar
            </Button>

            <Button
              size="sm"
              variant={u.bloqueado ? "secondary" : "warning"}
              onClick={() => toggleBloqueo(u)}
            >
              {u.bloqueado ? "Desbloquear" : "Bloquear"}
            </Button>

            <Button
              size="sm"
              variant={u.activo ? "outline-danger" : "outline-success"}
              onClick={() => toggleActivo(u)}
            >
              {u.activo ? "Desactivar" : "Activar"}
            </Button>

            <Button
              size="sm"
              variant="outline-dark"
              onClick={() => resetPassword(u)}
            >
              Reset Pass
            </Button>

            <Button size="sm" variant="danger" onClick={() => hardDelete(u)}>
              Hard
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="m-0">Usuarios</h3>
        <Button variant="success" onClick={abrirCrear}>
          Crear usuario
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}
      {okMsg && (
        <Alert variant="success" onClose={() => setOkMsg("")} dismissible>
          {okMsg}
        </Alert>
      )}

      <div className="card p-3 mb-3">
        <Row className="g-2">
          <Col md={4}>
            <Form.Control
              placeholder="Buscar (usuario o nombre/apellidos)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </Col>

          <Col md={2}>
            <Form.Select value={activo} onChange={(e) => setActivo(e.target.value)}>
              {ESTADOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Col>

          <Col md={2}>
            <Form.Select
              value={bloqueado}
              onChange={(e) => setBloqueado(e.target.value)}
            >
              {SI_NO_TODOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Col>

          <Col md={2}>
            <Form.Select value={rolId} onChange={(e) => setRolId(e.target.value)}>
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.descripcion}
                </option>
              ))}
            </Form.Select>
          </Col>

          <Col md={2} className="d-flex gap-2">
            <Button variant="primary" onClick={aplicarFiltros} className="w-100">
              Filtrar
            </Button>
            <Button
              variant="secondary"
              onClick={limpiarFiltros}
              className="w-100"
            >
              Limpiar
            </Button>
          </Col>
        </Row>
      </div>

      <div style={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
           
          rowHeight={72}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
          }}
          disableRowSelectionOnClick
           
          getRowId={(r) => r.idUsuario}
        />
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Form onSubmit={onSubmitModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              {modo === "crear" ? "Crear usuario" : "Editar usuario"}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {loading && (
              <div className="mb-2 d-flex align-items-center gap-2">
                <Spinner size="sm" />
                <span>Procesando…</span>
              </div>
            )}

            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Empleado</Form.Label>
                <Form.Select
                  value={form.empleadoId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, empleadoId: e.target.value }))
                  }
                  required
                  disabled={modo === "editar"}
                >
                  <option value="">Seleccione...</option>
                  {empleados.map((emp) => (
                    <option key={emp.idEmpleado} value={emp.idEmpleado}>
                      {emp.idEmpleado} - {emp.nombreCompleto}
                    </option>
                  ))}
                </Form.Select>
                {modo === "editar" && (
                  <Form.Text muted>
                    (Para cambiar empleado, desactivá y creá otro usuario.)
                  </Form.Text>
                )}
              </Col>

              <Col md={6}>
                <Form.Label>Rol</Form.Label>
                <Form.Select
                  value={form.rolId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rolId: e.target.value }))
                  }
                  required
                >
                  <option value="">Seleccione...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.descripcion}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={6}>
                <Form.Label>Nombre de usuario</Form.Label>
                <Form.Control
                  value={form.nombreUsuario}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombreUsuario: e.target.value }))
                  }
                  required
                />
              </Col>

              <Col md={6}>
                <Form.Label>
                  Contraseña {modo === "editar" ? "(opcional)" : ""}
                </Form.Label>
                <Form.Control
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required={modo === "crear"}
                  placeholder={
                    modo === "crear"
                      ? "Mínimo 6 caracteres"
                      : "Dejar vacío si no cambia"
                  }
                />
              </Col>

              <Col md={4} className="d-flex align-items-center gap-2">
                <Form.Check
                  type="switch"
                  label="Activo"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, activo: e.target.checked }))
                  }
                />
              </Col>

              <Col md={4} className="d-flex align-items-center gap-2">
                <Form.Check
                  type="switch"
                  label="Bloqueado"
                  checked={form.bloqueado}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bloqueado: e.target.checked }))
                  }
                />
              </Col>

              <Col md={4}>
                <Form.Label>Intentos fallidos</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={form.intentosFallidos}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, intentosFallidos: e.target.value }))
                  }
                />
                <Form.Text muted>Si desbloqueás, podés ponerlo en 0.</Form.Text>
              </Col>
            </Row>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
