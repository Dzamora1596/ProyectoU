//Codigo para la página de registrar empleados
export default function RegistrarEmpleados() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Registrar empleados</h1>
      <p>Gestión de información básica del colaborador</p>

      <div style={{ marginTop: 20, maxWidth: 800 }}>
        <fieldset style={{ padding: 20, marginBottom: 20 }}>
          <legend>Datos personales</legend>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input type="text" placeholder="Nombre" disabled />
            <input type="text" placeholder="Primer apellido" disabled />
            <input type="text" placeholder="Segundo apellido" disabled />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input type="text" placeholder="Identificación" disabled />
            <input type="text" placeholder="Género" disabled />
          </div>
        </fieldset>

        <fieldset style={{ padding: 20, marginBottom: 20 }}>
          <legend>Datos laborales</legend>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input type="text" placeholder="Tipo de empleado" disabled />
            <input type="text" placeholder="Horario" disabled />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input type="date" disabled />
            <input type="text" placeholder="Estado" disabled />
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: 10 }}>
          <button disabled>Guardar empleado</button>
          <button disabled>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
