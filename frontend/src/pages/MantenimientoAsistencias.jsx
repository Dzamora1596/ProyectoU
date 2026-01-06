//Pagina de mantenimiento de asistencias
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listarEmpleados } from "../services/empleadoService";
import { crearAsistencia } from "../services/asistenciaService";
// Componente de Mantenimiento de Asistencias
export default function MantenimientoAsistencias({ user, onLogout }) {
  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol);
  const esAdmin = rolId === 1;
  const esJefatura = rolId === 2;
  const permitido = esAdmin || esJefatura;

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
// Lista de empleados para el select
  const [empleados, setEmpleados] = useState([]);
// Formulario de asistencia
  const [form, setForm] = useState({
    empleadoId: "",
    fecha: "",
    entrada: "",
    salida: "",
    tardia: false,
    ausente: false,
    validado: false,
    observacion: "",
    activo: true,
  });
// Normaliza la lista de empleados para el select
  const empleadosNormalizados = useMemo(() => {
    return (empleados || []).map((e) => ({
      idEmpleado: e.idEmpleado ?? e.IdEmpleado ?? e.id ?? e.Empleado_idEmpleado,
      activo: normalizarBool(e.activo ?? e.Activo ?? true),
      nombreCompleto:
        e?.persona
          ? `${e.persona.nombre ?? ""} ${e.persona.apellido1 ?? ""} ${e.persona.apellido2 ?? ""}`.trim()
          : `${e.nombre ?? ""} ${e.apellido1 ?? ""} ${e.apellido2 ?? ""}`.trim(),
    }));
  }, [empleados]);
// Carga la lista de empleados al montar el componente
  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setErr("");
      setMsg("");
      try {
        const data = await listarEmpleados();
        const lista = data?.empleados ?? data?.rows ?? data?.data ?? data ?? [];
        setEmpleados(Array.isArray(lista) ? lista : []);

        const primer = Array.isArray(lista) && lista[0]
          ? (lista[0].idEmpleado ?? lista[0].IdEmpleado ?? lista[0].id ?? lista[0].Empleado_idEmpleado)
          : "";

        setForm((prev) => ({ ...prev, empleadoId: prev.empleadoId || (primer ? String(primer) : "") }));
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando empleados.");
        setEmpleados([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);
// Maneja cambios en el formulario
  const onChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Maneja checkbox y otros tipos de inputs
    if (type === "checkbox") {
      // si marca ausente, bloqueamos tardía y horas y obliga el 00:00:00)
      if (name === "ausente") {
        setForm((prev) => ({
          ...prev,
          ausente: checked,
          tardia: checked ? false : prev.tardia,
          entrada: checked ? "" : prev.entrada,
          salida: checked ? "" : prev.salida,
        }));
        return;
      }

      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };
// Limpia el formulario
  const limpiar = () => {
    setMsg("");
    setErr("");
    setForm((prev) => ({
      empleadoId: prev.empleadoId || "",
      fecha: "",
      entrada: "",
      salida: "",
      tardia: false,
      ausente: false,
      validado: false,
      observacion: "",
      activo: true,
    }));
  };
// Maneja el envío del formulario
  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
// Verifica permisos
    if (!permitido) {
      setErr("No tiene permisos para este módulo.");
      return;
    }

    if (!form.empleadoId || !form.fecha) {
      setErr("Empleado y Fecha son requeridos.");
      return;
    }

    // Horas simples hora minuto y segundos
    const entrada = form.entrada ? `${form.entrada}:00` : "00:00:00";
    const salida = form.salida ? `${form.salida}:00` : "00:00:00";

    const payload = {
      empleadoId: Number(form.empleadoId),
      fecha: form.fecha, // YYYY-MM-DD
      entrada,
      salida,
      tardia: !!form.tardia,
      ausente: !!form.ausente,
      validado: !!form.validado,
      observacion: String(form.observacion ?? ""),
      activo: form.activo ? 1 : 0,
    };

    setLoading(true);
    try {
      const r = await crearAsistencia(payload);
      setMsg(r?.mensaje || "Asistencia creada.");
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error creando asistencia.");
    } finally {
      setLoading(false);
    }
  };

  if (!permitido) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Mantenimiento: Asistencias</h1>
        <p>
          Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
        </p>
        <p style={{ color: "crimson" }}>
          No tiene permisos para acceder a este módulo.
        </p>
        <p>
          <Link to="/inicio">
            <button type="button">Volver a Inicio</button>
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>Mantenimiento: Asistencias</h1>
          <p>
            Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/mantenimientos">
            <button type="button">Volver a Mantenimientos</button>
          </Link>
          <Link to="/inicio">
            <button type="button">Inicio</button>
          </Link>
          <button type="button" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>

      <hr />

      {loading && <p><b>Cargando...</b></p>}
      {msg && <p><b>{msg}</b></p>}
      {err && <p><b style={{ color: "crimson" }}>{err}</b></p>}

      <form onSubmit={onSubmit}>
        <fieldset>
          <legend>Crear registro de asistencia</legend>

          <table>
            <tbody>
              <tr>
                <td><label>Empleado</label></td>
                <td>
                  <select
                    name="empleadoId"
                    value={form.empleadoId}
                    onChange={onChange}
                    disabled={loading}
                    required
                  >
                    <option value="">-- Seleccione --</option>
                    {empleadosNormalizados
                      .filter((e) => e.activo !== false)
                      .map((e) => (
                        <option key={e.idEmpleado} value={String(e.idEmpleado)}>
                          #{e.idEmpleado} - {e.nombreCompleto || "(sin nombre)"}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>

              <tr>
                <td><label>Fecha</label></td>
                <td>
                  <input
                    type="date"
                    name="fecha"
                    value={form.fecha}
                    onChange={onChange}
                    disabled={loading}
                    required
                  />
                </td>
              </tr>

              <tr>
                <td><label>Entrada</label></td>
                <td>
                  <input
                    type="time"
                    name="entrada"
                    value={form.entrada}
                    onChange={onChange}
                    disabled={loading || form.ausente}
                  />
                  {form.ausente ? <small> (ausente → 00:00:00)</small> : null}
                </td>
              </tr>

              <tr>
                <td><label>Salida</label></td>
                <td>
                  <input
                    type="time"
                    name="salida"
                    value={form.salida}
                    onChange={onChange}
                    disabled={loading || form.ausente}
                  />
                  {form.ausente ? <small> (ausente → 00:00:00)</small> : null}
                </td>
              </tr>

              <tr>
                <td><label>Tardía</label></td>
                <td>
                  <input
                    type="checkbox"
                    name="tardia"
                    checked={form.tardia}
                    onChange={onChange}
                    disabled={loading || form.ausente}
                  />
                </td>
              </tr>

              <tr>
                <td><label>Ausente</label></td>
                <td>
                  <input
                    type="checkbox"
                    name="ausente"
                    checked={form.ausente}
                    onChange={onChange}
                    disabled={loading}
                  />
                </td>
              </tr>

              <tr>
                <td><label>Validado</label></td>
                <td>
                  <input
                    type="checkbox"
                    name="validado"
                    checked={form.validado}
                    onChange={onChange}
                    disabled={loading}
                  />
                </td>
              </tr>

              <tr>
                <td><label>Observación</label></td>
                <td>
                  <input
                    type="text"
                    name="observacion"
                    value={form.observacion}
                    onChange={onChange}
                    disabled={loading}
                    size={40}
                    placeholder="Opcional"
                  />
                </td>
              </tr>

              <tr>
                <td><label>Activo</label></td>
                <td>
                  <input
                    type="checkbox"
                    name="activo"
                    checked={form.activo}
                    onChange={onChange}
                    disabled={loading}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <p>
            <button type="submit" disabled={loading}>Guardar</button>{" "}
            <button type="button" onClick={limpiar} disabled={loading}>Limpiar</button>
          </p>
        </fieldset>
      </form>
    </div>
  );
}

// Normaliza valores booleanos desde varias representaciones
function normalizarBool(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) {
    return v.data[0] === 1;
  }

  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "1" || s === "true" || s === "si" || s === "sí";
  }
  return true;
}
