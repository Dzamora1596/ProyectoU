// Pagina de mantenimiento de horarios laborales
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/autenticar.css";

import {
  setAuth, 
  listarHorarios,
  crearHorario,
  actualizarHorario,
  eliminarHorario,
} from "../services/horarioLaboralService";

export default function MantenimientoHorarios({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  const esAdmin = rolId === 1;

  const [loading, setLoading] = useState(true);
  const [horarios, setHorarios] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [modo, setModo] = useState("crear"); 
  const [form, setForm] = useState({
    idHorarioLaboral: "",
    descripcion: "",
    entrada: "",
    salida: "",
    activo: "1",
  });

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  
  useEffect(() => {
    setAuth(user);
  }, [user]);

  const horariosNormalizados = useMemo(() => {
    return (horarios || []).map((h) => ({
      idHorarioLaboral: h.idHorarioLaboral ?? h.idHorario_Laboral ?? h.id,
      descripcion: h.descripcion ?? h.Descripcion ?? "",
      entrada: h.entrada ?? h.Entrada ?? "",
      salida: h.salida ?? h.Salida ?? "",
      activo: normalizarActivo(h.activo ?? h.Activo),
    }));
  }, [horarios]);

  const cargar = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await listarHorarios();
      const lista = data?.horarios ?? data?.rows ?? data?.data ?? data ?? [];
      setHorarios(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error cargando horarios.");
      setHorarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const recargar = async () => {
    try {
      const data = await listarHorarios();
      const lista = data?.horarios ?? data?.rows ?? data?.data ?? data ?? [];
      setHorarios(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error recargando horarios.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const limpiar = () => {
    setModo("crear");
    setMsg("");
    setErr("");
    setForm({
      idHorarioLaboral: "",
      descripcion: "",
      entrada: "",
      salida: "",
      activo: "1",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cargarEnFormulario = (h) => {
    setModo("editar");
    setMsg("");
    setErr("");
    setForm({
      idHorarioLaboral: String(h.idHorarioLaboral ?? ""),
      descripcion: String(h.descripcion ?? ""),
      // input type="time" espera HH:MM
      entrada: String(h.entrada ?? "").slice(0, 5),
      salida: String(h.salida ?? "").slice(0, 5),
      activo: h.activo ? "1" : "0",
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

    if (!String(form.descripcion).trim()) return setErr("La descripción es requerida.");
    if (!form.entrada) return setErr("La hora de entrada es requerida.");
    if (!form.salida) return setErr("La hora de salida es requerida.");

    const payload = {
      descripcion: String(form.descripcion).trim(),
      // backend normalmente acepta HH:MM o HH:MM:SS
      entrada: String(form.entrada),
      salida: String(form.salida),
      activo: Number(form.activo),
    };

    try {
      if (modo === "crear") {
        const r = await crearHorario(payload);
        setMsg(r?.mensaje || "Horario creado.");
      } else {
        const id = Number(form.idHorarioLaboral);
        if (!id) return setErr("ID inválido.");
        const r = await actualizarHorario(id, payload);
        setMsg(r?.mensaje || "Horario actualizado.");
      }

      await recargar();
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error guardando horario.");
    }
  };

  const onDelete = async (id) => {
    if (!esAdmin) return;

    const ok = window.confirm(`¿Desactivar horario ${id}?`);
    if (!ok) return;

    setMsg("");
    setErr("");
    try {
      const r = await eliminarHorario(id);
      setMsg(r?.mensaje || "Horario desactivado.");
      await recargar();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error desactivando horario.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>Mantenimiento: Horarios</h1>
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

        {/* Form */}
        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <h2 style={{ margin: "0 0 10px 0" }}>
            {modo === "crear" ? "Crear horario" : "Editar horario"}
          </h2>

          {!esAdmin && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Usted solo puede <b>consultar</b>. Requiere rol de Administrador.
            </p>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {modo === "editar" && (
                <Campo
                  label="ID Horario"
                  name="idHorarioLaboral"
                  value={form.idHorarioLaboral}
                  disabled
                />
              )}

              <Campo
                label="Descripción"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                placeholder="Ej: Jornada diurna"
                required
                disabled={!esAdmin}
              />

              <Campo
                label="Entrada"
                name="entrada"
                type="time"
                value={form.entrada}
                onChange={handleChange}
                required
                disabled={!esAdmin}
              />

              <Campo
                label="Salida"
                name="salida"
                type="time"
                value={form.salida}
                onChange={handleChange}
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
                  required
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
              <button type="button" className="auth-secondary" onClick={cargar} disabled={loading}>
                Recargar
              </button>
            </div>
          </form>
        </div>

        {/* Tabla */}
        <div style={{ marginTop: 22 }}>
          <h2 style={{ marginBottom: 10 }}>Horarios registrados</h2>

          {loading ? (
            <p>Cargando...</p>
          ) : horariosNormalizados.length === 0 ? (
            <p>No hay horarios registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <Th>ID</Th>
                    <Th>Descripción</Th>
                    <Th>Entrada</Th>
                    <Th>Salida</Th>
                    <Th>Activo</Th>
                    <Th style={{ width: 220 }}>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {horariosNormalizados.map((h) => (
                    <tr key={h.idHorarioLaboral} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <Td>{h.idHorarioLaboral}</Td>
                      <Td>{h.descripcion}</Td>
                      <Td>{String(h.entrada).slice(0, 5)}</Td>
                      <Td>{String(h.salida).slice(0, 5)}</Td>
                      <Td>{h.activo ? "Sí" : "No"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="auth-secondary"
                            type="button"
                            onClick={() => cargarEnFormulario(h)}
                            disabled={!esAdmin}
                          >
                            Editar
                          </button>
                          <button
                            className="auth-danger"
                            type="button"
                            onClick={() => onDelete(h.idHorarioLaboral)}
                            disabled={!esAdmin}
                          >
                            Desactivar
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

// Normaliza el campo activo para manejar distintas estructuras de datos

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
