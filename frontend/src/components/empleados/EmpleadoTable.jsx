import { useEffect, useState } from "react";
import { obtenerEmpleados } from "../../services/empleadoService";

const EmpleadoTable = () => {
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarEmpleados = async () => {
      try {
        const data = await obtenerEmpleados();
        setEmpleados(data);
      } catch (err) {
        setError("Error al cargar empleados");
        console.error(err);
      }
    };

    cargarEmpleados();
  }, []);

  if (error) return <p>{error}</p>;

  return (
    <div>
      <h2>Empleados</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Fecha Ingreso</th>
            <th>Activo</th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((emp) => (
            <tr key={emp.idEmpleado}>
              <td>{emp.idEmpleado}</td>
              <td>{emp.Nombre}</td>
              <td>{new Date(emp.FechaIngreso).toLocaleDateString()}</td>
              <td>{emp.Activo ? "Sí" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EmpleadoTable;
