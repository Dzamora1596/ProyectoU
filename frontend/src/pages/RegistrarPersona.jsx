//Pagina para registrar personas
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/autenticar.css";

import { crearPersona, obtenerGeneros } from "../services/personaService";

export default function RegistrarPersona({ user, onLogout }) {
  
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;
  const esJefatura = rolId === 2;
  const puedeRegistrar = esAdmin || esJefatura;

  // Estados de la página
  const [loading, setLoading] = useState(true);
  const [generos, setGeneros] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    idPersona: "",
    nombre: "",
    apellido1: "",
    apellido2: "",
    generoId: "",
    activo: "1",
  });

  // Para normalizar los géneros y que ayude a soportar varios nombres de campos
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

  
  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setErr("");
      try {
        const dataGeneros = await obtenerGeneros();
        const listaGeneros =
          dataGeneros?.generos ?? dataGeneros?.rows ?? dataGeneros?.data ?? dataGeneros ?? [];

        setGeneros(Array.isArray(listaGeneros) ? listaGeneros : []);
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando géneros");
        setGeneros([]);
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!puedeRegistrar) {
      setErr("No tiene permisos para registrar personas.");
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
      const data = await crearPersona(payload);
      setMsg(data?.mensaje || "Persona creada correctamente");
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error guardando persona");
    }
  };

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

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
          <h2 style={{ margin: "0 0 10px 0" }}>Nueva Persona</h2>

          {!puedeRegistrar && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Usted solo puede <b>consultar</b>. Para registrar se requiere rol Administrador o Jefatura.
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
              {/* Id de Persona */}
              <Campo
                label="ID Persona"
                name="idPersona"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.idPersona}
                onChange={handleChange}
                placeholder="Cedula"
                required
                disabled={!puedeRegistrar}
              />

              <Campo
                label="Nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Nombre"
                required
                disabled={!puedeRegistrar}
              />

              <Campo
                label="Primer Apellido"
                name="apellido1"
                value={form.apellido1}
                onChange={handleChange}
                placeholder="Apellido Paterno"
                required
                disabled={!puedeRegistrar}
              />

              <Campo
                label="Segundo Apellido"
                name="apellido2"
                value={form.apellido2}
                onChange={handleChange}
                placeholder="Apellido Materno"
                required
                disabled={!puedeRegistrar}
              />

              {/* Género por nombre */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Género</label>
                <select
                  className="auth-input"
                  name="generoId"
                  value={form.generoId}
                  onChange={handleChange}
                  required
                  disabled={!puedeRegistrar}
                >
                  <option value="">{loading ? "Cargando..." : "Seleccione..."}</option>

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
                  disabled={!puedeRegistrar}
                >
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              {puedeRegistrar && (
                <button className="auth-button" type="submit">
                  Guardar
                </button>
              )}

              <button type="button" className="auth-secondary" onClick={limpiar}>
                Limpiar
              </button>
            </div>
          </form>
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

// Normaliza valores de activo a inactivo

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
