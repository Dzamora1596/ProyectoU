//Para la página de Validar Asistencias
export default function ValidarAsistencias() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Validar asistencias</h1>
      <p>Por favor confirmar las asistencias antes del cálculo de planilla.</p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <div style={{ minWidth: 260 }}>
          <label>Período</label>
          <input
            type="text"
            placeholder="Ej: 2025-12-01 a 2025-12-15"
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ minWidth: 220 }}>
          <label>Departamento</label>
          <input
            type="text"
            placeholder="Ej: Operaciones"
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <label>Buscar colaborador</label>
          <input
            type="text"
            placeholder="Nombre o ID"
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
          <button style={{ padding: "10px 12px" }}>Buscar</button>
          <button style={{ padding: "10px 12px" }}>Validar todo el período</button>
          <button style={{ padding: "10px 12px" }}>Guardar cambios</button>
        </div>
      </div>

      {/* lista mas detalles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 16,
          marginTop: 20,
        }}
      >
        {/* Lista colaboradores */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Colaboradores</h3>

          <div style={{ opacity: 0.7, fontSize: 14 }}>
            Aquí se mostrará la lista de colaboradores según el período/filtros.
          </div>

          <div style={{ marginTop: 12 }}>
            <button style={{ width: "100%", padding: 10 }}>
              Seleccionar colaborador (xxxxx)
            </button>
          </div>
        </div>

        {/* Detalle asistencias */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Detalle de asistencias</h3>
          <p style={{ opacity: 0.8, marginTop: 0 }}>
            Seleccione un colaborador para ver entradas, salidas, tardías, ausencias, permisos e incapacidades.
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Fecha", "Entrada", "Salida", "Tardía", "Ausente", "Acciones"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: 10,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Sin datos */}
              <tr>
                <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                  No hay registros para mostrar.
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ padding: "10px 12px" }}>Editar marcación</button>
            <button style={{ padding: "10px 12px" }}>Validar registro</button>
            <button style={{ padding: "10px 12px" }}>Registrar ausencia justificada</button>
            <button style={{ padding: "10px 12px" }}>Registrar permiso</button>
            <button style={{ padding: "10px 12px" }}>Registrar incapacidad</button>
          </div>
        </div>
      </div>
    </div>
  );
}
