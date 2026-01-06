//Pagina para registrar la asistencias de los empleados
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  listarColaboradoresParaValidacion,
  crearAsistencia,
  listarAsistenciasPorEmpleado,
} from "../services/asistenciaService";

export default function RegistroAsistencias({ user }) {
  const navigate = useNavigate();

  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  const permitido = rolId === 1 || rolId === 2; // ✅ Admin/Jefatura/Planilla

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // buscar empleado
  const [buscar, setBuscar] = useState("");
  const [colaboradores, setColaboradores] = useState([]);
  const [empleadoIdSel, setEmpleadoIdSel] = useState("");

  // formulario asistencia
  const [fecha, setFecha] = useState("");
  const [entrada, setEntrada] = useState(""); // hora y minutos
  const [salida, setSalida] = useState(""); // hora y minutos
  const [ausente, setAusente] = useState(false);
  const [tardia, setTardia] = useState(false);
  const [observacion, setObservacion] = useState("");

  
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [asistencias, setAsistencias] = useState([]);

  const limpiarMensajes = () => {
    setMsg("");
    setErr("");
  };

  const onBuscarColaboradores = async () => {
    limpiarMensajes();
    setLoading(true);
    try {
      const data = await listarColaboradoresParaValidacion({ buscar: buscar.trim() });
      const lista = data?.colaboradores ?? data?.empleados ?? data ?? [];
      const arr = Array.isArray(lista) ? lista : [];
      setColaboradores(arr);
      setMsg(arr.length ? "Colaboradores cargados." : "No se encontraron colaboradores.");
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error consultando colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  const refrescarAsistencias = async () => {
    if (!empleadoIdSel || !desde || !hasta) return;

    setLoading(true);
    try {
      const data = await listarAsistenciasPorEmpleado({
        empleadoId: Number(empleadoIdSel),
        desde,
        hasta,
      });
      const lista = data?.asistencias ?? data ?? [];
      const arr = Array.isArray(lista) ? lista : [];
      setAsistencias(arr);
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error cargando asistencias.");
      setAsistencias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!empleadoIdSel || !desde || !hasta) {
      setAsistencias([]);
      return;
    }
    refrescarAsistencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoIdSel, desde, hasta]);

  const onGuardar = async () => {
    limpiarMensajes();

    if (!permitido) return setErr("No tiene permisos para registrar asistencias.");
    if (!empleadoIdSel) return setErr("Seleccione un colaborador.");
    if (!fecha) return setErr("Debe indicar la fecha.");

    if (!ausente) {
      if (!entrada) return setErr("Debe indicar la hora de entrada o marcar Ausente.");
      if (!salida) return setErr("Debe indicar la hora de salida o marcar Ausente.");
    }

    
    const payload = {
      Empleado_idEmpleado: Number(empleadoIdSel),
      fecha,
      entrada: ausente ? "" : entrada,
      salida: ausente ? "" : salida,
      ausente: !!ausente,
      tardia: ausente ? false : !!tardia,
      observacion: String(observacion || "").trim(),
    };

    const ok = window.confirm("¿Guardar asistencia? (si ya existe ese día, se actualiza)");
    if (!ok) return;

    setLoading(true);
    try {
      const r = await crearAsistencia(payload);
      setMsg(r?.mensaje || "Asistencia guardada.");
      await refrescarAsistencias();
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error guardando asistencia.");
    } finally {
      setLoading(false);
    }
  };

  if (!permitido) {
    return (
      <div>
        <h1>Registro de asistencias</h1>
        <p>
          <button type="button" onClick={() => navigate("/inicio")}>Volver al inicio</button>
        </p>
        <hr />
        <p><b style={{ color: "crimson" }}>No tiene permisos.</b></p>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1>Registro de asistencias</h1>
        <p>Admin/Jefatura/Planilla registran o actualizan la asistencia.</p>

        <p>
          <button type="button" onClick={() => navigate("/inicio")}>Volver al inicio</button>{" "}
          <button type="button" onClick={() => navigate("/asistencias/validar")}>Ir a Validar Asistencias</button>
        </p>

        {loading && <p><b>Cargando...</b></p>}
        {msg && <p><b>{msg}</b></p>}
        {err && <p><b style={{ color: "crimson" }}>{err}</b></p>}
      </header>

      <hr />

      <fieldset>
        <legend>Buscar colaborador</legend>
        <p>
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Cédula, nombre o idEmpleado"
            size={35}
          />{" "}
          <button type="button" onClick={onBuscarColaboradores} disabled={loading}>Buscar</button>
        </p>

        <p>
          <select
            size={8}
            value={empleadoIdSel}
            onChange={(e) => setEmpleadoIdSel(e.target.value)}
            disabled={loading || colaboradores.length === 0}
          >
            <option value="">-- Seleccione --</option>
            {colaboradores.map((c, idx) => (
              <option key={`${c.idEmpleado}-${idx}`} value={String(c.idEmpleado)}>
                #{c.idEmpleado} - {c.nombreCompleto || "(sin nombre)"}
              </option>
            ))}
          </select>
        </p>
      </fieldset>

      <hr />

      <fieldset>
        <legend>Registrar / Actualizar asistencia</legend>

        <table>
          <tbody>
            <tr>
              <td>Fecha</td>
              <td><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></td>
            </tr>

            <tr>
              <td>Ausente</td>
              <td>
                <input
                  type="checkbox"
                  checked={ausente}
                  onChange={(e) => {
                    const marcado = e.target.checked;
                    setAusente(marcado);
                    if (marcado) {
                      setEntrada("");
                      setSalida("");
                      setTardia(false);
                    }
                  }}
                />{" "}
                (si marca Ausente, no es necesario colocar las horas)
              </td>
            </tr>

            <tr>
              <td>Entrada</td>
              <td>
                <input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} disabled={ausente} />
              </td>
            </tr>

            <tr>
              <td>Salida</td>
              <td>
                <input type="time" value={salida} onChange={(e) => setSalida(e.target.value)} disabled={ausente} />
              </td>
            </tr>

            <tr>
              <td>Tardía</td>
              <td>
                <input type="checkbox" checked={tardia} onChange={(e) => setTardia(e.target.checked)} disabled={ausente} />
              </td>
            </tr>

            <tr>
              <td>Observación</td>
              <td>
                <input value={observacion} onChange={(e) => setObservacion(e.target.value)} size={45} placeholder="Opcional" />
              </td>
            </tr>
          </tbody>
        </table>

        <p>
          <button type="button" onClick={onGuardar} disabled={loading || !empleadoIdSel}>
            Guardar
          </button>
        </p>
      </fieldset>

      <hr />

      <fieldset>
        <legend>Ver asistencias (rango)</legend>

        <table>
          <tbody>
            <tr>
              <td>Desde</td>
              <td><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></td>
            </tr>
            <tr>
              <td>Hasta</td>
              <td><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></td>
            </tr>
          </tbody>
        </table>

        <p>
          <button type="button" onClick={refrescarAsistencias} disabled={loading || !empleadoIdSel || !desde || !hasta}>
            Ver
          </button>
        </p>

        <table border="1" width="100%" cellPadding="6">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Tardía</th>
              <th>Ausente</th>
              <th>Validado</th>
              <th>Obs</th>
            </tr>
          </thead>
          <tbody>
            {!empleadoIdSel ? (
              <tr><td colSpan={8} align="center">Seleccione un colaborador.</td></tr>
            ) : !desde || !hasta ? (
              <tr><td colSpan={8} align="center">Indique Desde y Hasta para ver registros.</td></tr>
            ) : asistencias.length === 0 ? (
              <tr><td colSpan={8} align="center">No hay registros en ese rango.</td></tr>
            ) : (
              asistencias.map((a) => (
                <tr key={a.idAsistencia}>
                  <td>{a.idAsistencia}</td>
                  <td>{String(a.fecha ?? a.Fecha ?? "").slice(0, 10)}</td>
                  <td>{mostrarHora(a.entrada ?? a.Entrada)}</td>
                  <td>{mostrarHora(a.salida ?? a.Salida)}</td>
                  <td align="center">{normalizarBool(a.tardia ?? a.Tardia) ? "Sí" : "No"}</td>
                  <td align="center">{normalizarBool(a.ausente ?? a.Ausente) ? "Sí" : "No"}</td>
                  <td align="center">{normalizarBool(a.validado ?? a.Validado) ? "Sí" : "No"}</td>
                  <td>{a.observacion ?? a.Observacion ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </fieldset>
    </div>
  );
}

// Muestra hora en formato HH:MM o "--" si es 00:00:00 o nulo
function mostrarHora(h) {
  const s = String(h ?? "00:00:00");
  if (s === "00:00:00") return "--";
  return s.slice(0, 5);
}

function normalizarBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "1" || s === "true" || s === "si" || s === "sí";
  }
  if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) return v.data[0] === 1;
  return false;
}
