// HorasExtra.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import {
  obtenerCatalogosEstadosPorModulo,
  obtenerCatalogosTiposHoraExtra,
} from "../../api/catalogosApi";
import { listarEmpleados } from "../../api/empleadosApi";
import {
  calcularHorasExtra,
  listarHorasExtra,
  cambiarEstadoHoraExtra,
} from "../../api/horasExtraApi";

function pad2(n) {
  const x = Number(n || 0);
  return String(x).padStart(2, "0");
}

function ymd(d) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function parseYmd(s) {
  const t = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [yy, mm, dd] = t.split("-").map((x) => Number(x));
  const dt = new Date(yy, mm - 1, dd);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function clampMinMaxDate(s, min, max) {
  const d = parseYmd(s);
  if (!d) return "";
  if (min && d < min) return ymd(min);
  if (max && d > max) return ymd(max);
  return ymd(d);
}

function getEmpleadoId(e) {
  return Number(e?.idEmpleado ?? e?.Empleado_idEmpleado ?? e?.id ?? e?.ID ?? 0) || 0;
}

function getEmpleadoNombre(e) {
  const nombre =
    e?.nombre ??
    e?.Nombre ??
    e?.nombres ??
    e?.Nombres ??
    e?.Nombre_Completo ??
    e?.nombreCompleto ??
    "";

  const ap1 = e?.apellido1 ?? e?.Apellido1 ?? e?.primerApellido ?? e?.Primer_Apellido ?? "";
  const ap2 = e?.apellido2 ?? e?.Apellido2 ?? e?.segundoApellido ?? e?.Segundo_Apellido ?? "";

  const full = String(e?.nombreCompleto ?? e?.NombreCompleto ?? e?.Nombre_Completo ?? "").trim();
  if (full) return full;

  const parts = [nombre, ap1, ap2]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join(" ");

  const fallback = String(e?.correo ?? e?.email ?? e?.Email ?? "").trim();
  return fallback || "(sin nombre)";
}

export default function HorasExtra() {
  const [tiposHoraExtra, setTiposHoraExtra] = useState([]);
  const [estadosHoraExtra, setEstadosHoraExtra] = useState([]);

   
  const [modoPeriodo, setModoPeriodo] = useState("RANGO");  
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;  
  });

  
  const [empleados, setEmpleados] = useState([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);
  const [showEmpleados, setShowEmpleados] = useState(false);
  const [busquedaEmpleado, setBusquedaEmpleado] = useState("");
  const [empleadoFiltroId, setEmpleadoFiltroId] = useState(""); // string

  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

   
  useEffect(() => {
    const now = new Date();
    setDesde(ymd(startOfMonth(now)));
    setHasta(ymd(endOfMonth(now)));
  }, []);

  useEffect(() => {
    if (modoPeriodo !== "MES") return;
    const m = String(mes || "").trim();
    if (!/^\d{4}-\d{2}$/.test(m)) return;

    const [yy, mm] = m.split("-").map((x) => Number(x));
    const base = new Date(yy, mm - 1, 1);
    setDesde(ymd(startOfMonth(base)));
    setHasta(ymd(endOfMonth(base)));
  }, [mes, modoPeriodo]);

  useEffect(() => {
    let mounted = true;

    async function cargarCatalogos() {
      setCargando(true);
      setError("");
      setMensaje("");

      try {
        const [resTipos, resEstados] = await Promise.all([
          obtenerCatalogosTiposHoraExtra(),
          obtenerCatalogosEstadosPorModulo({ modulo: "HORA_EXTRA" }),
        ]);

        const listaTipos = Array.isArray(resTipos?.tiposHoraExtra) ? resTipos.tiposHoraExtra : [];
        const listaEstados = Array.isArray(resEstados?.estados) ? resEstados.estados : [];

        if (mounted) {
          setTiposHoraExtra(listaTipos);
          setEstadosHoraExtra(listaEstados);
        }
      } catch (e) {
        if (mounted) {
          setError(
            e?.response?.data?.mensaje ||
              e?.response?.data?.message ||
              e?.message ||
              "Error cargando catálogos"
          );
        }
      } finally {
        if (mounted) setCargando(false);
      }
    }

    cargarCatalogos();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function cargarEmpleados() {
      setCargandoEmpleados(true);
      try {
        const r = await listarEmpleados();
        const data = r?.ok ? r : r?.data?.ok ? r.data : r?.data || r || {};

        const list = Array.isArray(data?.empleados)
          ? data.empleados
          : Array.isArray(data)
          ? data
          : [];

        if (mounted) setEmpleados(list);
      } catch {
        if (mounted) setEmpleados([]);
      } finally {
        if (mounted) setCargandoEmpleados(false);
      }
    }

    cargarEmpleados();

    return () => {
      mounted = false;
    };
  }, []);

  function getEstadoIdPorDescripcion(desc) {
    const d = String(desc || "").trim().toUpperCase();
    const found = estadosHoraExtra.find(
      (x) => String(x.descripcion || "").trim().toUpperCase() === d
    );
    return found ? Number(found.id) : 0;
  }

  const estadoAprobadoId = getEstadoIdPorDescripcion("APROBADO");
  const estadoRechazadoId = getEstadoIdPorDescripcion("RECHAZADO");

  const rangoValido = useMemo(() => {
    const d = parseYmd(desde);
    const h = parseYmd(hasta);
    if (!d || !h) return false;
    return d.getTime() <= h.getTime();
  }, [desde, hasta]);

  const resumenPeriodoUI = useMemo(() => {
    if (!desde || !hasta) return "";
    return modoPeriodo === "MES" ? `${desde} a ${hasta} (mes)` : `${desde} a ${hasta} (rango)`;
  }, [modoPeriodo, desde, hasta]);

  const empleadoFiltroObj = useMemo(() => {
    const id = Number(empleadoFiltroId || 0);
    if (!id) return null;
    return empleados.find((emp) => getEmpleadoId(emp) === id) || null;
  }, [empleadoFiltroId, empleados]);

  const empleadosFiltradosModal = useMemo(() => {
    const q = String(busquedaEmpleado || "").trim().toLowerCase();
    const list = Array.isArray(empleados) ? empleados : [];
    if (!q) return list;

    return list.filter((emp) => {
      const id = String(getEmpleadoId(emp));
      const name = String(getEmpleadoNombre(emp)).toLowerCase();
      return id.includes(q) || name.includes(q);
    });
  }, [empleados, busquedaEmpleado]);

  async function cargarListado() {
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      const empleadoIdNum = Number(empleadoFiltroId || 0);

      const params = {
        desde: desde || undefined,
        hasta: hasta || undefined,
        estado: estadoFiltro || undefined,
        empleadoId: empleadoIdNum || undefined,
      };

      const res = await listarHorasExtra(params);
      setDatos(Array.isArray(res) ? res : []);
      setMensaje(resumenPeriodoUI ? `Mostrando: ${resumenPeriodoUI}` : "");
    } catch (e) {
      setError(
        e?.response?.data?.mensaje ||
          e?.response?.data?.message ||
          e?.message ||
          "Error cargando horas extra"
      );
    } finally {
      setCargando(false);
    }
  }

  async function ejecutarCalculo() {
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      const d = parseYmd(desde);
      const h = parseYmd(hasta);
      if (!d || !h || d > h) {
        setError("Rango inválido. Verifique Desde/Hasta.");
        setCargando(false);
        return;
      }

      const res = await calcularHorasExtra({ desde, hasta });
      setMensaje(`Cálculo ejecutado. Insertadas: ${res?.totalInsertadas || 0}`);
      await cargarListado();
    } catch (e) {
      setError(
        e?.response?.data?.mensaje ||
          e?.response?.data?.message ||
          e?.message ||
          "Error calculando horas extra"
      );
    } finally {
      setCargando(false);
    }
  }

  async function actualizarEstado(idExtra, estadoId) {
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      await cambiarEstadoHoraExtra(idExtra, estadoId);
      setMensaje("Estado actualizado");
      await cargarListado();
    } catch (e) {
      setError(
        e?.response?.data?.mensaje ||
          e?.response?.data?.message ||
          e?.message ||
          "Error actualizando estado"
      );
    } finally {
      setCargando(false);
    }
  }

  const helpTipos = useMemo(() => {
    const list = Array.isArray(tiposHoraExtra) ? tiposHoraExtra : [];
    if (!list.length) return "";
    return list
      .map((t) => {
        const pct = Number(t?.PorcentajePago ?? t?.porcentajePago ?? 0);
        const desc = t?.descripcion ?? t?.Descripcion ?? "";
        return `${desc} (${pct * 100}%)`;
      })
      .join(" | ");
  }, [tiposHoraExtra]);

  const maxDesde = hasta ? parseYmd(hasta) : null;
  const minHasta = desde ? parseYmd(desde) : null;

  return (
    <div style={{ padding: 16 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Horas Extra</h2>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div style={{ fontSize: 12, color: "#666" }}>
            {empleadoFiltroObj ? (
              <>
                Filtrando: <b>{getEmpleadoNombre(empleadoFiltroObj)}</b> (ID:{" "}
                {getEmpleadoId(empleadoFiltroObj)})
              </>
            ) : (
              "Filtrando: Todos los empleados"
            )}
          </div>

          <Button
            variant="outline-primary"
            size="sm"
            disabled={cargandoEmpleados || cargando}
            onClick={() => {
              setBusquedaEmpleado("");
              setShowEmpleados(true);
            }}
          >
            {cargandoEmpleados ? (
              <>
                <Spinner size="sm" /> Empleados
              </>
            ) : (
              "Seleccionar empleado"
            )}
          </Button>

          {empleadoFiltroId ? (
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={cargando}
              onClick={() => setEmpleadoFiltroId("")}
            >
              Quitar filtro
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: 10,
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
          }}
        >
          {error}
        </div>
      ) : null}

      {mensaje ? (
        <div
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: 10,
            border: "1px solid #badbcc",
            background: "#d1e7dd",
          }}
        >
          {mensaje}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          marginBottom: 16,
          flexWrap: "wrap",
          marginTop: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
          <label style={{ fontSize: 12, marginBottom: 6 }}>Modo</label>
          <select
            value={modoPeriodo}
            onChange={(ev) => setModoPeriodo(ev.target.value)}
            disabled={cargando}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="RANGO">Rango (fechas)</option>
            <option value="MES">Mes</option>
          </select>
        </div>

        {modoPeriodo === "MES" ? (
          <div style={{ display: "flex", flexDirection: "column", minWidth: 200 }}>
            <label style={{ fontSize: 12, marginBottom: 6 }}>Mes</label>
            <input
              type="month"
              value={mes}
              onChange={(ev) => setMes(ev.target.value)}
              disabled={cargando}
              style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </div>
        ) : null}

        {modoPeriodo === "RANGO" ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>
              <label style={{ fontSize: 12, marginBottom: 6 }}>Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(ev) => setDesde(clampMinMaxDate(ev.target.value, null, maxDesde))}
                disabled={cargando}
                style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>
              <label style={{ fontSize: 12, marginBottom: 6 }}>Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(ev) => setHasta(clampMinMaxDate(ev.target.value, minHasta, null))}
                disabled={cargando}
                style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={cargando}
                onClick={() => {
                  const now = new Date();
                  setDesde(ymd(startOfMonth(now)));
                  setHasta(ymd(endOfMonth(now)));
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#f3f3f3",
                }}
              >
                Este mes
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => {
                  const now = new Date();
                  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  setDesde(ymd(startOfMonth(prev)));
                  setHasta(ymd(endOfMonth(prev)));
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#f3f3f3",
                }}
              >
                Mes anterior
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => {
                  const base = parseYmd(desde) || new Date();
                  const d = new Date(base.getFullYear(), base.getMonth(), 1);
                  setDesde(ymd(new Date(d.getFullYear(), d.getMonth(), 1)));
                  setHasta(ymd(new Date(d.getFullYear(), d.getMonth(), 15)));
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#f3f3f3",
                }}
              >
                Quincena 1
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => {
                  const base = parseYmd(desde) || new Date();
                  const d = new Date(base.getFullYear(), base.getMonth(), 1);
                  setDesde(ymd(new Date(d.getFullYear(), d.getMonth(), 16)));
                  setHasta(ymd(endOfMonth(d)));
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#f3f3f3",
                }}
              >
                Quincena 2
              </button>
            </div>
          </>
        ) : null}

        {modoPeriodo === "MES" ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 170 }}>
              <label style={{ fontSize: 12, marginBottom: 6 }}>Desde</label>
              <input
                type="date"
                value={desde}
                readOnly
                disabled
                style={{
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #e2e2e2",
                  background: "#f7f7f7",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 170 }}>
              <label style={{ fontSize: 12, marginBottom: 6 }}>Hasta</label>
              <input
                type="date"
                value={hasta}
                readOnly
                disabled
                style={{
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #e2e2e2",
                  background: "#f7f7f7",
                }}
              />
            </div>
          </>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
          <label style={{ fontSize: 12, marginBottom: 6 }}>Filtro estado</label>
          <select
            value={estadoFiltro}
            onChange={(ev) => setEstadoFiltro(ev.target.value)}
            disabled={cargando}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="">Todos</option>
            {estadosHoraExtra.map((est) => (
              <option key={est.id} value={est.descripcion}>
                {est.descripcion}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={cargando || !rangoValido}
          onClick={cargarListado}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#f3f3f3",
          }}
        >
          Buscar
        </button>

        <button
          type="button"
          disabled={cargando || !rangoValido}
          onClick={ejecutarCalculo}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#f3f3f3",
          }}
        >
          Calcular horas extra
        </button>
      </div>

      <div style={{ marginBottom: 10, fontSize: 12, color: "#555" }}>
        Tipos registrados (referencia): {helpTipos || "—"}
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f7f7f7" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Empleado
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Fecha
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Inicio
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Fin
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "right" }}>
                Cantidad
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "right" }}>
                Monto
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Tipo
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Estado
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 12 }}>
                  {cargando
                    ? "Cargando..."
                    : "No hay horas extra para mostrar. Configure el rango y presione Buscar."}
                </td>
              </tr>
            ) : (
              datos.map((d) => (
                <tr key={d.idExtra}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.EmpleadoNombre}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {String(d.Fecha || "").slice(0, 10)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.Hora_Inicio}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.Hora_Final}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee", textAlign: "right" }}>
                    {d.Cantidad}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee", textAlign: "right" }}>
                    {d.Monto}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.TipoHoraExtra}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.Estado || ""}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={cargando || !estadoAprobadoId}
                        onClick={() => actualizarEstado(d.idExtra, estadoAprobadoId)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          background: "#f3f3f3",
                        }}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={cargando || !estadoRechazadoId}
                        onClick={() => actualizarEstado(d.idExtra, estadoRechazadoId)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          background: "#f3f3f3",
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        show={showEmpleados}
        onHide={() => setShowEmpleados(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Seleccionar empleado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
            <Form.Group style={{ minWidth: 260, flex: 1 }}>
              <Form.Label style={{ fontSize: 12 }}>Buscar</Form.Label>
              <Form.Control
                value={busquedaEmpleado}
                onChange={(ev) => setBusquedaEmpleado(ev.target.value)}
                placeholder="Nombre o ID…"
              />
            </Form.Group>

            <Button
              variant="outline-secondary"
              onClick={() => setEmpleadoFiltroId("")}
              disabled={!empleadoFiltroId}
            >
              Todos
            </Button>

            <Button variant="primary" onClick={() => setShowEmpleados(false)}>
              Listo
            </Button>
          </div>

          <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
            <Table hover responsive className="mb-0">
              <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <tr>
                  <th style={{ width: 110 }}>ID</th>
                  <th>Empleado</th>
                  <th style={{ width: 180 }}></th>
                </tr>
              </thead>
              <tbody>
                {cargandoEmpleados ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center">
                      <Spinner /> Cargando empleados...
                    </td>
                  </tr>
                ) : empleadosFiltradosModal.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted">
                      No hay resultados
                    </td>
                  </tr>
                ) : (
                  empleadosFiltradosModal.map((emp) => {
                    const id = getEmpleadoId(emp);
                    if (!id) return null;
                    const selected = Number(empleadoFiltroId || 0) === id;

                    return (
                      <tr key={`emp-${id}`}>
                        <td className="align-middle">{id}</td>
                        <td className="align-middle">
                          <div style={{ fontWeight: 600 }}>{getEmpleadoNombre(emp)}</div>
                        </td>
                        <td className="align-middle text-end">
                          <Button
                            size="sm"
                            variant={selected ? "success" : "outline-primary"}
                            onClick={() => setEmpleadoFiltroId(String(id))}
                          >
                            {selected ? "Seleccionado" : "Seleccionar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-3" style={{ fontSize: 12, color: "#666" }}>
            Este filtro afecta solo el <b>listado</b> (Buscar).
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
