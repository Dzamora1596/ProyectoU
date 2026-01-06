// Pagina para registrar nuevos usuarios en el sistema
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/autenticar.css";

import { registrarUsuario, obtenerRoles } from "../services/autenticarService";
import { listarEmpleados } from "../services/empleadoService";
import { listarUsuarios } from "../services/usuarioService";

export default function RegistroUsuarios({ user, onLogout }) {
  const [empleadoId, setEmpleadoId] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");

  const [roles, setRoles] = useState([]);
  const [rolId, setRolId] = useState("");

  const [empleados, setEmpleados] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const rolTexto = user?.rolNombre || user?.rol || user?.nombreRol || "";

  // Normalizadores en caso de que los objetos tengan distintos nombres de campos
  const empleadosNormalizados = useMemo(() => {
    return (empleados || []).map((e) => {
      const idEmpleado = e.idEmpleado ?? e.IdEmpleado ?? e.Empleado_idEmpleado ?? e.id;
      const activo = normalizarActivo(e.Activo ?? e.activo);
      return { ...e, idEmpleado: Number(idEmpleado), activo };
    });
  }, [empleados]);

  const usuariosNormalizados = useMemo(() => {
    return (usuarios || []).map((u) => {
      const empleadoIdU =
        u.empleadoId ??
        u.Empleado_idEmpleado ??
        u.empleado_idEmpleado ??
        u.idEmpleado ??
        u.Empleado ??
        "";
      return { ...u, empleadoId: Number(empleadoIdU) };
    });
  }, [usuarios]);

  // Set para saber qué empleados ya tienen usuario
  const empleadosConUsuarioSet = useMemo(() => {
    const s = new Set();
    for (const u of usuariosNormalizados) {
      if (!Number.isNaN(u.empleadoId)) s.add(Number(u.empleadoId));
    }
    return s;
  }, [usuariosNormalizados]);

  // Empleados disponibles para asignar usuario 
  const empleadosDisponibles = useMemo(() => {
    return empleadosNormalizados
      .filter((e) => e.activo !== false)
      .filter((e) => !empleadosConUsuarioSet.has(Number(e.idEmpleado)))
      .sort((a, b) => Number(a.idEmpleado) - Number(b.idEmpleado));
  }, [empleadosNormalizados, empleadosConUsuarioSet]);

  useEffect(() => {
    const cargarTodo = async () => {
      setLoading(true);
      setMsg("");
      setErr("");

      try {
        const [dataRoles, dataEmpleados, dataUsuarios] = await Promise.all([
          obtenerRoles(),       
          listarEmpleados(),     
          listarUsuarios(),      
        ]);

        const listaRoles = dataRoles?.roles ?? [];
        const listaEmpleados =
          dataEmpleados?.empleados ?? dataEmpleados?.rows ?? dataEmpleados?.data ?? dataEmpleados ?? [];
        const listaUsuarios =
          dataUsuarios?.usuarios ?? dataUsuarios?.rows ?? dataUsuarios?.data ?? dataUsuarios ?? [];

        setRoles(Array.isArray(listaRoles) ? listaRoles : []);
        setEmpleados(Array.isArray(listaEmpleados) ? listaEmpleados : []);
        setUsuarios(Array.isArray(listaUsuarios) ? listaUsuarios : []);

        // Rol por defecto
        if (Array.isArray(listaRoles) && listaRoles.length > 0) {
          setRolId(String(listaRoles[0].idRol));
        } else {
          setRolId("");
        }
      } catch (e) {
        setRoles([]);
        setRolId("");
        setEmpleados([]);
        setUsuarios([]);
        setErr(e?.response?.data?.mensaje || "Error cargando roles/empleados/usuarios");
      } finally {
        setLoading(false);
      }
    };

    cargarTodo();
  }, []);

  // Si hay empleados disponibles y no hay empleadoId seleccionado, pone el primero
  useEffect(() => {
    if (!empleadoId && empleadosDisponibles.length > 0) {
      setEmpleadoId(String(empleadosDisponibles[0].idEmpleado));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadosDisponibles.length]);

  const limpiar = () => {
    setMsg("");
    setErr("");
    setNombreUsuario("");
    setPassword("");
    setRolId(roles?.[0]?.idRol ? String(roles[0].idRol) : "");
    setEmpleadoId(empleadosDisponibles?.[0]?.idEmpleado ? String(empleadosDisponibles[0].idEmpleado) : "");
  };

  const refrescarListas = async () => {
    const [eData, uData] = await Promise.all([listarEmpleados(), listarUsuarios()]);
    const listaEmpleados = eData?.empleados ?? eData?.rows ?? eData?.data ?? eData ?? [];
    const listaUsuarios = uData?.usuarios ?? uData?.rows ?? uData?.data ?? uData ?? [];
    setEmpleados(Array.isArray(listaEmpleados) ? listaEmpleados : []);
    setUsuarios(Array.isArray(listaUsuarios) ? listaUsuarios : []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      const payload = {
        empleadoId: Number(empleadoId),
        nombreUsuario: String(nombreUsuario).trim(),
        password: String(password),
        rolId: Number(rolId),
      };

      const data = await registrarUsuario(payload);
      setMsg(data?.mensaje || "Usuario creado correctamente");

      // refresca para que el empleado recién usado desaparezca del combo
      await refrescarListas();
      limpiar();
    } catch (e2) {
      setErr(e2?.response?.data?.mensaje || "Error creando usuario");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="auth-title" style={{ marginBottom: 6 }}>
              Registrar Usuario
            </h1>
            <p className="auth-subtitle" style={{ marginTop: 0 }}>
              {user ? (
                <>
                  Bienvenido, <b>{user?.nombreUsuario}</b> {rolTexto ? `(${rolTexto})` : ""}
                </>
              ) : (
                <>Crea usuarios y asigna su rol en el sistema.</>
              )}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/inicio">
              <button className="auth-secondary" type="button">Volver a Inicio</button>
            </Link>
            {typeof onLogout === "function" && (
              <button className="auth-danger" type="button" onClick={onLogout}>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>

        {/* Mensajes */}
        {msg && <div className="auth-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}

        {/* Form */}
        <div style={{ marginTop: 16, borderTop: "1px solid #1f2937", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: "0 0 10px 0" }}>Nuevo Usuario</h2>
            <span style={{ opacity: 0.85, fontSize: 13 }}>
              {loading
                ? "Cargando..."
                : empleadosDisponibles.length > 0
                ? `Empleados sin usuario: ${empleadosDisponibles.length}`
                : "No hay empleados disponibles (sin usuario)"}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {/* ✅ Empleado (solo los que NO tienen usuario) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Empleado</label>
                <select
                  className="auth-input"
                  value={empleadoId}
                  onChange={(e) => setEmpleadoId(e.target.value)}
                  required
                  disabled={loading || empleadosDisponibles.length === 0}
                >
                  {empleadosDisponibles.length === 0 ? (
                    <option value="">No hay empleados disponibles</option>
                  ) : (
                    empleadosDisponibles.map((emp) => (
                      <option key={emp.idEmpleado} value={emp.idEmpleado}>
                        {emp.idEmpleado}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <Campo
                label="Nombre de usuario"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                placeholder="Ej: juan.perez"
                required
              />

              <Campo
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-label">Rol</label>
                <select
                  className="auth-input"
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                  required
                  disabled={loading || roles.length === 0}
                >
                  {roles.length === 0 ? (
                    <option value="">No hay roles disponibles</option>
                  ) : (
                    roles.map((r) => (
                      <option key={r.idRol} value={r.idRol}>
                        {r.nombreRol}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                className="auth-button"
                type="submit"
                disabled={loading || roles.length === 0 || empleadosDisponibles.length === 0}
              >
                Crear usuario
              </button>

              <button className="auth-secondary" type="button" onClick={limpiar}>
                Limpiar
              </button>
            </div>
          </form>
        </div>

        {/* Nota */}
        <div style={{ marginTop: 14, opacity: 0.85, fontSize: 13 }}>
          * El combo de Empleado muestra únicamente empleados <b>sin usuario</b>.
        </div>
      </div>
    </div>
  );
}

// Componente Campo reutilizable para inputs

function Campo({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label className="auth-label">{label}</label>
      <input className="auth-input" {...props} />
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
