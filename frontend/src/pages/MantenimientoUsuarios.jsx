//Pagina de mantenimiento de usuarios
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/autenticar.css";

import { obtenerRoles } from "../services/autenticarService";
import { listarEmpleados } from "../services/empleadoService";

import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuarioDefinitivo,
} from "../services/usuarioService";

export default function MantenimientoUsuarios({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;

  const [loading, setLoading] = useState(true);

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [modo, setModo] = useState("crear"); 

  const [form, setForm] = useState({
    idUsuario: "",
    nombreUsuario: "",
    password: "",
    empleadoId: "",
    rolId: "",
    activo: "1",
  });

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";


  const rolesNormalizados = useMemo(() => {
    return (roles || []).map((r) => ({
      idRol: r.idRol ?? r.IdRol ?? r.rolId ?? r.id ?? r.value,
      nombreRol:
        r.Descripcion ?? r.descripcion ?? r.nombreRol ?? r.nombre ?? r.label ?? "Sin nombre",
      activo: normalizarActivo(r.Activo ?? r.activo),
    }));
  }, [roles]);

  const empleadosNormalizados = useMemo(() => {
    return (empleados || []).map((e) => ({
      idEmpleado: e.idEmpleado ?? e.IdEmpleado ?? e.id ?? e.Empleado_idEmpleado,
      activo: normalizarActivo(e.activo ?? e.Activo),
      nombreCompleto: e?.persona
        ? `${e.persona.nombre ?? ""} ${e.persona.apellido1 ?? ""} ${e.persona.apellido2 ?? ""}`.trim()
        : `${e.nombre ?? ""} ${e.apellido1 ?? ""} ${e.apellido2 ?? ""}`.trim(),
    }));
  }, [empleados]);

  const usuariosNormalizados = useMemo(() => {
    return (usuarios || []).map((u) => ({
      idUsuario: u.idUsuario ?? u.IdUsuario ?? u.id ?? "",
      nombreUsuario: u.NombreUsuario ?? u.nombreUsuario ?? u.usuario ?? "",
      empleadoId: u.Empleado_idEmpleado ?? u.empleadoId ?? "",
      rolId: u.Rol_idRol ?? u.rolId ?? "",
      activo: normalizarActivo(u.Activo ?? u.activo),
    }));
  }, [usuarios]);

  const rolNombrePorId = useMemo(() => {
    const m = new Map();
    for (const r of rolesNormalizados) m.set(Number(r.idRol), String(r.nombreRol));
    return m;
  }, [rolesNormalizados]);

  const empleadoNombrePorId = useMemo(() => {
    const m = new Map();
    for (const e of empleadosNormalizados) m.set(Number(e.idEmpleado), String(e.nombreCompleto || ""));
    return m;
  }, [empleadosNormalizados]);

  

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setErr("");
      try {
        const [dataUsuarios, dataRoles, dataEmpleados] = await Promise.all([
          listarUsuarios(),
          obtenerRoles(),
          listarEmpleados(),
        ]);

        const listaUsuarios =
          dataUsuarios?.usuarios ?? dataUsuarios?.rows ?? dataUsuarios?.data ?? dataUsuarios ?? [];
        const listaRoles =
          dataRoles?.roles ?? dataRoles?.rows ?? dataRoles?.data ?? dataRoles ?? [];
        const listaEmpleados =
          dataEmpleados?.empleados ?? dataEmpleados?.rows ?? dataEmpleados?.data ?? dataEmpleados ?? [];

        setUsuarios(Array.isArray(listaUsuarios) ? listaUsuarios : []);
        setRoles(Array.isArray(listaRoles) ? listaRoles : []);
        setEmpleados(Array.isArray(listaEmpleados) ? listaEmpleados : []);

        const primerRol =
          Array.isArray(listaRoles) && listaRoles[0]
            ? (listaRoles[0].idRol ?? listaRoles[0].IdRol ?? listaRoles[0].rolId ?? listaRoles[0].id)
            : "";

        const primerEmpleado =
          Array.isArray(listaEmpleados) && listaEmpleados[0]
            ? (listaEmpleados[0].idEmpleado ?? listaEmpleados[0].IdEmpleado ?? listaEmpleados[0].id)
            : "";

        setForm((prev) => ({
          ...prev,
          rolId: prev.rolId || (primerRol ? String(primerRol) : ""),
          empleadoId: prev.empleadoId || (primerEmpleado ? String(primerEmpleado) : ""),
        }));
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando usuarios/roles/empleados.");
        setUsuarios([]);
        setRoles([]);
        setEmpleados([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  const recargarUsuarios = async () => {
    const dataUsuarios = await listarUsuarios();
    const lista = dataUsuarios?.usuarios ?? dataUsuarios?.rows ?? dataUsuarios?.data ?? dataUsuarios ?? [];
    setUsuarios(Array.isArray(lista) ? lista : []);
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const limpiar = () => {
    setModo("crear");
    setMsg("");
    setErr("");
    setForm((prev) => ({
      ...prev,
      idUsuario: "",
      nombreUsuario: "",
      password: "",
      activo: "1",
      empleadoId:
        prev.empleadoId ||
        (empleadosNormalizados[0]?.idEmpleado ? String(empleadosNormalizados[0].idEmpleado) : ""),
      rolId:
        prev.rolId ||
        (rolesNormalizados[0]?.idRol ? String(rolesNormalizados[0].idRol) : ""),
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cargarEnFormulario = (u) => {
    setModo("editar");
    setMsg("");
    setErr("");
    setForm({
      idUsuario: String(u.idUsuario ?? ""),
      nombreUsuario: String(u.nombreUsuario ?? ""),
      password: "",
      empleadoId: String(u.empleadoId ?? ""),
      rolId: String(u.rolId ?? ""),
      activo: u.activo ? "1" : "0",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!esAdmin) {
      setErr("No tiene permisos para realizar esta acción.");
      return;
    }

    if (!form.nombreUsuario || !form.empleadoId || !form.rolId) {
      setErr("Faltan datos requeridos.");
      return;
    }

    const payloadBase = {
      nombreUsuario: String(form.nombreUsuario).trim(),
      empleadoId: Number(form.empleadoId),
      rolId: Number(form.rolId),
      activo: Number(form.activo),
    };

    
    const payload = form.password ? { ...payloadBase, password: String(form.password) } : payloadBase;

    try {
      if (modo === "crear") {
        if (!form.password) {
          setErr("Para crear usuario, el password es requerido.");
          return;
        }
        const r = await crearUsuario(payload);
        setMsg(r?.mensaje || "Usuario creado correctamente.");
      } else {
        const idUsuario = Number(form.idUsuario);
        const r = await actualizarUsuario(idUsuario, { idUsuario, ...payload });
        setMsg(r?.mensaje || "Usuario actualizado correctamente.");
      }

      await recargarUsuarios();
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error guardando usuario.");
    }
  };

  const onToggleActivo = async (u) => {
    if (!esAdmin) return;

    const idUsuario = Number(u.idUsuario);
    const nuevoActivo = u.activo ? 0 : 1;

    const ok = window.confirm(
      u.activo
        ? `¿Desactivar usuario ${u.nombreUsuario} (ID ${idUsuario})?`
        : `¿Activar usuario ${u.nombreUsuario} (ID ${idUsuario})?`
    );
    if (!ok) return;

    setMsg("");
    setErr("");
    try {
      const r = await actualizarUsuario(idUsuario, { activo: nuevoActivo });
      setMsg(r?.mensaje || (nuevoActivo ? "Usuario activado." : "Usuario desactivado."));
      await recargarUsuarios();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error cambiando estado del usuario.");
    }
  };

  
  const onDeleteHard = async (u) => {
    if (!esAdmin) return;

    const idUsuario = Number(u.idUsuario);
    const ok = window.confirm(
      `⚠️ ELIMINAR DEFINITIVAMENTE al usuario ${u.nombreUsuario} (ID ${idUsuario})?\nEsta acción no se puede revertir.`
    );
    if (!ok) return;

    setMsg("");
    setErr("");
    try {
      const r = await eliminarUsuarioDefinitivo(idUsuario);
      setMsg(r?.mensaje || "Usuario eliminado definitivamente.");
      await recargarUsuarios();
      if (String(form.idUsuario) === String(idUsuario)) limpiar();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error eliminando usuario.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>Mantenimiento: Usuarios</h1>
            <p className="auth-subtitle" style={{ marginTop: 0 }}>
              Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/mantenimientos">
              <button className="auth-secondary">Volver a Mantenimientos</button>
            </Link>
            <Link to="/inicio">
              <button className="auth-secondary">Inicio</button>
            </Link>
            <button className="auth-danger" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>

        {msg && <div className="auth-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}

        {/* Formulario */}
        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <h2 style={{ margin: "0 0 10px 0" }}>{modo === "crear" ? "Crear usuario" : "Editar usuario"}</h2>

          {!esAdmin && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Usted solo puede <b>consultar</b>. Requiere rol de Administrador.
            </p>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {modo === "editar" && (
                <Campo label="ID Usuario" name="idUsuario" type="text" value={form.idUsuario} onChange={handleChange} disabled />
              )}

              <Campo
                label="Nombre de usuario"
                name="nombreUsuario"
                value={form.nombreUsuario}
                onChange={handleChange}
                placeholder="Ej: david.zamora"
                required
                disabled={!esAdmin}
              />

              <Campo
                label={modo === "crear" ? "Password" : "Password (opcional)"}
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder={modo === "crear" ? "••••••••" : "Dejar vacío para no cambiar"}
                required={modo === "crear"}
                disabled={!esAdmin}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Empleado</label>
                <select className="auth-input" name="empleadoId" value={form.empleadoId} onChange={handleChange} required disabled={!esAdmin}>
                  <option value="">Seleccione...</option>
                  {empleadosNormalizados
                    .filter((e) => e.activo !== false)
                    .map((e) => (
                      <option key={e.idEmpleado} value={e.idEmpleado}>
                        {e.idEmpleado} - {e.nombreCompleto || "(sin nombre)"}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Rol</label>
                <select className="auth-input" name="rolId" value={form.rolId} onChange={handleChange} required disabled={!esAdmin}>
                  <option value="">Seleccione...</option>
                  {rolesNormalizados
                    .filter((r) => r.activo !== false)
                    .map((r) => (
                      <option key={r.idRol} value={r.idRol}>
                        {r.nombreRol}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Activo</label>
                <select className="auth-input" name="activo" value={form.activo} onChange={handleChange} required disabled={!esAdmin}>
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              {esAdmin && (
                <button className="auth-button" type="submit">
                  {modo === "crear" ? "Guardar" : "Actualizar"}
                </button>
              )}
              <button type="button" className="auth-secondary" onClick={limpiar}>
                Limpiar
              </button>
            </div>
          </form>
        </div>

        {/* Tabla */}
        <div style={{ marginTop: 22 }}>
          <h2 style={{ marginBottom: 10 }}>Usuarios registrados</h2>

          {loading ? (
            <p>Cargando...</p>
          ) : usuariosNormalizados.length === 0 ? (
            <p>No hay usuarios registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <Th>ID</Th>
                    <Th>Usuario</Th>
                    <Th>Empleado</Th>
                    <Th>Rol</Th>
                    <Th>Activo</Th>
                    <Th style={{ width: 340 }}>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosNormalizados.map((u) => (
                    <tr key={u.idUsuario} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <Td>{u.idUsuario}</Td>
                      <Td>{u.nombreUsuario}</Td>
                      <Td>
                        {u.empleadoId} - {empleadoNombrePorId.get(Number(u.empleadoId)) || "(sin nombre)"}
                      </Td>
                      <Td>{rolNombrePorId.get(Number(u.rolId)) || "Sin rol"}</Td>
                      <Td>{u.activo ? "Sí" : "No"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="auth-secondary" type="button" onClick={() => cargarEnFormulario(u)} disabled={!esAdmin}>
                            Editar
                          </button>

                          <button className="auth-secondary" type="button" onClick={() => onToggleActivo(u)} disabled={!esAdmin}>
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>

                          <button className="auth-danger" type="button" onClick={() => onDeleteHard(u)} disabled={!esAdmin}>
                            Eliminar
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Me normaliza valores booleanos de activo

function normalizarActivo(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "sí" || s === "si";
}

function Campo({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label className="auth-label">{label}</label>
      <input className="auth-input" {...props} />
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{ padding: "10px 8px", fontWeight: 700, fontSize: 13, opacity: 0.9, ...style }}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td style={{ padding: "10px 8px", fontSize: 14 }}>{children}</td>;
}
