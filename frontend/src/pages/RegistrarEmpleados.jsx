//Pagina para registrar empleados
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/autenticar.css";

import { listarPersonas } from "../services/personaService";
import { crearEmpleado, obtenerHorarios, listarEmpleados } from "../services/empleadoService"; 

export default function RegistrarEmpleados({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;
  const esJefatura = rolId === 2;

  const puedeRegistrar = esAdmin || esJefatura;

  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [empleados, setEmpleados] = useState([]); 

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    personaId: "",
    fechaIngreso: "",
    horarioId: "",
    activo: "1",
  });

  const personasNormalizadas = useMemo(() => {
    return (personas || []).map((p) => ({
      idPersona: p.idPersona ?? p.IdPersona ?? p.id,
      nombre: p.Nombre ?? p.nombre ?? "",
      apellido1: p.Apellido1 ?? p.apellido1 ?? "",
      apellido2: p.Apellido2 ?? p.apellido2 ?? "",
      activo: normalizarActivo(p.Activo ?? p.activo),
    }));
  }, [personas]);

  const horariosNormalizados = useMemo(() => {
    return (horarios || []).map((h) => ({
      idHorarioLaboral: h.idHorarioLaboral ?? h.idHorario_Laboral ?? h.id,
      descripcion: h.descripcion ?? h.Descripcion ?? "",
      entrada: h.entrada ?? h.Entrada ?? "",
      salida: h.salida ?? h.Salida ?? "",
      activo: normalizarActivo(h.activo ?? h.Activo),
    }));
  }, [horarios]);

  
  const personaIdsYaEmpleados = useMemo(() => {
    const ids = new Set();
    (empleados || []).forEach((e) => {
      const pid =
        e.personaId ??
        e.Persona_idPersona ??
        e.Persona_idPersona_FK ??
        e.persona_idPersona ??
        e.idPersona ??
        e.IdPersona;
      if (pid !== null && pid !== undefined) ids.add(Number(pid));
    });
    return ids;
  }, [empleados]);

  
  const personasDisponibles = useMemo(() => {
    return personasNormalizadas.filter(
      (p) => p.activo !== false && !personaIdsYaEmpleados.has(Number(p.idPersona))
    );
  }, [personasNormalizadas, personaIdsYaEmpleados]);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setErr("");
      try {
        const [pData, hData, eData] = await Promise.all([
          listarPersonas(),
          obtenerHorarios(),
          listarEmpleados(), 
        ]);

        const listaPersonas = pData?.personas ?? pData?.rows ?? pData?.data ?? pData ?? [];
        const listaHorarios = hData?.horarios ?? hData?.rows ?? hData?.data ?? hData ?? [];
        const listaEmpleados = eData?.empleados ?? eData?.rows ?? eData?.data ?? eData ?? [];

        setPersonas(Array.isArray(listaPersonas) ? listaPersonas : []);
        setHorarios(Array.isArray(listaHorarios) ? listaHorarios : []);
        setEmpleados(Array.isArray(listaEmpleados) ? listaEmpleados : []);

        
        const horariosActivos = (Array.isArray(listaHorarios) ? listaHorarios : []).filter((h) =>
          normalizarActivo(h.Activo ?? h.activo)
        );

        const primerHorario = horariosActivos[0]
          ? horariosActivos[0].idHorarioLaboral ??
            horariosActivos[0].idHorario_Laboral ??
            horariosActivos[0].id
          : "";

        
        setForm((prev) => ({
          ...prev,
          horarioId: prev.horarioId || (primerHorario ? String(primerHorario) : ""),
        }));
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando Personas/Horarios/Empleados.");
        setPersonas([]);
        setHorarios([]);
        setEmpleados([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  
  useEffect(() => {
    if (loading) return;

    setForm((prev) => {
      const actual = Number(prev.personaId);
      const existe = personasDisponibles.some((p) => Number(p.idPersona) === actual);

      
      const primeraDisponible = personasDisponibles[0]?.idPersona;
      const nuevo = existe ? prev.personaId : (primeraDisponible ? String(primeraDisponible) : "");

      if (nuevo === prev.personaId) return prev;
      return { ...prev, personaId: nuevo };
    });
  }, [loading, personasDisponibles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const limpiar = () => {
    setMsg("");
    setErr("");

    const primeraPersonaDisponible = personasDisponibles[0]?.idPersona ?? "";
    const primerHorarioActivo = horariosNormalizados.find((h) => h.activo)?.idHorarioLaboral ?? "";

    setForm({
      personaId: primeraPersonaDisponible ? String(primeraPersonaDisponible) : "",
      fechaIngreso: "",
      horarioId: primerHorarioActivo ? String(primerHorarioActivo) : "",
      activo: "1",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setMsg("");
    setErr("");

    if (!puedeRegistrar) {
      setErr("No tiene permisos para registrar empleados.");
      return;
    }

    const payload = {
      personaId: Number(form.personaId),
      fechaIngreso: String(form.fechaIngreso),
      horarioId: Number(form.horarioId),
      activo: Number(form.activo),
    };

    try {
      const r = await crearEmpleado(payload);
      const nuevoId = r?.idEmpleado ? ` (ID: ${r.idEmpleado})` : "";
      setMsg((r?.mensaje || "Empleado creado.") + nuevoId);

      
      try {
        const eData = await listarEmpleados();
        const listaEmpleados = eData?.empleados ?? eData?.rows ?? eData?.data ?? eData ?? [];
        setEmpleados(Array.isArray(listaEmpleados) ? listaEmpleados : []);
      } catch {
        // Por si recuperar la lista de empleados falla solo reportamos el error pero no bloqueamos el flujo
      }

      limpiar();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error guardando empleado.");
    }
  };

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 1100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>
              Registrar Empleados
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

        {msg && <div className="auth-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}

        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <h2 style={{ margin: "0 0 10px 0" }}>Nuevo Empleado</h2>

          {!puedeRegistrar && (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Usted solo puede <b>consultar</b>. Requiere permiso de Admin o Jefatura.
            </p>
          )}

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <form onSubmit={onSubmit} className="auth-form">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="auth-label">Persona</label>
                  <select
                    className="auth-input"
                    name="personaId"
                    value={form.personaId}
                    onChange={handleChange}
                    required
                    disabled={!puedeRegistrar || personasDisponibles.length === 0}
                  >
                    {personasDisponibles.length === 0 ? (
                      <option value="">No hay personas disponibles (todas ya son empleados)</option>
                    ) : (
                      personasDisponibles.map((p) => (
                        <option key={p.idPersona} value={p.idPersona}>
                          {p.idPersona} - {p.nombre} {p.apellido1} {p.apellido2}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <Campo
                  label="Fecha ingreso"
                  name="fechaIngreso"
                  type="date"
                  value={form.fechaIngreso}
                  onChange={handleChange}
                  required
                  disabled={!puedeRegistrar}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="auth-label">Horario laboral</label>
                  <select
                    className="auth-input"
                    name="horarioId"
                    value={form.horarioId}
                    onChange={handleChange}
                    required
                    disabled={!puedeRegistrar}
                  >
                    {horariosNormalizados.length === 0 ? (
                      <option value="">No hay horarios disponibles</option>
                    ) : (
                      horariosNormalizados
                        .filter((h) => h.activo !== false)
                        .map((h) => (
                          <option key={h.idHorarioLaboral} value={h.idHorarioLaboral}>
                            {h.descripcion} ({h.entrada}-{h.salida})
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
                  <button className="auth-button" type="submit" disabled={personasDisponibles.length === 0}>
                    Guardar
                  </button>
                )}
                <button type="button" className="auth-secondary" onClick={limpiar}>
                  Limpiar
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/registro">
            <button className="auth-secondary">Ir a Registrar Usuarios</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

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
