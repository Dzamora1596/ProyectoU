//Usuarios.jsx
import { useEffect, useState, useCallback } from "react";
import { Button, Form, Modal, Row, Col, Alert, Spinner, Badge } from "react-bootstrap";

import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  eliminarUsuarioHard,
  listarEmpleadosDisponibles,
} from "@/services/usuariosService";

import { obtenerCatalogosRoles } from "@/services/catalogosService";

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

  // ✅ Separar loading general de acciones para que la tabla no “parpadee”
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modo, setModo] = useState("crear");
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

  const filtrosActuales = useCallback(
    () => ({
      texto,
      activo,
      bloqueado,
      rolId: rolId || undefined,
    }),
    [texto, activo, bloqueado, rolId]
  );

  const limpiarMensajes = useCallback(() => {
    setError("");
    setOkMsg("");
  }, []);

  const cargarRoles = useCallback(async () => {
    const data = await obtenerCatalogosRoles();
    const list = data?.roles || data?.data?.roles || data?.catalogos?.roles || [];
    const normalizados = list.map((r) => ({
      id: r.idCatalogo_Rol ?? r.id ?? r.rolId ?? r.idRol,
      descripcion: r.Descripcion ?? r.descripcion ?? r.nombre ?? r.rolNombre,
    }));
    setRoles(normalizados.filter((r) => r.id));
  }, []);

  const cargarEmpleadosDisponibles = useCallback(async () => {
    const data = await listarEmpleadosDisponibles();
    setEmpleados(data?.empleados || []);
  }, []);

  const cargarUsuarios = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const data = await listarUsuarios(params);
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
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await cargarRoles();
        await cargarUsuarios({
          texto: "",
          activo: "all",
          bloqueado: "all",
          rolId: undefined,
        });
      } catch (e) {
        setError(e?.response?.data?.mensaje || "Error inicial");
      }
    })();
  }, [cargarRoles, cargarUsuarios]);

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
      password: "",
      activo: Boolean(u.activo),
      bloqueado: Boolean(u.bloqueado),
      intentosFallidos: Number(u.intentosFallidos ?? 0),
    });

    setShowModal(true);
    cargarEmpleadosDisponibles().catch(() => {});
  }

  async function onSubmitModal(e) {
    e.preventDefault();
    setLoadingAction(true);
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
      await cargarUsuarios(filtrosActuales());
    } catch (e2) {
      setError(e2?.response?.data?.mensaje || "Error guardando usuario");
    } finally {
      setLoadingAction(false);
    }
  }

  async function toggleActivo(u) {
    if (!u?.idUsuario) return;
    setLoadingAction(true);
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
      await cargarUsuarios(filtrosActuales());
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error cambiando estado");
    } finally {
      setLoadingAction(false);
    }
  }

  async function toggleBloqueo(u) {
    if (!u?.idUsuario) return;
    setLoadingAction(true);
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
      await cargarUsuarios(filtrosActuales());
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error cambiando bloqueo");
    } finally {
      setLoadingAction(false);
    }
  }

  async function resetPassword(u) {
    const nueva = window.prompt(`Nueva contraseña para "${u.nombreUsuario}" (mínimo 6):`);
    if (!nueva) return;

    setLoadingAction(true);
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
      await cargarUsuarios(filtrosActuales());
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error actualizando contraseña");
    } finally {
      setLoadingAction(false);
    }
  }

  async function hardDelete(u) {
    const ok = window.confirm(
      `¿Eliminar DEFINITIVAMENTE el usuario "${u.nombreUsuario}"? (solo Admin)`
    );
    if (!ok) return;

    setLoadingAction(true);
    setError("");
    setOkMsg("");
    try {
      await eliminarUsuarioHard(u.idUsuario);
      setOkMsg("Usuario eliminado definitivamente.");
      await cargarUsuarios(filtrosActuales());
    } catch (e) {
      setError(e?.response?.data?.mensaje || "Error en eliminar");
    } finally {
      setLoadingAction(false);
    }
  }

  function aplicarFiltros() {
    limpiarMensajes();
    cargarUsuarios(filtrosActuales());
  }

  function limpiarFiltros() {
    limpiarMensajes();
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

  const disabledUi = loading || loadingAction;

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h3 className="mb-0 fw-bold">Usuarios</h3>
          <div className="text-muted small">Gestion de usuarios</div>
        </div>

        <Button variant="success" className="fw-bold" onClick={abrirCrear} disabled={disabledUi}>
          <i className="bi bi-plus-lg me-2"></i>
          Crear usuario
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="dm-alert-accent" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}
      {okMsg && (
        <Alert variant="success" className="dm-alert-accent" onClose={() => setOkMsg("")} dismissible>
          {okMsg}
        </Alert>
      )}

      <div className="card mb-3">
        <div className="card-body">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={4}>
              <Form.Label className="fw-semibold">Buscar</Form.Label>
              <Form.Control
                placeholder="Usuario o nombre/apellidos"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={disabledUi}
              />
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Label className="fw-semibold">Estado</Form.Label>
              <Form.Select value={activo} onChange={(e) => setActivo(e.target.value)} disabled={disabledUi}>
                {ESTADOS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Label className="fw-semibold">Bloqueado</Form.Label>
              <Form.Select
                value={bloqueado}
                onChange={(e) => setBloqueado(e.target.value)}
                disabled={disabledUi}
              >
                {SI_NO_TODOS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={2}>
              <Form.Label className="fw-semibold">Rol</Form.Label>
              <Form.Select value={rolId} onChange={(e) => setRolId(e.target.value)} disabled={disabledUi}>
                <option value="">Todos los roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.descripcion}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={2} className="d-flex gap-2">
              <Button
                variant="primary"
                onClick={aplicarFiltros}
                className="w-100 fw-bold"
                disabled={disabledUi}
              >
                <i className="bi bi-funnel me-2"></i>
                Filtrar
              </Button>
              <Button
                variant="outline-secondary"
                onClick={limpiarFiltros}
                className="w-100 fw-bold"
                disabled={disabledUi}
              >
                Limpiar
              </Button>
            </Col>
          </Row>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="text-muted small">{rows.length} registro(s)</div>
            {disabledUi && (
              <div className="d-flex align-items-center gap-2">
                <Spinner size="sm" />
                <span className="small">Procesando…</span>
              </div>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ID</th>
                  <th>Usuario</th>
                  <th style={{ width: 110 }}>Empleado</th>
                  <th style={{ width: 170 }}>Rol</th>
                  <th style={{ width: 110 }}>Intentos</th>
                  <th style={{ width: 120 }}>Bloqueado</th>
                  <th style={{ width: 110 }}>Activo</th>
                  <th style={{ width: 420 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      Sin resultados
                    </td>
                  </tr>
                )}

                {rows.map((u) => (
                  <tr key={u.idUsuario}>
                    <td>{u.idUsuario}</td>
                    <td className="fw-semibold">{u.nombreUsuario}</td>
                    <td>{u.empleadoId}</td>
                    <td>{u.rolNombre}</td>
                    <td>{u.intentosFallidos ?? 0}</td>
                    <td>
                      {u.bloqueado ? (
                        <Badge bg="warning" text="dark">
                          Sí
                        </Badge>
                      ) : (
                        <Badge bg="secondary">No</Badge>
                      )}
                    </td>
                    <td>{u.activo ? <Badge bg="success">Sí</Badge> : <Badge bg="danger">No</Badge>}</td>
                    <td>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          className="fw-bold"
                          onClick={() => abrirEditar(u)}
                          disabled={disabledUi}
                        >
                          <i className="bi bi-pencil-square me-1"></i>
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant={u.bloqueado ? "outline-secondary" : "warning"}
                          className="fw-bold"
                          onClick={() => toggleBloqueo(u)}
                          disabled={disabledUi}
                        >
                          <i className={u.bloqueado ? "bi bi-unlock me-1" : "bi bi-lock me-1"}></i>
                          {u.bloqueado ? "Desbloquear" : "Bloquear"}
                        </Button>

                        <Button
                          size="sm"
                          variant={u.activo ? "outline-danger" : "outline-success"}
                          className="fw-bold"
                          onClick={() => toggleActivo(u)}
                          disabled={disabledUi}
                        >
                          <i className={u.activo ? "bi bi-x-circle me-1" : "bi bi-check-circle me-1"}></i>
                          {u.activo ? "Desactivar" : "Activar"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline-dark"
                          className="fw-bold"
                          onClick={() => resetPassword(u)}
                          disabled={disabledUi}
                        >
                          <i className="bi bi-key me-1"></i>
                          Actualizar Contraseña
                        </Button>

                        <Button
                          size="sm"
                          variant="danger"
                          className="fw-bold"
                          onClick={() => hardDelete(u)}
                          disabled={disabledUi}
                        >
                          <i className="bi bi-trash3 me-1"></i>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        show={showModal}
        onHide={() => (loadingAction ? null : setShowModal(false))}
        centered
        size="lg"
        backdrop="static"
      >
        <Form onSubmit={onSubmitModal}>
          <Modal.Header closeButton={!loadingAction}>
            <Modal.Title className="fw-bold">{modo === "crear" ? "Crear usuario" : "Editar usuario"}</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {loadingAction && (
              <div className="mb-3 d-flex align-items-center gap-2">
                <Spinner size="sm" />
                <span className="fw-semibold">Procesando…</span>
              </div>
            )}

            <Row className="g-3">
              <Col md={6}>
                <Form.Label className="fw-semibold">Empleado</Form.Label>
                <Form.Select
                  value={form.empleadoId}
                  onChange={(e) => setForm((f) => ({ ...f, empleadoId: e.target.value }))}
                  required
                  disabled={modo === "editar" || loadingAction}
                >
                  <option value="">Seleccione...</option>
                  {empleados.map((emp) => (
                    <option key={emp.idEmpleado} value={emp.idEmpleado}>
                      {emp.idEmpleado} - {emp.nombreCompleto}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold">Rol</Form.Label>
                <Form.Select
                  value={form.rolId}
                  onChange={(e) => setForm((f) => ({ ...f, rolId: e.target.value }))}
                  required
                  disabled={loadingAction}
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
                <Form.Label className="fw-semibold">Nombre de usuario</Form.Label>
                <Form.Control
                  value={form.nombreUsuario}
                  onChange={(e) => setForm((f) => ({ ...f, nombreUsuario: e.target.value }))}
                  required
                  disabled={loadingAction}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold">Contraseña {modo === "editar" ? "(opcional)" : ""}</Form.Label>
                <Form.Control
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={modo === "crear"}
                  placeholder={modo === "crear" ? "Mínimo 6 caracteres" : "Dejar vacío si no cambia"}
                  disabled={loadingAction}
                />
              </Col>

              <Col md={4} className="d-flex align-items-center">
                <Form.Check
                  type="switch"
                  label="Activo"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  disabled={loadingAction}
                />
              </Col>

              <Col md={4} className="d-flex align-items-center">
                <Form.Check
                  type="switch"
                  label="Bloqueado"
                  checked={form.bloqueado}
                  onChange={(e) => setForm((f) => ({ ...f, bloqueado: e.target.checked }))}
                  disabled={loadingAction}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold">Intentos fallidos</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={form.intentosFallidos}
                  onChange={(e) => setForm((f) => ({ ...f, intentosFallidos: e.target.value }))}
                  disabled={loadingAction}
                />
              </Col>
            </Row>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setShowModal(false)}
              disabled={loadingAction}
              className="fw-bold"
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loadingAction} className="fw-bold">
              Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
