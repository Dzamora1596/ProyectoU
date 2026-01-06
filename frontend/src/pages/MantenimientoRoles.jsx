// Pagina de mantenimiento de roles
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/autenticar.css";

import {
  setAuth,
  listarRoles,
  crearRol,
  actualizarRol,
  desactivarRol,
  eliminarRolDefinitivo,
} from "../services/rolService";

export default function MantenimientoRoles({ user, onLogout }) {
  const navigate = useNavigate();

  
  useEffect(() => {
    setAuth(user);
  }, [user]);

  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  const esAdmin = rolId === 1;

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [modo, setModo] = useState("crear"); 
  const [form, setForm] = useState({
    idRol: "",
    descripcion: "",
    activo: "1",
  });

  const rolesNormalizados = useMemo(() => {
    return (roles || []).map((r) => ({
      idRol: r.idRol ?? r.IdRol ?? r.rolId ?? r.id ?? "",
      descripcion: r.descripcion ?? r.Descripcion ?? r.nombreRol ?? r.label ?? "",
      activo: normalizarActivo(r.activo ?? r.Activo),
    }));
  }, [roles]);

  const limpiarMensajes = () => {
    setMsg("");
    setErr("");
  };

  const cargar = async () => {
    setLoading(true);
    limpiarMensajes();
    try {
      const data = await listarRoles();
      const lista = data?.roles ?? data?.rows ?? data?.data ?? data ?? [];
      setRoles(Array.isArray(lista) ? lista : []);
    } catch (e) {
      //En caso de error, muestra mensaje
      if (e?.code === "NO_AUTH_HEADER") {
        setErr("Faltó autenticar el módulo: no se envió x-rol-id. Revise setAuth(user).");
      } else {
        setErr(e?.response?.data?.mensaje || "Error cargando roles.");
      }
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recargar = async () => {
    const data = await listarRoles();
    const lista = data?.roles ?? data?.rows ?? data?.data ?? data ?? [];
    setRoles(Array.isArray(lista) ? lista : []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const limpiar = () => {
    setModo("crear");
    limpiarMensajes();
    setForm({ idRol: "", descripcion: "", activo: "1" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cargarEnFormulario = (r) => {
    setModo("editar");
    limpiarMensajes();
    setForm({
      idRol: String(r.idRol),
      descripcion: String(r.descripcion || ""),
      activo: r.activo ? "1" : "0",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    if (!esAdmin) {
      setErr("No tiene permisos para realizar esta acción (solo Admin).");
      return;
    }

    if (!form.descripcion || !String(form.descripcion).trim()) {
      setErr("La descripción es requerida.");
      return;
    }

    try {
      const payload = {
        descripcion: String(form.descripcion).trim(),
        activo: Number(form.activo), // 1/0
      };

      if (modo === "crear") {
        const r = await crearRol(payload);
        setMsg(r?.mensaje || "Rol creado correctamente.");
      } else {
        const idRol = Number(form.idRol);
        const r = await actualizarRol(idRol, payload);
        setMsg(r?.mensaje || "Rol actualizado correctamente.");
      }

      await recargar();
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error guardando rol.");
    }
  };

  const onToggleActivo = async (r) => {
    if (!esAdmin) return;

    const idRol = Number(r.idRol);
    const nuevoActivo = r.activo ? 0 : 1;

    const ok = window.confirm(
      r.activo
        ? `¿Desactivar el rol "${r.descripcion}" (ID ${idRol})?`
        : `¿Activar el rol "${r.descripcion}" (ID ${idRol})?`
    );
    if (!ok) return;

    limpiarMensajes();

    try {
      // ✅ si tu backend solo permite actualizarRol parcial, esto funciona
      const resp = await actualizarRol(idRol, { activo: nuevoActivo });
      setMsg(resp?.mensaje || (nuevoActivo ? "Rol activado." : "Rol desactivado."));
      await recargar();
      if (String(form.idRol) === String(idRol)) {
        setForm((p) => ({ ...p, activo: String(nuevoActivo) }));
      }
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error cambiando estado del rol.");
    }
  };

  const onSoftDelete = async (r) => {
    if (!esAdmin) return;

    const idRol = Number(r.idRol);
    const ok = window.confirm(`¿Desactivar el rol "${r.descripcion}" (ID ${idRol})?`);
    if (!ok) return;

    limpiarMensajes();
    try {
      const resp = await desactivarRol(idRol);
      setMsg(resp?.mensaje || "Rol desactivado.");
      await recargar();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error desactivando rol.");
    }
  };

  const onDeleteHard = async (r) => {
    if (!esAdmin) return;

    const idRol = Number(r.idRol);
    const ok = window.confirm(
      `⚠️ ELIMINAR DEFINITIVAMENTE el rol "${r.descripcion}" (ID ${idRol})?\nPuede fallar si está en uso.`
    );
    if (!ok) return;

    limpiarMensajes();
    try {
      const resp = await eliminarRolDefinitivo(idRol);
      setMsg(resp?.mensaje || "Rol eliminado definitivamente.");
      await recargar();
      if (String(form.idRol) === String(idRol)) limpiar();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error eliminando rol.");
    }
  };

  // Si no hay user, pide login
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Mantenimiento: Roles</h1>
          <p className="auth-error">Sesión no encontrada. Vuelva a iniciar sesión.</p>
          <button className="auth-button" onClick={() => navigate("/login")}>
            Ir a Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 1100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>
              Mantenimiento: Roles
            </h1>
            <p className="auth-subtitle" style={{ marginTop: 0 }}>
              Bienvenido, <b>{user?.nombreUsuario}</b>
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/mantenimientos">
              <button className="auth-secondary">Volver a Mantenimientos</button>
            </Link>
            <Link to="/inicio">
              <button className="auth-secondary">Inicio</button>
            </Link>
            <button className="auth-danger" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>

        {!esAdmin && (
          <div className="auth-error" style={{ marginTop: 12 }}>
            No tiene permisos para administrar roles (solo Admin).
          </div>
        )}

        {msg && <div className="auth-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}

        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <h2 style={{ margin: "0 0 10px 0" }}>
            {modo === "crear" ? "Crear rol" : "Editar rol"}
          </h2>

          <form onSubmit={onSubmit} className="auth-form">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {modo === "editar" && (
                <Campo label="ID Rol" name="idRol" value={form.idRol} onChange={handleChange} disabled />
              )}

              <Campo
                label="Descripción"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                placeholder="Ej: Administrador"
                required
                disabled={!esAdmin}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Activo</label>
                <select
                  className="auth-input"
                  name="activo"
                  value={form.activo}
                  onChange={handleChange}
                  disabled={!esAdmin}
                >
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

        <div style={{ marginTop: 22 }}>
          <h2 style={{ marginBottom: 10 }}>Roles registrados</h2>

          {loading ? (
            <p>Cargando...</p>
          ) : rolesNormalizados.length === 0 ? (
            <p>No hay roles registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <Th>ID</Th>
                    <Th>Descripción</Th>
                    <Th>Activo</Th>
                    <Th style={{ width: 360 }}>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {rolesNormalizados.map((r) => (
                    <tr key={r.idRol} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <Td>{r.idRol}</Td>
                      <Td>{r.descripcion}</Td>
                      <Td>{r.activo ? "Sí" : "No"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="auth-secondary"
                            type="button"
                            onClick={() => cargarEnFormulario(r)}
                            disabled={!esAdmin}
                          >
                            Editar
                          </button>

                          <button
                            className="auth-secondary"
                            type="button"
                            onClick={() => onToggleActivo(r)}
                            disabled={!esAdmin}
                          >
                            {r.activo ? "Desactivar" : "Activar"}
                          </button>

                          <button
                            className="auth-secondary"
                            type="button"
                            onClick={() => onSoftDelete(r)}
                            disabled={!esAdmin || !r.activo}
                            title="Desactiva (soft delete)"
                          >
                            Desactivar (soft)
                          </button>

                          <button
                            className="auth-danger"
                            type="button"
                            onClick={() => onDeleteHard(r)}
                            disabled={!esAdmin}
                          >
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
  if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) return v.data[0] === 1;
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
