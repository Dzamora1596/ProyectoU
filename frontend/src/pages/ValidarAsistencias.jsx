// Página para validar asistencias de colaboradores
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  setAuth,
  listarColaboradoresParaValidacion,
  listarAsistenciasPorEmpleado,
  validarTodoPeriodo,
  validarLote,
} from "../services/asistenciaService";

export default function ValidarAsistencias({ user }) {
  const navigate = useNavigate();

  // Header x-rol-id para backend que indica el rol del usuario
  useEffect(() => {
    setAuth(user);
  }, [user]);

  const rolId = Number(user?.rolId ?? user?.Rol_idRol ?? user?.rol_id ?? user?.idRol ?? 0);
  const permitido = rolId === 1 || rolId === 2 || rolId === 3; 

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [buscar, setBuscar] = useState("");
  const [colaboradores, setColaboradores] = useState([]);
  const [empleadoIdSel, setEmpleadoIdSel] = useState("");

  const [asistencias, setAsistencias] = useState([]);

  const cambiosPendientes = useMemo(
    () => asistencias.filter((a) => a.__dirty),
    [asistencias]
  );
  const hayCambios = cambiosPendientes.length > 0;

  const limpiarMensajes = () => {
    setMsg("");
    setErr("");
  };

  const validarRango = () => {
    if (!desde || !hasta) {
      setErr("Debe indicar Desde y Hasta.");
      return false;
    }
    if (new Date(desde) > new Date(hasta)) {
      setErr("Rango inválido: Desde no puede ser mayor que Hasta.");
      return false;
    }
    return true;
  };

  const onBuscarColaboradores = async () => {
    limpiarMensajes();
    if (!validarRango()) return;

    setLoading(true);
    try {
      const data = await listarColaboradoresParaValidacion({
        buscar: buscar.trim(),
      });

      const lista = data?.colaboradores ?? data?.empleados ?? data ?? [];
      const arr = Array.isArray(lista) ? lista : [];

      setColaboradores(arr);
      setMsg(arr.length ? "Colaboradores cargados." : "No se encontraron colaboradores.");
      setEmpleadoIdSel("");
      setAsistencias([]);
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error consultando colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  // Carga las asistencias al cambiar empleado o fechas
  useEffect(() => {
    const cargar = async () => {
      if (!empleadoIdSel) return;
      if (!validarRango()) return;

      limpiarMensajes();
      setLoading(true);
      try {
        const data = await listarAsistenciasPorEmpleado({
          empleadoId: Number(empleadoIdSel),
          desde,
          hasta,
        });

        const lista = data?.asistencias ?? data ?? [];
        const arr = Array.isArray(lista) ? lista : [];
        setAsistencias(arr.map(normalizarAsistencia));
      } catch (e) {
        setErr(e?.response?.data?.mensaje || "Error cargando asistencias.");
        setAsistencias([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoIdSel, desde, hasta]);

  const onToggleValidado = (idx) => {
    setAsistencias((prev) => {
      const copy = [...prev];
      const x = { ...copy[idx] };
      x.validado = !x.validado;
      x.__dirty = true;
      copy[idx] = x;
      return copy;
    });
  };

  const onGuardarValidaciones = async () => {
    limpiarMensajes();
    if (!empleadoIdSel) return setErr("Seleccione un colaborador.");
    if (!validarRango()) return;
    if (!hayCambios) return setErr("No hay cambios para guardar.");

    const ok = window.confirm(
      `¿Guardar ${cambiosPendientes.length} cambio(s) de validación?`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const cambios = cambiosPendientes
        .filter((a) => a.idAsistencia)
        .map((a) => ({
          idAsistencia: Number(a.idAsistencia),
          validado: !!a.validado,
        }));

      const r = await validarLote({ cambios });
      setMsg(r?.mensaje || "Validaciones guardadas.");

      //  refresca la lista
      const data = await listarAsistenciasPorEmpleado({
        empleadoId: Number(empleadoIdSel),
        desde,
        hasta,
      });
      const lista = data?.asistencias ?? data ?? [];
      const arr = Array.isArray(lista) ? lista : [];
      setAsistencias(arr.map(normalizarAsistencia));
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error guardando validaciones.");
    } finally {
      setLoading(false);
    }
  };

  const onValidarTodoPeriodo = async () => {
    limpiarMensajes();
    if (!validarRango()) return;

    const ok = window.confirm(`¿Validar todo el período ${desde} a ${hasta}?`);
    if (!ok) return;

    setLoading(true);
    try {
      const r = await validarTodoPeriodo({ desde, hasta });
      setMsg(r?.mensaje || "Período validado.");

      if (empleadoIdSel) {
        const data = await listarAsistenciasPorEmpleado({
          empleadoId: Number(empleadoIdSel),
          desde,
          hasta,
        });
        const lista = data?.asistencias ?? data ?? [];
        const arr = Array.isArray(lista) ? lista : [];
        setAsistencias(arr.map(normalizarAsistencia));
      }
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "Error validando período.");
    } finally {
      setLoading(false);
    }
  };

  // Bloqueo de acceso según rol
  if (!permitido) {
    return (
      <div>
        <h1>Validar asistencias</h1>
        <p>
          <button type="button" onClick={() => navigate("/inicio")}>
            Volver al inicio
          </button>
        </p>
        <hr />
        <p>
          <b style={{ color: "crimson" }}>
            No tiene permisos para entrar aquí.
          </b>
        </p>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1>Validar asistencias</h1>
        <p>Planilla valida registros digitados por Administrador y Jefatura.</p>

        <p>
          <button type="button" onClick={() => navigate("/inicio")}>
            Volver al inicio
          </button>
        </p>

        {loading && (
          <p>
            <b>Cargando...</b>
          </p>
        )}
        {msg && (
          <p>
            <b>{msg}</b>
          </p>
        )}
        {err && (
          <p>
            <b style={{ color: "crimson" }}>{err}</b>
          </p>
        )}
      </header>

      <hr />

      <fieldset>
        <legend>Filtros</legend>
        <table>
          <tbody>
            <tr>
              <td>Desde</td>
              <td>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td>Hasta</td>
              <td>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td>Buscar colaborador</td>
              <td>
                <input
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Cédula, nombre o idEmpleado"
                  size={35}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p>
          <button type="button" onClick={onBuscarColaboradores} disabled={loading}>
            Buscar
          </button>{" "}
          <button type="button" onClick={onValidarTodoPeriodo} disabled={loading}>
            Validar todo el período
          </button>{" "}
          <button
            type="button"
            onClick={onGuardarValidaciones}
            disabled={loading || !hayCambios}
          >
            Guardar validaciones
          </button>
          {hayCambios ? (
            <span> &nbsp; (* pendientes: {cambiosPendientes.length})</span>
          ) : null}
        </p>
      </fieldset>

      <hr />

      <table width="100%" cellPadding="10">
        <tbody>
          <tr>
            <td width="30%" valign="top">
              <fieldset>
                <legend>Colaboradores</legend>

                <select
                  size={10}
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
              </fieldset>
            </td>

            <td width="70%" valign="top">
              <fieldset>
                <legend>Detalle</legend>

                <table border="1" width="100%" cellPadding="6">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Fecha</th>
                      <th>Entrada</th>
                      <th>Salida</th>
                      <th>Ausente</th>
                      <th>Validado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!empleadoIdSel ? (
                      <tr>
                        <td colSpan={7} align="center">
                          Seleccione un colaborador.
                        </td>
                      </tr>
                    ) : asistencias.length === 0 ? (
                      <tr>
                        <td colSpan={7} align="center">
                          No hay registros en ese rango.
                        </td>
                      </tr>
                    ) : (
                      asistencias.map((a, idx) => (
                        <tr key={a.__key}>
                          <td>{a.idAsistencia}</td>
                          <td>{a.fecha}</td>
                          <td>{mostrarHora(a.entrada)}</td>
                          <td>{mostrarHora(a.salida)}</td>
                          <td align="center">{a.ausente ? "Sí" : "No"}</td>
                          <td align="center">
                            {a.validado ? "Sí" : "No"} {a.__dirty ? "*" : ""}
                          </td>
                          <td>
                            <button type="button" onClick={() => onToggleValidado(idx)}>
                              Alternar Validado
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </fieldset>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Muestra hora en formato HH:MM o "--" si es 00:00:00 o nulo
function mostrarHora(h) {
  const s = String(h ?? "00:00:00");
  if (s === "00:00:00") return "--";
  return s.slice(0, 5);
}

function normalizarAsistencia(x) {
  const idAsistencia = x?.idAsistencia ?? x?.IdAsistencia ?? x?.id ?? "";
  const fecha = String(x?.fecha ?? x?.Fecha ?? "").slice(0, 10);

  return {
    idAsistencia,
    fecha,
    entrada: String(x?.entrada ?? x?.Entrada ?? "00:00:00"),
    salida: String(x?.salida ?? x?.Salida ?? "00:00:00"),
    ausente: normalizarBool(x?.ausente ?? x?.Ausente ?? false),
    validado: normalizarBool(x?.validado ?? x?.Validado ?? false),
    __dirty: false,
    __key: `id-${idAsistencia || Math.random().toString(16).slice(2)}`,
  };
}
// Normaliza valores booleanos desde varios tipos
function normalizarBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "1" || s === "true" || s === "si" || s === "sí";
  }
  if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) {
    return v.data[0] === 1;
  }
  return false;
}
