//Codigo para la página de registrar personas
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/autenticar.css";


import {
  listarPersonas,
  crearPersona,
  actualizarPersona,
  eliminarPersona,
  obtenerGeneros,
} from "../services/personaService";

export default function RegistrarPersona({ user, onLogout }) {
  // solo Adminy jefaturapuede agregar/editar/eliminar
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;

  // Estados de la página
  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState([]);
  const [generos, setGeneros] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Controla si estamos en modo "crear" o "editar"
  const [modo, setModo] = useState("crear");

  const [form, setForm] = useState({
    idPersona: "",
    nombre: "",
    apellido1: "",
    apellido2: "",
    generoId: "",
    activo: "1",
  });

  
  // El codigo normaliza los datos de géneros para soportar varios nombres de campos
  const generosNormalizados = useMemo(() => {
    return (generos || []).map((g) => ({
      id:
        g.idCatalogo_Genero ??
        g.idGenero ??
        g.id ??
        g.IdCatalogo_Genero ??
        g.ID ??
        g.value,
      nombre:
        g.Descripcion_Genero ??
        g.descripcion ??
        g.nombre ??
        g.nombreGenero ??
        g.label ??
        g.Descripcion ??
        "Sin nombre",
      activo: normalizarActivo(g.Activo ?? g.activo),
    }));
  }, [generos]);

  // Codigo para mapear id de género a nombre
  const generoNombrePorId = useMemo(() => {
    const m = new Map();
    for (const g of generosNormalizados) {
      if (g?.id != null) m.set(Number(g.id), String(g.nombre));
    }
    return m;
  }, [generosNormalizados]);

  // El codigo normaliza los datos de personas para soportar varios nombres de campos
  const personasNormalizadas = useMemo(() => {
    return (personas || []).map((p) => {
      const idPersona = p.idPersona ?? p.IdPersona ?? p.Persona_idPersona ?? p.id;
      const generoId =
        p.Catalogo_Genero_idCatalogo_Genero ??
        p.generoId ??
        p.idGenero ??
        p.Catalogo_Genero ??
        p.genero ??
        "";
      return {
        raw: p,
        idPersona,
        nombre: p.Nombre ?? p.nombre ?? "",
        apellido1: p.Apellido1 ?? p.apellido1 ?? "",
        apellido2: p.Apellido2 ?? p.apellido2 ?? "",
        generoId: generoId,
        activo: normalizarActivo(p.Activo ?? p.activo),
      };
    });
  }, [personas]);

  // Cargar datos iniciales 
  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setErr("");
      try {
        const [dataGeneros, dataPersonas] = await Promise.all([
          obtenerGeneros(), 
          listarPersonas(), 
        ]);

        const listaGeneros =
          dataGeneros?.generos ?? dataGeneros?.rows ?? dataGeneros?.data ?? dataGeneros ?? [];

        const listaPersonas =
          dataPersonas?.personas ?? dataPersonas?.rows ?? dataPersonas?.data ?? dataPersonas ?? [];

        setGeneros(Array.isArray(listaGeneros) ? listaGeneros : []);
        setPersonas(Array.isArray(listaPersonas) ? listaPersonas : []);
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando personas/géneros");
        setGeneros([]);
        setPersonas([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  // Manejo de formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const limpiar = () => {
    setModo("crear");
    setForm({
      idPersona: "",
      nombre: "",
      apellido1: "",
      apellido2: "",
      generoId: "",
      activo: "1",
    });
    setMsg("");
    setErr("");
  };

  const cargarEnFormulario = (p) => {
    setModo("editar");
    setMsg("");
    setErr("");
    setForm({
      idPersona: String(p.idPersona ?? ""),
      nombre: String(p.nombre ?? ""),
      apellido1: String(p.apellido1 ?? ""),
      apellido2: String(p.apellido2 ?? ""),
      generoId: String(p.generoId ?? ""),
      activo: p.activo ? "1" : "0",
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

    // Payload es un objeto con los datos del formulario para enviar al backend
    const payload = {
      idPersona: Number(form.idPersona),
      nombre: String(form.nombre).trim(),
      apellido1: String(form.apellido1).trim(),
      apellido2: String(form.apellido2).trim(),
      generoId: Number(form.generoId),
      activo: Number(form.activo), 
    };

    try {
      if (modo === "crear") {
        const data = await crearPersona(payload);
        setMsg(data?.mensaje || "Persona creada correctamente");
      } else {
        const data = await actualizarPersona(payload.idPersona, payload);
        setMsg(data?.mensaje || "Persona actualizada correctamente");
      }

      // Recargar lista
      const dataPersonas = await listarPersonas();
      const listaPersonas =
        dataPersonas?.personas ?? dataPersonas?.rows ?? dataPersonas?.data ?? dataPersonas ?? [];
      setPersonas(Array.isArray(listaPersonas) ? listaPersonas : []);

      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error guardando persona");
    }
  };

  const onDelete = async (idPersona) => {
    if (!esAdmin) return;

    const ok = window.confirm(`¿Eliminar persona ${idPersona}?`);
    if (!ok) return;

    setMsg("");
    setErr("");
    try {
      const data = await eliminarPersona(idPersona);
      setMsg(data?.mensaje || "Persona eliminada");

      const dataPersonas = await listarPersonas();
      const listaPersonas =
        dataPersonas?.personas ?? dataPersonas?.rows ?? dataPersonas?.data ?? dataPersonas ?? [];
      setPersonas(Array.isArray(listaPersonas) ? listaPersonas : []);
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error eliminando persona");
    }
  };

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  // ---- UI ----
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>
              Registrar Persona
            </h1>
            <p className="auth-subtitle" style={{ marginTop: 0 }}>
              Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link to="/inicio">
              <button className="auth-secondary">Volver a Inicio</button>
            </Link>
            <button className="auth-danger" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Mensajes */}
        {msg && (
          <div className="auth-success" style={{ marginTop: 12 }}>
            {msg}
          </div>
        )}
        {err && (
          <div className="auth-error" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}

        {/* Formulario */}
        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <h2 style={{ margin: "0 0 10px 0" }}>{modo === "crear" ? "Nueva Persona" : "Editar Persona"}</h2>

          {!esAdmin && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Usted solo puede <b>consultar</b>. Para crear/editar/eliminar se requiere rol Administrador.
            </p>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {/* Codigo para ID Persona */}
              <Campo
                label="ID Persona"
                name="idPersona"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.idPersona}
                onChange={handleChange}
                placeholder="Ej: 1001"
                required
                disabled={!esAdmin || modo === "editar"} // en editar no cambiamos ID
              />

              <Campo
                label="Nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Nombre"
                required
                disabled={!esAdmin}
              />

              <Campo
                label="Primer Apellido"
                name="apellido1"
                value={form.apellido1}
                onChange={handleChange}
                placeholder="Apellido Paterno"
                required
                disabled={!esAdmin}
              />

              <Campo
                label="Segundo Apellido"
                name="apellido2"
                value={form.apellido2}
                onChange={handleChange}
                placeholder="Apellido Materno"
                required
                disabled={!esAdmin}
              />

              {/*Muestra el género por nombre*/}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Género</label>
                <select
                  className="auth-input"
                  name="generoId"
                  value={form.generoId}
                  onChange={handleChange}
                  required
                  disabled={!esAdmin}
                >
                  <option value="">Seleccione...</option>
                  {generosNormalizados.length === 0 ? (
                    <option value="" disabled>
                      No hay géneros disponibles
                    </option>
                  ) : (
                    generosNormalizados
                      .filter((g) => g.activo !== false)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre}
                        </option>
                      ))
                  )}
                </select>
              </div>

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
            </div>
          </form>
        </div>

        {/* Tabla */}
        <div style={{ marginTop: 22 }}>
          <h2 style={{ marginBottom: 10 }}>Personas registradas</h2>

          {loading ? (
            <p>Cargando...</p>
          ) : personasNormalizadas.length === 0 ? (
            <p>No hay personas registradas.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <Th>ID</Th>
                    <Th>Nombre</Th>
                    <Th>Apellidos</Th>
                    <Th>Género</Th>
                    <Th>Activo</Th>
                    <Th style={{ width: 220 }}>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {personasNormalizadas.map((p) => (
                    <tr key={p.idPersona} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <Td>{p.idPersona}</Td>
                      <Td>{p.nombre}</Td>
                      <Td>
                        {p.apellido1} {p.apellido2}
                      </Td>
                      <Td>{generoNombrePorId.get(Number(p.generoId)) || "Sin nombre"}</Td>
                      <Td>{p.activo ? "Sí" : "No"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="auth-secondary"
                            type="button"
                            onClick={() => cargarEnFormulario(p)}
                            disabled={!esAdmin}
                          >
                            Editar
                          </button>
                          <button
                            className="auth-danger"
                            type="button"
                            onClick={() => onDelete(p.idPersona)}
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

        {/* Atajo */}
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/registrar-empleados">
            <button className="auth-secondary">Ir a Registrar Empleados</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers / mini componentes ---------- */

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
    <th
      style={{
        padding: "10px 8px",
        fontWeight: 700,
        fontSize: 13,
        opacity: 0.9,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td style={{ padding: "10px 8px", fontSize: 14 }}>{children}</td>;
}
