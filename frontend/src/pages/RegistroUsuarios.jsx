// Página para registrar nuevos usuarios en el sistema
import { useEffect, useState } from "react";
import { registrarUsuario, obtenerRoles } from "../services/autenticarService";
import "../styles/autenticar.css";

export default function RegistroUsuarios() {
  const [empleadoId, setEmpleadoId] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");

  const [roles, setRoles] = useState([]);
  const [rolId, setRolId] = useState("");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const cargarRoles = async () => {
      try {
        const data = await obtenerRoles(); // GET /api/autenticar/roles
        const lista = data?.roles;

        if (Array.isArray(lista) && lista.length > 0) {
          setRoles(lista);
          setRolId(String(lista[0].idRol));
        } else {
          setRoles([]);
          setRolId("");
        }
      } catch {
        setRoles([]);
        setRolId("");
      }
    };

    cargarRoles();
  }, []);

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
      setEmpleadoId("");
      setNombreUsuario("");
      setPassword("");
      setRolId(roles?.[0]?.idRol ? String(roles[0].idRol) : "");
    } catch (e2) {
      setErr(e2.response?.data?.mensaje || "Error creando usuario");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Encabezado para Registro de usuarios */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Registro de usuarios</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Crea usuarios y asigna su rol en el sistema.
          </p>
        </div>
      </div>

      {/* Card principal */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 12,
          padding: 18,
          border: "1px solid #e5e7eb",
          maxWidth: 900,
        }}
      >
        {/* Barra superior (acciones/estado) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Formulario</h2>

          {/* Indicador simple */}
          <span
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            Estado: {rolId ? "Listo para crear" : "Roles no disponibles"}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <label style={{ fontWeight: 600, fontSize: 13 }}>ID Empleado</label>
              <input
                type="number"
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                placeholder="Ej: 2615"
                required
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Nombre de usuario</label>
              <input
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                placeholder="Ej: juan.perez"
                required
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Rol</label>
              <select
                value={rolId}
                onChange={(e) => setRolId(e.target.value)}
                required
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "white",
                }}
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

          {/* Botón y mensajes */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={!rolId}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: rolId ? "#111827" : "#9ca3af",
                color: "white",
                cursor: rolId ? "pointer" : "not-allowed",
              }}
            >
              Crear usuario
            </button>

            <button
              type="button"
              onClick={() => {
                setMsg("");
                setErr("");
                setEmpleadoId("");
                setNombreUsuario("");
                setPassword("");
                setRolId(roles?.[0]?.idRol ? String(roles[0].idRol) : "");
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
          </div>

          {msg && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
              }}
            >
              {msg}
            </div>
          )}

          {err && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
              }}
            >
              {err}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
