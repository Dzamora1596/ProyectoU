//Pagina de mantenimiento de empleados
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
// Servicios para llamadas a la API de personas y empleados
import { listarPersonas } from "../services/personaService";
import {
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
  obtenerHorarios,
} from "../services/empleadoService";

export default function MantenimientoEmpleados({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;

  const [loading, setLoading] = useState(true);

  const [personas, setPersonas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [modo, setModo] = useState("crear"); 

  // Formulario de empleado
  const [form, setForm] = useState({
    idEmpleado: "", 
    personaId: "",
    fechaIngreso: "",
    horarioId: "",
    activo: "1",
  });

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  //Normalizaciones de datos que ayuda a manejar distintas estructuras de datos
  const personasNormalizadas = useMemo(() => {
    return (personas || []).map((p) => ({
      idPersona: p.idPersona ?? p.IdPersona ?? p.id,
      nombre: p.Nombre ?? p.nombre ?? "",
      apellido1: p.Apellido1 ?? p.apellido1 ?? "",
      apellido2: p.Apellido2 ?? p.apellido2 ?? "",
      activo: normalizarActivo(p.Activo ?? p.activo),
    }));
  }, [personas]);
// Normaliza horarios laborales que ayuda a manejar distintas estructuras de datos
  const horariosNormalizados = useMemo(() => {
    return (horarios || []).map((h) => ({
      idHorarioLaboral: h.idHorarioLaboral ?? h.idHorario_Laboral ?? h.id,
      descripcion: h.descripcion ?? h.Descripcion ?? "",
      entrada: h.entrada ?? h.Entrada ?? "",
      salida: h.salida ?? h.Salida ?? "",
      activo: normalizarActivo(h.activo ?? h.Activo),
    }));
  }, [horarios]);
// Normaliza empleados que ayuda a manejar distintas estructuras de datos
  const empleadosNormalizados = useMemo(() => {
    return (empleados || []).map((e) => {
      const idEmpleado = e.idEmpleado ?? e.IdEmpleado ?? e.Empleado_idEmpleado ?? e.id;
      const personaId = e.Persona_idPersona ?? e.personaId ?? e.Persona ?? "";
      const fechaIngreso = e.Fecha_Ingreso ?? e.fechaIngreso ?? "";
      const horarioId = e.Horario_Laboral_idHorario_Laboral ?? e.horarioId ?? e.idHorario ?? "";
      const activo = normalizarActivo(e.Activo ?? e.activo);
// Nombre completo de la persona asociada
      const personaNombre =
        e?.persona
          ? `${e.persona.nombre} ${e.persona.apellido1} ${e.persona.apellido2}`
          : (e.nombre && e.apellido1)
          ? `${e.nombre} ${e.apellido1} ${e.apellido2 ?? ""}`.trim()
          : "";

      const horarioDesc =
        e?.horario
          ? `${e.horario.descripcion} (${e.horario.entrada}-${e.horario.salida})`
          : "";

      return {
        raw: e,
        idEmpleado,
        personaId,
        fechaIngreso,
        horarioId,
        activo,
        personaNombre,
        horarioDesc,
      };
    });
  }, [empleados]);

  //Carga inicial de personas, horarios y empleados
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

        // Defaults a personaId y horarioId en el form si están vacíos
        const primeraPersona =
          Array.isArray(listaPersonas) && listaPersonas[0]
            ? (listaPersonas[0].idPersona ?? listaPersonas[0].IdPersona ?? listaPersonas[0].id)
            : "";
        const primerHorario =
          Array.isArray(listaHorarios) && listaHorarios[0]
            ? (listaHorarios[0].idHorarioLaboral ?? listaHorarios[0].idHorario_Laboral ?? listaHorarios[0].id)
            : "";

        setForm((prev) => ({
          ...prev,
          personaId: prev.personaId || (primeraPersona ? String(primeraPersona) : ""),
          horarioId: prev.horarioId || (primerHorario ? String(primerHorario) : ""),
        }));
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando mantenimiento de empleados");
        setPersonas([]);
        setHorarios([]);
        setEmpleados([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  const recargarEmpleados = async () => {
    const data = await listarEmpleados();
    const lista = data?.empleados ?? data?.rows ?? data?.data ?? data ?? [];
    setEmpleados(Array.isArray(lista) ? lista : []);
  };

  // Maneja cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
// Limpia el formulario
  const limpiar = () => {
    setModo("crear");
    setMsg("");
    setErr("");
    setForm({
      idEmpleado: "",
      personaId: personasNormalizadas[0]?.idPersona ? String(personasNormalizadas[0].idPersona) : "",
      fechaIngreso: "",
      horarioId: horariosNormalizados[0]?.idHorarioLaboral ? String(horariosNormalizados[0].idHorarioLaboral) : "",
      activo: "1",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
// Maneja el envío del formulario 
  const cargarEnFormulario = (emp) => {
    setModo("editar");
    setMsg("");
    setErr("");

    setForm({
      idEmpleado: String(emp.idEmpleado ?? ""),
      personaId: String(emp.personaId ?? ""),
      fechaIngreso: String(emp.fechaIngreso ?? "").slice(0, 10),
      horarioId: String(emp.horarioId ?? ""),
      activo: emp.activo ? "1" : "0",
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

    try {
      if (modo === "crear") {
        // ✅ Crear: SIN idEmpleado
        const payload = {
          personaId: Number(form.personaId),
          fechaIngreso: String(form.fechaIngreso),
          horarioId: Number(form.horarioId),
          activo: Number(form.activo),
        };
        const data = await crearEmpleado(payload);
        setMsg(data?.mensaje || "Empleado creado correctamente");
      } else {
        // Edita con el id empleado
        const payload = {
          personaId: Number(form.personaId),
          fechaIngreso: String(form.fechaIngreso),
          horarioId: Number(form.horarioId),
          activo: Number(form.activo),
        };
        const data = await actualizarEmpleado(Number(form.idEmpleado), payload);
        setMsg(data?.mensaje || "Empleado actualizado correctamente");
      }

      await recargarEmpleados();
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error guardando empleado");
    }
  };

  const onDelete = async (idEmpleado) => {
    if (!esAdmin) return;

    const ok = window.confirm(`¿Desactivar empleado ${idEmpleado}?`);
    if (!ok) return;

    setMsg("");
    setErr("");
    try {
      const data = await eliminarEmpleado(idEmpleado);
      setMsg(data?.mensaje || "Empleado desactivado");
      await recargarEmpleados();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error desactivando empleado");
    }
  };

  return (
    <div style={{ padding: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Mantenimiento: Empleados</h1>
          <p style={{ marginTop: 8 }}>
            Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/mantenimientos">
            <button>Volver a Mantenimientos</button>
          </Link>
          <Link to="/inicio">
            <button>Inicio</button>
          </Link>
          <button onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>

      {/* Mensajes de acción en caso de error o éxito */}
      {msg && <div style={{ marginTop: 12, padding: 10, border: "1px solid #16a34a" }}>{msg}</div>}
      {err && <div style={{ marginTop: 12, padding: 10, border: "1px solid #ef4444" }}>{err}</div>}

      {/* Formulario de empleados */}
      <div style={{ marginTop: 16, padding: 14, border: "1px solid #ddd" }}>
        <h2 style={{ marginTop: 0 }}>{modo === "crear" ? "Crear empleado" : "Editar empleado"}</h2>

        {!esAdmin && (
          <p style={{ marginTop: 0 }}>
            Usted solo puede <b>consultar</b>. Para crear/editar/desactivar se requiere rol Administrador.
          </p>
        )}

        <form onSubmit={onSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {/*Para mostrar ID en editar, no al crear*/}
            {modo === "editar" && (
              <Campo
                label="ID Empleado"
                name="idEmpleado"
                type="text"
                value={form.idEmpleado}
                disabled
              />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 700 }}>Persona</label>
              <select
                name="personaId"
                value={form.personaId}
                onChange={handleChange}
                disabled={!esAdmin}
                required
                style={{ padding: "10px 12px" }}
              >
                {personasNormalizadas.length === 0 ? (
                  <option value="">No hay personas disponibles</option>
                ) : (
                  personasNormalizadas
                    .filter((p) => p.activo !== false)
                    .map((p) => (
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
              disabled={!esAdmin}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 700 }}>Horario laboral</label>
              <select
                name="horarioId"
                value={form.horarioId}
                onChange={handleChange}
                disabled={!esAdmin}
                required
                style={{ padding: "10px 12px" }}
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
              <label style={{ fontWeight: 700 }}>Activo</label>
              <select
                name="activo"
                value={form.activo}
                onChange={handleChange}
                disabled={!esAdmin}
                required
                style={{ padding: "10px 12px" }}
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {esAdmin && <button type="submit">{modo === "crear" ? "Guardar" : "Actualizar"}</button>}
            <button type="button" onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Tabla */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 10 }}>Empleados registrados</h2>

        {loading ? (
          <p>Cargando...</p>
        ) : empleadosNormalizados.length === 0 ? (
          <p>No hay empleados registrados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <Th>ID Empleado</Th>
                  <Th>Persona</Th>
                  <Th>Fecha ingreso</Th>
                  <Th>Horario</Th>
                  <Th>Activo</Th>
                  <Th style={{ width: 180 }}>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {empleadosNormalizados.map((e) => (
                  <tr key={e.idEmpleado} style={{ borderTop: "1px solid #ddd" }}>
                    <Td>{e.idEmpleado}</Td>
                    <Td>
                      {e.personaId} - {e.personaNombre || "Sin nombre"}
                    </Td>
                    <Td>{String(e.fechaIngreso ?? "").slice(0, 10)}</Td>
                    <Td>{e.horarioDesc || `ID ${e.horarioId}`}</Td>
                    <Td>{e.activo ? "Sí" : "No"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => cargarEnFormulario(e)} disabled={!esAdmin}>
                          Editar
                        </button>
                        <button type="button" onClick={() => onDelete(e.idEmpleado)} disabled={!esAdmin}>
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
  );
}

// Normaliza el campo activo para manejar distintas estructuras de datos

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
      <label style={{ fontWeight: 700 }}>{label}</label>
      <input {...props} style={{ padding: "10px 12px" }} />
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{ padding: "10px 8px", fontWeight: 700, fontSize: 13, ...style }}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td style={{ padding: "10px 8px", fontSize: 14 }}>{children}</td>;
}
