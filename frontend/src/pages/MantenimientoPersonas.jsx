//Pagina de mantenimiento de personas
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

export default function MantenimientoPersonas({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;

  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState([]);
  const [generos, setGeneros] = useState([]);

  const [q, setQ] = useState("");

  const [modo, setModo] = useState("crear"); 
  const [form, setForm] = useState({
    idPersona: "",
    nombre: "",
    apellido1: "",
    apellido2: "",
    generoId: "",
    activo: "1",
  });

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

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

  const generoNombrePorId = useMemo(() => {
    const m = new Map();
    for (const g of generosNormalizados) {
      if (g?.id != null) m.set(Number(g.id), String(g.nombre));
    }
    return m;
  }, [generosNormalizados]);

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
        idPersona: Number(idPersona),
        nombre: p.Nombre ?? p.nombre ?? "",
        apellido1: p.Apellido1 ?? p.apellido1 ?? "",
        apellido2: p.Apellido2 ?? p.apellido2 ?? "",
        generoId: generoId === "" ? "" : Number(generoId),
        activo: normalizarActivo(p.Activo ?? p.activo),
      };
    });
  }, [personas]);

  const personasFiltradas = useMemo(() => {
    const term = String(q || "").toLowerCase().trim();
    if (!term) return personasNormalizadas;

    return personasNormalizadas.filter((p) => {
      const full = `${p.idPersona} ${p.nombre} ${p.apellido1} ${p.apellido2}`.toLowerCase();
      return full.includes(term);
    });
  }, [personasNormalizadas, q]);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setErr("");
      setMsg("");
      try {
        const [dataGeneros, dataPersonas] = await Promise.all([obtenerGeneros(), listarPersonas()]);

        const listaGeneros =
          dataGeneros?.generos ?? dataGeneros?.rows ?? dataGeneros?.data ?? dataGeneros ?? [];

        const listaPersonas =
          dataPersonas?.personas ?? dataPersonas?.rows ?? dataPersonas?.data ?? dataPersonas ?? [];

        setGeneros(Array.isArray(listaGeneros) ? listaGeneros : []);
        setPersonas(Array.isArray(listaPersonas) ? listaPersonas : []);
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando datos de Personas");
        setGeneros([]);
        setPersonas([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  const recargarPersonas = async () => {
    const dataPersonas = await listarPersonas();
    const listaPersonas =
      dataPersonas?.personas ?? dataPersonas?.rows ?? dataPersonas?.data ?? dataPersonas ?? [];
    setPersonas(Array.isArray(listaPersonas) ? listaPersonas : []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

   
    if (name === "idPersona") {
      const soloNumeros = String(value).replace(/\D/g, "");
      setForm((prev) => ({ ...prev, [name]: soloNumeros }));
      return;
    }

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

  const editarFila = (p) => {
    setModo("editar");
    setMsg("");
    setErr("");
    setForm({
      idPersona: String(p.idPersona),
      nombre: p.nombre,
      apellido1: p.apellido1,
      apellido2: p.apellido2,
      generoId: p.generoId === "" ? "" : String(p.generoId),
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

    const payload = {
      idPersona: Number(form.idPersona),
      nombre: String(form.nombre).trim(),
      apellido1: String(form.apellido1).trim(),
      apellido2: String(form.apellido2).trim(),
      generoId: Number(form.generoId),
      activo: Number(form.activo),
    };

    try {
      if (!payload.idPersona || Number.isNaN(payload.idPersona)) {
        setErr("ID Persona inválido.");
        return;
      }
      if (!payload.generoId || Number.isNaN(payload.generoId)) {
        setErr("Debe seleccionar un género.");
        return;
      }

      if (modo === "crear") {
        const data = await crearPersona(payload);
        setMsg(data?.mensaje || "Persona creada");
      } else {
        const data = await actualizarPersona(payload.idPersona, payload);
        setMsg(data?.mensaje || "Persona actualizada");
      }

      await recargarPersonas();
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
      await recargarPersonas();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error eliminando persona");
    }
  };

  if (!esAdmin) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Mantenimiento de Personas</h1>
        <p>No tiene permisos para acceder a este módulo.</p>
        <Link to="/inicio">
          <button>Volver a Inicio</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 1200 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>
              Mantenimiento de Personas
            </h1>
            <p className="auth-subtitle" style={{ marginTop: 0 }}>
              Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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

        {msg && <div className="auth-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}

        {/* Form */}
        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{modo === "crear" ? "Agregar persona" : "Editar persona"}</h2>
            <button className="auth-secondary" type="button" onClick={limpiar}>
              Limpiar
            </button>
          </div>

          <form onSubmit={onSubmit} className="auth-form" style={{ marginTop: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {/*ID Persona en texto*/}
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
                disabled={modo === "editar"}
              />

              <Campo
                label="Nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Nombre"
                required
              />

              <Campo
                label="Primer Apellido"
                name="apellido1"
                value={form.apellido1}
                onChange={handleChange}
                placeholder="Apellido 1"
                required
              />

              <Campo
                label="Segundo Apellido"
                name="apellido2"
                value={form.apellido2}
                onChange={handleChange}
                placeholder="Apellido 2"
                required
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Género</label>
                <select
                  className="auth-input"
                  name="generoId"
                  value={form.generoId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione...</option>
                  {generosNormalizados
                    .filter((g) => g.activo !== false)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Activo</label>
                <select className="auth-input" name="activo" value={form.activo} onChange={handleChange}>
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button className="auth-button" type="submit">
                {modo === "crear" ? "Guardar" : "Actualizar"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Listado</h2>

            <input
              className="auth-input"
              style={{ maxWidth: 320 }}
              placeholder="Buscar por ID o nombre..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loading ? (
            <p style={{ marginTop: 10 }}>Buscando...</p>
          ) : personasFiltradas.length === 0 ? (
            <p style={{ marginTop: 10 }}>No hay personas registradas.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <Th>ID</Th>
                    <Th>Nombre</Th>
                    <Th>Apellido 1</Th>
                    <Th>Apellido 2</Th>
                    <Th>Género</Th>
                    <Th>Activo</Th>
                    <Th style={{ width: 180 }}>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {personasFiltradas.map((p) => (
                    <tr key={p.idPersona} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <Td>{p.idPersona}</Td>
                      <Td>{p.nombre}</Td>
                      <Td>{p.apellido1}</Td>
                      <Td>{p.apellido2}</Td>
                      <Td>{generoNombrePorId.get(Number(p.generoId)) || "Sin nombre"}</Td>
                      <Td>{p.activo ? "Sí" : "No"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="auth-secondary" type="button" onClick={() => editarFila(p)}>
                            Edit
                          </button>
                          <button className="auth-danger" type="button" onClick={() => onDelete(p.idPersona)}>
                            Del
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
